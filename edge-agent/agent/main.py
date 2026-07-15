"""
OmniCollect Edge Agent — Core detection and counting loop.

Runs on Jetson Orin Nano or Raspberry Pi 5 + Hailo-8 at OOH billboard sites.
Loads YOLOv8n, opens an RTSP stream, counts vehicles crossing a tripwire line,
and POSTs batched sightings to the OmniCollect ingest API every 15 minutes.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import logging
import os
import signal
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import httpx

from tracker import SimpleTracker
from tripwire import TripwireState

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("omnicollect")

AGENT_DIR = Path(__file__).parent
EDGE_DIR = AGENT_DIR.parent
CONFIG_PATH = EDGE_DIR / "config.json"
STATS_PATH = EDGE_DIR / "stats.json"
MODEL_PATH = AGENT_DIR / "yolov8n.pt"

SAMPLE_EVERY: int = int(os.environ.get("SAMPLE_EVERY", "3"))
UPLOAD_INTERVAL_SEC: int = 15 * 60          # 15 minutes
CAMERA_RETRY_SEC: int = 30
INGEST_URL: str = "https://omnicollect.tech/api/ingest"

# COCO vehicle classes of interest
VEHICLE_CLASSES: Dict[int, str] = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}
CONFIDENCE_THRESHOLD: float = 0.4

PADDLE_AVAILABLE: bool = False
_ocr_instance = None

try:
    from paddleocr import PaddleOCR  # type: ignore
    _ocr_instance = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    PADDLE_AVAILABLE = True
    log.info("PaddleOCR loaded — plate hashing enabled")
except Exception:
    log.warning("PaddleOCR not available — plate_hash will be null for all sightings")

REQUIRED_FIELDS = ("api_key", "site_id", "site_name", "camera_url", "zone")


def load_config() -> Dict[str, Any]:
    if not CONFIG_PATH.exists():
        log.error(
            "config.json not found at %s. "
            "Please run the config UI first: python3 config-ui/main.py "
            "then open http://<device-ip>:8080 in your browser.",
            CONFIG_PATH,
        )
        sys.exit(1)

    try:
        cfg = json.loads(CONFIG_PATH.read_text())
    except json.JSONDecodeError as exc:
        log.error("config.json is corrupt: %s", exc)
        sys.exit(1)

    missing = [f for f in REQUIRED_FIELDS if not cfg.get(f)]
    if missing:
        log.error(
            "config.json is incomplete — missing fields: %s. "
            "Re-run the config UI to finish setup.",
            ", ".join(missing),
        )
        sys.exit(1)

    return cfg


def _hash_plate(crop) -> Optional[str]:
    """Return SHA-256 hex of the plate text, or None on failure."""
    if not PADDLE_AVAILABLE or _ocr_instance is None:
        return None
    try:
        import numpy as np
        result = _ocr_instance.ocr(crop, cls=True)
        if not result or not result[0]:
            return None
        text = "".join(line[1][0] for line in result[0] if line and line[1])
        text = text.strip().upper().replace(" ", "")
        if not text:
            return None
        return hashlib.sha256(text.encode()).hexdigest()
    except Exception:
        return None


def write_stats(
    vehicles_today: int,
    last_upload: Optional[str],
    last_upload_status: str,
    uptime_seconds: float,
    camera_ok: bool,
    model_loaded: bool,
) -> None:
    data = {
        "vehicles_today": vehicles_today,
        "last_upload": last_upload,
        "last_upload_status": last_upload_status,
        "uptime_seconds": int(uptime_seconds),
        "camera_ok": camera_ok,
        "model_loaded": model_loaded,
        "paddle_available": PADDLE_AVAILABLE,
    }
    try:
        STATS_PATH.write_text(json.dumps(data, indent=2))
    except Exception as exc:
        log.warning("Could not write stats.json: %s", exc)


def upload_batch(
    api_key: str,
    site_id: str,
    crossing_buffer: List[dict],
) -> bool:
    """POST batch to ingest API. Returns True on success."""
    payload = {
        "api_key": api_key,
        "site_id": site_id,
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "period_minutes": 15,
        "vehicle_count": len(crossing_buffer),
        "sightings": crossing_buffer,
    }
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.post(INGEST_URL, json=payload)
        if r.status_code < 300:
            log.info("Upload OK — %d sightings sent", len(crossing_buffer))
            return True
        log.warning("Upload failed — HTTP %d: %s", r.status_code, r.text[:200])
        return False
    except Exception as exc:
        log.warning("Upload error: %s", exc)
        return False


def open_camera(camera_url: str) -> Optional[cv2.VideoCapture]:
    cap = cv2.VideoCapture(camera_url)
    if cap.isOpened():
        return cap
    cap.release()
    return None


_shutdown_requested: bool = False


def _handle_signal(signum, frame):  # noqa: ANN001
    global _shutdown_requested
    log.info("Shutdown signal received (%s) — flushing and exiting", signum)
    _shutdown_requested = True


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)


def run() -> None:
    cfg = load_config()
    api_key: str = cfg["api_key"]
    site_id: str = cfg["site_id"]
    camera_url: str = cfg["camera_url"]
    zone: List[List[float]] = cfg["zone"]  # [[x1,y1],[x2,y2]] normalised 0-1

    log.info("Starting OmniCollect agent — site: %s (%s)", cfg["site_name"], site_id)
    log.info("Camera: %s", camera_url)
    log.info("Tripwire zone (normalised): %s", zone)
    log.info("SAMPLE_EVERY=%d, UPLOAD_INTERVAL=%ds", SAMPLE_EVERY, UPLOAD_INTERVAL_SEC)

    # Load YOLO model
    from ultralytics import YOLO  # import late so startup errors surface cleanly
    model_loaded: bool = False
    try:
        model = YOLO(str(MODEL_PATH))
        model_loaded = True
        log.info("YOLOv8n model loaded from %s", MODEL_PATH)
    except Exception as exc:
        log.error("Failed to load YOLOv8n model: %s", exc)
        sys.exit(1)

    # State
    tracker = SimpleTracker()
    tripwire = TripwireState(
        line_start=(zone[0][0], zone[0][1]),
        line_end=(zone[1][0], zone[1][1]),
    )
    crossing_buffer: List[dict] = []
    vehicles_today: int = 0
    last_upload_ts: float = time.monotonic()
    last_upload_wall: Optional[str] = None
    last_upload_status: str = "no_upload_yet"
    start_time: float = time.monotonic()
    today_date: datetime.date = datetime.date.today()

    camera_ok: bool = False
    cap: Optional[cv2.VideoCapture] = None
    frame_index: int = 0

    write_stats(
        vehicles_today=0,
        last_upload=None,
        last_upload_status="no_upload_yet",
        uptime_seconds=0,
        camera_ok=False,
        model_loaded=model_loaded,
    )

    while not _shutdown_requested:
        # ---- Midnight reset ----
        current_date = datetime.date.today()
        if current_date != today_date:
            log.info("Midnight rollover — resetting vehicles_today counter")
            vehicles_today = 0
            today_date = current_date

        # ---- Camera connection ----
        if cap is None or not cap.isOpened():
            camera_ok = False
            log.info("Connecting to camera: %s", camera_url)
            cap = open_camera(camera_url)
            if cap is None:
                log.error("Could not open camera stream. Retrying in %ds", CAMERA_RETRY_SEC)
                write_stats(
                    vehicles_today=vehicles_today,
                    last_upload=last_upload_wall,
                    last_upload_status=last_upload_status,
                    uptime_seconds=time.monotonic() - start_time,
                    camera_ok=False,
                    model_loaded=model_loaded,
                )
                time.sleep(CAMERA_RETRY_SEC)
                continue
            camera_ok = True
            log.info("Camera connected")

        # ---- Read frame ----
        ret, frame = cap.read()
        if not ret or frame is None:
            log.warning("Failed to read frame — reconnecting in %ds", CAMERA_RETRY_SEC)
            cap.release()
            cap = None
            camera_ok = False
            time.sleep(CAMERA_RETRY_SEC)
            continue

        frame_index += 1

        # ---- Sampling ----
        if frame_index % SAMPLE_EVERY != 0:
            continue

        frame_h, frame_w = frame.shape[:2]

        # ---- Convert tripwire to pixel coords ----
        line_px_start = (zone[0][0] * frame_w, zone[0][1] * frame_h)
        line_px_end = (zone[1][0] * frame_w, zone[1][1] * frame_h)

        # Update tripwire with current pixel coords (frame size may vary)
        tripwire.line_start = line_px_start
        tripwire.line_end = line_px_end

        # ---- YOLOv8 inference ----
        try:
            results = model(frame, verbose=False)[0]
        except Exception as exc:
            log.warning("Inference error on frame %d: %s — skipping", frame_index, exc)
            continue

        # ---- Parse detections ----
        detections: List[dict] = []
        for box in results.boxes:
            cls_id = int(box.cls[0])
            if cls_id not in VEHICLE_CLASSES:
                continue
            conf = float(box.conf[0])
            if conf < CONFIDENCE_THRESHOLD:
                continue
            x1, y1, x2, y2 = (float(v) for v in box.xyxy[0])
            detections.append({
                "bbox": (x1, y1, x2, y2),
                "class_name": VEHICLE_CLASSES[cls_id],
                "confidence": conf,
            })

        # ---- Tracker update ----
        tracks = tracker.update(detections, frame_index)

        # ---- Tripwire check ----
        for track in tracks:
            crossed = tripwire.check_crossing(track.id, track.centroid)
            if not crossed:
                continue

            vehicles_today += 1
            crossed_at = datetime.datetime.utcnow().isoformat() + "Z"

            # Optional plate hash
            plate_hash: Optional[str] = None
            if PADDLE_AVAILABLE:
                x1, y1, x2, y2 = (int(v) for v in track.bbox)
                crop = frame[max(0, y1):y2, max(0, x1):x2]
                if crop.size > 0:
                    plate_hash = _hash_plate(crop)

            crossing_buffer.append({
                "plate_hash": plate_hash,
                "vehicle_class": track.class_name,
                "confidence": round(track.confidence, 4),
                "crossed_at": crossed_at,
            })
            log.info(
                "Vehicle crossed: class=%s conf=%.2f plate_hash=%s",
                track.class_name,
                track.confidence,
                plate_hash or "null",
            )

        # ---- Periodic upload ----
        now = time.monotonic()
        if now - last_upload_ts >= UPLOAD_INTERVAL_SEC:
            success = False
            if crossing_buffer:
                success = upload_batch(api_key, site_id, crossing_buffer)
            else:
                log.info("Upload interval reached — no sightings to send")
                success = True  # nothing to send, treat as ok

            last_upload_wall = datetime.datetime.utcnow().isoformat() + "Z"
            last_upload_status = "ok" if success else "error"
            last_upload_ts = now

            if success:
                crossing_buffer = []

            write_stats(
                vehicles_today=vehicles_today,
                last_upload=last_upload_wall,
                last_upload_status=last_upload_status,
                uptime_seconds=now - start_time,
                camera_ok=camera_ok,
                model_loaded=model_loaded,
            )

    # ---- Graceful shutdown ----
    log.info("Flushing %d pending sightings before exit...", len(crossing_buffer))
    if crossing_buffer:
        upload_batch(api_key, site_id, crossing_buffer)
    if cap is not None:
        cap.release()
    log.info("Agent stopped cleanly")


if __name__ == "__main__":
    run()
