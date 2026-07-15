"""
OmniCollect — Simple IoU centroid tracker.

Assigns stable IDs to detections across frames using bounding-box IoU overlap.
No deep learning required. Evicts tracks not seen for EVICT_AFTER frames.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import List, Optional, Tuple


EVICT_AFTER = 30  # frames before a lost track is removed
IOU_THRESHOLD = 0.25  # minimum IoU to match a detection to an existing track


@dataclass
class Track:
    id: int
    centroid: Tuple[float, float]   # (cx, cy) in pixels
    bbox: Tuple[float, float, float, float]  # (x1, y1, x2, y2) in pixels
    last_seen: int                   # frame counter value
    class_name: str
    confidence: float


def _iou(a: Tuple[float, float, float, float],
         b: Tuple[float, float, float, float]) -> float:
    """Intersection-over-Union for two (x1, y1, x2, y2) boxes."""
    ix1 = max(a[0], b[0])
    iy1 = max(a[1], b[1])
    ix2 = min(a[2], b[2])
    iy2 = min(a[3], b[3])

    inter_w = max(0.0, ix2 - ix1)
    inter_h = max(0.0, iy2 - iy1)
    inter = inter_w * inter_h

    area_a = max(0.0, a[2] - a[0]) * max(0.0, a[3] - a[1])
    area_b = max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])
    union = area_a + area_b - inter

    return inter / union if union > 0 else 0.0


class SimpleTracker:
    """
    Greedy IoU tracker. O(N*M) per frame — acceptable for edge vehicle counts.

    Usage:
        tracker = SimpleTracker()
        while True:
            detections = [{"bbox": (x1,y1,x2,y2), "class_name": "car", "confidence": 0.87}, ...]
            tracks = tracker.update(detections, frame_index)
    """

    def __init__(self) -> None:
        self._tracks: List[Track] = []
        self._next_id: int = 0

    def update(
        self,
        detections: List[dict],
        frame_index: int,
    ) -> List[Track]:
        """
        Match detections to existing tracks via IoU. Create new tracks for
        unmatched detections. Evict tracks not seen recently.

        Each detection dict must have keys:
            bbox        (x1, y1, x2, y2) floats in pixels
            class_name  str
            confidence  float
        """
        if not detections:
            self._evict(frame_index)
            return list(self._tracks)

        # Build centroid list for detections
        det_centroids: List[Tuple[float, float]] = []
        for d in detections:
            x1, y1, x2, y2 = d["bbox"]
            det_centroids.append(((x1 + x2) / 2.0, (y1 + y2) / 2.0))

        matched_track_ids: set[int] = set()
        matched_det_indices: set[int] = set()

        # Greedy best-IoU match
        iou_matrix: List[List[float]] = []
        for track in self._tracks:
            row = [_iou(track.bbox, d["bbox"]) for d in detections]
            iou_matrix.append(row)

        # Sort all (track_idx, det_idx) pairs by IoU descending, assign greedily
        pairs: List[Tuple[float, int, int]] = []
        for ti, row in enumerate(iou_matrix):
            for di, score in enumerate(row):
                if score >= IOU_THRESHOLD:
                    pairs.append((score, ti, di))
        pairs.sort(key=lambda x: x[0], reverse=True)

        for score, ti, di in pairs:
            if ti in matched_track_ids or di in matched_det_indices:
                continue
            # Update existing track
            d = detections[di]
            x1, y1, x2, y2 = d["bbox"]
            self._tracks[ti].centroid = det_centroids[di]
            self._tracks[ti].bbox = d["bbox"]
            self._tracks[ti].last_seen = frame_index
            self._tracks[ti].class_name = d["class_name"]
            self._tracks[ti].confidence = d["confidence"]
            matched_track_ids.add(ti)
            matched_det_indices.add(di)

        # Create new tracks for unmatched detections
        for di, d in enumerate(detections):
            if di in matched_det_indices:
                continue
            x1, y1, x2, y2 = d["bbox"]
            new_track = Track(
                id=self._next_id,
                centroid=det_centroids[di],
                bbox=d["bbox"],
                last_seen=frame_index,
                class_name=d["class_name"],
                confidence=d["confidence"],
            )
            self._tracks.append(new_track)
            self._next_id += 1

        self._evict(frame_index)
        return list(self._tracks)

    def _evict(self, frame_index: int) -> None:
        self._tracks = [
            t for t in self._tracks
            if (frame_index - t.last_seen) <= EVICT_AFTER
        ]
