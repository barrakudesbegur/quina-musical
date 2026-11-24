"""Integrated loudness (BS.1770-4 via pyloudnorm), true peak (4x oversampled) and per-hook loudness."""
from __future__ import annotations

import numpy as np

TARGET_LUFS = -14.0
HOOK_WINDOW_SEC = 8.0
MAX_BOOST_DB = 6.0


def integrated(signal: np.ndarray, sr: int) -> float:
    import pyloudnorm as pyln

    meter = pyln.Meter(sr)
    return float(meter.integrated_loudness(signal))


def true_peak_dbtp(signal: np.ndarray) -> float:
    from scipy.signal import resample_poly

    peak = 0.0
    # Chunked to keep memory low; overlap avoids missing peaks at chunk edges.
    chunk = 48000 * 20
    for start in range(0, len(signal), chunk):
        part = signal[max(0, start - 64): start + chunk + 64]
        up = resample_poly(part, 4, 1, axis=0)
        peak = max(peak, float(np.max(np.abs(up))))
    return 20 * np.log10(max(peak, 1e-9))


def window_lufs(signal: np.ndarray, sr: int, start: float, seconds: float = HOOK_WINDOW_SEC) -> float | None:
    import pyloudnorm as pyln

    a = int(max(0, start) * sr)
    b = int(min(len(signal), (start + seconds) * sr))
    if b - a < int(0.5 * sr):
        return None
    meter = pyln.Meter(sr)
    value = float(meter.integrated_loudness(signal[a:b]))
    return value if np.isfinite(value) else None


def gain_to_target(lufs: float | None, target: float = TARGET_LUFS) -> float:
    if lufs is None or not np.isfinite(lufs):
        return 0.0
    return round(float(min(MAX_BOOST_DB, target - lufs)), 2)
