"""
Aggregates detections into configurable time windows.
Tracks: vehicle counts by class, colour breakdown, unique plate hashes, dwell time.
"""
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Optional


@dataclass
class WindowReading:
    """
    Aggregated reading for a single time window.
    This is the data structure sent to the cloud.
    """
    window_start: datetime
    window_end: datetime
    vehicle_count: int
    people_count: int
    vehicle_classes: dict   # {'car': 12, 'truck': 3, ...}
    colour_breakdown: dict  # {'silver': 9, 'white': 7, ...}
    unique_plate_hashes: int
    avg_dwell_secs: float
    plate_sightings: list   # [{'hash': '...', 'seen_at': iso, 'vehicle_class': '...'}]
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'window_start': self.window_start.isoformat(),
            'window_end': self.window_end.isoformat(),
            'vehicle_count': self.vehicle_count,
            'people_count': self.people_count,
            'vehicle_classes': self.vehicle_classes,
            'colour_breakdown': self.colour_breakdown,
            'unique_plate_hashes': self.unique_plate_hashes,
            'avg_dwell_secs': round(self.avg_dwell_secs, 2),
            'plate_sightings': self.plate_sightings
        }
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), default=str)


class DetectionTracker:
    """
    Track individual detections to calculate dwell time.
    Simple approach: track same class in similar position across frames.
    """
    def __init__(self, proximity_threshold: float = 0.3):
        """
        Initialize tracker.
        
        Args:
            proximity_threshold: Max distance (as % of frame) to consider same object
        """
        self.proximity_threshold = proximity_threshold
        self.tracks: dict[str, dict] = {}  # track_id -> {first_seen, last_seen, count}
        self.next_id = 0
    
    def _bbox_center(self, bbox: tuple) -> tuple[float, float]:
        """Get center point of bounding box."""
        x1, y1, x2, y2 = bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)
    
    def _bbox_distance(self, bbox1: tuple, bbox2: tuple) -> float:
        """Calculate normalized distance between two bounding boxes."""
        c1 = self._bbox_center(bbox1)
        c2 = self._bbox_center(bbox2)
        # Normalize by frame size (assuming bbox values are in pixels)
        width = max(bbox1[2], bbox2[2])
        height = max(bbox1[3], bbox2[3])
        if width == 0 or height == 0:
            return float('inf')
        dx = (c1[0] - c2[0]) / width
        dy = (c1[1] - c2[1]) / height
        return (dx ** 2 + dy ** 2) ** 0.5
    
    def update(self, detections: list, timestamp: datetime) -> dict[str, float]:
        """
        Update tracks with new detections and return dwell times for completed tracks.
        
        Args:
            detections: List of detection objects
            timestamp: Current timestamp
        
        Returns:
            Dict mapping track_id to dwell time in seconds
        """
        dwell_times = {}
        current_tracks = set()
        
        for detection in detections:
            # Find matching track
            matched_id = None
            for track_id, track in self.tracks.items():
                if track['class'] == detection.class_name:
                    dist = self._bbox_distance(track['bbox'], detection.bbox)
                    if dist < self.proximity_threshold:
                        matched_id = track_id
                        break
            
            if matched_id is None:
                # Create new track
                matched_id = f"track_{self.next_id}"
                self.next_id += 1
                self.tracks[matched_id] = {
                    'class': detection.class_name,
                    'bbox': detection.bbox,
                    'first_seen': timestamp,
                    'last_seen': timestamp,
                    'count': 1
                }
            else:
                # Update existing track
                self.tracks[matched_id]['bbox'] = detection.bbox
                self.tracks[matched_id]['last_seen'] = timestamp
                self.tracks[matched_id]['count'] += 1
            
            current_tracks.add(matched_id)
        
        # Remove tracks not seen in this frame and record their dwell time
        for track_id in list(self.tracks.keys()):
            if track_id not in current_tracks:
                track = self.tracks[track_id]
                dwell = (track['last_seen'] - track['first_seen']).total_seconds()
                if dwell > 0:
                    dwell_times[track_id] = dwell
                del self.tracks[track_id]
        
        return dwell_times
    
    def flush(self) -> dict[str, float]:
        """Get dwell times for all remaining tracks and clear."""
        dwell_times = {}
        for track_id, track in self.tracks.items():
            dwell = (track['last_seen'] - track['first_seconds']).total_seconds()
            if dwell > 0:
                dwell_times[track_id] = dwell
        self.tracks = {}
        return dwell_times


