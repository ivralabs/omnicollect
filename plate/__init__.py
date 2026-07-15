"""
License plate detection and hashing module.
CRITICAL: Raw plate text is NEVER stored, logged, or transmitted.
All plates are hashed immediately (SHA-256) and only the hash is processed.
"""
from .plate_processor import PlateProcessor, PlateResult

__all__ = ["PlateProcessor", "PlateResult"]
