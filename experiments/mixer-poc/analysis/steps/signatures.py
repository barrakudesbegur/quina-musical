"""Signature candidates: short, iconic, isolated pieces of a song that a transition can layer (GLOSSARY:
Signature). Pure functions over the analysis (beats, downbeats, hooks) and the stems' bar levels, plus a
vocal envelope for shouts; analysis/signatures.py cuts the audio and writes the files.

Three kinds, all placed on the song's own grid so the engine can line their anchor up with a beat:
- call: the vocal line that opens a hook (from its pickup to the end of its first bar). Hooks are the
  recognisable part of a song by definition, so the first line of one is the most iconic vocal there is.
- riff: two bars of an instrumental intro (the "other" stem, or the mix when the drums carry it) while
  the vocals are silent.
- shout: a short vocal burst (at most about a beat and a half) between silences, like "Hey!".
Candidates are only proposals: the user approves them on the audition page, and only approved ones play.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

# Bar levels (dBFS, the stems' bar RMS from analysis/stems.py, at stemGain scale) that count as audible.
VOCAL_ON_DB = -26.0
VOCAL_OFF_DB = -38.0
OTHER_ON_DB = -28.0
# A call's vocals must stand out this much against the louder of the other stems in that bar.
CALL_MIN_LEAD_DB = -8.0
# Shouts, on a 10 ms vocal envelope, relative to the song's typical singing level (the median of its
# audible frames): separated vocals always carry some bleed, so fixed dBFS thresholds find almost none.
FRAME_SEC = 0.01
AUDIBLE_DB = -60.0
SHOUT_SILENT_BELOW = 15.0
SHOUT_ATTACK_BELOW = 8.0
SHOUT_PEAK_BELOW = 1.0
SHOUT_MAX_BEATS = 1.5
SHOUT_SILENT_BEFORE_BEATS = 0.75
SHOUT_PRE_ROLL_SEC = 0.03
SHOUT_TAIL_SEC = 0.12
# Search the intro for a riff within its first bars.
RIFF_SEARCH_BARS = 16
RIFF_BARS = 2
# How many of each kind to propose per song.
MAX_CALLS = 2
MAX_SHOUTS = 2
SHOUT_MIN_SPACING_BARS = 8


@dataclass(frozen=True)
class Candidate:
    kind: str  # 'call' | 'riff' | 'shout'
    stem: str  # 'vocals' | 'other' | 'mix'
    start_sec: float  # where the slice starts in the song
    end_sec: float
    anchor_sec: float  # where its first downbeat (or a shout's attack) is, from start_sec
    beats: float
    score: float
    source: str  # what it came from, for the report (a hook id, "intro", "vocal burst")


def _bar(bars: dict[str, list[float]], stem: str, k: int) -> float:
    values = bars.get(stem) or []
    return values[k] if 0 <= k < len(values) else -120.0


def call_candidates(analysis: dict, bars: dict[str, list[float]]) -> list[Candidate]:
    """The vocal line opening each valid best/main hook whose first bar is clearly sung."""
    downbeats: list[float] = analysis["downbeats"]
    beat = 60.0 / analysis["tempo"]["bpm"]
    bpb = analysis["tempo"]["beatsPerBar"]
    order = {"best": 0, "main": 1}
    hooks = sorted(
        (h for h in analysis["hooks"] if h.get("valid") and h.get("tag") in order),
        key=lambda h: (order[h["tag"]], h["downbeatSec"]),
    )
    out: list[Candidate] = []
    used_bars: set[int] = set()
    for h in hooks:
        k = h["downbeatIndex"]
        if k in used_bars or k + 1 >= len(downbeats):
            continue
        vocal = _bar(bars, "vocals", k)
        lead = vocal - max(_bar(bars, "other", k), _bar(bars, "drums", k))
        if vocal < VOCAL_ON_DB or lead < CALL_MIN_LEAD_DB:
            continue
        pickup = min(h.get("pickupSec") or 0.0, h["downbeatSec"])
        start = h["downbeatSec"] - pickup
        end = downbeats[k + 1]
        used_bars.add(k)
        # Louder and more isolated is more recognisable; a hook tagged "best" gets a small bonus.
        score = round(0.6 * _norm(vocal, -30, -12) + 0.4 * _norm(lead, -8, 8) + (0.1 if h["tag"] == "best" else 0), 3)
        out.append(Candidate("call", "vocals", start, end, pickup, bpb + pickup / beat, score, h["id"]))
        if len(out) >= MAX_CALLS:
            break
    return out


def riff_candidates(analysis: dict, bars: dict[str, list[float]]) -> list[Candidate]:
    """Two bars of the intro where the instruments play and the vocals are silent."""
    downbeats: list[float] = analysis["downbeats"]
    bpb = analysis["tempo"]["beatsPerBar"]
    for k in range(min(RIFF_SEARCH_BARS, len(downbeats) - RIFF_BARS)):
        span = range(k, k + RIFF_BARS)
        if all(_bar(bars, "other", j) >= OTHER_ON_DB and _bar(bars, "vocals", j) <= VOCAL_OFF_DB for j in span):
            other = float(np.mean([_bar(bars, "other", j) for j in span]))
            drums = float(np.mean([_bar(bars, "drums", j) for j in span]))
            stem = "other" if other >= drums - 3 else "mix"
            score = round(0.7 * _norm(other, -30, -12) + 0.3 * _norm(other - drums, -6, 6), 3)
            return [Candidate("riff", stem, downbeats[k], downbeats[k + RIFF_BARS], 0.0, RIFF_BARS * bpb, score, "intro")]
    return []


def shout_candidates(vocal_db: np.ndarray, frame_sec: float, analysis: dict, offset_sec: float = 0.0) -> list[Candidate]:
    """Short vocal bursts between silences, from a vocal envelope in dBFS (one value per frame).

    `offset_sec` is the song time of the envelope's first frame (stems are stored in windows).
    """
    audible = vocal_db[vocal_db > AUDIBLE_DB]
    if audible.size == 0:
        return []
    typical = float(np.median(audible))
    silent_db = typical - SHOUT_SILENT_BELOW
    attack_db = typical - SHOUT_ATTACK_BELOW
    peak_db = typical - SHOUT_PEAK_BELOW
    beat = 60.0 / analysis["tempo"]["bpm"]
    bar = beat * analysis["tempo"]["beatsPerBar"]
    silent_frames = max(1, int(round(SHOUT_SILENT_BEFORE_BEATS * beat / frame_sec)))
    max_frames = int(round(SHOUT_MAX_BEATS * beat / frame_sec))
    found: list[Candidate] = []
    i = silent_frames
    n = len(vocal_db)
    while i < n - 1:
        if vocal_db[i] < attack_db or vocal_db[i - silent_frames:i].max() > silent_db:
            i += 1
            continue
        # The burst: from the attack until the vocals fall silent again.
        end = i
        while end < n and vocal_db[end] > silent_db and end - i <= max_frames:
            end += 1
        if end - i <= max_frames and end < n and vocal_db[i:end].max() >= peak_db:
            attack = offset_sec + i * frame_sec
            length = (end - i) * frame_sec
            peak = float(vocal_db[i:end].max())
            score = round(0.6 * _norm(peak - typical, -1, 6) + 0.4 * _norm(peak - float(vocal_db[i - silent_frames:i].max()), 10, 40), 3)
            start = attack - SHOUT_PRE_ROLL_SEC
            found.append(Candidate("shout", "vocals", start, attack + length + SHOUT_TAIL_SEC, SHOUT_PRE_ROLL_SEC, length / beat, score, "vocal burst"))
        i = max(end, i + 1)
    # The strongest ones, far enough apart to be different moments.
    chosen: list[Candidate] = []
    for c in sorted(found, key=lambda c: -c.score):
        if all(abs(c.start_sec - o.start_sec) >= SHOUT_MIN_SPACING_BARS * bar for o in chosen):
            chosen.append(c)
        if len(chosen) >= MAX_SHOUTS:
            break
    return sorted(chosen, key=lambda c: c.start_sec)


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
