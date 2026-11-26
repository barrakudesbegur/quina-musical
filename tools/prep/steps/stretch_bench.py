"""Benchmarks for the layering stretcher (writes nothing outside <cacheDir>/stretch/bench/).

    tools/prep/.venv/bin/python tools/prep/steps/stretch_bench.py engines   # Rubber Band vs fallbacks
    tools/prep/.venv/bin/python tools/prep/steps/stretch_bench.py sections  # stretch.py on many hooks

`engines`: 10 s clips (a steady stretch of the mix, and the drums stem where it exists) at speed
ratios 0.92, 0.96, 1.04 and 1.08, through Rubber Band R3 (standard and short window), Rubber Band R2,
the librosa phase vocoder and audiotsm WSOLA. Metrics, per beat of the analysis grid (time-scaled):
  - speed: wall and CPU seconds per second of input audio;
  - timingMs: lag that best aligns the output's spectral flux with the ideally time-scaled source
    flux (±40 ms, 1 ms steps): mean (bias) and p95 of |lag|;
  - smearMs: high-band (>2 kHz) attack rise time 10 -> 90 %, output minus source (transient smearing);
  - preEchoDb: energy in [-40, -10] ms before the beat relative to [0, 30] ms after it, output minus
    source (phase-vocoder pre-echo);
  - offBeatFlux: spectral flux more than 60 ms away from any beat, output / source (warble, phasiness);
  - roundTripLsdDb: log-spectral distance after stretching by r and back by 1/r (overall damage);
  - beatThisMs: Beat This! on the output vs the scaled grid (mean).

`sections`: renders N-bar sections through stretch.render (mix only, then with stems) at random
ratios inside ±8%, verifies each, and reports seconds per section and timing errors.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfiltfilt

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import repertoire as repertoires  # noqa: E402
import stretch as S  # noqa: E402

from steps import rubberband as rb  # noqa: E402

SR = S.SR
RATIOS = (0.92, 0.96, 1.04, 1.08)
CLIP_SEC = 10.0


# ---------------------------------------------------------------- engines

def eng_rb(kind: str):
    def run(x: np.ndarray, speed: float) -> np.ndarray:
        return rb.stretch(x, SR, int(round(x.shape[1] / speed)), None, engine=kind)
    return run


def eng_librosa(x: np.ndarray, speed: float) -> np.ndarray:
    import librosa

    return np.stack([librosa.effects.time_stretch(c, rate=speed, n_fft=2048) for c in x]).astype(np.float32)


def eng_wsola(x: np.ndarray, speed: float) -> np.ndarray:
    from audiotsm import wsola
    from audiotsm.io.array import ArrayReader, ArrayWriter

    writer = ArrayWriter(x.shape[0])
    wsola(x.shape[0], speed=speed, frame_length=1024).run(ArrayReader(x.astype(np.float32)), writer)
    return writer.data.astype(np.float32)


ENGINES = {
    "rubberband-r3": eng_rb("r3"),
    "rubberband-r3-short": eng_rb("r3short"),
    "rubberband-r2": eng_rb("r2"),
    "librosa-pv": eng_librosa,
    "audiotsm-wsola": eng_wsola,
}


# ---------------------------------------------------------------- metrics

def timing_lags(y: np.ndarray, x: np.ndarray, beats_out: np.ndarray, speed: float) -> np.ndarray:
    fy, fx = S._flux(y), S._flux(x)
    frames = np.arange(len(fy)) * 48 / SR
    ideal = np.interp(frames * speed * SR / 48, np.arange(len(fx)), fx)
    win, maxlag, lags = 60, 40, []
    for b in beats_out:
        c = int(round(b * SR / 48))
        if c - win - maxlag < 0 or c + win + maxlag > len(fy):
            continue
        a = ideal[c - win:c + win] - ideal[c - win:c + win].mean()
        if not np.any(a):
            continue
        sc = [np.dot(a, fy[c - win + l:c + win + l] - fy[c - win + l:c + win + l].mean()) for l in range(-maxlag, maxlag + 1)]
        lags.append(int(np.argmax(sc)) - maxlag)
    return np.asarray(lags, dtype=float)


_HP = butter(4, 2000, "high", fs=SR, output="sos")


def _env(m: np.ndarray) -> np.ndarray:
    return np.sqrt(np.convolve(m * m, np.ones(48) / 48, "same"))


def attack_stats(mono: np.ndarray, beats: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Per beat: high-band 10->90 % rise time (ms) and pre-echo ratio (dB)."""
    hi = _env(sosfiltfilt(_HP, mono))
    full = _env(mono)
    rise, pre = [], []
    for b in beats:
        c = int(round(b * SR))
        lo_i, hi_i = c - int(0.06 * SR), c + int(0.06 * SR)
        if lo_i - int(0.1 * SR) < 0 or hi_i > len(mono):
            continue
        seg = hi[lo_i:hi_i]
        base = np.percentile(hi[lo_i - int(0.06 * SR):lo_i], 20)
        pk_i = int(np.argmax(seg))
        pk = seg[pk_i]
        if pk <= base * 1.5:
            continue
        pre_seg = seg[:pk_i + 1]
        t10 = np.flatnonzero(pre_seg < base + 0.1 * (pk - base))
        t90 = np.argmax(pre_seg >= base + 0.9 * (pk - base))
        t10 = t10[-1] if len(t10) else 0
        rise.append(max(0, t90 - t10) / SR * 1000)
        e_pre = np.sum(full[c - int(0.04 * SR):c - int(0.01 * SR)] ** 2)
        e_post = np.sum(full[c:c + int(0.03 * SR)] ** 2) + 1e-12
        pre.append(10 * np.log10(e_pre / e_post + 1e-12))
    return np.asarray(rise), np.asarray(pre)


