"""Hold and celebration music: find loop points inside the user's looping tracks.

Usage (from experiments/mixer-poc):
    analysis/.venv/bin/python analysis/hold.py                      # every file in the SOURCES folders
    analysis/.venv/bin/python analysis/hold.py --file windows-error-remix.mp3
    analysis/.venv/bin/python analysis/hold.py --force              # re-decode, re-run Beat This!, re-derive

Sources: client/public/audios/hold/ (category "error": the fail music after a failed Check or Back) and
client/public/audios/celebration/ (category "celebration"). Loops always run between two points inside the
track, never from its very start or to its very end.

For each track:
  1. decode to cache/hold/<name>.flac (48 kHz, stereo, 16-bit, audio stream only, resampled if needed), the
     PCM the engine must serve: loop samples are in this file's timeline (an MP3 decoder adds priming delay);
  2. run the Beat This! grid (cached in cache/hold/<name>.raw.json, keyed by the source file's sha256);
  3. split the track into remixes at long silences and into stable-tempo sections at beat irregularities
     and tempo changes;
  4. find the composer's loop ("body"): the lag at which the longest stretch of the track repeats itself
     (game rips play intro + body + body + fade), refined to the sample by waveform cross-correlation, and
     started on the first downbeat of the repeat, so jumping from loopEnd to loopStart continues the music;
  5. score every 16- and 8-bar span (4-bar in short or slow sections) that starts and ends on downbeats
     inside one section: the seam compares the beat before loopEnd with the beat before loopStart, or the
     beat after each (log-mel spectrum and RMS; either match is enough), and the loop end is nudged by a
     few ms so the waveforms line up (no click);
  6. keep the body loop as the preferred loop when its seam is clean, plus the best non-overlapping bar
     loops spread over the sections, with their loudness, and mark each as inside the intro/outro or not;
  7. render cache/hold/audition/<name>-<k>.flac (each loop 3 times) and measure the seam jumps in them.

Writes data/hold/<name>.json, data/hold/index.json and data/hold-report.md.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
from steps import beats as beats_step  # noqa: E402
from steps import loudness as loud_step  # noqa: E402

POC = Path(__file__).resolve().parent.parent
ROOT = POC.parent.parent
AUDIO_DIR = ROOT / "client/public/audios"
# Folder under AUDIO_DIR → category of every file in it.
SOURCES = (("hold", "error"), ("celebration", "celebration"))
CACHE = POC / "cache/hold"
AUDITION = CACHE / "audition"
OUT = POC / "data/hold"
REPORT = POC / "data/hold-report.md"
EXTENSIONS = {".mp3", ".flac", ".ogg", ".wav", ".m4a"}

SR = 48000
RAW_VERSION = 1
SCHEMA_VERSION = 2
DERIVE_VERSION = 8

# Remixes: a silence of at least this long (frame RMS below SILENCE_DB) separates two parts of a track.
FRAME_SEC = 0.02
HOP_SEC = 0.01
SILENCE_DB = -55.0
REMIX_GAP_SEC = 1.0
MIN_PART_SEC = 2.0
# Beat runs: an inter-beat interval within ±12% of the local median continues the run; one close to 2× or
# 3× is a missed beat (filled); anything else breaks the run.
IBI_TOLERANCE = 0.12
LOCAL_IBIS = 8
TEMPO_CHANGE = 0.04
MIN_SECTION_BARS = 4
# Candidates: 16 and 8 bars; 4 bars too when the section is short or the bars are long (slow tempo).
LOOP_BARS = (16, 8)
SHORT_LOOP_BARS = (4,)
LONG_BAR_SEC = 3.0
LOOP_BAR_IQR_PCT = 3.0
NEAR_SILENT_BAR_DB = -40.0
NEAR_SILENT_REL_DB = 18.0
MAX_SILENT_RUN_SEC = 0.35
# Seam alignment (bar loops): search ±25 ms for the end that best matches the audio around the start (the
# beat before the seam or the beat after, whichever matches better), then ±1 ms (±0.17 ms after a near-exact
# match) for the closest waveform at the seam itself. Body loops use the exact period instead.
ALIGN_SEARCH_SEC = 0.025
ALIGN_MIN_CORR = 0.5
FINE_SEARCH = 48
FINE_SEARCH_EXACT = 8  # when the coarse match is a near-exact repeat (correlation ≥ EXACT_CORR), stay close to it
EXACT_CORR = 0.8
FINE_HALF = 32
# Loop start: Beat This!'s refined grid sits ~10 ms after the attacks here, so the start moves to the
# strongest spectral-flux onset between 35 ms before and 20 ms after the grid downbeat, minus 2 ms.
ONSET_BEFORE_SEC = 0.035
ONSET_AFTER_SEC = 0.02
ONSET_MIN_RATIO = 3.0
OFFSET_MIN_RATIO = 2.0
ONSET_FFT = 256
ONSET_HOP = 24
PRE_ATTACK_SEC = 0.002
# Seam spectrum: 64 log-mel bands, 2048-point frames every 10 ms, 60 dB floor below the window's peak.
N_FFT = 2048
MEL_HOP = 480
N_MELS = 64
SPEC_FLOOR_DB = 60.0
# Selection: every remix gets its best loop if it reaches MIN_REMIX_SEAM_SCORE (flagged when weak), then
# every section and the remaining slots take loops of at least MIN_SEAM_SCORE.
MAX_LOOPS = 6
MIN_SEAM_SCORE = 0.6
MIN_REMIX_SEAM_SCORE = 0.35
LONG_LOOP_BONUS = 0.06
# Two loops whose average log-mel spectra differ by less than this (mean dB) play the same material.
SAME_MATERIAL_DB = 1.0
TARGET_LUFS = loud_step.TARGET_LUFS
# Body (composer's) loop: for every lag between BODY_MIN_SEC and BODY_MAX_SEC, the longest run where the
# track and its lagged copy have the same log-mel spectrum (mean |Δ| under BODY_RUN_DB over 0.5 s). The lag
# whose repeat covers the most of the track wins (the shortest one on a tie, so a body played three times is
# not taken as a double body), if its two copies are near-identical waveforms (correlation ≥ BODY_MIN_CORR).
BODY_MIN_SEC = 6.0
BODY_MAX_SEC = 120.0
BODY_HOP_SEC = 0.02
BODY_MAX_FRAMES = 8000
BODY_RUN_DB = 3.0
BODY_SMOOTH_SEC = 0.5
BODY_MIN_RUN_SEC = 3.0
BODY_MIN_CORR = 0.9
BODY_MAX_LAG_SPREAD = 2.0  # samples between the exact lags measured at three points of the run
BODY_COVERAGE_TIE = 0.05
BODY_CANDIDATES = 8
# The repeat's exact start and end: 10 ms windows where the difference between the copies is at least
# BODY_MATCH_DB below their level, holding for 90% of the next (previous) second.
BODY_MATCH_DB = -12.0
# A body loop is preferred when its seam is clean.
BODY_CLEAN_SEAM = 0.8
# Outro / fade: from the end of a part back to the last second whose level is within FADE_DROP_DB of the
# part's median level.
FADE_DROP_DB = 4.0
EDGE_TOLERANCE_SEC = 0.05


# --------------------------------------------------------------------------------------------- helpers

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ffmpeg_version() -> str:
    try:
        line = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True).stdout.splitlines()[0]
        return " ".join(line.split()[:3])
    except Exception:
        return "unknown"


def finite(value: float | None, digits: int = 2) -> float | None:
    """JSON-safe: None for -inf (silence) and NaN."""
    return round(float(value), digits) if value is not None and np.isfinite(value) else None


def db(value: float, floor: float = 1e-6) -> float:
    return float(20 * np.log10(max(float(value), floor)))


def rms_db(x: np.ndarray) -> float:
    if not len(x):
        return -120.0
    return db(np.sqrt(np.mean(np.square(x, dtype=np.float64))))


def probe_rate(src: Path) -> int | None:
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate",
                              "-of", "csv=p=0", str(src)], capture_output=True, text=True).stdout.strip()
        return int(out.splitlines()[0])
    except Exception:
        return None


def decode(src: Path, flac: Path) -> None:
    flac.parent.mkdir(parents=True, exist_ok=True)
    tmp = flac.with_suffix(".tmp.flac")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(src), "-map", "0:a:0", "-ar", str(SR),
                    "-ac", "2", "-c:a", "flac", "-sample_fmt", "s16", str(tmp)], check=True)
    tmp.replace(flac)


def load_raw(name: str, src: Path, flac: Path, digest: str, force: bool) -> dict:
    raw_path = CACHE / f"{name}.raw.json"
    if raw_path.exists() and flac.exists() and not force:
        raw = json.loads(raw_path.read_text())
        if raw.get("sha256") == digest and raw.get("rawVersion") == RAW_VERSION:
            return raw
    decode(src, flac)
    signal, sr = sf.read(flac, dtype="float32", always_2d=True)
    t0 = time.time()
    beats, downbeats = beats_step.run_beat_this(signal, sr)
    raw = {
        "rawVersion": RAW_VERSION,
        "sha256": digest,
        "source": src.name,
        "sampleRate": sr,
        "frames": len(signal),
        "beatsRaw": [round(float(b), 4) for b in beats],
        "downbeatsRaw": [round(float(b), 4) for b in downbeats],
        "integratedLufs": finite(loud_step.integrated(signal, sr)),
        "decoder": ffmpeg_version(),
        "beatThisSec": round(time.time() - t0, 2),
    }
    raw_path.write_text(json.dumps(raw))
    return raw


# ------------------------------------------------------------------------------------ remixes, sections

def frame_rms_db(signal: np.ndarray, sr: int) -> np.ndarray:
    """RMS in dBFS of FRAME_SEC windows every HOP_SEC (stereo mean square)."""
    power = np.square(signal, dtype=np.float64).mean(axis=1)
    hop, frame = int(HOP_SEC * sr), int(FRAME_SEC * sr)
    csum = np.concatenate([[0.0], np.cumsum(power)])
    starts = np.arange(0, max(1, len(power) - frame + 1), hop)
    mean = (csum[np.minimum(starts + frame, len(power))] - csum[starts]) / frame
    return 10 * np.log10(np.maximum(mean, 1e-12))


def find_parts(frames_db: np.ndarray, duration: float) -> tuple[list[tuple[float, float]], list[tuple[float, float]]]:
    """Non-silent parts (remixes) and the silent gaps between them."""
    silent = frames_db < SILENCE_DB
    gaps = []
    k = 0
    n = len(silent)
    while k < n:
        if silent[k]:
            j = k
            while j < n and silent[j]:
                j += 1
            a, b = k * HOP_SEC, min(duration, j * HOP_SEC + FRAME_SEC)
            if b - a >= REMIX_GAP_SEC or k == 0 or j == n:
                gaps.append((a, b))
            k = j
        else:
            k += 1
    parts = []
    cursor = 0.0
    for a, b in gaps:
        if a - cursor >= MIN_PART_SEC:
            parts.append((cursor, a))
        cursor = max(cursor, b)
    if duration - cursor >= MIN_PART_SEC:
        parts.append((cursor, duration))
    return parts, [g for g in gaps if g[1] - g[0] >= REMIX_GAP_SEC]


def split_runs(beats: np.ndarray) -> tuple[list[np.ndarray], int, list[tuple[float, float]]]:
    """Split beats into runs of steady inter-beat intervals; fill single and double missed beats.

    Returns the runs, how many beats were filled, and the irregular spans between runs.
    """
    if len(beats) < 3:
        return [], 0, []
    ibi = np.diff(beats)
    runs: list[list[float]] = []
    current = [float(beats[0])]
    filled = 0
    irregular = []
    for k, value in enumerate(ibi):
        window = np.concatenate([ibi[max(0, k - LOCAL_IBIS):k], ibi[k + 1:k + 1 + LOCAL_IBIS]])
        ref = float(np.median(window)) if len(window) else float(value)
        ratio = value / ref
        if abs(ratio - 1) <= IBI_TOLERANCE:
            current.append(float(beats[k + 1]))
        elif abs(ratio / 2 - 1) <= 0.08 or abs(ratio / 3 - 1) <= 0.06:
            missing = int(round(ratio)) - 1
            for m in range(1, missing + 1):
                current.append(float(beats[k] + value * m / (missing + 1)))
            current.append(float(beats[k + 1]))
            filled += missing
        else:
            runs.append(current)
            irregular.append((float(beats[k]), float(beats[k + 1])))
            current = [float(beats[k + 1])]
    runs.append(current)
    return [np.asarray(r) for r in runs], filled, irregular


def split_tempo(run: np.ndarray) -> list[np.ndarray]:
    """Cut a run where the tempo settles more than TEMPO_CHANGE away from the tempo so far.

    Tempos are mean intervals over 8–16 beats, so Beat This!'s 20 ms frame jitter averages out.
    """
    out = []
    start = 0
    k = start + 8
    while k + 8 <= len(run) - 1:
        back = max(start, k - 16)
        so_far = (run[k] - run[back]) / (k - back)
        ahead = (run[k + 8] - run[k]) / 8
        if abs(ahead / so_far - 1) > TEMPO_CHANGE:
            out.append(run[start:k + 1])
            start = k + 1
            k = start + 8
            continue
        k += 1
    out.append(run[start:])
    return out


def meter_for_part(db_gaps: list[int]) -> int:
    """Beats per bar from downbeat gaps; 2-beat gaps (half-bar detections) defer to 4 when 4 also occurs."""
    if not db_gaps:
        return 4
    values, counts = np.unique(db_gaps, return_counts=True)
    hist = dict(zip(values.tolist(), counts.tolist()))
    best = int(values[np.argmax(counts)])
    if best == 2 and hist.get(4, 0) >= 0.25 * hist[2]:
        best = 4
    return best if best >= 3 else 4


def build_sections(raw: dict, parts: list[tuple[float, float]]) -> tuple[list[dict], dict]:
    beats_raw = np.asarray(raw["beatsRaw"], dtype=float)
    downbeats_raw = np.asarray(raw["downbeatsRaw"], dtype=float)
    sections = []
    stats = {"filled": 0, "irregular": [], "dropped": [], "downbeatsGuessed": 0}
    for part_index, (pa, pb) in enumerate(parts):
        part_beats = beats_raw[(beats_raw >= pa) & (beats_raw < pb)]
        runs, filled, irregular = split_runs(part_beats)
        stats["filled"] += filled
        stats["irregular"] += [(round(max(0.0, a), 2), round(b, 2)) for a, b in irregular]
        pieces = [piece for run in runs for piece in split_tempo(run)]
        part_sections = []
        for piece in pieces:
            if len(piece) < 2:
                continue
            refined, _ = beats_step.refine_beats(piece)
            db_idx = beats_step.downbeat_indices(refined, downbeats_raw[(downbeats_raw >= piece[0] - 0.1)
                                                                      & (downbeats_raw <= piece[-1] + 0.1)])
            part_sections.append({"beats": refined, "dbIdx": db_idx, "part": part_index})
        gaps = [int(g) for s in part_sections for g in np.diff(s["dbIdx"])]
        bpb = meter_for_part(gaps)
        for s in part_sections:
            n_beats = len(s["beats"])
            if n_beats < MIN_SECTION_BARS * bpb + 1:
                stats["dropped"].append((round(max(0.0, float(s["beats"][0])), 2), round(float(s["beats"][-1]), 2)))
                continue
            if len(s["dbIdx"]) == 0:
                db_idx = np.arange(0, n_beats, bpb)
                stats["downbeatsGuessed"] += 1
                s["guessed"] = True
            else:
                db_idx, _ = beats_step.regularize_downbeats(n_beats, s["dbIdx"], bpb)
            beats = s["beats"]
            x = np.arange(n_beats, dtype=float)
            slope = float(np.polyfit(x, beats, 1)[0])
            ibi = np.diff(beats)
            end = float(min(pb, beats[-1] + np.median(ibi)))
            s.update({
                "startSec": float(beats[0]),
                "endSec": end,
                "bpm": 60.0 / slope,
                "beatsPerBar": bpb,
                "dbIdx": np.asarray(db_idx, dtype=int),
                "ibiIqrPct": float((np.percentile(ibi, 75) - np.percentile(ibi, 25)) / np.median(ibi) * 100),
            })
            sections.append(s)
    return sections, stats


# ---------------------------------------------------------------------------------------------- seams

class SeamScorer:
    def __init__(self, signal: np.ndarray, sr: int):
        import librosa

        self.x = signal
        self.mono = signal.mean(axis=1)
        self.sr = sr
        self.mel = librosa.filters.mel(sr=sr, n_fft=N_FFT, n_mels=N_MELS)
        self.window = np.hanning(N_FFT).astype(np.float32)
        self.onset_window = np.hanning(ONSET_FFT).astype(np.float32)

    def logmel(self, a: int, b: int) -> np.ndarray:
        seg = self.mono[a:b]
        if len(seg) < N_FFT:
            seg = np.pad(seg, (0, N_FFT - len(seg)))
        count = 1 + (len(seg) - N_FFT) // MEL_HOP
        idx = np.arange(N_FFT)[None, :] + MEL_HOP * np.arange(count)[:, None]
        spec = np.abs(np.fft.rfft(seg[idx] * self.window, axis=1)) ** 2
        return 10 * np.log10(np.maximum(spec @ self.mel.T, 1e-12))

    def spec_distance(self, a1: int, a2: int, length: int) -> float:
        """Mean absolute log-mel difference (dB) between two equally long windows, floored 60 dB down."""
        m1, m2 = self.logmel(a1, a1 + length), self.logmel(a2, a2 + length)
        top = max(m1.max(), m2.max())
        m1, m2 = np.maximum(m1, top - SPEC_FLOOR_DB), np.maximum(m2, top - SPEC_FLOOR_DB)
        return float(np.mean(np.abs(m1 - m2)))

    def timbre(self, a: int, b: int) -> np.ndarray:
        """Average log-mel spectrum (dB) of a span, sampled every 4th frame."""
        mel = self.logmel(a, b)[::4]
        return 10 * np.log10(np.mean(10 ** (mel / 10), axis=0) + 1e-12)

    def onset_near(self, t: float, min_ratio: float = ONSET_MIN_RATIO) -> float | None:
        """Time of the strongest spectral-flux onset near the grid time t, or None if there is no clear one
        (a flux peak below min_ratio × the median flux of the surrounding 0.6 s)."""
        sr = self.sr
        a = int((t - 0.3) * sr)
        b = int((t + 0.3) * sr)
        if a < 0 or b > len(self.mono):
            return None
        seg = self.mono[a:b]
        count = 1 + (len(seg) - ONSET_FFT) // ONSET_HOP
        idx = np.arange(ONSET_FFT)[None, :] + ONSET_HOP * np.arange(count)[:, None]
        mag = np.log1p(100 * np.abs(np.fft.rfft(seg[idx] * self.onset_window, axis=1)))
        flux = np.concatenate([[0.0], np.maximum(0.0, np.diff(mag, axis=0)).sum(axis=1)])
        centers = (a + ONSET_HOP * np.arange(count) + ONSET_FFT / 2) / sr
        mask = (centers >= t - ONSET_BEFORE_SEC) & (centers <= t + ONSET_AFTER_SEC)
        if not mask.any():
            return None
        k = int(np.flatnonzero(mask)[np.argmax(flux[mask])])
        if flux[k] < min_ratio * float(np.median(flux)):
            return None
        return float(centers[k])

    def xcorr(self, a0: int, length: int, b0: int, lag_max: int) -> tuple[float, float]:
        """Normalized cross-correlation of mono[a0:a0+length] against mono[b0+lag : b0+lag+length] for
        |lag| ≤ lag_max. Returns (best lag with parabolic sub-sample refinement, peak correlation)."""
        from scipy.signal import correlate

        lo, hi = b0 - lag_max, b0 + length + lag_max
        if a0 < 0 or lo < 0 or a0 + length > len(self.mono) or hi > len(self.mono) or length <= 0:
            return 0.0, 0.0
        a = self.mono[a0:a0 + length].astype(np.float64)
        b = self.mono[lo:hi].astype(np.float64)
        xc = correlate(b, a, mode="valid", method="fft")
        csum = np.concatenate([[0.0], np.cumsum(b * b)])
        norms = np.sqrt((csum[len(a):] - csum[:-len(a)]) * float(np.dot(a, a))) + 1e-12
        corr = xc / norms
        k = int(np.argmax(corr))
        frac = 0.0
        if 0 < k < len(corr) - 1:
            y0, y1, y2 = corr[k - 1], corr[k], corr[k + 1]
            den = y0 - 2 * y1 + y2
            frac = float(0.5 * (y0 - y2) / den) if den < 0 else 0.0
        return k - lag_max + frac, float(corr[k])

    def fine_align(self, s: int, e: int, reach: int) -> int:
        """The end within ±reach samples whose waveform (both channels) is closest to the start's right at
        the seam, weighted toward the samples next to it, so the step x[e−1] → x[s] looks like a natural one."""
        ref = self.x[s - FINE_HALF:s + FINE_HALF].astype(np.float64)
        weight = np.exp(-np.abs(np.arange(-FINE_HALF, FINE_HALF) + 0.5) / 4.0)[:, None]
        costs = []
        for d in range(-reach, reach + 1):
            seg = self.x[e + d - FINE_HALF:e + d + FINE_HALF].astype(np.float64)
            costs.append(float(np.sum(weight * (seg - ref) ** 2)) if len(seg) == len(ref) else np.inf)
        return e + int(np.argmin(costs)) - reach

    def align_end(self, s: int, e0: int, beat: int) -> tuple[int, float, int]:
        """Best end near e0: the one whose surroundings correlate best with the start's, on whichever side
        of the seam matches better (the beat before, or the beat after). Returns (e, corr, lag)."""
        lag_max = int(ALIGN_SEARCH_SEC * self.sr)
        sides = [self.xcorr(s - beat, beat + beat // 4, e0 - beat, lag_max),  # before (and a little after)
                 self.xcorr(s - beat // 4, beat + beat // 4, e0 - beat // 4, lag_max)]  # after
        lag, best_corr = max(sides, key=lambda side: side[1])
        e = e0 + int(round(lag)) if best_corr >= ALIGN_MIN_CORR else e0
        e = self.fine_align(s, e, FINE_SEARCH_EXACT if best_corr >= EXACT_CORR else FINE_SEARCH)
        return e, best_corr, e - e0

    def jump(self, s: int, e: int) -> dict:
        """The sample jump at the seam (x[e-1] → x[s]) and the largest natural one nearby, in dB re local RMS."""
        x = self.x
        seam = float(np.max(np.abs(x[s].astype(np.float64) - x[e - 1])))
        local = np.concatenate([x[e - 480:e], x[s:s + 480]]).astype(np.float64)
        local_rms = float(np.sqrt(np.mean(local ** 2))) + 1e-9
        natural = max(float(np.max(np.abs(np.diff(x[s - 2400:s + 2400].astype(np.float64), axis=0)))),
                      float(np.max(np.abs(np.diff(x[e - 2400:e + 2400].astype(np.float64), axis=0)))))
        return {"jumpDb": round(db(seam / local_rms), 1), "naturalJumpDb": round(db(natural / local_rms), 1)}

    def score(self, s: int, e: int, beat: int, section_end: int) -> dict:
        """Seam score 0–1 from the log-mel distance and the RMS step over one beat, plus any click beyond
        the natural jumps. Either side is enough for a seamless jump: if the beat before loopEnd sounds like
        the beat before loopStart, or the beat after loopEnd (never heard in the loop) like the beat after
        loopStart, then x[..e) → x[s..) sounds like the track's own continuation. The better side counts."""
        def side(e0: int, s0: int) -> tuple[float, float, float]:
            spec = self.spec_distance(e0, s0, beat)
            rms = abs(rms_db(self.x[e0:e0 + beat]) - rms_db(self.x[s0:s0 + beat]))
            a = self.mono[s0:s0 + beat].astype(np.float64)
            b = self.mono[e0:e0 + beat].astype(np.float64)
            corr = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))
            return spec, rms, corr

        spec_pre, rms_pre, corr_pre = side(e - beat, s - beat)
        has_post = e + beat <= min(section_end, len(self.mono))
        post = side(e, s) if has_post else None
        spec, rms, corr, which = spec_pre, rms_pre, corr_pre, "before"
        if post is not None and post[0] < spec_pre:
            spec, rms, corr, which = post[0], post[1], post[2], "after"
        jump = self.jump(s, e)
        # Copy error: how far the 100 ms the loop plays after (before) the seam differ from what the track
        # plays there, in dB re their level. About −20 dB or lower is the same recording.
        n = int(0.1 * self.sr)

        def copy_err(a: int, b: int) -> float:
            if a < 0 or b < 0 or a + n > len(self.x) or b + n > len(self.x):
                return 99.0
            x1, x2 = self.x[a:a + n].astype(np.float64), self.x[b:b + n].astype(np.float64)
            return 10 * float(np.log10(np.sum((x1 - x2) ** 2) / (0.5 * np.sum(x1 ** 2 + x2 ** 2) + 1e-12) + 1e-12))

        copy = min(copy_err(s, e), copy_err(s - n, e - n))
        s_spec = float(np.exp(-max(0.0, spec - 1.5) / 3.0))
        s_rms = float(np.exp(-rms / 3.0))
        excess = jump["jumpDb"] - jump["naturalJumpDb"]
        s_click = float(np.exp(-max(0.0, excess) / 6.0))
        seam = s_spec ** 0.6 * s_rms ** 0.25 * s_click ** 0.15
        return {
            "seamScore": round(seam, 3),
            "seamSide": which,
            "specDistDb": round(spec, 2),
            "specDistPreDb": round(spec_pre, 2),
            "specDistPostDb": None if post is None else round(post[0], 2),
            "rmsDiffDb": round(rms, 2),
            "waveCorr": round(corr, 3),
            "copyErrDb": round(copy, 1),
            **jump,
        }


