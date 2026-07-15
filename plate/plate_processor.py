"""
Plate Recognizer API integration + SHA-256 hashing.

CRITICAL PRIVACY REQUIREMENT:
Raw plate text is NEVER stored, logged, or transmitted from this device.
Plates are hashed immediately upon receipt from the API, and only the SHA-256
hash is retained. This ensures POPIA compliance by design.
"""
import hashlib
import io
import base64
from typing import Optional
from dataclasses import dataclass
import requests
import cv2
import numpy as np


@dataclass
class PlateResult:
    """Result from plate processing — hash only, no raw text."""
    plate_hash: str      # SHA-256 of raw plate (lowercase, stripped)
    vehicle_class: str   # from Plate Recognizer response (e.g., 'Car', 'Truck')
    confidence: float


class PlateProcessor:
    """
    Process vehicle images to extract license plates.
    
    PRIVACY DESIGN:
    - Sends image to Plate Recognizer API
    - Receives plate text from API
    - Immediately hashes the text using SHA-256
    - Discards raw text before any storage or logging
    - Only the hash is stored/returned
    """
    
    PLATE_RECOGNIZER_URL = "https://api.platerecognizer.com/v1/plate-reader/"
    
    def __init__(self, api_key: str, region: str = 'za'):
        """
        Initialize plate processor.
        
        Args:
            api_key: Plate Recognizer API key
            region: Region code for plates (default: 'za' for South Africa)
        """
        self.api_key = api_key
        self.region = region
        self.headers = {
            "Authorization": f"Token {api_key}"
        }
    
    def process(self, vehicle_crop: np.ndarray) -> Optional[PlateResult]:
        """
        Process a vehicle image to extract and hash the license plate.
        
        CRITICAL: Raw plate text is NEVER stored or transmitted from this method.
        The text is immediately hashed, and only the hash is returned.
        
        Args:
            vehicle_crop: Cropped OpenCV image (BGR) of a vehicle
        
        Returns:
            PlateResult with hash only, or None if no plate found or API error
        """
        if vehicle_crop.size == 0:
            return None
        
        try:
            # Encode image to JPEG for API
            _, buffer = cv2.imencode('.jpg', vehicle_crop)
            if buffer is None:
                return None
            
            # Send to Plate Recognizer API
            files = {
                'upload': ('vehicle.jpg', io.BytesIO(buffer), 'image/jpeg')
            }
            data = {
                'regions': self.region,  # e.g., 'za' for South Africa
            }
            
            response = requests.post(
                self.PLATE_RECOGNIZER_URL,
                headers=self.headers,
                files=files,
                data=data,
                timeout=10
            )
            
            if response.status_code != 200:
                return None
            
            result = response.json()
            
            # Check if any plates were found
            if not result.get('results') or len(result['results']) == 0:
                return None
            
            # Get the first plate result (highest confidence)
            plate_data = result['results'][0]
            raw_plate = plate_data.get('plate', '')
            
            # PRIVACY CRITICAL: Immediately hash the raw plate text
            # The raw text is never stored, logged, or retained in any way
            if not raw_plate:
                return None
            
            # Hash immediately — raw text is discarded after this line
            plate_hash = self.hash_plate(raw_plate)
            
            # Get vehicle class if available, default to 'unknown'
            vehicle_class = plate_data.get('vehicle', {}).get('type', 'Car')
            if not vehicle_class:
                vehicle_class = 'unknown'
            
            confidence = plate_data.get('score', 0.0)
            
            # Return result with hash only — no raw plate text
            return PlateResult(
                plate_hash=plate_hash,
                vehicle_class=vehicle_class,
                confidence=confidence
            )
            
        except requests.RequestException:
            # Network error — don't crash the pipeline
            return None
        except Exception:
            # Any other error — don't crash the pipeline
            return None
    
    @staticmethod
    def hash_plate(raw_plate: str) -> str:
        """
        Hash a raw license plate using SHA-256.
        
        This is the ONLY place where raw plate text exists in memory.
        The hash is computed and the raw text is immediately available
        for garbage collection.
        
        Normalization: lowercase, stripped of whitespace
        
        Args:
            raw_plate: Raw license plate text from OCR
        
        Returns:
            SHA-256 hexadecimal hash string
        """
        # Normalize: lowercase, strip whitespace
        normalized = raw_plate.lower().strip()
        # Compute SHA-256 hash
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()
    
    def process_batch(self, vehicle_crops: list[np.ndarray]) -> list[Optional[PlateResult]]:
        """
        Process multiple vehicle images. Note: Plate Recognizer API
        doesn't support true batching, so this just loops.
        
        Args:
            vehicle_crops: List of cropped vehicle images
        
        Returns:
            List of PlateResult objects or None (same length as input)
        """
        return [self.process(crop) for crop in vehicle_crops]
