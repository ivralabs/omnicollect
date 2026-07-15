"""
Test the on-device ALPR pipeline on a local image or video file.

Usage:
    python scripts/test_plate.py --image path/to/car.jpg
    python scripts/test_plate.py --video path/to/traffic.mp4
    python scripts/test_plate.py --image car.jpg --model ./models/yolov8n-plate.pt

Output:
    - Detected plate region (shown in window if --show, else printed to console)
    - OCR result: MASKED (privacy — raw text never displayed)
    - Hash: <sha256>
    - is_sa_plate: True/False
    - Confidence: 0.xx

NOTE: Raw plate text is NEVER shown. The script only displays the hash.
This mirrors the production privacy guarantee exactly.
"""
import argparse
import sys
import time
from pathlib import Path

# Ensure we can import from the project root
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import cv2
import numpy as np


def parse_args():
    parser = argparse.ArgumentParser(description="Test OmniCollect on-device ALPR pipeline")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--image", type=str, help="Path to a vehicle image (.jpg/.png)")
    group.add_argument("--video", type=str, help="Path to a video file (.mp4/.avi)")
    parser.add_argument(
        "--model",
        type=str,
        default="./models/yolov8n-plate.pt",
        help="Path to YOLOv8 plate detection model (default: ./models/yolov8n-plate.pt)"
    )
    parser.add_argument(
        "--show",
        action="store_true",
        help="Show detected plate region in an OpenCV window (requires display)"
    )
    parser.add_argument(
        "--no-gpu",
        action="store_true",
        help="Disable GPU (run CPU-only)"
    )
    parser.add_argument(
        "--confidence",
        type=float,
        default=0.4,
        help="Plate detection confidence threshold (default: 0.4)"
    )
    return parser.parse_args()


def process_image(frame: np.ndarray, processor, show: bool = False) -> dict:
    """Run the plate pipeline on a single frame and return result summary."""
    from plate.plate_processor import PlateResult

    start = time.time()
    result = processor.process(frame, vehicle_class="test")
    elapsed_ms = (time.time() - start) * 1000

    summary = {
        "plate_detected": result is not None,
        "plate_hash": result.plate_hash if result else None,
        "is_sa_plate": result.is_sa_plate if result else None,
        "confidence": result.confidence if result else None,
        "elapsed_ms": elapsed_ms,
    }

    # Show plate region (if detector found one)
    if show and result:
        from plate.plate_detector import PlateDetector
        detector = processor.detector
        plate_region = detector.detect(frame)
        if plate_region is not None:
            cv2.imshow("Detected Plate Region (masked)", plate_region.crop)
            cv2.waitKey(1000)

    return summary


def print_result(summary: dict, frame_num: int = None):
    """Print result to console — raw plate text never displayed."""
    label = f"Frame {frame_num}" if frame_num is not None else "Image"

    if not summary["plate_detected"]:
        print(f"{label}: NO PLATE DETECTED")
        return

    print(f"{label}: PLATE DETECTED")
    print(f"  Hash:       {summary['plate_hash']}")
    print(f"  SA plate:   {summary['is_sa_plate']}")
    print(f"  Confidence: {summary['confidence']:.3f}")
    print(f"  Time:       {summary['elapsed_ms']:.1f}ms")
    print(f"  Raw text:   [PRIVACY — never displayed]")


def test_image(image_path: str, model_path: str, show: bool, use_gpu: bool, confidence: float):
    """Test on a single image."""
    frame = cv2.imread(image_path)
    if frame is None:
        print(f"ERROR: Could not read image: {image_path}")
        sys.exit(1)

    print(f"Testing on image: {image_path} ({frame.shape[1]}x{frame.shape[0]})")

    from plate.plate_processor import PlateProcessor
    processor = PlateProcessor(model_path=model_path, use_gpu=use_gpu, confidence=confidence)

    summary = process_image(frame, processor, show=show)
    print_result(summary)

    if show:
        cv2.imshow("Input vehicle image", frame)
        print("\nPress any key to close windows...")
        cv2.waitKey(0)
        cv2.destroyAllWindows()


def test_video(video_path: str, model_path: str, show: bool, use_gpu: bool, confidence: float):
    """Test on a video file — process every 10th frame."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"ERROR: Could not open video: {video_path}")
        sys.exit(1)

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print(f"Testing on video: {video_path}")
    print(f"  Resolution: {w}x{h} @ {fps:.1f}fps, {total_frames} frames")
    print(f"  Processing every 10th frame...\n")

    from plate.plate_processor import PlateProcessor
    processor = PlateProcessor(model_path=model_path, use_gpu=use_gpu, confidence=confidence)

    detections = 0
    frame_count = 0
    processed = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1
            if frame_count % 10 != 0:
                continue

            processed += 1
            summary = process_image(frame, processor, show=show)

            if summary["plate_detected"]:
                detections += 1
                print_result(summary, frame_num=frame_count)

            if show:
                cv2.imshow("Video feed", frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("\nStopped by user.")
                    break

    except KeyboardInterrupt:
        print("\nInterrupted.")
    finally:
        cap.release()
        if show:
            cv2.destroyAllWindows()

    print(f"\n--- Summary ---")
    print(f"Frames processed:  {processed}")
    print(f"Plates detected:   {detections}")
    print(f"Detection rate:    {detections / max(processed, 1) * 100:.1f}%")


def main():
    args = parse_args()
    use_gpu = not args.no_gpu

    if args.image:
        test_image(args.image, args.model, args.show, use_gpu, args.confidence)
    elif args.video:
        test_video(args.video, args.model, args.show, use_gpu, args.confidence)


if __name__ == "__main__":
    main()
