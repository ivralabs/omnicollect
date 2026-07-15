"""
PaddleOCR-based license plate text extractor.

Extracts plate text from a plate region crop.
Handles common South African plate formats and normalises output.

SA plate formats supported:
  CA 123 456  — Western Cape (letters + 3-3 digits)
  GP 12 34 AB — Gauteng (letters + 2-2 digits + letters)  [newer]
  WP 123 456  — Western Province variations
  NP 123 456  — Northern Province
  Older/numeric: ABC 123, 123 ABC, etc.

# PRIVACY: this module sees raw plate text — never log, store, or return it
# Caller (PlateProcessor) hashes immediately after extract_text returns.
"""
import logging
import re
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# South African plate format patterns (post-normalisation, no spaces)
SA_PLATE_PATTERNS = [
    r'^[A-Z]{2}\d{6}$',            # CA123456 / WP123456 (2-letter prefix + 6 digits)
    r'^[A-Z]{2}\d{3}\d{3}$',       # same, with split
    r'^[A-Z]{2}\d{4}[A-Z]{2}$',    # GP1234AB (newer Gauteng)
    r'^[A-Z]{2}\d{2}\d{2}[A-Z]{2}$',  # GP1234AB split
    r'^[A-Z]{1,3}\d{3,4}$',        # older format: CAR1234
    r'^\d{3,4}[A-Z]{2,3}$',        # numeric first: 1234CA
    r'^[A-Z]{2}\d{2,3}[A-Z]{2,3}$', # mixed
    r'^[A-Z]{2}\d{3,6}$',          # general 2-prefix + digits
]

_COMPILED_PATTERNS = [re.compile(p) for p in SA_PLATE_PATTERNS]


class OCREngine:
    """
    PaddleOCR text extractor tuned for South African license plates.

    # PRIVACY: raw plate text — hash immediately in caller
    """

    def __init__(self, use_gpu: bool = True):
        """
        Initialize PaddleOCR.

        Args:
            use_gpu: Use CUDA GPU for inference (recommended on Jetson)
        """
        self._ocr = None
        self._use_gpu = use_gpu

        try:
            from paddleocr import PaddleOCR
            # use_angle_cls=True handles upside-down / tilted plates
            # det=True + rec=True = full pipeline
            self._ocr = PaddleOCR(
                use_angle_cls=True,
                lang='en',
                use_gpu=use_gpu,
                show_log=False,
                # Suppress PaddlePaddle startup noise
                enable_mkldnn=False,
            )
            logger.info(f"PaddleOCR initialized (GPU={use_gpu})")
        except Exception as e:
            logger.error(f"Failed to initialize PaddleOCR: {e}")
            raise

    def extract_text(self, plate_crop: np.ndarray) -> Optional[str]:
        """
        Extract and return cleaned plate text from a plate region image.

        # PRIVACY: raw plate text — hash immediately in caller
        # Returns None if no readable plate text found.

        Args:
            plate_crop: BGR image of the license plate region

        Returns:
            Normalised plate string (e.g. "CA123456") or None
        """
        if plate_crop is None or plate_crop.size == 0:
            return None

        try:
            processed = self.preprocess(plate_crop)
            result = self._ocr.ocr(processed, cls=True)

            if not result or not result[0]:
                return None

            # Collect all text segments, join them
            # PaddleOCR returns: [[[bbox, (text, confidence)], ...]]
            parts = []
            for line in result[0]:
                text = line[1][0] if line[1] else ''
                parts.append(text.strip())

            raw_text = ' '.join(p for p in parts if p)

            if not raw_text:
                return None

            # Clean and validate
            # PRIVACY: raw plate text — hash immediately in caller
            return self.clean_plate(raw_text)

        except Exception as e:
            logger.debug(f"OCR extraction failed: {e}")
            return None

    def clean_plate(self, raw_text: str) -> Optional[str]:
        """
        Normalise raw OCR output and validate as a South African plate.

        # PRIVACY: raw plate text — hash immediately in caller

        Steps:
        1. Uppercase
        2. Remove all non-alphanumeric characters (spaces, dashes, dots)
        3. Apply common OCR confusion fixes (0↔O, 1↔I)
        4. Validate against SA patterns
        5. Return None if it doesn't look like a valid SA plate

        Args:
            raw_text: Raw text from PaddleOCR

        Returns:
            Normalised plate string or None
        """
        if not raw_text:
            return None

        # Uppercase and strip
        text = raw_text.upper().strip()

        # Remove non-alphanumeric (spaces, hyphens, dots, special chars)
        text = re.sub(r'[^A-Z0-9]', '', text)

        if len(text) < 4 or len(text) > 10:
            return None

        # Common OCR confusion fixes for plates
        # Only apply if pattern doesn't match first
        if not self._matches_sa_pattern(text):
            # Try swapping common confusables
            candidates = [text]
            # O <-> 0 swaps (try both directions)
            if 'O' in text:
                candidates.append(text.replace('O', '0', 2))
            if '0' in text:
                candidates.append(text.replace('0', 'O', 2))
            # I <-> 1 swaps
            if 'I' in text:
                candidates.append(text.replace('I', '1', 2))
            if '1' in text:
                candidates.append(text.replace('1', 'I', 2))

            for candidate in candidates[1:]:
                if self._matches_sa_pattern(candidate):
                    text = candidate
                    break

        if not self._matches_sa_pattern(text):
            return None

        # PRIVACY: raw plate text — hash immediately in caller
        return text

    def _matches_sa_pattern(self, text: str) -> bool:
        """Check if text matches any known SA plate pattern."""
        return any(p.match(text) for p in _COMPILED_PATTERNS)

    def preprocess(self, crop: np.ndarray) -> np.ndarray:
        """
        Preprocess plate crop for optimal OCR accuracy.

        Steps:
        1. Resize to minimum 100px height (PaddleOCR accuracy floor)
        2. Convert to grayscale
        3. Apply CLAHE for contrast enhancement (handles shadows/glare)
        4. Convert back to BGR (PaddleOCR expects BGR input)

        Args:
            crop: Raw BGR plate crop

        Returns:
            Preprocessed BGR image
        """
        if crop is None or crop.size == 0:
            return crop

        h, w = crop.shape[:2]

        # Ensure minimum height of 100px for reliable OCR
        min_height = 100
        if h < min_height:
            scale = min_height / h
            new_w = int(w * scale)
            crop = cv2.resize(crop, (new_w, min_height), interpolation=cv2.INTER_CUBIC)

        # Convert to grayscale
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

        # CLAHE — adaptive histogram equalisation handles:
        # - uneven lighting
        # - shadows from overhead sun
        # - partial glare from headlights
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
        enhanced = clahe.apply(gray)

        # Convert back to BGR (PaddleOCR input format)
        return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