# -------------------------------------------------------------------------------------------- candidates

def candidates_for(section: dict, index: int, scorer: SeamScorer, frames_db: np.ndarray, sr: int,
                   track_bar_median_db: float, fade_start_sec: float) -> list[dict]:
    beats = section["beats"]
    bpb = section["beatsPerBar"]
    downs = section["dbIdx"]
    downs = downs[(downs >= 0) & (downs < len(beats))]
    section_end = int(min(section["endSec"], fade_start_sec) * sr)
    out = []
    n_bars_total = len(downs) - 1
    bar_sec = 60.0 / section["bpm"] * bpb
    lengths = [n for n in LOOP_BARS if n <= n_bars_total]
    if not lengths or bar_sec >= LONG_BAR_SEC:
        lengths += [n for n in SHORT_LOOP_BARS if n <= n_bars_total]
    # Where a downbeat has no clear onset, shift the grid by the section's median grid-to-onset offset.
    offsets = [o - b for b in beats for o in [scorer.onset_near(float(b), OFFSET_MIN_RATIO)] if o is not None]
    grid_offset = float(np.median(offsets)) if len(offsets) >= 8 else 0.0
    section["gridOffsetMs"] = round(grid_offset * 1000, 1)
    for bars in lengths:
        for i in range(len(downs)):
            j = i + bars
            if j >= len(downs):
                break
            bi, bj = int(downs[i]), int(downs[j])
            if bj - bi != bars * bpb:
                continue  # an irregular bar (phase change) inside the span
            span_beats = beats[bi:bj + 1]
            ibi = np.diff(span_beats)
            bar_secs = np.diff(beats[downs[i:j + 1]])
            if (np.percentile(bar_secs, 75) - np.percentile(bar_secs, 25)) / np.median(bar_secs) * 100 > LOOP_BAR_IQR_PCT:
                continue
            beat = int(round(float(np.median(ibi)) * sr))
            onset = scorer.onset_near(float(beats[bi]))
            s = int(round(((onset if onset is not None else beats[bi] + grid_offset) - PRE_ATTACK_SEC) * sr))
            if s - beat < 0:
                continue
            e0 = s + int(round((beats[bj] - beats[bi]) * sr))
            e, corr, lag = scorer.align_end(s, e0, beat)
            if e > section_end + int(0.02 * sr) or e + 2400 > len(scorer.mono):
                continue
            # Near-silence: every bar loud enough, and no long silent stretch inside the loop.
            bar_db = [rms_db(scorer.x[int(beats[downs[k]] * sr):int(beats[downs[k + 1]] * sr)]) for k in range(i, j)]
            if min(bar_db) < max(NEAR_SILENT_BAR_DB, track_bar_median_db - NEAR_SILENT_REL_DB):
                continue
            fa, fb = int(s / sr / HOP_SEC), int(e / sr / HOP_SEC)
            quiet = frames_db[fa:fb] < SILENCE_DB
            if quiet.any():
                longest = max(len(r) for r in "".join("1" if q else "0" for q in quiet).split("0"))
                if longest * HOP_SEC > MAX_SILENT_RUN_SEC:
                    continue
            seam = scorer.score(s, e, beat, section_end)
            length_sec = (e - s) / sr
            rank = seam["seamScore"] + (LONG_LOOP_BONUS if bars >= 16 else 0.0) \
                - 0.01 * max(0.0, float(np.std(bar_db)) - 3.0)
            out.append({
                "kind": "bars",
                "section": index,
                "startSample": s,
                "endSample": e,
                "startSec": s / sr,
                "endSec": e / sr,
                "bars": bars,
                "bpm": round(60.0 * bars * bpb / length_sec, 3),
                "gridStartSec": round(float(beats[bi]), 4),
                "gridEndSec": round(float(beats[bj]), 4),
                "alignLagMs": round(lag / sr * 1000, 2),
                "alignCorr": round(corr, 3),
                "barRmsDb": [round(v, 1) for v in bar_db],
                "rank": rank,
                **seam,
            })
    return out