def off_beat_flux(mono: np.ndarray, beats: np.ndarray) -> float:
    f = S._flux(mono)
    t = np.arange(len(f)) * 48 / SR
    far = np.min(np.abs(t[:, None] - beats[None, :]), axis=1) > 0.06 if len(beats) else np.ones(len(t), bool)
    return float(np.mean(f[far]))


def lsd(a: np.ndarray, b: np.ndarray) -> float:
    import librosa

    n = min(len(a), len(b))
    A = np.abs(librosa.stft(a[:n], n_fft=2048, hop_length=512)) + 1e-6
    B = np.abs(librosa.stft(b[:n], n_fft=2048, hop_length=512)) + 1e-6
    d = 20 * np.log10(A / B)
    mask = (A > A.max() * 1e-4)
    return float(np.mean(np.sqrt(np.sum((d * mask) ** 2, axis=0) / np.maximum(1, mask.sum(axis=0)))))


def clips(repertoire: repertoires.Repertoire, n_songs: int, seed: int) -> list[dict]:
    """Steady 10 s clips starting on a downbeat 8 bars before a valid best hook."""
    index = json.loads(repertoire.analysis_index.read_text())["songs"]
    rng = random.Random(seed)
    rng.shuffle(index)
    out = []
    for song in index:
        if len(out) >= n_songs:
            break
        a = S.load_analysis(song["id"], repertoire)
        if not a["tempo"].get("isStable"):
            continue
        hooks = [h for h in a["hooks"] if h["valid"] and h["tag"] == "best" and h.get("downbeatIndex", 0) >= 8]
        if not hooks:
            continue
        k = hooks[0]["downbeatIndex"] - 6
        t0 = a["downbeats"][k]
        t1 = t0 + CLIP_SEC
        beats = np.asarray(a["beats"])
        inner = beats[(beats > t0 + 0.25) & (beats < t1 - 0.4)] - t0
        clip = {"song": song["id"], "title": a["title"], "t0": t0, "beats": inner,
                "mix": S.read_region(repertoire.mix_flac(song["id"]), int(t0 * SR), int(t1 * SR))}
        info, _ = S.stems_source(song["id"], int(t0 * SR), int(t1 * SR), repertoire)
        if info:
            clip["drums"] = S.read_region(info["paths"]["drums"], int(t0 * SR), int(t1 * SR),
                                          info["window"]["startSample"]) / info["stemGain"]
        out.append(clip)
    return out


