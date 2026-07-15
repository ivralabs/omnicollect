"""
Model manager for the YOLOv8 plate detection model.

Phase 1: Downloads a pre-trained open-source plate detection model
         as a baseline (works reasonably well on SA plates).
Phase 2: Replace with our own YOLOv8n model fine-tuned on SA plates
         (see scripts/train/README.md for training instructions).

To swap models: just replace the .pt file at the configured model_path.
No code changes required.
"""
import logging
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

# Known open-source YOLOv8 plate detection model sources.
# These are community models trained on mixed datasets — performance on
# SA plates is reasonable but a fine-tuned model will be significantly better.
#
# NOTE: URLs may change. If a download fails, manually place a plate-detection
# .pt file at the configured model_path and the agent will use it automatically.
PLATE_MODEL_SOURCES: dict[str, str | None] = {
    # YOLOv8n trained on CCPD + mixed plate dataset (Chinese + international)
    # Plate class ID: 0
    # Works on rectangular plates — reasonable SA baseline.
    "yolov8n-plate": (
        "https://github.com/rigvedrs/YOLO-V8-CAR-PLATE-DETECTION/releases/download/v1.0/best.pt"
    ),
    # Fallback: use the standard YOLOv8n COCO model
    # (no dedicated plate class — OCR on full vehicle crop instead)
    "fallback": None,
}

# Production model name used by default
DEFAULT_MODEL = "yolov8n-plate"


class ModelManager:
    """
    Manages lifecycle of the YOLOv8 plate detection model file.

    Usage:
        manager = ModelManager(model_dir="./models")
        model_path = manager.ensure_plate_model()
        # Pass model_path to PlateDetector(model_path=...)
    """

    def __init__(self, model_dir: str = "./models"):
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)

    def ensure_plate_model(self, model_name: str = DEFAULT_MODEL) -> str:
        """
        Ensure the plate detection model is available locally.

        If the model file doesn't exist, attempts to download it.
        If download fails, returns the fallback model path (yolov8n.pt)
        which allows the pipeline to run in full-crop OCR mode.

        Args:
            model_name: Key in PLATE_MODEL_SOURCES

        Returns:
            Absolute path to the model file (may not exist if download failed)
        """
        model_path = self.model_dir / f"{model_name}.pt"

        if model_path.exists():
            logger.info(f"Plate model already present: {model_path}")
            return str(model_path)

        url = PLATE_MODEL_SOURCES.get(model_name)
        if not url:
            logger.warning(f"No download URL for model '{model_name}' — fallback mode")
            return self.get_fallback_model()

        logger.info(f"Downloading plate model '{model_name}' from {url}...")
        try:
            tmp_path = model_path.with_suffix(".tmp")
            urllib.request.urlretrieve(url, tmp_path)
            tmp_path.rename(model_path)
            logger.info(f"Plate model downloaded: {model_path}")
            return str(model_path)

        except Exception as e:
            logger.warning(
                f"Failed to download plate model ({e}). "
                "The agent will run in full-crop OCR mode (lower accuracy). "
                "To fix: manually place a plate detection .pt file at "
                f"{model_path} and restart."
            )
            # Clean up partial download
            tmp_path = model_path.with_suffix(".tmp")
            if tmp_path.exists():
                tmp_path.unlink()
            return self.get_fallback_model()

    def get_fallback_model(self) -> str:
        """
        Returns path to standard YOLOv8n.pt for vehicle detection fallback.

        In fallback mode PlateDetector returns None → OCR runs on the full
        vehicle crop rather than a focused plate region.

        Returns:
            Path string (file may not exist — ultralytics will auto-download it)
        """
        fallback = self.model_dir / "yolov8n.pt"
        return str(fallback)

    def list_available(self) -> list[str]:
        """List all model files currently on disk."""
        return [str(p) for p in self.model_dir.glob("*.pt")]
