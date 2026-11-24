"""Per-bar energy: RMS in dB and mean onset strength (normalized 0..1 per song)."""
from __future__ import annotations

import numpy as np

ONSET_SR = 22050
ONSET_HOP = 512


def onset_envelope(mono: np.ndarray, sr: int) -> np.ndarray:
    import librosa

    y = librosa.resample(mono, orig_sr=sr, target_sr=ONSET_SR, res_type="soxr_hq")
    return librosa.onset.onset_strength(y=y, sr=ONSET_SR, hop_length=ONSET_HOP)


def per_bar(mono: np.ndarray, sr: int, downbeats: np.ndarray, onset_env: np.ndarray) -> dict:
    rms_db = []
    onset = []
    frame_sec = ONSET_HOP / ONSET_SR
    for a, b in zip(downbeats[:-1], downbeats[1:]):
        seg = mono[int(a * sr): int(b * sr)]
        rms = float(np.sqrt(np.mean(seg.astype(np.float64) ** 2))) if len(seg) else 0.0
        rms_db.append(round(20 * np.log10(max(rms, 1e-6)), 2))
        fa, fb = int(a / frame_sec), max(int(a / frame_sec) + 1, int(b / frame_sec))
        onset.append(float(np.mean(onset_env[fa:fb])) if fa < len(onset_env) else 0.0)
    peak = max(onset) if onset else 1.0
    onset = [round(v / peak, 3) if peak else 0.0 for v in onset]
    return {"barRmsDb": rms_db, "barOnset": onset}


def rms_db(mono: np.ndarray, sr: int, start: float, seconds: float) -> float | None:
    seg = mono[int(max(0, start) * sr): int((start + seconds) * sr)]
    if not len(seg):
        return None
    rms = float(np.sqrt(np.mean(seg.astype(np.float64) ** 2)))
    return round(20 * np.log10(max(rms, 1e-6)), 2)
