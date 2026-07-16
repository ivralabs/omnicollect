@echo off
setlocal enabledelayedexpansion

echo.
echo ================================================
echo  OmniCollect Edge Agent -- Windows Installer
echo ================================================
echo.

:: Check for Administrator rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This installer must be run as Administrator.
    echo Right-click install-windows.bat and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)

:: Get the directory where this script lives
set "EDGE_DIR=%~dp0"
if "%EDGE_DIR:~-1%"=="\" set "EDGE_DIR=%EDGE_DIR:~0,-1%"

set "AGENT_DIR=%EDGE_DIR%\agent"
set "CONFIG_UI_DIR=%EDGE_DIR%\config-ui"
set "MODEL_PATH=%AGENT_DIR%\yolov8n.pt"
set "MODEL_URL=https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt"
set "LOG_DIR=%EDGE_DIR%\logs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

:: -----------------------------------------------
:: Step 1: Check Python 3.10+
:: -----------------------------------------------
echo [1/5] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Python is not installed or not on PATH.
    echo.
    echo Please install Python 3.10 or newer:
    echo   1. Go to https://www.python.org/downloads/
    echo   2. Download the latest Python 3.x installer
    echo   3. Run the installer -- IMPORTANT: check "Add Python to PATH"
    echo   4. Re-run this installer after Python is installed
    echo.
    pause
    exit /b 1
)

for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set "PY_VER=%%v"
echo   Found Python %PY_VER%

:: Extract major.minor for version check
for /f "tokens=1,2 delims=." %%a in ("%PY_VER%") do (
    set "PY_MAJOR=%%a"
    set "PY_MINOR=%%b"
)

if %PY_MAJOR% lss 3 (
    echo.
    echo ERROR: Python 3.10 or newer is required. You have %PY_VER%.
    echo Please download a newer version from https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

if %PY_MAJOR% equ 3 if %PY_MINOR% lss 10 (
    echo.
    echo ERROR: Python 3.10 or newer is required. You have %PY_VER%.
    echo Please download a newer version from https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo   Python %PY_VER% -- OK

:: -----------------------------------------------
:: Step 2: Install pip dependencies
:: -----------------------------------------------
echo.
echo [2/5] Installing Python dependencies (this may take a few minutes)...
python -m pip install --upgrade pip --quiet
if %errorlevel% neq 0 (
    echo ERROR: Failed to upgrade pip. Check your internet connection.
    pause
    exit /b 1
)

python -m pip install -r "%EDGE_DIR%\requirements-windows.txt" --quiet
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies from requirements-windows.txt.
    echo Make sure you have a working internet connection.
    pause
    exit /b 1
)
echo   Dependencies installed -- OK

:: -----------------------------------------------
:: Step 3: Download YOLOv8n model
:: -----------------------------------------------
echo.
echo [3/5] Checking YOLOv8n model...
if exist "%MODEL_PATH%" (
    echo   Model already present -- skipping download.
) else (
    echo   Downloading YOLOv8n model (6 MB)...
    powershell -Command "try { Invoke-WebRequest -Uri '%MODEL_URL%' -OutFile '%MODEL_PATH%' -UseBasicParsing } catch { Write-Error $_.Exception.Message; exit 1 }"
    if %errorlevel% neq 0 (
        echo ERROR: Failed to download YOLOv8n model.
        echo Please check your internet connection and try again.
        pause
        exit /b 1
    )
    echo   Model saved to %MODEL_PATH%
)

:: -----------------------------------------------
:: Step 4: Create logs directory
:: -----------------------------------------------
echo.
echo [4/5] Setting up directories...
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
echo   Logs directory: %LOG_DIR%

:: -----------------------------------------------
:: Step 5: Install as service (NSSM) or startup shortcut
:: -----------------------------------------------
echo.
echo [5/5] Installing OmniCollect as a startup service...

:: Check if NSSM is available
where nssm >nul 2>&1
if %errorlevel% equ 0 (
    echo   NSSM found -- installing as Windows Service...

    :: Remove old service if it exists
    nssm stop OmniCollectAgent >nul 2>&1
    nssm remove OmniCollectAgent confirm >nul 2>&1

    nssm install OmniCollectAgent python "%AGENT_DIR%\main_windows.py"
    nssm set OmniCollectAgent AppDirectory "%EDGE_DIR%"
    nssm set OmniCollectAgent DisplayName "OmniCollect Edge Agent"
    nssm set OmniCollectAgent Description "OmniCollect vehicle counting agent"
    nssm set OmniCollectAgent Start SERVICE_AUTO_START
    nssm set OmniCollectAgent AppStdout "%LOG_DIR%\agent-service.log"
    nssm set OmniCollectAgent AppStderr "%LOG_DIR%\agent-service-error.log"

    echo   Service installed as OmniCollectAgent.
    echo   Use: nssm start OmniCollectAgent  (to start)
    echo   Use: nssm stop OmniCollectAgent   (to stop)
) else (
    echo   NSSM not found -- creating startup shortcut instead.
    echo   (For a proper Windows Service install, get NSSM from https://nssm.cc)
    echo.

    :: Create start-agent.bat
    echo @echo off > "%EDGE_DIR%\start-agent.bat"
    echo cd /d "%EDGE_DIR%" >> "%EDGE_DIR%\start-agent.bat"
    echo python agent\main_windows.py >> "%EDGE_DIR%\start-agent.bat"

    :: Copy to Windows Startup folder via VBScript shortcut
    set "SHORTCUT_TARGET=%EDGE_DIR%\start-agent.bat"
    set "SHORTCUT_PATH=%STARTUP_FOLDER%\OmniCollect Agent.lnk"

    powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%SHORTCUT_TARGET%'; $s.WorkingDirectory = '%EDGE_DIR%'; $s.WindowStyle = 7; $s.Description = 'OmniCollect Edge Agent'; $s.Save()"
    if %errorlevel% equ 0 (
        echo   Startup shortcut created: %SHORTCUT_PATH%
        echo   The agent will start automatically when this PC boots.
    ) else (
        echo   WARNING: Could not create startup shortcut automatically.
        echo   To run the agent manually: double-click start-agent.bat in %EDGE_DIR%
    )
)

:: -----------------------------------------------
:: Start Config UI now for first-time setup
:: -----------------------------------------------
echo.
echo Starting Config UI for first-time setup...
start "OmniCollect Config UI" /D "%CONFIG_UI_DIR%" python main_windows.py

echo.
echo ================================================
echo  Installation complete.
echo.
echo  Open http://localhost:8080 in your browser to configure OmniCollect
echo.
echo  The browser should open automatically.
echo  If it does not, type the address above manually.
echo ================================================
echo.
pause
