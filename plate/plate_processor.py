"""
On-device license plate processing pipeline.

Replaces the Plate Recognizer API entirely.
Pipeline: vehicle crop → plate region detection → OCR → SHA-256 hash

PRIVACY DESIGN (POPIA compliant by design):
- Raw plate text NEVER leaves this module
- Raw plate text is NEVER logged
- Raw plate text is NEVER stored to disk
- Raw plate text NEVER appears in any return value
- Only the SHA-256 hash is used outside this module
- Raw text exists in memory only for the microseconds between OCR and hash
"""

import hashlib
import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np

from .plate_detector import PlateDetector
from .ocr_engine import OCREngine

logger = logging.getLogger(__name__)


@dataclass
class PlateResult:
    """Result from on-device plate processing — hash only, never raw text."""
    plate_hash: str       # SHA-256 of normalised plate text (uppercase, no spaces)
    vehicle_class: str    # passed in from YOLOv8 vehicle detector
    confidence: float     # OCR confidence score (0.0–1.0)
    is_sa_plate: bool     # True if text matched a known SA plate pattern


class PlateProcessor:
    """
    On-device license plate processing pipeline.

    No external API calls. Runs entirely on Jetson hardware.

    Architecture:
        vehicle_crop → PlateDetector (YOLOv8) → plate_region
                     → [fallback: full crop if no region found]
                     → OCREngine (PaddleOCR) → raw_text  ← PRIVACY BOUNDARY
                     → hash_plate() → plate_hash
                     → PlateResult (hash only)
    """

    def __init__(self, model_path: str, use_gpu: bool = True, confidence: float = 0.4):
        """
        Initialize the on-device ALPR pipeline.

        Args:
            model_path: Path to YOLOv8 plate detection model (.pt)
            use_gpu:    Use CUDA for both YOLOv8 and PaddleOCR
            confidence: Minimum detection confidence for plate region
        """
        self.detector = PlateDetector(model_path=model_path, confidence=confidence)
        self.ocr = OCREngine(use_gpu=use_gpu)

        mode = "fallback (full-crop OCR)" if self.detector.is_fallback else "plate-region detection + OCR"
        logger.info(f"PlateProcessor initialized — mode: {mode}, GPU={use_gpu}")

    def process(self, vehicle_crop: np.ndarray, vehicle_class: str = "unknown") -> Optional[PlateResult]:
        """
        Process a vehicle crop through the full on-device ALPR pipeline.

        Pipeline steps:
        1. Detect plate region within vehicle crop (YOLOv8)
        2. If no region detected, fall back to full vehicle crop
        3. Run PaddleOCR on the plate crop
        4. Clean and validate the OCR output as an SA plate
        5. Hash immediately — PRIVACY BOUNDARY
        6. Discard raw text
        7. Return PlateResult with hash only

        # PRIVACY: raw plate text exists only in step 3–5 (microseconds in memory)
        # It is NEVER logged, stored, returned, or visible outside this method.

        Args:
            vehicle_crop:  Cropped BGR image of a vehicle (from VehicleDetector.get_crop)
            vehicle_class: Vehicle type label (e.g. 'car', 'truck')

        Returns:
            PlateResult with plate_hash, or None if no valid plate found
        """
        if vehicle_crop is None or vehicle_crop.size == 0:
            return None

        # Step 1: Try to detect the plate region
        plate_region = self.detector.detect(vehicle_crop)

        if plate_region is not None:
            ocr_crop = plate_region.crop
            detect_confidence = plate_region.confidence
        else:
            # Step 2: Fallback — run OCR on full vehicle crop
            ocr_crop = vehicle_crop
            detect_confidence = 0.0

        # Step 3: Run OCR on the plate crop
        # PRIVACY: raw plate text — hash immediately below
        raw_plate = self.ocr.extract_text(ocr_crop)  # returns normalised text or None

        if not raw_plate:
            return None

        # Step 4: Validate (clean_plate already ran inside extract_text,
        # but we do a final check — is_sa_plate is already True here
        # since extract_text returns None for non-SA plates)
        is_sa = True  # extract_text only returns text matching SA patterns

        # Step 5 + 6: Hash immediately — PRIVACY BOUNDARY
        # PRIVACY: raw plate text — hash immediately
        plate_hash = self.hash_plate(raw_plate)
        # raw_plate goes out of scope here — available for GC

        # Step 7: Return hash only
        return PlateResult(
            plate_hash=plate_hash,
            vehicle_class=vehicle_class,
            confidence=detect_confidence if plate_region else 0.5,
            is_sa_plate=is_sa,
        )

    def process_batch(self, vehicle_crops: list[np.ndarray], vehicle_class: str = "unknown") -> list[Optional[PlateResult]]:
        """
        Process multiple vehicle crops.

        Args:
            vehicle_crops: List of BGR vehicle images
            vehicle_class: Vehicle type for all crops in this batch

        Returns:
            List of PlateResult or None, same length as input
        """
        return [self.process(crop, vehicle_class) for crop in vehicle_crops]

    @staticmethod
    def hash_plate(normalised_plate: str) -> str:
        """
        Hash a normalised plate string using SHA-256.

        Normalisation: uppercase, stripped of whitespace.
        Consistent hashing: same plate always produces same hash across sessions.

        # PRIVACY: raw plate text — hash immediately (this IS the hash function)

        Args:
            normalised_plate: Cleaned plate text (e.g. "CA123456")

        Returns:
            SHA-256 hex digest string (64 characters)
        """
        # PRIVACY: raw plate text — hash immediately
        canonical = normalised_plate.upper().strip()
        return hashlib.sha256(canonical.encode('utf-8')).hexdigest()
