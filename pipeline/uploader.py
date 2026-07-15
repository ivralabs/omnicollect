"""
HTTPS POST to cloud /api/ingest.
Handles retries, exponential backoff, and offline queuing.
"""
import json
import time
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional
import requests

from .aggregator import WindowReading


class Uploader:
    """
    Upload aggregated readings to the OmniCollect cloud API.
    
    Features:
    - Retry with exponential backoff
    - Offline queue: saves to disk if upload fails persistently
    - Queue flush on startup: attempts to upload queued readings
    """
    
    QUEUE_DIR = Path("/data/queue")  # Balena persistent storage
    QUEUE_FILE = QUEUE_DIR / "pending_readings.jsonl"
    
    def __init__(
        self, 
        ingest_url: str, 
        site_api_key: str, 
        retry_attempts: int = 3,
        retry_delay: int = 30
    ):
        """
        Initialize uploader.
        
        Args:
            ingest_url: URL to POST readings to
            site_api_key: API key for authentication
            retry_attempts: Number of retry attempts before queuing
            retry_delay: Initial delay between retries (doubles each attempt)
        """
        self.ingest_url = ingest_url
        self.site_api_key = site_api_key
        self.retry_attempts = retry_attempts
        self.retry_delay = retry_delay
        self.logger = logging.getLogger(__name__)
        
        # Ensure queue directory exists
        self.QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    
    def _serialize_reading(self, reading: WindowReading) -> dict:
        """
        Serialize WindowReading to dict matching cloud API spec.
        
        The API expects:
        {
            "site_api_key": "...",
            "window_start": "...",
            "window_end": "...",
            "vehicle_count": N,
            "people_count": N,
            "vehicle_classes": {...},
            "colour_breakdown": {...},
            "unique_plate_hashes": N,
            "avg_dwell_secs": N.NN,
            "plate_sightings": [...]
        }
        """
        payload = reading.to_dict()
        payload['site_api_key'] = self.site_api_key
        return payload
    
    def upload(self, reading: WindowReading) -> bool:
        """
        Upload a reading to the cloud API.
        
        Attempts retries with exponential backoff. If all retries fail,
        saves to local queue for later upload.
        
        Args:
            reading: WindowReading to upload
        
        Returns:
            True on success, False if queued for later
        """
        payload = self._serialize_reading(reading)
        
        # Attempt upload with retries
        delay = self.retry_delay
        for attempt in range(self.retry_attempts):
            try:
                response = requests.post(
                    self.ingest_url,
                    json=payload,
                    headers={
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    self.logger.info(
                        f"Upload successful: window {reading.window_start.isoformat()}",
                        extra={"event": "upload_success", "window_start": reading.window_start.isoformat()}
                    )
                    return True
                
                # Log non-200 response
                self.logger.warning(
                    f"Upload failed (attempt {attempt + 1}/{self.retry_attempts}): "
                    f"HTTP {response.status_code}",
                    extra={
                        "event": "upload_retry",
                        "attempt": attempt + 1,
                        "status_code": response.status_code
                    }
                )
                
            except requests.RequestException as e:
                self.logger.warning(
                    f"Upload failed (attempt {attempt + 1}/{self.retry_attempts}): {str(e)}",
                    extra={"event": "upload_retry", "attempt": attempt + 1, "error": str(e)}
                )
            
            # Wait before retry (except on last attempt)
            if attempt < self.retry_attempts - 1:
                time.sleep(delay)
                delay *= 2  # Exponential backoff
        
        # All retries failed — queue for later
        self._queue_reading(reading)
        self.logger.error(
            f"Upload failed after {self.retry_attempts} attempts, queued for later",
            extra={"event": "upload_queued", "window_start": reading.window_start.isoformat()}
        )
        return False
    
    def _queue_reading(self, reading: WindowReading) -> None:
        """Save a reading to the local queue file."""
        try:
            payload = self._serialize_reading(reading)
            with open(self.QUEUE_FILE, 'a') as f:
                f.write(json.dumps(payload) + '\n')
        except Exception as e:
            self.logger.error(f"Failed to queue reading: {str(e)}", extra={"event": "queue_error"})
    
    def flush_queue(self) -> int:
        """
        Attempt to upload any queued readings from offline periods.
        
        Called on startup to clear any backlog.
        
        Returns:
            Number of successfully uploaded readings
        """
        if not self.QUEUE_FILE.exists():
            return 0
        
        uploaded = 0
        failed = []
        
        try:
            with open(self.QUEUE_FILE, 'r') as f:
                lines = f.readlines()
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                try:
                    payload = json.loads(line)
                    
                    # Attempt single upload (no retries for queued items)
                    response = requests.post(
                        self.ingest_url,
                        json=payload,
                        headers={'Content-Type': 'application/json'},
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        uploaded += 1
                    else:
                        failed.append(line)
                        
                except Exception as e:
                    self.logger.warning(f"Failed to upload queued reading: {str(e)}")
                    failed.append(line)
            
            # Rewrite queue file with only failed items
            if failed:
                with open(self.QUEUE_FILE, 'w') as f:
                    for line in failed:
                        f.write(line + '\n')
                self.logger.info(f"Queue flush: {uploaded} uploaded, {len(failed)} remain in queue")
            else:
                # All uploaded — remove queue file
                self.QUEUE_FILE.unlink()
                self.logger.info(f"Queue flush complete: {uploaded} readings uploaded")
                
        except Exception as e:
            self.logger.error(f"Failed to flush queue: {str(e)}")
        
        return uploaded
    
    def get_queue_size(self) -> int:
        """Get number of readings currently in queue."""
        if not self.QUEUE_FILE.exists():
            return 0
        
        try:
            with open(self.QUEUE_FILE, 'r') as f:
                return sum(1 for _ in f)
        except Exception:
            return 0
