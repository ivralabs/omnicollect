#!/usr/bin/env bash
# OmniCollect Edge Agent — One-shot installer for JetPack 6.x (Jetson Orin Nano)
# Usage: sudo bash setup.sh
set -euo pipefail

EDGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$EDGE_DIR/agent"
CONFIG_UI_DIR="$EDGE_DIR/config-ui"
MODEL_URL="https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt"
MODEL_PATH="$AGENT_DIR/yolov8n.pt"
SERVICE_NAME="omnicollect-agent"

echo ""
echo "================================================"
echo " OmniCollect Edge Agent — Installer"
echo "================================================"
echo ""

# --- 1. System deps ---
echo "[1/5] Updating package list and installing system dependencies..."
apt-get update -qq
apt-get install -y -qq \
    python3-pip \
    python3-venv \
    curl \
    wget \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1

# --- 2. Python deps ---
echo ""
echo "[2/5] Installing Python dependencies..."
pip3 install --quiet --upgrade pip
pip3 install --quiet \
    ultralytics \
    opencv-python-headless \
    httpx \
    pillow \
    fastapi \
    uvicorn \
    websockets

echo ""
echo "========================================================"
echo " WARNING: PaddleOCR requires manual installation."
echo " ARM wheels are NOT available on PyPI."
echo " Install manually from:"
echo "   https://github.com/PaddlePaddle/PaddleOCR"
echo " See edge-agent/INSTALL.md for detailed instructions."
echo "========================================================"
echo ""

# --- 3. Download YOLOv8n model ---
echo "[3/5] Downloading YOLOv8n model..."
mkdir -p "$AGENT_DIR"
if [ -f "$MODEL_PATH" ]; then
    echo "  Model already exists, skipping download."
else
    wget -q --show-progress -O "$MODEL_PATH" "$MODEL_URL"
    echo "  Model saved to $MODEL_PATH"
fi

# --- 4. Create systemd service ---
echo ""
echo "[4/5] Creating systemd service: $SERVICE_NAME..."

cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=OmniCollect Edge Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=${EDGE_DIR}
ExecStart=/usr/bin/python3 agent/main.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
echo "  Service enabled. It will start automatically on next boot."
echo "  To start now: sudo systemctl start $SERVICE_NAME"

# --- 5. Start config UI ---
echo ""
echo "[5/5] Starting config UI on port 8080..."

# Start config UI as a one-shot background process (not managed by the agent service)
# We use a separate simple service for the config UI
cat > "/etc/systemd/system/omnicollect-config-ui.service" <<EOF
[Unit]
Description=OmniCollect Config UI
After=network.target

[Service]
Type=simple
WorkingDirectory=${CONFIG_UI_DIR}
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=omnicollect-config-ui

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable omnicollect-config-ui
systemctl start omnicollect-config-ui

echo ""
echo "================================================"
echo " Installation complete."
echo ""
echo " Next step:"
DEVICE_IP=$(hostname -I | awk '{print $1}')
echo "   Open http://${DEVICE_IP}:8080 in your browser to configure"
echo ""
echo " If that IP looks wrong, run: hostname -I"
echo "================================================"
echo ""
