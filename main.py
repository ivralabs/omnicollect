"""
OmniCollect Edge Agent — Main entry point.

Orchestrates the full pipeline:
1. Load configuration
2. Initialize detector, classifier, plate processor, aggregator, uploader
3. Open RTSP stream (OpenCV VideoCapture)
4. Main loop:
   - Capture frame
   - Run detector
   - For each vehicle: classify colour, optionally process plate
   - Track dwell time
   - Add to aggregator
   - Upload when window completes
5. Handle reconnect on stream drop

Logging outputs structured JSON to stdout for Balena logging.
"""
import sys
import time
import json
import logging
import signal
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from config import Config
from detector.vehicle_detector import VehicleDetector
from classifier.colour_classifier import ColourClassifier
from plate.plate_processor import PlateProcessor
from pipeline.aggregator import Aggregator, DetectionTracker
from pipeline.uploader import Uploader


# --- Structured JSON Logging for Balena ---

class JSONLogFormatter(logging.Formatter):
    """Output logs as JSON for Balena Cloud ingestion."""
    
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "msg": record.getMessage(),
            "module": record.module,
        }
        
        # Include extra fields if present
        if hasattr(record, 'event'):
            log_entry['event'] = record.event
        if hasattr(record, 'error'):
            log_entry['error'] = record.error
        if hasattr(record, 'attempt'):
            log_entry['attempt'] = record.attempt
        if hasattr(record, 'window_start'):
            log_entry['window_start'] = record.window_start
        if hasattr(record, 'vehicle_count'):
            log_entry['vehicle_count'] = record.vehicle_count
        
        return json.dumps(log_entry)


