"""Signature candidates: short, recognizable INSTRUMENTAL pieces of a song, teased just before it lands
(GLOSSARY: Signature). Never a vocal line: the user's first listen rejected lyric lines. Pure functions over
the analysis (beats, downbeats, hooks) and the stems' bar levels; tools/prep/signatures.py cuts the audio
(the instrumental parts without the vocals, so no lyric ever leaks in) and writes the files.

Three kinds, each starting on one of the song's downbeats and lasting whole bars, so the engine can end
them on the landing:
- riff: two bars of the instrumental intro (before the first sung bar), the steadier and louder the better.
- build: the two bars leading into a chorus (a valid best/main hook), the build that makes it recognizable;
  played into the landing it is the song's own way into its chorus.
- motif: the chorus's instrumental line (the "other" stem over the hook's first two bars), when it carries.
Candidates are proposals: per song the best one above a score plays automatically (tools/prep/signatures.py
AUTO_MIN_SCORE), and the user can veto any, pick another, or turn the song's Signatures off.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

# Bar levels (dBFS, the stems' bar RMS from tools/prep/stems.py, at stemGain scale) that count as audible.
VOCAL_ON_DB = -26.0
VOCAL_OFF_DB = -38.0
OTHER_ON_DB = -28.0
# Every kind lasts two bars.
SIGNATURE_BARS = 2
# A riff is searched in the intro's first bars, before the first sung bar.
RIFF_SEARCH_BARS = 16
# How many of each kind to propose per song.
MAX_BUILDS = 2
MAX_MOTIFS = 1
# Frames for the loudness helpers below.
FRAME_SEC = 0.01


@dataclass(frozen=True)
class Candidate:
    kind: str  # 'riff' | 'build' | 'motif'
    stem: str  # 'instrumental' (the mix without the vocals) | 'other'
    start_sec: float  # where the slice starts in the song (a downbeat)
    end_sec: float
    anchor_sec: float  # where its first downbeat is, from start_sec (0: every kind starts on one)
    beats: float
    score: float
    source: str  # what it came from, for the report (a hook id, "intro")


def _bar(bars: dict[str, list[float]], stem: str, k: int) -> float:
    values = bars.get(stem) or []
    return values[k] if 0 <= k < len(values) else -120.0


def _mean(bars: dict[str, list[float]], stem: str, span: range) -> float:
    return float(np.mean([_bar(bars, stem, j) for j in span]))


def _hooks(analysis: dict) -> list[dict]:
    """The valid best and main hooks, best first, then in song order."""
    order = {"best": 0, "main": 1}
    return sorted(
        (h for h in analysis["hooks"] if h.get("valid") and h.get("tag") in order),
        key=lambda h: (order[h["tag"]], h["downbeatSec"]),
    )


def first_sung_bar(bars: dict[str, list[float]]) -> int:
    """The first bar whose vocals are clearly audible (the end of the intro); the bar count when none is."""
    vocals = bars.get("vocals") or []
    return next((k for k, db in enumerate(vocals) if db >= VOCAL_ON_DB), len(vocals))


def riff_candidates(analysis: dict, bars: dict[str, list[float]]) -> list[Candidate]:
    """The best two bars of the instrumental intro: the instruments carry, nothing is sung, and the same
    level goes on for two more bars (a riff that repeats, not a fade-in or a lone hit)."""
    downbeats: list[float] = analysis["downbeats"]
    bpb = analysis["tempo"]["beatsPerBar"]
    last = min(RIFF_SEARCH_BARS, first_sung_bar(bars), len(downbeats) - 1) - SIGNATURE_BARS
    best: Candidate | None = None
    for k in range(0, last + 1):
        span = range(k, k + SIGNATURE_BARS)
        if not all(_bar(bars, "other", j) >= OTHER_ON_DB and _bar(bars, "vocals", j) <= VOCAL_OFF_DB for j in span):
            continue
        other = _mean(bars, "other", span)
        drums = _mean(bars, "drums", span)
        after = range(k + SIGNATURE_BARS, k + 2 * SIGNATURE_BARS)
        steady = 1.0 - _norm(abs(_mean(bars, "other", after) - other), 1.5, 6.0)
        score = round(0.4 * _norm(other, -30, -14) + 0.25 * steady + 0.2 * _norm(other - drums, -6, 6) + 0.15 * (1 - k / RIFF_SEARCH_BARS), 3)
        if best is None or score > best.score:
            best = Candidate("riff", "instrumental", downbeats[k], downbeats[k + SIGNATURE_BARS], 0.0, SIGNATURE_BARS * bpb, score, "intro")
    return [best] if best else []


def build_candidates(analysis: dict, bars: dict[str, list[float]]) -> list[Candidate]:
    """The two bars into each chorus (a valid best/main hook) while the instruments play: the stronger the
    chorus hits after them, and the less is sung over them, the more they sound like its build."""
    downbeats: list[float] = analysis["downbeats"]
    bpb = analysis["tempo"]["beatsPerBar"]
    out: list[Candidate] = []
    used: set[int] = set()
    for h in _hooks(analysis):
        k = h["downbeatIndex"]
        if k < SIGNATURE_BARS or k in used or k >= len(downbeats):
            continue
        span = range(k - SIGNATURE_BARS, k)
        if not all(max(_bar(bars, "other", j), _bar(bars, "drums", j)) >= OTHER_ON_DB for j in span):
            continue
        band = lambda j: max(_bar(bars, "other", j), _bar(bars, "drums", j), _bar(bars, "bass", j))  # noqa: E731
        rise = band(k) - float(np.mean([band(j) for j in span]))
        sung = _mean(bars, "vocals", span)
        # Most pre-choruses are sung (their vocals are cut out of the file): an instrumental build is the real one.
        quiet = 1.0 - _norm(sung, VOCAL_OFF_DB, -20.0)
        score = round(0.35 * _norm(_mean(bars, "other", span), -30, -16) + 0.25 * _norm(rise, -2, 4) + 0.4 * quiet, 3)
        used.add(k)
        out.append(Candidate("build", "instrumental", downbeats[k - SIGNATURE_BARS], downbeats[k], 0.0, SIGNATURE_BARS * bpb, score, h["id"]))
        if len(out) >= MAX_BUILDS:
            break
    return out


def motif_candidates(analysis: dict, bars: dict[str, list[float]]) -> list[Candidate]:
    """The chorus's instrumental line: the "other" stem (no drums, bass or vocals) over a hook's first two
    bars, when it is loud and holds its own against the singer."""
    downbeats: list[float] = analysis["downbeats"]
    bpb = analysis["tempo"]["beatsPerBar"]
    out: list[Candidate] = []
    for h in _hooks(analysis):
        k = h["downbeatIndex"]
        if k + SIGNATURE_BARS >= len(downbeats):
            continue
        span = range(k, k + SIGNATURE_BARS)
        if not all(_bar(bars, "other", j) >= OTHER_ON_DB for j in span):
            continue
        other = _mean(bars, "other", span)
        score = round(0.6 * _norm(other, -28, -12) + 0.4 * _norm(other - _mean(bars, "vocals", span), -8, 4), 3)
        out.append(Candidate("motif", "other", downbeats[k], downbeats[k + SIGNATURE_BARS], 0.0, SIGNATURE_BARS * bpb, score, h["id"]))
        if len(out) >= MAX_MOTIFS:
            break
    return out


def candidates(analysis: dict, bars: dict[str, list[float]]) -> list[Candidate]:
    """Every kind's candidates for one song."""
    return riff_candidates(analysis, bars) + build_candidates(analysis, bars) + motif_candidates(analysis, bars)


def envelope_db(mono: np.ndarray, sr: int, frame_sec: float = FRAME_SEC) -> np.ndarray:
    """RMS per frame, in dBFS."""
    hop = max(1, int(round(frame_sec * sr)))
    frames = len(mono) // hop
    if frames == 0:
        return np.zeros(0)
    x = mono[: frames * hop].reshape(frames, hop)
    rms = np.sqrt(np.mean(x * x, axis=1))
    return 20 * np.log10(np.maximum(rms, 1e-7))


def gain_to_target_db(audio: np.ndarray, sr: int, target_db: float, floor_db: float = -40.0, limit_db: float = 12.0) -> float:
    """Gain that brings the slice's active part (10 ms frames above `floor_db`) to `target_db` RMS."""
    mono = audio.mean(axis=1) if audio.ndim == 2 else audio
    env = envelope_db(mono, sr)
    active = env[env > floor_db]
    if active.size == 0:
        return 0.0
    rms_db = 10 * np.log10(float(np.mean(10 ** (active / 10))))
    return round(float(np.clip(target_db - rms_db, -limit_db, limit_db)), 2)


def _norm(x: float, lo: float, hi: float) -> float:
    return float(np.clip((x - lo) / (hi - lo), 0.0, 1.0))