class Aggregator:
    """
    Aggregate vehicle detections into time windows.
    
    Maintains running counts and produces WindowReading objects
    at the end of each window period.
    """
    
    def __init__(self, window_minutes: int = 15):
        """
        Initialize aggregator.
        
        Args:
            window_minutes: Length of each aggregation window in minutes
        """
        self.window_minutes = window_minutes
        self.window_start: Optional[datetime] = None
        self.window_end: Optional[datetime] = None
        
        # Counters for current window
        self.vehicle_count = 0
        self.people_count = 0
        self.vehicle_classes: dict[str, int] = defaultdict(int)
        self.colour_breakdown: dict[str, int] = defaultdict(int)
        self.plate_hashes_seen: set[str] = set()
        self.plate_sightings: list[dict] = []
        self.dwell_times: list[float] = []
        
        # Tracker for dwell time calculation
        self.tracker = DetectionTracker()
    
    def _window_utc(self, now: datetime) -> datetime:
        """Get the window start time by rounding down to window boundary."""
        minute = now.minute
        window_start_minute = (minute // self.window_minutes) * self.window_minutes
        return now.replace(minute=window_start_minute, second=0, microsecond=0)
    
    def _init_window(self, now: datetime) -> None:
        """Initialize a new window starting at the given time."""
        self.window_start = self._window_utc(now)
        self.window_end = self.window_start + timedelta(minutes=self.window_minutes)
        
        # Reset counters
        self.vehicle_count = 0
        self.people_count = 0
        self.vehicle_classes = defaultdict(int)
        self.colour_breakdown = defaultdict(int)
        self.plate_hashes_seen = set()
        self.plate_sightings = []
        self.dwell_times = []
        self.tracker = DetectionTracker()
    
    def add_detection(
        self, 
        detection, 
        colour: str, 
        plate_hash: Optional[str], 
        timestamp: datetime
    ) -> None:
        """
        Add a detection to the current window.
        
        Args:
            detection: Detection object (from vehicle_detector)
            colour: Colour classification (string)
            plate_hash: Optional SHA-256 hash of plate (None if not processed)
            timestamp: When the detection occurred
        """
        # Initialize window if this is the first detection
        if self.window_start is None:
            self._init_window(timestamp)
        
        # Check if we need to move to next window
        if timestamp >= self.window_end:
            # This shouldn't happen in normal flow — handled by is_window_complete
            return
        
        # Update counts
        if detection.class_name == 'person':
            self.people_count += 1
        else:
            self.vehicle_count += 1
            self.vehicle_classes[detection.class_name] += 1
        
        # Update colour breakdown
        self.colour_breakdown[colour] += 1
        
        # Track plate if present
        if plate_hash:
            self.plate_hashes_seen.add(plate_hash)
            self.plate_sightings.append({
                'hash': plate_hash,
                'seen_at': timestamp.isoformat(),
                'vehicle_class': detection.class_name
            })
    
    def add_dwell_times(self, dwell_times: dict[str, float]) -> None:
        """Add dwell times from the tracker to the running average."""
        self.dwell_times.extend(dwell_times.values())
    
    def is_window_complete(self, now: datetime) -> bool:
        """
        Check if the current window has elapsed.
        
        Args:
            now: Current timestamp
        
        Returns:
            True if window should be closed and uploaded
        """
        if self.window_start is None:
            return False
        return now >= self.window_end
    
    def get_and_reset(self, now: datetime) -> WindowReading:
        """
        Get the completed window reading and reset for next window.
        
        This should only be called when is_window_complete() returns True.
        
        Args:
            now: Current timestamp (used to set next window)
        
        Returns:
            WindowReading with aggregated data
        """
        # Flush any remaining dwell times
        remaining_dwell = self.tracker.flush()
        self.dwell_times.extend(remaining_dwell.values())
        
        # Calculate average dwell time
        avg_dwell = sum(self.dwell_times) / len(self.dwell_times) if self.dwell_times else 0.0
        
        reading = WindowReading(
            window_start=self.window_start,
            window_end=self.window_end,
            vehicle_count=self.vehicle_count,
            people_count=self.people_count,
            vehicle_classes=dict(self.vehicle_classes),
            colour_breakdown=dict(self.colour_breakdown),
            unique_plate_hashes=len(self.plate_hashes_seen),
            avg_dwell_secs=avg_dwell,
            plate_sightings=self.plate_sightings
        )
        
        # Reset for next window
        self._init_window(now)
        
        return reading