def select(cands: list[dict], sections: list[dict], scorer: SeamScorer) -> list[dict]:
    """Best non-overlapping loops, spread out: one per remix, one per section, then round-robin by remix.

    After the first pass a loop is skipped when it plays the same material as one already chosen.
    """
    ranked = sorted(cands, key=lambda c: -c["rank"])
    chosen: list[dict] = []

    def timbre(c):
        if "_timbre" not in c:
            c["_timbre"] = scorer.timbre(c["startSample"], c["endSample"])
        return c["_timbre"]

    def ok(c, distinct):
        if any(c["startSample"] < o["endSample"] and c["endSample"] > o["startSample"] for o in chosen):
            return False
        return not distinct or all(float(np.mean(np.abs(timbre(c) - timbre(o)))) >= SAME_MATERIAL_DB for o in chosen)

    def take(pred, floor, distinct=True):
        if len(chosen) >= MAX_LOOPS:
            return None
        pick = next((c for c in ranked if pred(c) and c["seamScore"] >= floor and ok(c, distinct)), None)
        if pick:
            chosen.append(pick)
        return pick

    remix_of = {k: s["part"] for k, s in enumerate(sections)}
    span: dict[int, float] = {}
    for s in sections:
        span[s["part"]] = span.get(s["part"], 0.0) + s["endSec"] - s["startSec"]
    remixes = sorted(span, key=lambda r: -span[r])
    for r in remixes:
        take(lambda c: remix_of[c["section"]] == r, MIN_REMIX_SEAM_SCORE, distinct=False)
    by_length = sorted(range(len(sections)), key=lambda k: -(sections[k]["endSec"] - sections[k]["startSec"]))
    for k in by_length:
        if not any(c["section"] == k for c in chosen):
            take(lambda c: c["section"] == k, MIN_SEAM_SCORE)
    progress = True
    while len(chosen) < MAX_LOOPS and progress:
        progress = False
        for r in remixes:
            if take(lambda c: remix_of[c["section"]] == r, MIN_SEAM_SCORE):
                progress = True
    return sorted(chosen, key=lambda c: c["startSample"])


