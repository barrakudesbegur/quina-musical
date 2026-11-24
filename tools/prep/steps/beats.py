"""Beats and downbeats with Beat This! (MIT code and weights), plus a sub-frame grid refinement.

Beat This! peaks are quantized to its 50 fps frame grid (20 ms). Where the local tempo is steady we
replace each beat with a least-squares line fitted through its neighbours, which removes most of that
quantization. Irregular regions (rubato intros, fills) keep the raw values.
"""
from __future__ import annotations

import numpy as np

_MODEL = None
REFINE_HALF_WINDOW = 4
REFINE_MAX_RESIDUAL_SEC = 0.03


def run_beat_this(signal: np.ndarray, sample_rate: int, device: str = "cpu"):
    global _MODEL
    if _MODEL is None:
        from beat_this.inference import Audio2Beats

        _MODEL = Audio2Beats(checkpoint_path="final0", device=device, dbn=False)
    beats, downbeats = _MODEL(signal, sample_rate)
    return np.asarray(beats, dtype=float), np.asarray(downbeats, dtype=float)


def refine_beats(beats: np.ndarray) -> tuple[np.ndarray, int]:
    """Return refined beats and how many were replaced by the local linear fit."""
    refined = beats.copy()
    replaced = 0
    count = len(beats)
    for index in range(count):
        lo = max(0, index - REFINE_HALF_WINDOW)
        hi = min(count, index + REFINE_HALF_WINDOW + 1)
        if hi - lo < 5:
            continue
        x = np.arange(lo, hi, dtype=float)
        y = beats[lo:hi]
        slope, intercept = np.polyfit(x, y, 1)
        residuals = y - (slope * x + intercept)
        if np.max(np.abs(residuals)) < REFINE_MAX_RESIDUAL_SEC:
            refined[index] = slope * index + intercept
            replaced += 1
    # Keep strict monotonicity.
    for index in range(1, count):
        if refined[index] <= refined[index - 1]:
            refined[index] = beats[index]
    return refined, replaced


def downbeat_indices(beats: np.ndarray, downbeats: np.ndarray, tolerance: float = 0.07) -> np.ndarray:
    """Map each downbeat to the index of the nearest beat (Beat This! snaps downbeats to beats)."""
    indices = []
    for time in downbeats:
        nearest = int(np.argmin(np.abs(beats - time)))
        if abs(beats[nearest] - time) <= tolerance and (not indices or nearest > indices[-1]):
            indices.append(nearest)
    return np.asarray(indices, dtype=int)


def beats_per_bar(db_idx: np.ndarray) -> int:
    if len(db_idx) < 3:
        return 4
    gaps = np.diff(db_idx)
    values, counts = np.unique(gaps, return_counts=True)
    return int(values[np.argmax(counts)])


def apply_downbeat_overrides(beats: np.ndarray, db_idx: np.ndarray, override: dict, bpb: int):
    """Overrides: downbeatShiftBeats (int) rotates the bar phase; beatsPerBar forces a regular grid."""
    shift = int(override.get("downbeatShiftBeats", 0) or 0)
    forced_bpb = override.get("beatsPerBar")
    if forced_bpb:
        bpb = int(forced_bpb)
        anchor = int(db_idx[len(db_idx) // 2]) if len(db_idx) else 0
        db_idx = np.arange(anchor % bpb, len(beats), bpb, dtype=int)
    if shift:
        db_idx = db_idx + shift
        db_idx = db_idx[(db_idx >= 0) & (db_idx < len(beats))]
    return db_idx, bpb


def apply_tempo_factor(beats: np.ndarray, db_idx: np.ndarray, factor: float):
    """factor 0.5 keeps every other beat (half time); 2 inserts midpoints (double time)."""
    if factor == 0.5:
        keep = np.arange(0, len(beats), 2)
        if len(db_idx):
            keep = np.arange(db_idx[0] % 2, len(beats), 2)
        new_beats = beats[keep]
        position = {int(old): new for new, old in enumerate(keep)}
        new_db = np.asarray([position[int(i)] for i in db_idx if int(i) in position], dtype=int)
        return new_beats, new_db
    if factor == 2:
        mids = (beats[:-1] + beats[1:]) / 2
        new_beats = np.empty(len(beats) + len(mids))
        new_beats[0::2] = beats
        new_beats[1::2] = mids
        return new_beats, db_idx * 2
    return beats, db_idx


def regularize_downbeats(n_beats: int, db_idx: np.ndarray, bpb: int, lookahead_bars: int = 4) -> tuple[np.ndarray, dict]:
    """Make bars consistent: drop spurious half-bar downbeats, fill missing ones, and follow a real
    phase change only when the detections after it support the new phase better than the old one.

    Returns the regularized downbeat beat indices and counts of what changed.
    """
    detected = set(int(i) for i in db_idx)
    stats = {"filled": 0, "dropped": 0, "phaseChanges": 0}
    if len(db_idx) == 0 or bpb < 2:
        return db_idx, stats

    def support(start: int) -> int:
        return sum(1 for j in range(1, lookahead_bars + 1) if start + j * bpb in detected)

    out = [int(db_idx[0])]
    # Extend backwards so the grid also covers an intro before the first detection.
    while out[0] - bpb >= 0:
        out.insert(0, out[0] - bpb)
        stats["filled"] += 1
    current = int(db_idx[0])
    while current + bpb < n_beats:
        expected = current + bpb
        if expected in detected:
            stats["dropped"] += sum(1 for d in detected if current < d < expected)
            out.append(expected)
            current = expected
            continue
        # A detection near the expected bar line may be a genuine phase change (an odd-length bar).
        window = [d for d in detected if current < d <= expected + bpb // 2 and d != expected]
        best = max(window, key=lambda d: (support(d), -abs(d - expected)), default=None)
        if best is not None and support(best) >= 2 and support(best) > support(expected):
            stats["phaseChanges"] += 1
            stats["dropped"] += sum(1 for d in window if d < best)
            nxt = best
        else:
            stats["filled"] += 1
            stats["dropped"] += sum(1 for d in window if d < expected)
            nxt = expected
        out.append(nxt)
        current = nxt
    return np.asarray(sorted(set(out)), dtype=int), stats


def tag_phase_fit(beats: np.ndarray, db_idx: np.ndarray, tag_times: list[float], bpb: int) -> dict | None:
    """Mean distance (in beats) from each hand tag to its nearest downbeat, for every bar-phase shift."""
    if len(db_idx) < 4 or not tag_times:
        return None
    means = []
    for shift in range(bpb):
        idx = db_idx + shift
        idx = idx[(idx >= 0) & (idx < len(beats))]
        dbs = beats[idx]
        dist = []
        for t in tag_times:
            k = int(np.searchsorted(dbs, t)) - 1
            if k < 0 or k + 1 >= len(dbs):
                continue
            position = (t - dbs[k]) / (dbs[k + 1] - dbs[k]) * bpb
            dist.append(min(position, bpb - position))
        means.append(round(float(np.mean(dist)), 3) if dist else 99.0)
    return {"meanDistBeats": means, "bestShift": int(np.argmin(means)), "tags": len(tag_times)}