def setup_logging():
    """Configure structured JSON logging to stdout."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONLogFormatter())
    
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.handlers = []  # Clear existing handlers
    root_logger.addHandler(handler)


# --- Main Pipeline Class ---

class OmniCollectEdgeAgent:
    """
    Main edge agent orchestrating detection, classification, and upload.
    """
    
    def __init__(self, config: Config):
        """Initialize all pipeline components."""
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        self.logger.info("Initializing OmniCollect Edge Agent", extra={"event": "init_start"})
        
        # Initialize components
        self.detector = VehicleDetector(
            model_path=config.model_path,
            confidence=config.detection_confidence,
            target_classes=config.target_classes
        )
        self.logger.info(f"Loaded YOLOv8 model: {config.model_path}", extra={"event": "model_loaded"})
        
        self.colour_classifier = ColourClassifier()
        self.logger.info("Colour classifier initialized", extra={"event": "classifier_ready"})
        
        # Plate processor (optional, depends on config)
        self.plate_processor: Optional[PlateProcessor] = None
        if config.plate_enabled and config.plate_api_key != "PLATE_RECOGNIZER_API_KEY":
            self.plate_processor = PlateProcessor(
                api_key=config.plate_api_key,
                region=config.plate_region
            )
            self.logger.info("Plate processor initialized", extra={"event": "plate_ready"})
        else:
            self.logger.info("Plate processing disabled", extra={"event": "plate_disabled"})
        
        # Pipeline components
        self.aggregator = Aggregator(window_minutes=config.window_minutes)
        self.uploader = Uploader(
            ingest_url=config.ingest_url,
            site_api_key=config.site_api_key,
            retry_attempts=config.retry_attempts,
            retry_delay=config.retry_delay
        )
        
        # State
        self.running = False
        self.frame_count = 0
        self.plate_sample_counter = 0
        
        # Camera
        self.cap: Optional[cv2.VideoCapture] = None
        
        self.logger.info(
            f"Agent initialized: site={config.site_name}, capture_interval={1000/config.fps_capture:.0f}ms",
            extra={"event": "init_complete"}
        )
    
    def connect_camera(self) -> bool:
        """Connect to RTSP camera stream."""
        self.logger.info(f"Connecting to camera: {self.config.camera_url}", extra={"event": "camera_connect"})
        
        # Open RTSP stream
        self.cap = cv2.VideoCapture(self.config.camera_url)
        
        # Set buffer size to reduce latency
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
        if not self.cap.isOpened():
            self.logger.error("Failed to open camera stream", extra={"event": "camera_error"})
            return False
        
        # Get stream info
        width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = self.cap.get(cv2.CAP_PROP_FPS)
        
        self.logger.info(
            f"Camera connected: {width}x{height} @ {fps:.1f}fps",
            extra={"event": "camera_connected", "width": width, "height": height, "fps": fps}
        )
        return True
    
    def disconnect_camera(self):
        """Disconnect from camera."""
        if self.cap:
            self.cap.release()
            self.cap = None
            self.logger.info("Camera disconnected", extra={"event": "camera_disconnected"})
    
    def process_frame(self, frame: np.ndarray, timestamp: datetime) -> None:
        """
        Process a single frame through the pipeline.
        
        Args:
            frame: OpenCV image (BGR)
            timestamp: Current timestamp
        """
        self.frame_count += 1
        
        # Run vehicle detection
        detections = self.detector.detect(frame)
        
        if not detections:
            return
        
        # Track objects for dwell time
        vehicle_detections = [d for d in detections if d.class_name != 'person']
        dwell_times = self.aggregator.tracker.update(vehicle_detections, timestamp)
        self.aggregator.add_dwell_times(dwell_times)
        
        # Process each detection
        vehicles_in_frame = 0
        for detection in detections:
            # Skip people for colour/plate (they don't have vehicles to classify)
            is_person = detection.class_name == 'person'
            
            # Get vehicle crop for colour classification
            crop = self.detector.get_crop(frame, detection)
            
            # Classify colour
            colour = 'other'
            if not is_person:
                colour = self.colour_classifier.classify(crop)
                vehicles_in_frame += 1
            
            # Process plate (if enabled, and only at sample rate)
            plate_hash = None
            if self.plate_processor and not is_person:
                self.plate_sample_counter += 1
                if self.plate_sample_counter >= self.config.plate_sample_rate:
                    self.plate_sample_counter = 0
                    # Process plate in try-except to prevent crash on API failure
                    try:
                        result = self.plate_processor.process(crop)
                        if result:
                            plate_hash = result.plate_hash
                    except Exception as e:
                        self.logger.warning(
                            f"Plate processing error: {str(e)}",
                            extra={"event": "plate_error", "error": str(e)}
                        )
            
            # Add to aggregator
            self.aggregator.add_detection(detection, colour, plate_hash, timestamp)
        
        # Log activity periodically
        if self.frame_count % 50 == 0 and vehicles_in_frame > 0:
            self.logger.info(
                f"Frame {self.frame_count}: {vehicles_in_frame} vehicles detected",
                extra={
                    "event": "frame_activity",
                    "frame": self.frame_count,
                    "vehicles": vehicles_in_frame
                }
            )
    
    def check_and_upload(self, now: datetime) -> None:
        """Check if current window is complete and upload if so."""
        if self.aggregator.is_window_complete(now):
            reading = self.aggregator.get_and_reset(now)
            
            self.logger.info(
                f"Window complete: {reading.vehicle_count} vehicles, "
                f"{reading.unique_plate_hashes} unique plates",
                extra={
                    "event": "window_complete",
                    "vehicle_count": reading.vehicle_count,
                    "people_count": reading.people_count,
                    "unique_hashes": reading.unique_plate_hashes,
                    "window_start": reading.window_start.isoformat()
                }
            )
            
            if self.config.upload_on_complete:
                success = self.uploader.upload(reading)
                if not success:
                    self.logger.warning(
                        "Window upload queued for retry",
                        extra={"event": "upload_queued"}
                    )
    
    def run(self):
        """Main processing loop."""
        self.running = True
        
        # Flush any queued readings from previous offline period
        self.logger.info("Flushing offline queue...", extra={"event": "queue_flush_start"})
        uploaded = self.uploader.flush_queue()
        self.logger.info(f"Queue flush: {uploaded} readings uploaded", extra={"event": "queue_flush_complete", "uploaded": uploaded})
        
        # Connect to camera
        if not self.connect_camera():
            self.logger.error("Cannot start without camera connection", extra={"event": "startup_failed"})
            return
        
        # Calculate frame interval based on fps_capture
        frame_interval = 1.0 / self.config.fps_capture
        last_frame_time = time.time()
        
        self.logger.info("Starting main loop", extra={"event": "main_loop_start"})
        
        try:
            while self.running:
                now = time.time()
                
                # Check if it's time to capture next frame
                if now - last_frame_time < frame_interval:
                    # Sleep a bit to avoid CPU spinning
                    time.sleep(0.01)
                    continue
                
                last_frame_time = now
                timestamp = datetime.utcnow()
                
                # Read frame from camera
                ret, frame = self.cap.read()
                
                if not ret:
                    # Stream dropped — attempt reconnect
                    self.logger.warning(
                        "Camera stream dropped, attempting reconnect...",
                        extra={"event": "camera_reconnect"}
                    )
                    self.disconnect_camera()
                    time.sleep(self.config.reconnect_delay)
                    
                    if not self.connect_camera():
                        self.logger.error(
                            "Failed to reconnect to camera",
                            extra={"event": "camera_reconnect_failed"}
                        )
                        continue
                    
                    self.logger.info("Camera reconnected", extra={"event": "camera_reconnected"})
                    continue
                
                # Process the frame
                self.process_frame(frame, timestamp)
                
                # Check if window is complete and upload
                self.check_and_upload(timestamp)
                
        except KeyboardInterrupt:
            self.logger.info("Received interrupt, shutting down...", extra={"event": "shutdown_signal"})
        finally:
            self.shutdown()
    
    def shutdown(self):
        """Graceful shutdown."""
        self.logger.info("Shutting down...", extra={"event": "shutdown_start"})
        self.running = False
        self.disconnect_camera()
        
        # Force final window upload if there's data
        now = datetime.utcnow()
        if self.aggregator.vehicle_count > 0 or self.aggregator.people_count > 0:
            reading = self.aggregator.get_and_reset(now)
            self.logger.info(
                f"Final window: {reading.vehicle_count} vehicles uploaded",
                extra={
                    "event": "final_upload",
                    "vehicle_count": reading.vehicle_count
                }
            )
            self.uploader.upload(reading)
        
        self.logger.info("Shutdown complete", extra={"event": "shutdown_complete"})


def signal_handler(signum, frame):
    """Handle shutdown signals."""
    logging.getLogger(__name__).info(f"Received signal {signum}", extra={"event": "signal_received"})


def main():
    """Entry point."""
    # Setup structured logging
    setup_logging()
    
    logger = logging.getLogger(__name__)
    logger.info("=" * 50)
    logger.info("OmniCollect Edge Agent Starting")
    logger.info("=" * 50)
    
    # Setup signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Load configuration
    try:
        config = Config()
    except Exception as e:
        logger.error(f"Failed to load configuration: {str(e)}", extra={"event": "config_error", "error": str(e)})
        sys.exit(1)
    
    # Validate critical config
    if config.site_api_key == "YOUR_SITE_API_KEY":
        logger.error("Site API key not configured. Set OMNICOLLECT_SITE_API_KEY env var.", extra={"event": "config_error"})
        sys.exit(1)
    
    # Run the agent
    agent = OmniCollectEdgeAgent(config)
    agent.run()


if __name__ == "__main__":
    main()
