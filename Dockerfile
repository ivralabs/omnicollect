FROM balenalib/jetson-orin-nano-ubuntu:jammy

# Install system deps for OpenCV + YOLOv8 + PaddleOCR
RUN apt-get update && apt-get install -y \
    python3.11 python3-pip \
    libglib2.0-0 libsm6 libxext6 libxrender-dev \
    libgomp1 \
    # PaddleOCR additional dependencies
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# NOTE: Jetson Orin Nano (aarch64 / JetPack) requires the ARM-optimised
# PaddlePaddle wheel — the standard PyPI paddlepaddle-gpu does NOT work on arm64.
# Options:
#   1. Use the official Paddle JetPack wheel:
#      https://www.paddlepaddle.org.cn/install/quick?hardware=Jetson
#   2. Use nvcr.io/nvidia/paddlepaddle as the base image instead of balenalib.
#   3. Build PaddlePaddle from source for aarch64.
# The pip install below will succeed on x86_64 dev machines for testing.
# For production Jetson builds, replace paddlepaddle-gpu with the JetPack wheel URL.

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Download YOLOv8n weights (nano model — fast, good enough for Phase 1)
RUN python3 -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Copy application code
COPY . .

# Create queue directory for offline storage
RUN mkdir -p /data/queue

CMD ["python3", "main.py"]
