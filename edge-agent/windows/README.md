# OmniCollect Edge Agent — Windows Setup Guide

This guide is for installing the OmniCollect vehicle counting agent on a Windows PC at a billboard site.

---

## Before You Start

You need:
- A Windows 10 or Windows 11 PC (always on)
- An internet connection (SIM or fixed)
- One or two IP cameras on the local network
- Your OmniCollect API key (starts with `oc_site_`)

---

## Step 1 — Install Python

1. Open a browser and go to **https://www.python.org/downloads/**
2. Download the latest **Python 3.10 or newer** installer
3. Run the installer
4. **IMPORTANT: Check the box that says "Add Python to PATH"** before clicking Install
5. Click Install Now and wait for it to finish
6. Close the installer

To confirm Python installed correctly, open Command Prompt (search for `cmd`) and type:

```
python --version
```

You should see something like `Python 3.12.x`. If you get an error, restart your PC and try again.

---

## Step 2 — Download OmniCollect

**Option A — Download as ZIP (recommended for non-technical installs):**

1. Go to **https://github.com/ivralabs/omnicollect**
2. Click the green **Code** button
3. Click **Download ZIP**
4. Extract the ZIP to a folder, for example: `C:\OmniCollect`

**Option B — Clone with git:**

```
git clone https://github.com/ivralabs/omnicollect.git C:\OmniCollect
```

---

## Step 3 — Run the Installer

1. Open the `edge-agent` folder inside the downloaded/cloned directory
2. Right-click **install-windows.bat**
3. Select **Run as administrator**
4. Wait — the installer will:
   - Check your Python version
   - Install all required packages (this takes 2-5 minutes)
   - Download the YOLOv8 detection model
   - Set up the agent to start automatically when Windows boots
   - Open the setup page in your browser

If Windows Defender SmartScreen appears, click **More info** then **Run anyway**.

---

## Step 4 — Configure in the Browser

The browser should open automatically to **http://localhost:8080**.

If it does not open, type that address into your browser manually.

Follow the on-screen steps:

1. **API Key** — Paste your `oc_site_` API key and click Verify Key
2. **Camera** — Enter your camera RTSP URL and click Test Connection
3. **Zone** — Click two points on the camera image to draw the counting line
4. **Done** — The agent is now configured and counting

---

## Camera RTSP URL Formats

Replace `admin`, `password`, and the IP address with your camera's actual values.

**Hikvision:**
```
rtsp://admin:password@192.168.1.x:554/Streaming/Channels/101
```

**Dahua:**
```
rtsp://admin:password@192.168.1.x:554/cam/realmonitor?channel=1&subtype=0
```

**Generic / other brands:**
```
rtsp://admin:password@192.168.1.x:554/stream1
```

To find your camera's IP address, check your router's connected devices list, or use a network scan tool like **Advanced IP Scanner** (free, https://www.advanced-ip-scanner.com).

---

## Startup Behaviour

After installation, the agent starts automatically when the PC boots.

- **If NSSM was found:** The agent runs as a Windows Service called `OmniCollectAgent`.
  - Start: `nssm start OmniCollectAgent`
  - Stop: `nssm stop OmniCollectAgent`
  - View logs: `C:\OmniCollect\edge-agent\logs\`

- **If NSSM was not found:** A shortcut was added to the Windows Startup folder. The agent starts when any user logs in.
  - To run manually: double-click `start-agent.bat` in the `edge-agent` folder

---

## Log Files

All agent logs are saved to:

```
edge-agent\logs\agent.log
```

The log rotates automatically (max 5 MB, keeps 3 backups).

---

## Troubleshooting

**The browser did not open automatically**
- Type `http://localhost:8080` into your browser manually
- Make sure the Config UI is running (run `start-agent.bat` or check the service)

**"Python is not installed or not on PATH"**
- Reinstall Python from https://www.python.org/downloads/
- Make sure you check "Add Python to PATH" during installation
- Restart your PC and run the installer again

**"Could not open camera stream"**
- Check the RTSP URL format for your camera brand (see above)
- Make sure the camera and PC are on the same network
- Try pinging the camera IP: open Command Prompt and type `ping 192.168.1.x`
- Check the camera's username and password — default is often `admin` / `admin` or `admin` / `12345`

**The installer fails with a permissions error**
- Make sure you right-clicked and chose "Run as administrator"

**Vehicles are not being counted**
- Open the log file at `edge-agent\logs\agent.log` and look for error messages
- Re-open http://localhost:8080 and re-draw the tripwire zone across the lane of traffic
- The counting line should cross the path vehicles travel — not run parallel to it

**How do I check if the agent is working?**
- Open http://localhost:8080 — the Status page shows vehicles counted today and the last upload time
- Check `edge-agent\logs\agent.log` for recent activity

---

## Getting NSSM (optional, for proper Windows Service install)

NSSM (Non-Sucking Service Manager) lets the agent run as a true Windows Service that restarts automatically if it crashes.

1. Download from **https://nssm.cc/download**
2. Extract `nssm.exe` and place it somewhere on your PATH (e.g. `C:\Windows\System32\`)
3. Re-run `install-windows.bat` as administrator — it will detect NSSM and install the service properly

---

## Support

Contact your OmniCollect account manager with your site ID and a copy of the log file from `edge-agent\logs\agent.log`.
