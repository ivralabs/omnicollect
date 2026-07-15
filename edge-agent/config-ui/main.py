"""
OmniCollect Config UI — FastAPI app (port 8080)
Single-page configuration interface for on-site installers.
"""
import json
import os
import base64
import datetime
from pathlib import Path
from typing import Optional

import httpx
import cv2
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR.parent / "config.json"
STATS_PATH = BASE_DIR.parent / "agent" / "stats.json"

app = FastAPI(docs_url=None, redoc_url=None)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def read_config() -> dict:
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text())
        except Exception:
            pass
    return {}


def write_config(data: dict) -> None:
    existing = read_config()
    existing.update(data)
    CONFIG_PATH.write_text(json.dumps(existing, indent=2))


def read_stats() -> dict:
    if STATS_PATH.exists():
        try:
            return json.loads(STATS_PATH.read_text())
        except Exception:
            pass
    return {"vehicles_today": 0, "last_upload": None}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class VerifyKeyRequest(BaseModel):
    api_key: str


class CameraTestRequest(BaseModel):
    camera_url: str


class ZoneSaveRequest(BaseModel):
    zone: list  # [[x1,y1],[x2,y2]] normalised 0-1


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.post("/api/verify-key")
async def verify_key(body: VerifyKeyRequest):
    """Validate API key against omnicollect.tech and save to config."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                "https://omnicollect.tech/api/sites/verify-key",
                json={"api_key": body.api_key},
            )
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach verification server: {e}")

    if not data.get("valid"):
        raise HTTPException(status_code=401, detail="Invalid API key")

    write_config({
        "api_key": body.api_key,
        "site_id": data["site_id"],
        "site_name": data["site_name"],
    })
    return {"valid": True, "site_name": data["site_name"], "site_id": data["site_id"]}


@app.post("/api/test-camera")
async def test_camera(body: CameraTestRequest):
    """Grab one frame from the RTSP stream and return as base64 JPEG."""
    cap = cv2.VideoCapture(body.camera_url)
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="Could not open camera stream. Check the RTSP URL.")

    ret, frame = cap.read()
    cap.release()

    if not ret or frame is None:
        raise HTTPException(status_code=400, detail="Connected but could not read a frame.")

    # Resize for preview (max 640px wide)
    h, w = frame.shape[:2]
    if w > 640:
        scale = 640 / w
        frame = cv2.resize(frame, (640, int(h * scale)))

    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
    b64 = base64.b64encode(buf.tobytes()).decode()

    write_config({"camera_url": body.camera_url})
    return {"image": f"data:image/jpeg;base64,{b64}"}


@app.post("/api/save-zone")
async def save_zone(body: ZoneSaveRequest):
    """Save tripwire zone coordinates (normalised 0-1) to config."""
    if len(body.zone) != 2:
        raise HTTPException(status_code=400, detail="Zone must be exactly 2 points: [[x1,y1],[x2,y2]]")
    write_config({
        "zone": body.zone,
        "configured_at": datetime.datetime.utcnow().isoformat() + "Z",
    })
    return {"saved": True}


@app.get("/api/status")
async def get_status():
    return {
        "config": read_config(),
        "stats": read_stats(),
    }


# ---------------------------------------------------------------------------
# Single-page HTML app
# ---------------------------------------------------------------------------

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>OmniCollect — Site Setup</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #0f0f0f; color: #e8e8e8; min-height: 100vh; padding: 24px 16px; }
  h1 { font-size: 1.3rem; font-weight: 600; margin-bottom: 4px; }
  .sub { color: #888; font-size: 0.85rem; margin-bottom: 28px; }
  .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px;
          padding: 20px; margin-bottom: 16px; }
  .card h2 { font-size: 0.95rem; font-weight: 600; margin-bottom: 14px; color: #ccc; }
  label { display: block; font-size: 0.82rem; color: #888; margin-bottom: 6px; }
  input[type=text], input[type=password] {
    width: 100%; padding: 10px 12px; background: #111; border: 1px solid #333;
    border-radius: 6px; color: #e8e8e8; font-size: 0.95rem; outline: none; }
  input:focus { border-color: #555; }
  button {
    display: inline-block; padding: 10px 20px; border-radius: 6px; border: none;
    font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: opacity 0.15s; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-primary { background: #22c55e; color: #000; }
  .btn-secondary { background: #2a2a2a; color: #ccc; border: 1px solid #3a3a3a; }
  .btn-row { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
  .msg { font-size: 0.85rem; margin-top: 10px; padding: 8px 12px; border-radius: 6px; }
  .msg.ok  { background: #052e16; color: #4ade80; border: 1px solid #166534; }
  .msg.err { background: #2d0a0a; color: #f87171; border: 1px solid #7f1d1d; }
  #preview-img { max-width: 100%; border-radius: 6px; margin-top: 12px; display: none; }
  #zone-canvas { max-width: 100%; border-radius: 6px; margin-top: 12px; cursor: crosshair;
                 display: none; touch-action: none; }
  .step { display: none; }
  .step.active { display: block; }
  .kv { display: flex; justify-content: space-between; margin-bottom: 8px;
        font-size: 0.85rem; }
  .kv .k { color: #888; }
  .kv .v { color: #ccc; text-align: right; max-width: 60%; word-break: break-all; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
  .badge.green { background: #052e16; color: #4ade80; }
  .badge.grey  { background: #1a1a1a; color: #888; border: 1px solid #333; }
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #444;
             border-top-color: #888; border-radius: 50%; animation: spin 0.7s linear infinite;
             vertical-align: middle; margin-right: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<h1>OmniCollect</h1>
<p class="sub">Site setup</p>

<!-- Step 1: API Key -->
<div class="step active" id="step-key">
  <div class="card">
    <h2>Step 1 — API Key</h2>
    <label for="api-key-input">Paste your site API key (starts with oc_site_)</label>
    <input type="password" id="api-key-input" placeholder="oc_site_..." autocomplete="off" autocorrect="off" spellcheck="false">
    <div class="btn-row">
      <button class="btn-primary" id="btn-verify-key">Verify Key</button>
    </div>
    <div id="key-msg"></div>
  </div>
</div>

<!-- Step 2: Camera -->
<div class="step" id="step-camera">
  <div class="card">
    <h2>Step 2 — Camera</h2>
    <label for="rtsp-input">RTSP stream URL</label>
    <input type="text" id="rtsp-input" placeholder="rtsp://admin:pass@192.168.1.64:554/stream" autocomplete="off" autocorrect="off" spellcheck="false">
    <div class="btn-row">
      <button class="btn-primary" id="btn-test-camera">Test Connection</button>
    </div>
    <div id="camera-msg"></div>
    <img id="preview-img" alt="Camera preview">
    <div class="btn-row" id="camera-confirm-row" style="display:none;">
      <button class="btn-primary" id="btn-confirm-camera">Use this camera — draw zone</button>
    </div>
  </div>
</div>

<!-- Step 3: Zone -->
<div class="step" id="step-zone">
  <div class="card">
    <h2>Step 3 — Tripwire Zone</h2>
    <p style="font-size:0.85rem;color:#888;margin-bottom:10px;">
      Tap two points on the image to define the counting line. Vehicles crossing this line are counted.
    </p>
    <canvas id="zone-canvas"></canvas>
    <div id="zone-msg"></div>
    <div class="btn-row" id="zone-btn-row" style="display:none;">
      <button class="btn-primary" id="btn-save-zone">Save Zone</button>
      <button class="btn-secondary" id="btn-reset-zone">Reset</button>
    </div>
  </div>
</div>

<!-- Step 4: Status -->
<div class="step" id="step-status">
  <div class="card">
    <h2>Configuration</h2>
    <div id="status-config"></div>
  </div>
  <div class="card">
    <h2>Live Stats</h2>
    <div id="status-stats"></div>
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn-secondary" id="btn-redraw">Re-draw Zone</button>
    </div>
  </div>
</div>

<script>
(function () {
  'use strict';

  // ---- State ----
  let currentStep = 'key';
  let cameraImageSrc = null;
  let zonePoints = [];
  let canvasNaturalW = 1, canvasNaturalH = 1;

  // ---- Utils ----
  function show(msg, elId, type) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = msg ? `<div class="msg ${type}">${msg}</div>` : '';
  }

  function setLoading(btnId, loading, label) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading ? `<span class="spinner"></span>${label}` : label;
  }

  function goStep(name) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-' + name).classList.add('active');
    currentStep = name;
    window.scrollTo(0, 0);
  }

  async function api(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || 'Request failed');
    return data;
  }

  // ---- Step 1: API Key ----
  document.getElementById('btn-verify-key').addEventListener('click', async () => {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key) { show('Please enter your API key.', 'key-msg', 'err'); return; }
    setLoading('btn-verify-key', true, 'Verifying...');
    show('', 'key-msg', '');
    try {
      const data = await api('/api/verify-key', { api_key: key });
      show(`Key accepted. Site: <strong>${data.site_name}</strong>`, 'key-msg', 'ok');
      setTimeout(() => goStep('camera'), 800);
    } catch (e) {
      show(e.message, 'key-msg', 'err');
    } finally {
      setLoading('btn-verify-key', false, 'Verify Key');
    }
  });

  // ---- Step 2: Camera ----
  document.getElementById('btn-test-camera').addEventListener('click', async () => {
    const url = document.getElementById('rtsp-input').value.trim();
    if (!url) { show('Please enter a camera URL.', 'camera-msg', 'err'); return; }
    setLoading('btn-test-camera', true, 'Connecting...');
    show('', 'camera-msg', '');
    document.getElementById('camera-confirm-row').style.display = 'none';
    document.getElementById('preview-img').style.display = 'none';
    try {
      const data = await api('/api/test-camera', { camera_url: url });
      const img = document.getElementById('preview-img');
      img.src = data.image;
      img.style.display = 'block';
      cameraImageSrc = data.image;
      show('Camera connected.', 'camera-msg', 'ok');
      document.getElementById('camera-confirm-row').style.display = 'flex';
    } catch (e) {
      show(e.message, 'camera-msg', 'err');
    } finally {
      setLoading('btn-test-camera', false, 'Test Connection');
    }
  });

  document.getElementById('btn-confirm-camera').addEventListener('click', () => {
    if (!cameraImageSrc) return;
    setupZoneCanvas(cameraImageSrc);
    goStep('zone');
  });

  // ---- Step 3: Zone ----
  function setupZoneCanvas(imgSrc) {
    const canvas = document.getElementById('zone-canvas');
    const img = new Image();
    img.onload = () => {
      canvasNaturalW = img.naturalWidth;
      canvasNaturalH = img.naturalHeight;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.style.display = 'block';
      zonePoints = [];
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      show('Tap two points to define the tripwire line.', 'zone-msg', 'ok');
      document.getElementById('zone-btn-row').style.display = 'none';
    };
    img.src = imgSrc;
  }

  function getCanvasPoint(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function drawZoneState(canvas) {
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      if (zonePoints.length === 0) return;
      const p0 = zonePoints[0];
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(p0.x, p0.y, 6, 0, Math.PI * 2);
      ctx.fill();
      if (zonePoints.length === 2) {
        const p1 = zonePoints[1];
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    img.src = cameraImageSrc;
  }

  function handleCanvasTap(e) {
    e.preventDefault();
    const canvas = document.getElementById('zone-canvas');
    if (zonePoints.length >= 2) return;
    const pt = getCanvasPoint(canvas, e);
    zonePoints.push(pt);
    drawZoneState(canvas);
    if (zonePoints.length === 2) {
      show('Line set. Tap "Save Zone" to confirm.', 'zone-msg', 'ok');
      document.getElementById('zone-btn-row').style.display = 'flex';
    } else {
      show('Tap second point to complete the line.', 'zone-msg', 'ok');
    }
  }

  const canvas = document.getElementById('zone-canvas');
  canvas.addEventListener('click', handleCanvasTap);
  canvas.addEventListener('touchend', handleCanvasTap, { passive: false });

  document.getElementById('btn-reset-zone').addEventListener('click', () => {
    zonePoints = [];
    drawZoneState(canvas);
    show('Tap two points to define the tripwire line.', 'zone-msg', 'ok');
    document.getElementById('zone-btn-row').style.display = 'none';
  });

  document.getElementById('btn-save-zone').addEventListener('click', async () => {
    if (zonePoints.length < 2) { show('Please tap two points first.', 'zone-msg', 'err'); return; }
    const zone = zonePoints.map(p => [
      parseFloat((p.x / canvasNaturalW).toFixed(4)),
      parseFloat((p.y / canvasNaturalH).toFixed(4)),
    ]);
    setLoading('btn-save-zone', true, 'Saving...');
    try {
      await api('/api/save-zone', { zone });
      show('Zone saved.', 'zone-msg', 'ok');
      setTimeout(() => { loadStatus(); goStep('status'); }, 600);
    } catch (e) {
      show(e.message, 'zone-msg', 'err');
    } finally {
      setLoading('btn-save-zone', false, 'Save Zone');
    }
  });

  // ---- Step 4: Status ----
  function kv(k, v, badge) {
    const val = badge
      ? `<span class="badge ${badge}">${v}</span>`
      : `<span class="v">${v || '—'}</span>`;
    return `<div class="kv"><span class="k">${k}</span>${val}</div>`;
  }

  async function loadStatus() {
    try {
      const r = await fetch('/api/status');
      const { config, stats } = await r.json();
      document.getElementById('status-config').innerHTML =
        kv('Site', config.site_name || '') +
        kv('Camera', config.camera_url || '') +
        kv('Zone', config.zone ? 'Configured' : 'Not set', config.zone ? 'green' : 'grey') +
        kv('Configured', config.configured_at ? config.configured_at.replace('T', ' ').replace('Z', ' UTC') : '');
      document.getElementById('status-stats').innerHTML =
        kv('Vehicles today', stats.vehicles_today ?? '0') +
        kv('Last upload', stats.last_upload || 'No uploads yet');
    } catch (e) {
      document.getElementById('status-config').innerHTML = '<span style="color:#888;font-size:0.85rem;">Could not load status.</span>';
    }
  }

  document.getElementById('btn-redraw').addEventListener('click', () => {
    fetch('/api/status').then(r => r.json()).then(({ config }) => {
      if (config.camera_url) {
        // Re-test the camera to get a fresh frame
        document.getElementById('rtsp-input').value = config.camera_url;
        goStep('camera');
      } else {
        goStep('camera');
      }
    });
  });

  // ---- Init: check if already configured ----
  fetch('/api/status').then(r => r.json()).then(({ config }) => {
    if (config.api_key && config.site_name) {
      if (config.zone) {
        loadStatus();
        goStep('status');
      } else if (config.camera_url) {
        document.getElementById('rtsp-input').value = config.camera_url;
        goStep('camera');
      } else {
        goStep('camera');
      }
    }
  }).catch(() => {});

})();
</script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
async def index():
    return HTML
