"""
YOLOv8-based vehicle and person detector.
Uses Ultralytics YOLOv8 with COCO weights.
Processes frames, returns list of Detection objects.
"""
from dataclasses import dataclass
from typing import Optional
import numpy as np
from ultralytics import YOLO


@dataclass
class Detection:
    """A single detection result."""
    class_id: int
    class_name: str   # 'car', 'truck', 'motorcycle', 'bus', 'person'
    confidence: float
    bbox: tuple       # (x1, y1, x2, y2) in pixels
    frame_width: int
    frame_height: int


class VehicleDetector:
    """YOLOv8 vehicle and person detector."""
    
    # COCO class ID to human-readable label mapping
    COCO_CLASS_NAMES = {
        0: 'person',
        2: 'car',
        3: 'motorcycle',
        5: 'bus',
        7: 'truck'
    }
    
    def __init__(self, model_path: str, confidence: float, target_classes: list[int]):
        """
        Initialize the vehicle detector.
        
        Args:
            model_path: Path to YOLOv8 model weights (e.g., 'yolov8n.pt')
            confidence: Minimum confidence threshold (0.0-1.0)
            target_classes: List of COCO class IDs to detect
        """
        self.confidence = confidence
        self.target_classes = set(target_classes)
        
        # Load YOLOv8 model
        # Downloads weights automatically on first run if not present
        self.model = YOLO(model_path)
        
        # Warmup the model with a dummy inference
        # This avoids the first real detection being slow
        dummy_frame = np.zeros((640, 640, 3), dtype=np.uint8)
        self.model.predict(dummy_frame, verbose=False)
    
    def detect(self, frame: np.ndarray) -> list[Detection]:
        """
        Run inference on a frame and return filtered detections.
        
        Args:
            frame: OpenCV image (BGR format, numpy array)
        
        Returns:
            List of Detection objects for target classes above confidence threshold
        """
        frame_height, frame_width = frame.shape[:2]
        
        # Run YOLOv8 inference
        results = self.model.predict(
            frame,
            conf=self.confidence,
            classes=list(self.target_classes),
            verbose=False
        )
        
        detections: list[Detection] = []
        
        # Extract detections from results
        for result in results:
            if result.boxes is None:
                continue
            
            for box in result.boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                
                # Get bounding box coordinates
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                bbox = (float(x1), float(y1), float(x2), float(y2))
                
                # Map class ID to name
                class_name = self.get_vehicle_class(class_id)
                
                detection = Detection(
                    class_id=class_id,
                    class_name=class_name,
                    confidence=confidence,
                    bbox=bbox,
                    frame_width=frame_width,
                    frame_height=frame_height
                )
                detections.append(detection)
        
        return detections
    
    def get_vehicle_class(self, class_id: int) -> str:
        """
        Map COCO class ID to human-readable label.
        
        Args:
            class_id: COCO class ID
        
        Returns:
            Human-readable class name
        """
        return self.COCO_CLASS_NAMES.get(class_id, 'unknown')
    
    def get_crop(self, frame: np.ndarray, detection: Detection) -> np.ndarray:
        """
        Extract the region of interest for a detection.
        
        Args:
            frame: Full OpenCV image
            detection: Detection with bounding box
        
        Returns:
            Cropped image containing just the detected vehicle
        """
        x1, y1, x2, y2 = detection.bbox
        
        # Ensure coordinates are within frame bounds
        x1 = max(0, int(x1))
        y1 = max(0, int(y1))
        x2 = min(detection.frame_width, int(x2))
        y2 = min(detection.frame_height, int(y2))
        
        return frame[y1:y2, x1:x2]