def bench_engines(repertoire: repertoires.Repertoire, n_songs: int, seed: int, beat_this: bool) -> dict:
    rows = []
    for clip in clips(repertoire, n_songs, seed):
        for part in ("mix", "drums"):
            if part not in clip:
                continue
            x = clip[part]
            xm = x.mean(axis=0)
            src_rise, src_pre = attack_stats(xm, clip["beats"])
            src_off = off_beat_flux(xm, clip["beats"])
            for speed in RATIOS:
                beats_out = clip["beats"] / speed
                for name, fn in ENGINES.items():
                    t, c = time.perf_counter(), time.process_time()
                    y = fn(x, speed)
                    wall, cpu = time.perf_counter() - t, time.process_time() - c
                    ym = y.mean(axis=0)
                    lags = timing_lags(ym, xm, beats_out, speed)
                    rise, pre = attack_stats(ym, beats_out)
                    back = fn(y, 1.0 / speed).mean(axis=0)
                    row = {
                        "song": clip["song"], "part": part, "speed": speed, "engine": name,
                        "wallPerSec": wall / CLIP_SEC, "cpuPerSec": cpu / CLIP_SEC,
                        "timingMeanMs": float(lags.mean()) if len(lags) else None,
                        "timingP95Ms": float(np.percentile(np.abs(lags), 95)) if len(lags) else None,
                        "smearMs": float(np.median(rise) - np.median(src_rise)) if len(rise) and len(src_rise) else None,
                        "preEchoDb": float(np.median(pre) - np.median(src_pre)) if len(pre) and len(src_pre) else None,
                        "offBeatFlux": off_beat_flux(ym, beats_out) / src_off,
                        "roundTripLsdDb": lsd(back, xm),
                    }
                    if beat_this and part == "mix":
                        row["beatThisMs"] = S._stats(S._match(S._beat_this(ym), beats_out[1:-1])).get("meanMs")
                    rows.append(row)
                    print(json.dumps({k: (round(v, 3) if isinstance(v, float) else v) for k, v in row.items()}), flush=True)
    return {"rows": rows, "summary": summarize(rows)}


def summarize(rows: list[dict]) -> dict:
    out = {}
    keys = ("wallPerSec", "cpuPerSec", "timingMeanMs", "timingP95Ms", "smearMs", "preEchoDb", "offBeatFlux",
            "roundTripLsdDb", "beatThisMs")
    for part in ("mix", "drums"):
        for name in ENGINES:
            sel = [r for r in rows if r["engine"] == name and r["part"] == part]
            if not sel:
                continue
            agg = {}
            for k in keys:
                vals = [r[k] for r in sel if r.get(k) is not None]
                if vals:
                    agg[k] = round(float(np.median(vals)), 3)
                    if k in ("timingMeanMs", "beatThisMs"):
                        agg[k + "AbsMax"] = round(float(np.max(np.abs(vals))), 2)
            out[f"{part}/{name}"] = {"n": len(sel), **agg}
    return out


# ---------------------------------------------------------------- sections

def bench_sections(repertoire: repertoires.Repertoire, n_songs: int, seed: int, bars: int, beat_this: bool) -> dict:
    index = json.loads(repertoire.analysis_index.read_text())["songs"]
    rng = random.Random(seed)
    rng.shuffle(index)
    rows = []
    for song in index[:n_songs]:
        a = S.load_analysis(song["id"], repertoire)
        hooks = [h for h in a["hooks"] if h["valid"] and h.get("downbeatIndex", 0) >= bars]
        if not hooks:
            continue
        hook = rng.choice(hooks)
        speed = rng.choice([-1, 1]) * rng.uniform(0.01, 0.08) + 1
        to_bpm = a["tempo"]["bpm"] * speed
        for stems in (False, True):
            try:
                res = S.render(song["id"], hook["id"], to_bpm, bars=bars, after_bars=1, stems=stems, force=True,
                               repertoire=repertoire)
            except S.StretchError as err:
                print("skip", song["id"], err)
                break
            if stems and not res["stems"]["available"]:
                rows.append({"song": song["id"], "stems": True, "skipped": res["stems"]["reason"]})
                continue
            if stems:
                ver = {part: S.verify(res, part=part, beat_this=False, repertoire=repertoire)["xcorr"] for part in res["parts"]}
            else:
                ver = S.verify(res, part="mix", beat_this=beat_this, repertoire=repertoire)
            row = {"song": song["id"], "hook": hook["id"], "stems": stems, "ratio": res["ratio"],
                   "parts": len(res["parts"]), "seconds": res["timing"]["totalSec"],
                   "stretchSec": res["timing"]["stretchSec"], "stretchCpuSec": res["timing"]["stretchCpuSec"],
                   "audioSec": res["output"]["durationSec"], "verify": ver,
                   "beatDeviationMs": res["output"]["analysisBeatDeviationMs"]}
            again = S.render(song["id"], hook["id"], to_bpm, bars=bars, after_bars=1, stems=stems, repertoire=repertoire)
            row["cachedSeconds"] = again["seconds"]
            row["cachedHit"] = again["cached"]
            rows.append(row)
            print(json.dumps(row), flush=True)
    return {"rows": rows, "summary": summarize_sections(rows)}