# -------------------------------------------------------------------------------------- body loop, edges

def longest_run(mask: np.ndarray) -> tuple[int, int]:
    """(length, start) of the longest run of True."""
    if not mask.any():
        return 0, 0
    edges = np.flatnonzero(np.diff(np.concatenate([[0], mask.astype(np.int8), [0]])))
    starts, ends = edges[0::2], edges[1::2]
    k = int(np.argmax(ends - starts))
    return int(ends[k] - starts[k]), int(starts[k])


def repeat_lags(scorer: SeamScorer, part: tuple[float, float]) -> list[dict]:
    """Lags at which a long stretch of the part repeats (coarse, frame resolution), best coverage first."""
    import librosa

    sr = scorer.sr
    pa, pb = part
    hop = int(round(max(BODY_HOP_SEC, (pb - pa) / BODY_MAX_FRAMES) * sr))
    seg = scorer.mono[int(pa * sr):int(pb * sr)]
    if len(seg) < N_FFT + hop:
        return []
    mel = librosa.feature.melspectrogram(y=seg, sr=sr, n_fft=N_FFT, hop_length=hop, n_mels=N_MELS, center=False)
    feats = 10 * np.log10(np.maximum(mel, 1e-12)).T.astype(np.float32)
    feats = np.maximum(feats, feats.max() - 70)
    fps = sr / hop
    n = len(feats)
    lag_min = int(BODY_MIN_SEC * fps)
    lag_max = min(int(BODY_MAX_SEC * fps), n - int(BODY_MIN_RUN_SEC * fps))
    width = max(1, int(BODY_SMOOTH_SEC * fps))
    kernel = np.ones(width, dtype=np.float32) / width
    rows = []
    for lag in range(lag_min, lag_max + 1):
        dist = np.abs(feats[:-lag] - feats[lag:]).mean(axis=1)
        length, start = longest_run(np.convolve(dist, kernel, mode="same") < BODY_RUN_DB)
        if length >= BODY_MIN_RUN_SEC * fps:
            rows.append((lag, length, start))
    rows.sort(key=lambda r: -(r[0] + r[1]))
    picked: list[dict] = []
    for lag, length, start in rows:
        if any(abs(lag * hop - p["lagSamples"]) < 0.5 * sr for p in picked):
            continue
        picked.append({"lagSamples": lag * hop, "runStart": int(pa * sr) + start * hop,
                       "runEnd": int(pa * sr) + (start + length) * hop + N_FFT, "hop": hop,
                       "coverageSec": (lag + length) * hop / sr})
        if len(picked) >= BODY_CANDIDATES:
            break
    return picked


