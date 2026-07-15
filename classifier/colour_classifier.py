"""
HSV-based vehicle colour detection.
Takes a cropped vehicle image, returns dominant colour label.
"""
from typing import Optional
import cv2
import numpy as np


class ColourClassifier:
    """
    Classify vehicle colour from cropped image using HSV colour space.
    
    Colour map (HSV ranges → label):
    - Red: H 0-10 or 170-180
    - Orange: H 10-25
    - Yellow: H 25-35
    - Green: H 35-85
    - Blue: H 85-130
    - Purple: H 130-160
    - White: S < 30, V > 200
    - Black: V < 50
    - Silver/Grey: S < 30, V 50-200
    """
    
    COLOURS = ['white', 'black', 'silver', 'red', 'blue', 'green', 'yellow', 'orange', 'other']
    
    # HSV thresholds for colour classification
    # Format: (low_h, low_s, low_v, high_h, high_s, high_v)
    COLOUR_RANGES = {
        'red': [
            ((0, 50, 50), (10, 255, 255)),      # Lower red range
            ((170, 50, 50), (180, 255, 255))    # Upper red range (wraps around)
        ],
        'orange': [
            ((10, 50, 50), (25, 255, 255))
        ],
        'yellow': [
            ((25, 50, 50), (35, 255, 255))
        ],
        'green': [
            ((35, 50, 50), (85, 255, 255))
        ],
        'blue': [
            ((85, 50, 50), (130, 255, 255))
        ],
        'purple': [
            ((130, 50, 50), (160, 255, 255))
        ],
    }
    
    # Grayscale thresholds (low saturation)
    GRAYSCALE_RANGES = {
        'white': ((0, 0, 200), (180, 30, 255)),   # Low saturation, high value
        'black': ((0, 0, 0), (180, 255, 50)),     # Any saturation, very low value
        'silver': ((0, 0, 50), (180, 30, 200)),  # Low saturation, mid value
    }
    
    def __init__(self):
        """Initialize the colour classifier."""
        pass
    
    def classify(self, vehicle_crop: np.ndarray) -> str:
        """
        Classify the dominant colour of a vehicle from a cropped image.
        
        Args:
            vehicle_crop: Cropped OpenCV image (BGR) of a vehicle
        
        Returns:
            Colour label string from COLOURS list
        """
        if vehicle_crop.size == 0:
            return 'other'
        
        # Resize to a consistent size for analysis
        resized = cv2.resize(vehicle_crop, (100, 100))
        
        # Convert BGR to HSV
        hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
        
        # Count pixels matching each colour
        colour_counts = {colour: 0 for colour in self.COLOURS}
        
        # Count grayscale colours first (white, black, silver)
        total_pixels = hsv.shape[0] * hsv.shape[1]
        matched_pixels = 0
        
        for colour, (lower, upper) in self.GRAYSCALE_RANGES.items():
            lower_np = np.array(lower, dtype=np.uint8)
            upper_np = np.array(upper, dtype=np.uint8)
            mask = cv2.inRange(hsv, lower_np, upper_np)
            colour_counts[colour] = cv2.countNonZero(mask)
            matched_pixels += colour_counts[colour]
        
        # Count HSV colours
        for colour, ranges in self.COLOUR_RANGES.items():
            count = 0
            for lower, upper in ranges:
                lower_np = np.array(lower, dtype=np.uint8)
                upper_np = np.array(upper, dtype=np.uint8)
                mask = cv2.inRange(hsv, lower_np, upper_np)
                count += cv2.countNonZero(mask)
            colour_counts[colour] = count
            matched_pixels += count
        
        # If very few pixels match known colours, return 'other'
        if matched_pixels < total_pixels * 0.05:  # Less than 5% match
            return 'other'
        
        # Find the colour with most matching pixels
        # Ignore 'other' in the max check, it's a fallback
        max_colour = max(
            (k for k in colour_counts if k != 'other'),
            key=lambda k: colour_counts[k]
        )
        
        return max_colour
    
    def classify_with_confidence(self, vehicle_crop: np.ndarray) -> tuple[str, float]:
        """
        Classify colour and return confidence score.
        
        Args:
            vehicle_crop: Cropped OpenCV image (BGR) of a vehicle
        
        Returns:
            Tuple of (colour_label, confidence_score)
        """
        if vehicle_crop.size == 0:
            return 'other', 0.0
        
        resized = cv2.resize(vehicle_crop, (100, 100))
        hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
        
        colour_counts = {colour: 0 for colour in self.COLOURS}
        
        # Count grayscale colours
        for colour, (lower, upper) in self.GRAYSCALE_RANGES.items():
            lower_np = np.array(lower, dtype=np.uint8)
            upper_np = np.array(upper, dtype=np.uint8)
            mask = cv2.inRange(hsv, lower_np, upper_np)
            colour_counts[colour] = cv2.countNonZero(mask)
        
        # Count HSV colours
        for colour, ranges in self.COLOUR_RANGES.items():
            count = 0
            for lower, upper in ranges:
                lower_np = np.array(lower, dtype=np.uint8)
                upper_np = np.array(upper, dtype=np.uint8)
                mask = cv2.inRange(hsv, lower_np, upper_np)
                count += cv2.countNonZero(mask)
            colour_counts[colour] = count
        
        total_pixels = hsv.shape[0] * hsv.shape[1]
        total_matched = sum(colour_counts[k] for k in colour_counts if k != 'other')
        
        if total_matched == 0:
            return 'other', 0.0
        
        # Find max
        max_colour = max(
            (k for k in colour_counts if k != 'other'),
            key=lambda k: colour_counts[k]
        )
        
        confidence = colour_counts[max_colour] / total_matched
        return max_colour, confidence
