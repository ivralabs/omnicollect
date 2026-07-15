"""
OmniCollect — Tripwire line crossing detector.

Uses the cross product (sign of the Z-component) to determine which side of a
directed line each track centroid is on.  A crossing is registered on the frame
where the sign changes (track was on side A last frame, side B this frame).

State is stored per track ID so the caller does not need to manage it.
"""
from __future__ import annotations

from typing import Dict, Optional, Tuple


# Sentinel — track has not been seen yet
_UNSET = 0


def _side(
    point: Tuple[float, float],
    line_start: Tuple[float, float],
    line_end: Tuple[float, float],
) -> int:
    """
    Return the sign of the cross product (line_end - line_start) x (point - line_start).
    Returns +1, -1, or 0 (on the line).
    """
    dx = line_end[0] - line_start[0]
    dy = line_end[1] - line_start[1]
    px = point[0] - line_start[0]
    py = point[1] - line_start[1]
    cross = dx * py - dy * px
    if cross > 0:
        return 1
    if cross < 0:
        return -1
    return 0


class TripwireState:
    """
    Stateful crossing detector for a single tripwire line.

    Create one instance per line; call check_crossing() for each tracked
    vehicle on every frame.
    """

    def __init__(
        self,
        line_start: Tuple[float, float],
        line_end: Tuple[float, float],
    ) -> None:
        self.line_start = line_start
        self.line_end = line_end
        # track_id -> last known side (+1 / -1 / 0)
        self._last_side: Dict[int, int] = {}

    def check_crossing(
        self,
        track_id: int,
        centroid: Tuple[float, float],
    ) -> bool:
        """
        Return True on the single frame when the track crosses the line.
        Subsequent frames on the same side return False.
        """
        current_side = _side(centroid, self.line_start, self.line_end)

        if track_id not in self._last_side:
            # First time we see this track — record side, no crossing yet
            self._last_side[track_id] = current_side
            return False

        previous_side = self._last_side[track_id]
        self._last_side[track_id] = current_side

        # A crossing requires both sides to be non-zero and different
        if previous_side != 0 and current_side != 0 and previous_side != current_side:
            return True

        return False

    def forget(self, track_id: int) -> None:
        """Remove state for a track that has been evicted."""
        self._last_side.pop(track_id, None)


# ---------------------------------------------------------------------------
# Module-level convenience function (matches the spec signature)
# ---------------------------------------------------------------------------

def check_crossing(
    track_id: int,
    centroid: Tuple[float, float],
    line_start: Tuple[float, float],
    line_end: Tuple[float, float],
    state: TripwireState,
) -> bool:
    """
    Stateless-looking wrapper around TripwireState.check_crossing().

    The caller must pass the same TripwireState instance on every frame.
    """
    return state.check_crossing(track_id, centroid)
