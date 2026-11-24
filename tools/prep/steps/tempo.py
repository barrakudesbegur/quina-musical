"""Tempo summary and cross-checks (librosa, Spotify features)."""
from __future__ import annotations

import numpy as np

UNSTABLE_BAR_SPREAD_PCT = 3.0


def tempo_summary(beats: np.ndarray, downbeats: np.ndarray, bpb: int) -> dict:
    ibi = np.diff(beats)
    bpm = 60.0 / float(np.median(ibi)) if len(ibi) else 0.0
    bars = np.diff(downbeats)
    if len(bars) >= 8:
        # Ignore the outer 5% of the song (rubato intros, fade-outs).
        lo, hi = int(len(bars) * 0.05), int(np.ceil(len(bars) * 0.95))
        core = bars[lo:hi]
    else:
        core = bars
    bar_median = float(np.median(core)) if len(core) else bpb * 60.0 / max(bpm, 1)
    q75, q25 = (np.percentile(core, [75, 25]) if len(core) else (0, 0))
    iqr_pct = float((q75 - q25) / bar_median * 100) if bar_median else 0.0
    return {
        "bpm": round(bpm, 2),
        "beatsPerBar": int(bpb),
        "barSecMedian": round(bar_median, 4),
        "barSecIqrPct": round(iqr_pct, 2),
        "isStable": bool(iqr_pct <= UNSTABLE_BAR_SPREAD_PCT),
        "estimates": {"beatThisIbiMedian": round(bpm, 2)},
    }


def librosa_tempo(onset_env: np.ndarray, sr: int, hop: int) -> float | None:
    import librosa

    fn = getattr(getattr(librosa.feature, "rhythm", None), "tempo", None) or getattr(librosa.feature, "tempo", None)
    if fn is None:
        fn = librosa.beat.tempo
    value = fn(onset_envelope=onset_env, sr=sr, hop_length=hop)
    return round(float(np.atleast_1d(value)[0]), 2)


def compare_to_reference(ours: float, ref: float | None) -> dict:
    """Fold ours/ref into [0.5, 2] and classify per the report's rules."""
    if not ref or not ours:
        return {"status": "missing"}
    ratio = ours / ref
    folded = ratio
    steps = 0
    while folded > 1.5:
        folded /= 2
        steps += 1
    while folded < 0.75:
        folded *= 2
        steps += 1
    if abs(ratio - 1) <= 0.02:
        return {"status": "agree", "ratio": round(ratio, 4)}
    if abs(folded - 1) <= 0.02:
        return {"status": "half_double", "ratio": round(ratio, 4)}
    for metric in (1.5, 2 / 3, 0.75, 4 / 3):
        if abs(ratio / metric - 1) <= 0.02 or abs(folded / metric - 1) <= 0.02:
            return {"status": "metre_ambiguous", "ratio": round(ratio, 4)}
    return {"status": "disagree", "ratio": round(ratio, 4)}
