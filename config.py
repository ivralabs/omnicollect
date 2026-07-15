"""
Configuration loader — loads config.yaml and merges with environment variables.
"""
import os
from pathlib import Path
from typing import Optional
import yaml


class Config:
    """Configuration manager for OmniCollect edge agent."""
    
    def __init__(self, config_path: Optional[str] = None):
        """Load configuration from YAML file and environment."""
        if config_path is None:
            # Look for config.yaml in same directory as this file
            config_path = Path(__file__).parent / "config.yaml"
        
        self._config = self._load_yaml(config_path)
        self._apply_env_overrides()
    
    def _load_yaml(self, path: Path) -> dict:
        """Load YAML configuration file."""
        if not path.exists():
            raise FileNotFoundError(f"Config file not found: {path}")
        
        with open(path, 'r') as f:
            return yaml.safe_load(f)
    
    def _apply_env_overrides(self) -> None:
        """Apply environment variable overrides for secrets."""
        # Site API key (from dashboard)
        if os.getenv('OMNICOLLECT_SITE_API_KEY'):
            self._config['site']['api_key'] = os.getenv('OMNICOLLECT_SITE_API_KEY')
        
        # Plate Recognizer API key
        if os.getenv('PLATE_RECOGNIZER_API_KEY'):
            self._config['plate']['api_key'] = os.getenv('PLATE_RECOGNIZER_API_KEY')
        
        # Camera URL (allows RTSP_URL env var)
        if os.getenv('RTSP_URL'):
            self._config['camera']['url'] = os.getenv('RTSP_URL')
        
        # Cloud ingest URL
        if os.getenv('OMNICOLLECT_INGEST_URL'):
            self._config['cloud']['ingest_url'] = os.getenv('OMNICOLLECT_INGEST_URL')
    
    # Site config
    @property
    def site_api_key(self) -> str:
        """Site API key from dashboard."""
        return self._config['site']['api_key']
    
    @property
    def site_name(self) -> str:
        """Human-readable site name."""
        return self._config['site']['name']
    
    # Camera config
    @property
    def camera_url(self) -> str:
        """RTSP stream URL."""
        return self._config['camera']['url']
    
    @property
    def fps_capture(self) -> int:
        """Frames per second to capture."""
        return self._config['camera']['fps_capture']
    
    @property
    def reconnect_delay(self) -> int:
        """Seconds to wait before reconnecting."""
        return self._config['camera']['reconnect_delay']
    
    # Detection config
    @property
    def model_path(self) -> str:
        """Path to YOLOv8 model weights."""
        return self._config['detection']['model']
    
    @property
    def detection_confidence(self) -> float:
        """Minimum confidence threshold for detections."""
        return self._config['detection']['confidence']
    
    @property
    def target_classes(self) -> list[int]:
        """COCO class IDs to detect."""
        return self._config['detection']['classes']
    
    # Plate config
    @property
    def plate_enabled(self) -> bool:
        """Whether plate recognition is enabled."""
        return self._config['plate']['enabled']
    
    @property
    def plate_api_key(self) -> str:
        """Plate Recognizer API key."""
        return self._config['plate']['api_key']
    
    @property
    def plate_region(self) -> str:
        """Region for plate recognition (e.g., 'za' for South Africa)."""
        return self._config['plate']['region']
    
    @property
    def plate_sample_rate(self) -> int:
        """Process 1 in N detections for plates (cost control)."""
        return self._config['plate']['sample_rate']
    
    # Aggregation config
    @property
    def window_minutes(self) -> int:
        """Length of aggregation window in minutes."""
        return self._config['aggregation']['window_minutes']
    
    @property
    def upload_on_complete(self) -> bool:
        """Upload data immediately when window completes."""
        return self._config['aggregation']['upload_on_complete']
    
    # Cloud config
    @property
    def ingest_url(self) -> str:
        """URL to POST aggregated readings."""
        return self._config['cloud']['ingest_url']
    
    @property
    def retry_attempts(self) -> int:
        """Number of retry attempts on upload failure."""
        return self._config['cloud']['retry_attempts']
    
    @property
    def retry_delay(self) -> int:
        """Seconds between retry attempts."""
        return self._config['cloud']['retry_delay']
