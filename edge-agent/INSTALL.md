# OmniCollect Edge Agent — Installation Guide

This guide walks you through setting up the OmniCollect Edge Agent on a Jetson Orin Nano at an OOH billboard site.

---

## Requirements

- NVIDIA Jetson Orin Nano
- JetPack 6.x flashed and booted
- Internet connection (Wi-Fi or Ethernet)
- Your OmniCollect site API key (`oc_site_...`) — get this from the OmniCollect dashboard
- RTSP-capable IP camera already mounted and on the local network

---

## Step 1 — Flash JetPack 6.x

If your Jetson is not yet set up:

1. Download NVIDIA SDK Manager: https://developer.nvidia.com/sdk-manager
2. Connect the Jetson in recovery mode and flash JetPack 6.x
3. Complete initial Ubuntu setup (set username, password, Wi-Fi)

Official docs: https://docs.nvidia.com/jetson/archives/jetpack-archived/jetpack-60/install-setup/index.html

---

## Step 2 — Clone the repo and run setup

```bash
sudo apt-get install -y git
git clone https://github.com/ivralabs/omnicollect.git
cd omnicollect/edge-agent
sudo bash setup.sh
```

The install script will:
- Install Python dependencies (ultralytics, FastAPI, OpenCV, etc.)
- Download the YOLOv8n model
- Create and enable two systemd services:
  - `omnicollect-agent` — the counting agent (starts on boot)
  - `omnicollect-config-ui` — the web config interface (port 8080)

At the end, the script prints the device IP. Keep it handy.

---

## Step 3 — Open the config UI and set up the site

Open a browser on any phone or laptop on the same network:

```
http://<device-ip>:8080
```

Follow the on-screen steps:

1. **Enter API key** — paste your `oc_site_xxx` key from the dashboard
2. **Set camera** — enter the RTSP URL and tap "Test Connection" to verify a live frame
3. **Draw zone** — tap two points on the camera image to define the counting tripwire
4. Done — the agent service starts counting automatically

---

## Step 4 — Confirm data in the OmniCollect dashboard

1. Log in at https://omnicollect.tech
2. Navigate to Sites → your site
3. You should see incoming vehicle counts within a few minutes

If no data appears after 10 minutes, see Troubleshooting below.

---

## PaddleOCR — Manual Installation (ARM)

PaddleOCR is used for licence plate recognition. ARM wheels are **not on PyPI** and must be installed manually.

### Option A — Build from source

```bash
# Install PaddlePaddle for Jetson (JetPack 6 / CUDA 12.x)
# See: https://www.paddlepaddle.org.cn/documentation/docs/en/install/compile/linux-compile-by-make_en.html

git clone https://github.com/PaddlePaddle/PaddleOCR.git
cd PaddleOCR
pip3 install -r requirements.txt
pip3 install .
```

### Option B — Pre-built community wheel

Check the Jetson community for pre-built wheels:
- https://github.com/Qengineering/Install-PyTorch-on-Jetson-Nano (similar process applies)
- NVIDIA Developer Forums: https://forums.developer.nvidia.com

Once installed, restart the agent service:
```bash
sudo systemctl restart omnicollect-agent
```

---

## Troubleshooting

### Config UI not loading

```bash
# Check service status
sudo systemctl status omnicollect-config-ui

# Check logs
sudo journalctl -u omnicollect-config-ui -n 50

# Get device IP
hostname -I
```

### Agent not running

```bash
sudo systemctl status omnicollect-agent
sudo journalctl -u omnicollect-agent -n 100
```

### Camera test fails

- Verify the RTSP URL works from another device (VLC → Open Network Stream)
- Make sure the camera is on the same network as the Jetson
- Some cameras need credentials: `rtsp://admin:password@192.168.1.64:554/stream1`
- Check that UDP port 554 is not blocked by a firewall

### API key rejected

- Copy the key directly from the OmniCollect dashboard — avoid spaces
- Keys start with `oc_site_` followed by a 32-character string
- If the key was recently generated, wait 30 seconds for propagation

### No counts in dashboard

1. SSH into the Jetson: `ssh user@<device-ip>`
2. Check agent logs: `sudo journalctl -u omnicollect-agent -f`
3. Verify `config.json` is complete: `cat omnicollect/edge-agent/config.json`
4. Check network: `curl https://omnicollect.tech/api/ingest` (should return 405)

---

## Service management

```bash
# Start / stop / restart
sudo systemctl start omnicollect-agent
sudo systemctl stop omnicollect-agent
sudo systemctl restart omnicollect-agent

# View live logs
sudo journalctl -u omnicollect-agent -f

# Disable auto-start
sudo systemctl disable omnicollect-agent
```