def summarize_sections(rows: list[dict]) -> dict:
    out = {}
    for stems in (False, True):
        sel = [r for r in rows if r.get("stems") == stems and "verify" in r]
        if not sel:
            continue
        agg = {"sections": len(sel),
               "secondsMedian": round(float(np.median([r["seconds"] for r in sel])), 3),
               "secondsMax": round(float(np.max([r["seconds"] for r in sel])), 3),
               "cpuSecondsMedian": round(float(np.median([r["stretchCpuSec"] for r in sel])), 3),
               "audioSecMedian": round(float(np.median([r["audioSec"] for r in sel])), 2),
               "cachedSecondsMax": round(float(np.max([r["cachedSeconds"] for r in sel])), 4)}
        parts = ["mix"] if not stems else ["mix", "drums", "bass", "vocals", "other"]
        for part in parts:
            vals = [r["verify"]["xcorr"] if not stems else r["verify"][part] for r in sel]
            vals = [v for v in vals if v.get("n")]
            agg[f"xcorr/{part}"] = {
                "meanOfMeansMs": round(float(np.mean([v["meanMs"] for v in vals])), 2),
                "medianAbsMs": round(float(np.median([v["medianAbsMs"] for v in vals])), 2),
                "p95AbsMsMedian": round(float(np.median([v["p95AbsMs"] for v in vals])), 2),
                "p95AbsMsWorst": round(float(np.max([v["p95AbsMs"] for v in vals])), 2),
            }
        if not stems and sel[0]["verify"].get("beatThis"):
            for k in ("output", "sourceMapped"):
                vals = [r["verify"]["beatThis"][k] for r in sel if r["verify"]["beatThis"][k].get("n")]
                agg[f"beatThis/{k}"] = {
                    "meanOfMeansMs": round(float(np.mean([v["meanMs"] for v in vals])), 2),
                    "medianAbsMs": round(float(np.median([v["medianAbsMs"] for v in vals])), 2),
                    "absMeanWorstMs": round(float(np.max([abs(v["meanMs"]) for v in vals])), 2),
                }
        agg["analysisBeatDeviationMsMedian"] = round(float(np.median([r["beatDeviationMs"]["maxAbs"] for r in sel])), 2)
        out["stems" if stems else "mix"] = agg
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["engines", "sections"])
    ap.add_argument("--songs", type=int, default=4)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--bars", type=int, default=4)
    ap.add_argument("--no-beat-this", action="store_true")
    repertoires.add_argument(ap)
    args = ap.parse_args()
    repertoire = repertoires.from_args(args)
    bench = repertoire.stretch_dir / "bench"
    bench.mkdir(parents=True, exist_ok=True)
    if args.mode == "engines":
        res = bench_engines(repertoire, args.songs, args.seed, not args.no_beat_this)
        print(json.dumps(res["summary"], indent=1))
    else:
        res = bench_sections(repertoire, args.songs, args.seed, args.bars, not args.no_beat_this)
        print(json.dumps(res["summary"], indent=1))
    (bench / f"{args.mode}.json").write_text(json.dumps(res, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