def match_profile(scorer: SeamScorer, a: int, b: int, lag: int) -> np.ndarray:
    """Per 10 ms window from a to b: True where x(t) and x(t + lag) are the same audio (difference at
    least BODY_MATCH_DB below their level)."""
    sr = scorer.sr
    w = int(0.01 * sr)
    n = (b - a) // w
    if n <= 0 or b + lag > len(scorer.mono):
        return np.zeros(0, dtype=bool)
    x1 = scorer.mono[a:a + n * w].astype(np.float64).reshape(n, w)
    x2 = scorer.mono[a + lag:a + lag + n * w].astype(np.float64).reshape(n, w)
    diff = np.sum((x1 - x2) ** 2, axis=1)
    level = 0.5 * (np.sum(x1 ** 2, axis=1) + np.sum(x2 ** 2, axis=1)) + 1e-12
    return 10 * np.log10(diff / level + 1e-12) < BODY_MATCH_DB


def find_body(scorer: SeamScorer, parts: list[tuple[float, float]]) -> dict | None:
    """The composer's loop: the repeat that covers the most of a part, refined to the sample."""
    sr = scorer.sr
    tried = []
    for part_index, part in enumerate(parts):
        for cand in repeat_lags(scorer, part):
            # Exact lag: cross-correlate up to three 3 s windows spread over the coarse run.
            run_a, run_b = cand["runStart"], min(cand["runEnd"], int(part[1] * sr) - cand["lagSamples"])
            win = min(3 * sr, max(sr // 2, run_b - run_a - 2 * cand["hop"]))
            centers = [(run_a + run_b) // 2] + ([run_a + (run_b - run_a) // 4, run_a + 3 * (run_b - run_a) // 4]
                                                 if run_b - run_a > 3 * win else [])
            reach = int(1.5 * cand["hop"]) + int(0.005 * sr)
            fits = [scorer.xcorr(c - win // 2, win, c - win // 2 + cand["lagSamples"], reach) for c in centers]
            lags = [cand["lagSamples"] + f[0] for f in fits]
            corr = float(np.median([f[1] for f in fits]))
            tried.append({**cand, "part": part_index, "lagExact": float(np.median(lags)), "corr": corr,
                          "lagSpread": float(max(lags) - min(lags))})
    # Exact repeats only: near-identical copies at one constant lag (a lag that drifts across the run is
    # an edit or a tempo change, not a loop).
    remaining = [c for c in tried if c["corr"] >= BODY_MIN_CORR and c["lagSpread"] <= BODY_MAX_LAG_SPREAD]
    w = int(0.01 * sr)
    while remaining:
        top = max(c["coverageSec"] for c in remaining)
        best = min((c for c in remaining if c["coverageSec"] >= (1 - BODY_COVERAGE_TIE) * top),
                   key=lambda c: c["lagExact"])
        remaining.remove(best)
        best["checked"] = True
        lag = int(round(best["lagExact"]))
        part = parts[best["part"]]
        # Where the copies really start and stop matching (10 ms resolution), around the coarse run.
        a = max(int(part[0] * sr), best["runStart"] - 2 * sr)
        b = min(int(part[1] * sr) - lag, best["runEnd"] + 2 * sr)
        match = match_profile(scorer, a, b, lag)
        if len(match) < 200:
            continue
        # ahead[i] = share of matching windows in the second starting at window i.
        ahead = np.convolve(match.astype(float), np.ones(100) / 100, mode="full")[99:99 + len(match)]
        length, first = longest_run(ahead >= 0.9)
        if (length + 99) * w < BODY_MIN_RUN_SEC * sr:
            best["matchRunSec"] = round((length + 99) * w / sr, 2) if length else 0.0
            continue
        last = min(len(match), first + length + 99)
        # The 90% rule can open the run up to 0.1 s early (or close it late): tighten both ends to the first
        # and last 100 ms in which every window matches.
        solid = np.convolve(match.astype(int), np.ones(10, dtype=int), mode="valid") == 10  # solid[i]: match[i:i+10]
        inside = np.flatnonzero(solid[first:last])
        if not len(inside):
            continue
        first, last = first + int(inside[0]), first + int(inside[-1]) + 10
        return {"found": True, "tried": tried, "part": best["part"], "lagSamples": lag, "lagExact": best["lagExact"],
                "corr": best["corr"], "lagSpread": best["lagSpread"], "coverageSec": best["coverageSec"],
                "repeatStart": a + first * w, "repeatEnd": a + last * w}
    return {"found": False, "tried": tried}


def body_candidate(body: dict, sections: list[dict], scorer: SeamScorer) -> dict | None:
    """Loop [s, s + lag): s on the first downbeat after the repeat starts (or just after the start)."""
    sr = scorer.sr
    lag, r0, r1 = body["lagSamples"], body["repeatStart"], body["repeatEnd"]
    s = None
    sec_index, beat = None, sr // 2
    for k, sec in enumerate(sections):
        if sec["startSec"] - 1 <= r0 / sr <= sec["endSec"]:
            downs = sec["beats"][sec["dbIdx"][(sec["dbIdx"] >= 0) & (sec["dbIdx"] < len(sec["beats"]))]]
            bar = 60.0 / sec["bpm"] * sec["beatsPerBar"]
            after = [d for d in downs if r0 / sr + 0.005 <= d + sec.get("gridOffsetMs", 0) / 1000 <= r0 / sr + bar + 0.005]
            sec_index, beat = k, int(round(60.0 / sec["bpm"] * sr))
            if after:
                onset = scorer.onset_near(float(after[0]))
                t = onset if onset is not None else after[0] + sec.get("gridOffsetMs", 0) / 1000
                s = int(round((t - PRE_ATTACK_SEC) * sr))
                s = max(s, r0 + int(0.005 * sr))
            break
    if s is None:
        s = r0 + int(0.01 * sr)
    if s + sr > r1:  # the copies must keep matching for a while after the seam
        return None
    e = s + lag  # the exact period: the copies are the same samples, so no waveform nudge
    if e + beat + 2400 > len(scorer.mono) or s - beat < 0:
        return None
    seam = scorer.score(s, e, beat, r1 + lag)
    bars, bpm, bpb = None, None, None
    if sec_index is not None:
        sec = sections[sec_index]
        bpb = sec["beatsPerBar"]
        bar_count = (e - s) / sr / (60.0 / sec["bpm"] * bpb)
        if abs(bar_count - round(bar_count)) <= 0.1 and round(bar_count) >= 1:
            bars = int(round(bar_count))
            bpm = round(60.0 * bars * bpb / ((e - s) / sr), 3)
        else:
            bpm = round(sec["bpm"], 3)
    return {
        "kind": "body", "section": sec_index, "startSample": s, "endSample": e, "startSec": s / sr, "endSec": e / sr,
        "bars": bars, "bpm": bpm, "beatsPerBar": bpb, "alignLagMs": round((e - s - lag) / sr * 1000, 3),
        "alignCorr": round(body["corr"], 3), "rank": seam["seamScore"], **seam,
    }


def part_edges(signal: np.ndarray, sr: int, part: tuple[float, float], sections: list[dict], part_index: int,
               body: dict | None) -> dict:
    """Intro end and outro start of one part. With a body loop: where the repeat starts and where the
    repeated material (or the level, if it fades first) ends. Otherwise: the first steady beat, and the end
    of the last steady section or the fade, whichever comes first."""
    pa, pb = part
    hop = int(0.25 * sr)
    starts = np.arange(int(pa * sr), max(int(pa * sr) + 1, int(pb * sr) - sr), hop)
    levels = np.array([rms_db(signal[a:a + sr]) for a in starts])
    ref = float(np.median(levels)) if len(levels) else -120.0
    loud = np.flatnonzero(levels >= ref - FADE_DROP_DB)
    fade = float((starts[loud[-1]] + sr) / sr) if len(loud) else pb
    fade = min(fade, pb)
    own = [s for s in sections if s["part"] == part_index]
    if body and body.get("found") and body["part"] == part_index:
        intro_end = body["repeatStart"] / sr
        outro = min(fade, (body["repeatEnd"] + body["lagSamples"]) / sr)
        how = "repeat"
    else:
        intro_end = own[0]["startSec"] if own else pa
        outro = min(fade, own[-1]["endSec"]) if own else fade
        how = "beats"
    return {"introEndSec": round(intro_end, 3), "outroStartSec": round(outro, 3), "fadeStartSec": round(fade, 3),
            "edgesFrom": how}


# ---------------------------------------------------------------------------------------- loudness, audition

def loop_levels(signal: np.ndarray, sr: int, s: int, e: int) -> dict:
    seg = signal[s:e]
    import pyloudnorm as pyln

    lufs = float(pyln.Meter(sr).integrated_loudness(seg))
    lufs = lufs if np.isfinite(lufs) else None
    return {
        "lufs": None if lufs is None else round(lufs, 2),
        "rmsDb": round(rms_db(seg), 2),
        "truePeakDbtp": round(loud_step.true_peak_dbtp(seg), 2),
        "gainToTargetDb": loud_step.gain_to_target(lufs),
    }


def render_audition(pcm16: np.ndarray, sr: int, s: int, e: int, path: Path, repeats: int = 3) -> dict:
    """Write the loop `repeats` times in a row, then measure each seam in the written file."""
    loop = pcm16[s:e]
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.flac")
    sf.write(tmp, np.concatenate([loop] * repeats), sr, subtype="PCM_16", format="FLAC")
    tmp.replace(path)
    y, _ = sf.read(path, dtype="float64", always_2d=True)
    seams = []
    n = len(loop)
    for r in range(1, repeats):
        p = r * n
        jump = float(np.max(np.abs(y[p] - y[p - 1])))
        local_rms = float(np.sqrt(np.mean(y[p - 480:p + 480] ** 2))) + 1e-9
        window = np.abs(np.diff(y[p - 2400:p + 2400], axis=0)).max(axis=1)
        window = np.delete(window, 2399)  # the seam's own step (y[p] − y[p−1])
        seams.append({
            "jumpDb": round(db(jump / local_rms), 1),
            "naturalMaxJumpDb": round(db(float(window.max()) / local_rms), 1),
            "percentile": round(float(np.mean(window < jump) * 100), 2),
        })
    return {"seams": seams, "frames": int(len(y)), "bitExact": bool(np.array_equal(
        np.round(y[:n] * 32768).astype(np.int32), loop.astype(np.int32)))}


# ------------------------------------------------------------------------------------------------- main

def analyze(src: Path, category: str, force: bool) -> dict:
    name = src.stem
    flac = CACHE / f"{name}.flac"
    digest = sha256(src)
    out_path = OUT / f"{name}.json"
    if out_path.exists() and not force and flac.exists():
        prev = json.loads(out_path.read_text())
        auditions_ok = all((POC / loop["audition"]).exists() for loop in prev.get("loops", []))
        if (prev.get("sha256") == digest and prev.get("deriveVersion") == DERIVE_VERSION
                and prev.get("category") == category and auditions_ok):
            print(f"{name}: up to date")
            return prev

    raw = load_raw(name, src, flac, digest, force)
    pcm16, sr = sf.read(flac, dtype="int16", always_2d=True)
    signal = pcm16.astype(np.float32) / 32768.0
    duration = len(signal) / sr
    frames_db = frame_rms_db(signal, sr)
    parts, gaps = find_parts(frames_db, duration)
    sections, sec_stats = build_sections(raw, parts)
    scorer = SeamScorer(signal, sr)

    bar_dbs = []
    for sec in sections:
        b, d = sec["beats"], sec["dbIdx"]
        d = d[(d >= 0) & (d < len(b))]
        bar_dbs += [rms_db(signal[int(b[d[k]] * sr):int(b[d[k + 1]] * sr)]) for k in range(len(d) - 1)]
    track_bar_median_db = float(np.median(bar_dbs)) if bar_dbs else -20.0

    # Bar loops never run into a part's fade.
    fades = [part_edges(signal, sr, part, sections, k, None)["fadeStartSec"] for k, part in enumerate(parts)]
    cands = []
    for k, sec in enumerate(sections):
        cands += candidates_for(sec, k, scorer, frames_db, sr, track_bar_median_db, fades[sec["part"]])
    bar_loops = select(cands, sections, scorer)

    body = find_body(scorer, parts) if parts else {"found": False, "tried": []}
    body_loop = body_candidate(body, sections, scorer) if body.get("found") else None
    (CACHE / f"{name}.candidates.json").write_text(json.dumps(
        [{k: v for k, v in c.items() if not k.startswith("_") and k != "barRmsDb"}
         for c in sorted(cands + ([body_loop] if body_loop else []), key=lambda c: c["startSample"])]))

    def part_of(c: dict) -> int:
        return body["part"] if c["kind"] == "body" else sections[c["section"]]["part"]

    def clean(c: dict) -> bool:
        return c["seamScore"] >= BODY_CLEAN_SEAM and c["jumpDb"] <= c["naturalJumpDb"]

    def mark(c: dict, edges: list[dict]) -> None:
        edge = edges[part_of(c)]
        c["afterIntro"] = c["startSec"] >= edge["introEndSec"] - EDGE_TOLERANCE_SEC
        c["beforeOutro"] = c["endSec"] <= edge["outroStartSec"] + EDGE_TOLERANCE_SEC

    entries = []
    if body_loop and body_loop["seamScore"] >= MIN_SEAM_SCORE:
        entries.append(body_loop)
        # A bar loop as long as the body and overlapping it plays the same loop again.
        length = body_loop["endSample"] - body_loop["startSample"]
        bar_loops = [c for c in bar_loops
                     if not (abs((c["endSample"] - c["startSample"]) / length - 1) < 0.01
                             and min(c["endSample"], body_loop["endSample"]) - max(c["startSample"], body_loop["startSample"]) > length / 2)]
    entries += sorted(bar_loops, key=lambda c: -c["rank"])[:MAX_LOOPS - len(entries)]
    # The body loop is preferred when its seam is clean and no clean bar loop inside the music is longer
    # (a short exact repeat in a long track is a fallback, not the composer's loop). Only then do the
    # repeat's start and end define the part's intro and outro; otherwise the steady beats do.
    beat_edges = [part_edges(signal, sr, part, sections, k, None) for k, part in enumerate(parts)]
    for c in entries:
        mark(c, beat_edges)
    longest_bar = max(((c["endSample"] - c["startSample"]) for c in entries
                       if c["kind"] == "bars" and clean(c) and c["afterIntro"] and c["beforeOutro"]), default=0)
    body_preferred = bool(body_loop and body_loop in entries and clean(body_loop)
                          and body_loop["endSample"] - body_loop["startSample"] >= longest_bar - sr // 2)
    edges = [part_edges(signal, sr, part, sections, k, body if body_preferred else None)
             for k, part in enumerate(parts)]
    for c in entries:
        mark(c, edges)
    if body_preferred:
        preferred = body_loop
    else:
        # Near-ties go to the loop whose two sides are the same waveform (an exact repeat).
        preferred = max(entries, key=lambda c: (c["afterIntro"] and c["beforeOutro"], clean(c),
                                                c["rank"] + 0.05 * max(0.0, c["waveCorr"])), default=None)
    ordered = ([preferred] if preferred else []) + sorted((c for c in entries if c is not preferred),
                                                         key=lambda c: c["startSample"])

    # Clear this track's old auditions (exact pattern, so "<name>-x" tracks are untouched).
    pattern = re.compile(rf"^{re.escape(name)}-\d+\.flac$")
    if AUDITION.exists():
        for old in AUDITION.iterdir():
            if pattern.match(old.name):
                old.unlink()

    loops = []
    for k, c in enumerate(ordered, start=1):
        audition_path = AUDITION / f"{name}-{k}.flac"
        check = render_audition(pcm16, sr, c["startSample"], c["endSample"], audition_path)
        loop = {
            "kind": c["kind"],
            "preferred": c is preferred,
            "startSec": c["startSec"],
            "endSec": c["endSec"],
            "bars": c["bars"],
            "bpm": c["bpm"],
            "seamScore": c["seamScore"],
            **loop_levels(signal, sr, c["startSample"], c["endSample"]),
            "startSample": c["startSample"],
            "endSample": c["endSample"],
            "durationSec": round((c["endSample"] - c["startSample"]) / sr, 4),
            "beatsPerBar": sections[c["section"]]["beatsPerBar"] if c["section"] is not None else None,
            "section": c["section"],
            "remix": part_of(c),
            "afterIntro": bool(c["afterIntro"]),
            "beforeOutro": bool(c["beforeOutro"]),
            "seam": {key: c.get(key) for key in ("seamSide", "specDistDb", "specDistPreDb", "specDistPostDb",
                                                 "rmsDiffDb", "waveCorr", "copyErrDb", "jumpDb", "naturalJumpDb",
                                                 "alignLagMs", "alignCorr")},
            "audition": str(audition_path.relative_to(POC)),
            "auditionCheck": check,
        }
        if c["kind"] == "bars":
            loop["grid"] = {"startSec": c["gridStartSec"], "endSec": c["gridEndSec"]}
            loop["barRmsDb"] = c["barRmsDb"]
        loops.append(loop)

    # Track-level tempo: the longest section's. Track-level edges: those of the preferred loop's part.
    longest = max(sections, key=lambda s: s["endSec"] - s["startSec"]) if sections else None
    main_part = loops[0]["remix"] if loops else 0
    flags = []
    if not sections:
        flags.append("no_stable_section")
    if len(parts) > 1:
        flags.append("multiple_remixes")
    if len({round(s["bpm"]) for s in sections}) > 1:
        flags.append("tempo_changes")
    if sec_stats["irregular"]:
        flags.append("irregular_beats")
    if sec_stats["downbeatsGuessed"]:
        flags.append("downbeats_guessed")
    if body_preferred:
        flags.append("body_loop")
    elif body_loop and body_loop in entries:
        flags.append("body_loop_not_preferred")
    else:
        flags.append("no_body_loop")
    if len(loops) < 3:
        flags.append("few_loops" if loops else "no_loops")
    covered = {loop["section"] for loop in loops}
    if any(k not in covered for k in range(len(sections))):
        flags.append("section_without_loop")
    if any(loop["seamScore"] < MIN_SEAM_SCORE for loop in loops):
        flags.append("weak_seam")
    if any(s["jumpDb"] > s["naturalMaxJumpDb"] for loop in loops for s in loop["auditionCheck"]["seams"]):
        flags.append("seam_jump_above_natural")
    if any(not (loop["afterIntro"] and loop["beforeOutro"]) for loop in loops):
        flags.append("loop_in_intro_or_outro")
    if any(round(s["bpm"]) < 80 for s in sections):
        flags.append("slow_tempo_maybe_half_time")

    body_info: dict = {"found": bool(body.get("found"))}
    if body.get("found"):
        frac = body["lagExact"] - round(body["lagExact"])
        body_info.update({
            "remix": body["part"], "lagSamples": body["lagSamples"], "lagSec": round(body["lagSamples"] / sr, 4),
            "lagExactSamples": round(body["lagExact"], 3), "roundingSamples": round(frac, 3),
            "copiesCorr": round(body["corr"], 3), "lagSpreadSamples": round(body["lagSpread"], 3),
            "repeatStartSec": round(body["repeatStart"] / sr, 3), "repeatEndSec": round(body["repeatEnd"] / sr, 3),
            "coverageSec": round(body["coverageSec"], 2),
            "loopSeamScore": body_loop["seamScore"] if body_loop else None,
        })
    body_info["tried"] = [{"lagSec": round(c["lagExact"] / sr, 3), "coverageSec": round(c["coverageSec"], 2),
                           "corr": round(c["corr"], 3), "lagSpreadSamples": round(c["lagSpread"], 2),
                           "remix": c["part"], **({"matchRunSec": c["matchRunSec"]} if "matchRunSec" in c else {})}
                          for c in body.get("tried", [])]

    stats_for_report = {
        "candidates": len(cands),
        "candidatesAboveMin": sum(1 for c in cands if c["seamScore"] >= MIN_SEAM_SCORE),
        "bestPerSection": [
            max((c["seamScore"] for c in cands if c["section"] == k), default=None) for k in range(len(sections))
        ],
        "candidatesPerSection": [sum(1 for c in cands if c["section"] == k) for k in range(len(sections))],
    }
    main_edges = edges[main_part] if edges else {"introEndSec": 0.0, "outroStartSec": round(duration, 3)}
    result = {
        "schemaVersion": SCHEMA_VERSION,
        "deriveVersion": DERIVE_VERSION,
        "file": src.name,
        "name": name,
        "folder": src.parent.name,
        "category": category,
        "pcm": str(flac.relative_to(POC)),
        "sampleRate": sr,
        "sourceSampleRate": probe_rate(src),
        "frames": int(len(signal)),
        "durationSec": round(duration, 4),
        "sha256": digest,
        "bpm": round(longest["bpm"], 2) if longest else None,
        "beatsPerBar": longest["beatsPerBar"] if longest else None,
        "integratedLufs": finite(raw["integratedLufs"]),
        "targetLufs": TARGET_LUFS,
        "introEndSec": main_edges["introEndSec"],
        "outroStartSec": main_edges["outroStartSec"],
        "remixes": [{"startSec": round(a, 3), "endSec": round(b, 3), **edges[k]} for k, (a, b) in enumerate(parts)],
        "silences": [{"startSec": round(a, 3), "endSec": round(b, 3)} for a, b in gaps],
        "sections": [{
            "startSec": round(s["startSec"], 3),
            "endSec": round(s["endSec"], 3),
            "bpm": round(s["bpm"], 2),
            "beatsPerBar": s["beatsPerBar"],
            "bars": int(len(s["dbIdx"]) - 1),
            "remix": s["part"],
            "ibiIqrPct": round(s["ibiIqrPct"], 2),
            "downbeatsGuessed": bool(s.get("guessed")),
            "gridToOnsetMs": s.get("gridOffsetMs"),
        } for s in sections],
        "body": body_info,
        "loops": loops,
        "flags": flags,
        "analysis": {
            "createdAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "decoder": raw.get("decoder"),
            "beatThisSec": raw.get("beatThisSec"),
            "filledBeats": sec_stats["filled"],
            "irregularSpans": sec_stats["irregular"],
            "droppedShortSpans": sec_stats["dropped"],
            **stats_for_report,
        },
    }
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=1, allow_nan=False))
    print(f"{name}: {len(parts)} parts, {len(sections)} sections, {len(cands)} bar candidates, body "
          f"{'%.3f s' % (body['lagSamples'] / sr) if body.get('found') else 'none'}, {len(loops)} loops")
    return result


def fmt_time(sec: float) -> str:
    sec = max(0.0, sec)
    return f"{int(sec // 60)}:{sec % 60:06.3f}"


def write_report(results: list[dict]) -> None:
    lines = ["# Hold and celebration loops", "",
             "Generated by `analysis/hold.py`. Times are in the decoded 48 kHz FLAC (`cache/hold/<name>.flac`), "
             "the file the engine must serve. **body** loops are the composer's loop: the stretch the track itself "
             "repeats, cut at the exact repeat period. **bars** loops are whole bars between two downbeats. "
             "Seam score 0–1: log-mel and RMS match over one beat, before or after the seam (the better side), with a "
             "click penalty. Seam jump: the largest sample step at the seam of the rendered audition, in dB re the "
             "±10 ms RMS; *natural* is the largest step within ±50 ms, *p* the seam step's percentile among them. "
             "Copy err: how far the 100 ms after (or before) the seam differ from what the track plays there, in dB "
             "re their level (−20 dB or lower: the same recording, so the jump continues the music exactly). "
             "*Inside*: starts after the intro and ends before the outro or fade. The first loop of each file is "
             "the preferred one.", ""]
    for r in results:
        lufs = r["integratedLufs"] if r["integratedLufs"] is not None else "-inf"
        lines += [f"## {r['file']} ({r.get('folder', 'hold')}/ → {r['category']})", "",
                  f"{r['durationSec']:.1f} s (source {r.get('sourceSampleRate') or '?'} Hz), integrated {lufs} LUFS. "
                  f"Intro ends {fmt_time(r['introEndSec'])}, outro starts {fmt_time(r['outroStartSec'])}. "
                  f"Flags: {', '.join(r['flags']) or 'none'}.", ""]
        if len(r["remixes"]) > 1:
            lines += ["Parts (split at silences ≥ 1 s): " + "; ".join(
                f"{k + 1}: {fmt_time(p['startSec'])}–{fmt_time(p['endSec'])}" for k, p in enumerate(r["remixes"])) + ".", ""]
        body = r.get("body") or {}
        if body.get("found"):
            lines += [f"Body: the music repeats every {body['lagSec']:.3f} s ({body['lagSamples']} samples; exact "
                      f"{body['lagExactSamples']:.2f}, copies correlate {body['copiesCorr']:.3f}) from "
                      f"{fmt_time(body['repeatStartSec'])} to {fmt_time(body['repeatEndSec'] + body['lagSec'])}.", ""]
        else:
            best = max(body.get("tried", []), key=lambda c: c["coverageSec"], default=None)
            lines += ["Body: no stretch of at least 3 s repeats with near-identical copies"
                      + (f" (largest repeat: {best['lagSec']:.2f} s lag, copies correlate {best['corr']:.2f})"
                         if best else "") + "; bar loops only.", ""]
        if r["sections"]:
            lines += ["| Section | Part | Start | End | BPM | Bars | IBI IQR % | Candidates | Best seam |",
                      "|---|---|---|---|---|---|---|---|---|"]
            a = r["analysis"]
            for k, s in enumerate(r["sections"]):
                best = a["bestPerSection"][k]
                lines.append(f"| {k} | {s['remix'] + 1} | {fmt_time(s['startSec'])} | {fmt_time(s['endSec'])} | "
                             f"{s['bpm']:.2f} | {s['bars']} | {s['ibiIqrPct']:.1f} | {a['candidatesPerSection'][k]} | "
                             f"{'-' if best is None else f'{best:.2f}'} |")
            spans = merge_spans([tuple(x) for x in a["irregularSpans"] + a["droppedShortSpans"]])
            if spans:
                lines += ["", "No section (irregular beats or under 4 bars): " + ", ".join(
                    f"{fmt_time(x)}–{fmt_time(y)}" for x, y in spans) + "."]
            lines.append("")
        if r["loops"]:
            lines += ["| # | Kind | Start | End | Bars | BPM | Seam | Side | Spec dB | RMS Δ dB | Wave corr | Copy err dB | "
                      "Seam jump dB (natural, p) | Inside | LUFS | Gain dB | Audition |",
                      "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
            for k, loop in enumerate(r["loops"], start=1):
                seam = loop["seam"]
                seams = loop["auditionCheck"]["seams"]
                jumps = f"{max(s['jumpDb'] for s in seams):+.1f} ({min(s['naturalMaxJumpDb'] for s in seams):+.1f}, " \
                        f"p{max(s['percentile'] for s in seams):.0f})"
                inside = "yes" if loop["afterIntro"] and loop["beforeOutro"] else \
                    ("in intro" if not loop["afterIntro"] else "in outro")
                kind = loop["kind"] + (" ★" if loop["preferred"] else "")
                bars = "-" if loop["bars"] is None else loop["bars"]
                bpm = "-" if loop["bpm"] is None else f"{loop['bpm']:.2f}"
                lines.append(f"| {k} | {kind} | {fmt_time(loop['startSec'])} | {fmt_time(loop['endSec'])} | {bars} | "
                             f"{bpm} | {loop['seamScore']:.2f} | {seam['seamSide']} | {seam['specDistDb']:.1f} | "
                             f"{seam['rmsDiffDb']:.1f} | {seam['waveCorr']:.2f} | {seam['copyErrDb']:+.0f} | {jumps} | "
                             f"{inside} | {loop['lufs']} | "
                             f"{loop['gainToTargetDb']:+.1f} | `{Path(loop['audition']).name}` |")
        else:
            lines.append("No loops: the engine has nothing to loop in this file.")
        problems = report_problems(r)
        if problems:
            lines += ["", "Problems and doubts:", ""] + [f"- {p}" for p in problems]
        lines.append("")
    REPORT.write_text("\n".join(lines))


def merge_spans(spans: list[tuple[float, float]], gap: float = 1.0) -> list[tuple[float, float]]:
    out: list[list[float]] = []
    for a, b in sorted(spans):
        if out and a - out[-1][1] <= gap:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return [(a, b) for a, b in out]


def report_problems(r: dict) -> list[str]:
    out = []
    a = r["analysis"]
    loops = r["loops"]
    body = r.get("body") or {}
    if body.get("found"):
        if not any(loop["kind"] == "body" for loop in loops):
            out.append(f"The body loop's seam scored {body.get('loopSeamScore')}, below {MIN_SEAM_SCORE}; it is not listed.")
        elif not any(loop["kind"] == "body" and loop["preferred"] for loop in loops):
            body_loop = next(loop for loop in loops if loop["kind"] == "body")
            if body_loop["seamScore"] < BODY_CLEAN_SEAM or body_loop["seam"]["jumpDb"] > body_loop["seam"]["naturalJumpDb"]:
                out.append(f"The body loop's seam is not clean enough to be preferred (score < {BODY_CLEAN_SEAM} "
                           f"or a step above the natural ones).")
            else:
                out.append(f"The exact repeat ({body['lagSec']:.2f} s) is shorter than a clean bar loop, so it is "
                           f"listed as an alternative and the intro/outro come from the steady beats.")
        if abs(body.get("roundingSamples", 0)) > 0.25:
            out.append(f"The repeat period is {body['lagExactSamples']:.2f} samples at 48 kHz, so the loop is "
                       f"{abs(body['roundingSamples']):.2f} sample off the exact period (a 32 kHz source resampled).")
    covered = {loop["section"] for loop in loops if loop["kind"] == "bars"}
    for k, s in enumerate(r["sections"]):
        if k in covered:
            continue
        best = a["bestPerSection"][k]
        if best is None:
            out.append(f"Section {k}: no bar loop (too short, or every span crosses an irregular bar, near-silence "
                       f"or the fade).")
        elif best < MIN_SEAM_SCORE:
            out.append(f"Section {k}: no bar loop; its best seam is {best:.2f} (< {MIN_SEAM_SCORE}).")
        else:
            out.append(f"Section {k}: no bar loop; its good candidates overlap a chosen loop or repeat the same "
                       f"material (average spectrum within {SAME_MATERIAL_DB} dB).")
    for k, loop in enumerate(loops, start=1):
        if loop["seamScore"] < 0.7:
            out.append(f"Loop {k}: seam {loop['seamScore']:.2f}; the material does not repeat exactly (wave corr "
                       f"{loop['seam']['waveCorr']:.2f}, spectrum {loop['seam']['specDistDb']:.1f} dB apart). "
                       f"Check it by ear.")
        if any(s["jumpDb"] > s["naturalMaxJumpDb"] for s in loop["auditionCheck"]["seams"]):
            out.append(f"Loop {k}: the seam step is larger than any natural step within ±50 ms (possible click).")
        if not loop["afterIntro"]:
            out.append(f"Loop {k}: starts inside the intro (before {fmt_time(r['remixes'][loop['remix']]['introEndSec'])}).")
        if not loop["beforeOutro"]:
            out.append(f"Loop {k}: ends inside the outro (after {fmt_time(r['remixes'][loop['remix']]['outroStartSec'])}).")
    for k, s in enumerate(r["sections"]):
        if s["bpm"] < 80:
            out.append(f"Section {k}: {s['bpm']:.2f} BPM on the Beat This! grid may be a half-time feel of "
                       f"{2 * s['bpm']:.2f}; its 4-bar loops would be 8 bars at the double tempo.")
    by_section: dict[int, list[float]] = {}
    for loop in loops:
        if loop["kind"] == "bars":
            by_section.setdefault(loop["section"], []).append(loop["bpm"])
    for k, bpms in by_section.items():
        if len(bpms) > 1 and (max(bpms) / min(bpms) - 1) > 0.001:
            out.append(f"Section {k}: bar-loop tempos differ ({min(bpms):.2f}–{max(bpms):.2f} BPM). Loop lengths "
                       f"follow the audio's own repeat period, which changes by that much between passages (likely edits).")
    offsets = [s["gridToOnsetMs"] for s in r["sections"] if s.get("gridToOnsetMs")]
    if offsets:
        spread = f"{-max(offsets):.0f}–{-min(offsets):.0f}" if max(offsets) - min(offsets) >= 1 else f"{-offsets[0]:.0f}"
        out.append(f"The Beat This! grid sits {spread} ms after the onsets; loop starts are moved to the onset minus "
                   f"{PRE_ATTACK_SEC * 1000:.0f} ms.")
    if len(r["remixes"]) > 1:
        out.append("Remix boundaries come from silences ≥ 1 s. A change without a silence is only caught by a tempo "
                   "change, irregular beats or a poor seam score.")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--file", action="append", help="only this file name (repeatable)")
    parser.add_argument("--force", action="store_true", help="re-decode, re-run Beat This!, re-derive")
    args = parser.parse_args()

    files: list[tuple[Path, str]] = []
    seen: set[str] = set()
    for folder, category in SOURCES:
        directory = AUDIO_DIR / folder
        if not directory.exists():
            print(f"{directory} does not exist; skipped")
            continue
        for p in sorted(directory.iterdir()):
            if p.suffix.lower() not in EXTENSIONS or p.name.startswith("."):
                continue
            if p.stem in seen:
                print(f"warning: {folder}/{p.name} has the same name as another track; skipped")
                continue
            seen.add(p.stem)
            files.append((p, category))
    OUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    wanted = set(args.file or [])
    for src, category in files:
        if wanted and src.name not in wanted and src.stem not in wanted:
            continue
        analyze(src, category, args.force)

    results = [json.loads((OUT / f"{p.stem}.json").read_text()) for p, _ in files if (OUT / f"{p.stem}.json").exists()]
    index = {
        "schemaVersion": SCHEMA_VERSION,
        "targetLufs": TARGET_LUFS,
        "files": [{
            "name": r["name"], "file": r["file"], "folder": r.get("folder"), "category": r["category"],
            "pcm": r["pcm"], "json": f"data/hold/{r['name']}.json", "sha256": r["sha256"],
            "durationSec": r["durationSec"], "bpm": r["bpm"], "introEndSec": r.get("introEndSec"),
            "outroStartSec": r.get("outroStartSec"), "loops": len(r["loops"]),
            "preferredLoop": next(({"kind": loop["kind"], "startSample": loop["startSample"],
                                    "endSample": loop["endSample"]} for loop in r["loops"] if loop.get("preferred")), None),
            "flags": r["flags"],
        } for r in results],
    }
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1, allow_nan=False))
    write_report(results)
    print(f"index.json: {len(results)} files; report: {REPORT.relative_to(POC)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
