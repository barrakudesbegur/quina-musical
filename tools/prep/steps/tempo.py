"""Tempo summary and cross-checks (librosa, Spotify features)."""
from __future__ import annotations

import numpy as np

UNSTABLE_BAR_SPREAD_PCT = 3.0
# Half time (Beat This! counting twice the tempo). With Spotify features: Spotify and librosa both within 3% of half.
HALF_TIME_TOLERANCE = 0.03
# Without them (the playlist fetcher doesn't produce them, so this year's repertoire has none): librosa within 5% of half, and Beat This!
# at least 160 BPM, too fast for this music. On last year's 77 songs this halves exactly the one song Spotify did
# (Besos: Beat This! 214, librosa 103.4) and no other; the fast songs that really are fast (158–176) keep their tempo.
HALF_TIME_TOLERANCE_LIBROSA_ONLY = 0.05
HALF_TIME_MIN_BPM_LIBROSA_ONLY = 160.0


def half_time(raw_bpm: float, librosa_bpm: float | None, spotify_bpm: float | None) -> str | None:
    """Why Beat This!'s tempo should be halved, or None: 'spotify' when Spotify and librosa both put it at half;
    'librosa' when there is no Spotify tempo, librosa puts it at half and Beat This!'s is implausibly fast."""
    if not raw_bpm or not librosa_bpm:
        return None
    half = raw_bpm / 2
    if spotify_bpm:
        ok = abs(spotify_bpm / half - 1) < HALF_TIME_TOLERANCE and abs(librosa_bpm / half - 1) < HALF_TIME_TOLERANCE
        return "spotify" if ok else None
    if raw_bpm >= HALF_TIME_MIN_BPM_LIBROSA_ONLY and abs(librosa_bpm / half - 1) < HALF_TIME_TOLERANCE_LIBROSA_ONLY:
        return "librosa"
    return None


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
