"""
YOLOv8-based license plate region detector.

Detects the license plate region within a vehicle crop.
Uses YOLOv8-nano fine-tuned on plate detection.
Falls back to full-image OCR if no plate region found.
"""
import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class PlateRegion:
    """A detected license plate region within a vehicle crop."""
    crop: np.ndarray    # cropped plate image (BGR)
    confidence: float   # detection confidence
    bbox: tuple         # (x1, y1, x2, y2) relative to vehicle crop


class PlateDetector:
    """
    YOLOv8 license plate region detector.

    Runs YOLOv8 inference on a vehicle crop to locate the plate.
    If the model file is missing, falls back to passthrough mode
    (returns None so the full crop is handed to OCR instead).
    """

    def __init__(self, model_path: str, confidence: float = 0.4):
        """
        Initialize the plate detector.

        Args:
            model_path: Path to YOLOv8 plate-detection model (.pt)
            confidence: Minimum detection confidence threshold
        """
        self.confidence = confidence
        self.model = None
        self._fallback_mode = False

        try:
            from pathlib import Path
            if not Path(model_path).exists():
                logger.warning(
                    f"Plate model not found at {model_path} — running in fallback mode "
                    "(full vehicle crop passed to OCR). Download or train a plate detection "
                    "model and set plate.model_path in config.yaml to improve accuracy."
                )
                self._fallback_mode = True
                return

            from ultralytics import YOLO
            self.model = YOLO(model_path)

            # Warmup
            dummy = np.zeros((640, 640, 3), dtype=np.uint8)
            self.model.predict(dummy, verbose=False)
            logger.info(f"Plate detection model loaded: {model_path}")

        except Exception as e:
            logger.warning(f"Failed to load plate model ({e}) — fallback mode active")
            self._fallback_mode = True

    @property
    def is_fallback(self) -> bool:
        """True when running without a plate detection model."""
        return self._fallback_mode

    def detect(self, vehicle_crop: np.ndarray) -> Optional[PlateRegion]:
        """
        Detect the license plate region within a vehicle crop.

        Args:
            vehicle_crop: Cropped BGR image of a vehicle

        Returns:
            PlateRegion with the highest-confidence plate region,
            or None if no plate found (caller should fall back to full-crop OCR).
        """
        if vehicle_crop is None or vehicle_crop.size == 0:
            return None

        if self._fallback_mode or self.model is None:
            # No model — signal caller to do full-crop OCR
            return None

        try:
            results = self.model.predict(
                vehicle_crop,
                conf=self.confidence,
                verbose=False
            )

            best: Optional[PlateRegion] = None
            best_conf = 0.0

            for result in results:
                if result.boxes is None:
                    continue
                for box in result.boxes:
                    conf = float(box.conf[0])
                    if conf < self.confidence or conf <= best_conf:
                        continue

                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

                    # Clamp to image bounds
                    h, w = vehicle_crop.shape[:2]
                    x1 = max(0, x1)
                    y1 = max(0, y1)
                    x2 = min(w, x2)
                    y2 = min(h, y2)

                    if x2 <= x1 or y2 <= y1:
                        continue

                    plate_crop = vehicle_crop[y1:y2, x1:x2].copy()
                    best = PlateRegion(
                        crop=plate_crop,
                        confidence=conf,
                        bbox=(x1, y1, x2, y2)
                    )
                    best_conf = conf

            return best

        except Exception as e:
            logger.debug(f"Plate detection failed: {e}")
            return None
