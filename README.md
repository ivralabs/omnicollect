# OmniCollect Edge Agent

Python application that runs on NVIDIA Jetson Orin Nano (or Raspberry Pi 5 + Hailo-8L) at each billboard/screen site. Captures RTSP camera streams, detects vehicles using YOLOv8, classifies colours, hashes license plates, and uploads aggregated 15-minute readings to the OmniCollect cloud platform.

## Hardware Requirements

- **Primary:** NVIDIA Jetson Orin Nano (40 TOPS, ~R 5 000)
- **Alternative:** Raspberry Pi 5 + Hailo-8L Hat (26 TOPS, ~R 3 200)
- **Camera:** IP camera with RTSP stream (or existing DOOH screen camera)
- **Storage:** 16GB+ SD card or NVMe
- **Power:** 5V 4A supply

## Installation

### 1. Clone and Setup

```bash
cd /path/to/omnicollect/edge
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure

Copy the template and edit:

```bash
cp config.yaml config.local.yaml
```

Edit `config.local.yaml`:

```yaml
site:
  api_key: "YOUR_SITE_API_KEY"   # Get this from OmniCollect dashboard
  name: "N1 Highway Billboard"

camera:
  url: "rtsp://192.168.1.100:554/stream"  # Your camera RTSP URL

plate:
  enabled: true
  api_key: "YOUR_PLATE_RECOGNIZER_KEY"  # From platerecognizer.com
```

### 3. Run Locally

```bash
# Set environment variables (optional — overrides config.yaml)
export OMNICOLLECT_SITE_API_KEY="your-api-key"
export PLATE_RECOGNIZER_API_KEY="your-plate-key"

python main.py
```

### 4. Test with Local Webcam (Dev Mode)

```bash
# Use webcam instead of RTSP
export RTSP_URL="0"  # Use default webcam
python main.py
```

## Balena Cloud Deployment

### 1. Create Balena Application

```bash
# Install balena CLI
npm install -g balena-cli

# Login
balena login

# Create application
balena app create omnicollect-edge --type jetson-orin-nano
```

### 2. Push to Device

```bash
# Add device in Balena dashboard, download OS image
# Flash to SD card with Balena Etcher

# Push code
cd /path/to/omnicollect/edge
balena push <app-name>
```

### 3. Configure Device

In Balena dashboard or via env vars:

```bash
# Set device environment variables
balena env add OMNICOLLECT_SITE_API_KEY "your-key" --device <uuid>
balena env add PLATE_RECOGNIZER_API_KEY "your-key" --device <uuid>
balena env add RTSP_URL "rtsp://your-camera-url" --device <uuid>
```

### 4. OTA Updates

```bash
# Push new version
balena push <app-name>
# Automatically deploys to all devices
```

## Architecture

```
RTSP Camera Stream
       ↓
  Frame Capture (2 fps)
       ↓
  YOLOv8 Detection → bounding boxes
       ↓
  Colour Classification (HSV)
       ↓
  Plate OCR → SHA-256 Hash (POPIA compliant)
       ↓
  15-min Aggregation
       ↓
  HTTPS POST to Cloud
```

## Privacy

**Critical:** Raw license plate text is **NEVER** stored, logged, or transmitted from the edge device.

- Plates are hashed immediately upon receipt from Plate Recognizer API
- Only SHA-256 hashes leave the device
- POPIA compliant by design

## Project Structure

```
edge/
├── detector/
│   ├── __init__.py
│   └── vehicle_detector.py    # YOLOv8 vehicle + person detection
├── classifier/
│   ├── __init__.py
│   └── colour_classifier.py   # HSV-based colour detection
├── plate/
│   ├── __init__.py
│   └── plate_processor.py     # Plate Recognizer API + SHA-256 hashing
├── pipeline/
│   ├── __init__.py
│   ├── aggregator.py          # 15-min window aggregation
│   └── uploader.py            # HTTPS POST to cloud /api/ingest
├── config.yaml                # Site configuration
├── config.py                  # Config loader
├── main.py                    # Entry point
├── requirements.txt           # Python dependencies
├── Dockerfile                 # Balena Cloud deployment
└── docker-compose.yml         # Local development
```

## API Payload Format

The edge agent POSTs to `/api/ingest`:

```json
{
  "site_api_key": "...",
  "window_start": "2024-01-15T08:00:00Z",
  "window_end": "2024-01-15T08:15:00Z",
  "vehicle_count": 47,
  "people_count": 3,
  "vehicle_classes": {
    "car": 32,
    "truck": 8,
    "bus": 4,
    "motorcycle": 3
  },
  "colour_breakdown": {
    "silver": 18,
    "white": 15,
    "black": 8,
    "blue": 4,
    "red": 2
  },
  "unique_plate_hashes": 42,
  "avg_dwell_secs": 8.5,
  "plate_sightings": [
    {"hash": "a3f5...", "seen_at": "2024-01-15T08:05:23Z", "vehicle_class": "car"}
  ]
}
```

## Troubleshooting

### Camera won't connect

```bash
# Test RTSP stream with ffplay
ffplay rtsp://your-camera-url

# Check camera is on network
ping 192.168.1.100
```

### High CPU usage

- Reduce `fps_capture` in config.yaml (default: 2)
- Use smaller YOLO model: `yolov8n.pt` (already default)
- Disable plate processing if not needed: `plate.enabled: false`

### No data appearing in dashboard

1. Check `OMNICOLLECT_SITE_API_KEY` is set correctly
2. Verify network connectivity: `curl https://app.omnicollect.io/api/health`
3. Check logs: `balena logs <device-uuid>`
4. Verify camera is streaming: `ffprobe rtsp://...`

### Offline queue growing

If the device loses internet, readings are queued to `/data/queue/`. They will upload automatically when connectivity returns. Check queue size in logs.

## License

Internal use only — Ivra Labs.
