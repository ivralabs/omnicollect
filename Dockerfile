FROM balenalib/jetson-orin-nano-ubuntu:jammy

# Install system deps for OpenCV + YOLOv8
RUN apt-get update && apt-get install -y \
    python3.11 python3-pip \
    libglib2.0-0 libsm6 libxext6 libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

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
