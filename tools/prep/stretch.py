"""Render the bars of song B that lead into a hook, time-stretched onto a constant grid at A's tempo.

For "real DJ layering": B's drums (or the whole lead-in) play under A at A's tempo, then B lands on
its hook at its own tempo. The section is N bars before the hook downbeat plus `after` bars after
it, with a quarter-beat pad on both ends for fades.

Stretching is Rubber Band R3 ("finer"), pitch preserved. The mix and drums are "sliced", with
R3's short window: a constant ratio per bar, so every source downbeat is pinned to the target grid;
each bar is rendered on its own with 0.25 s of context and bars are spliced with a 10 ms crossfade
ending 15 ms before the downbeat, where the transient masks it (one R3 pass drifts up to ~15-18 ms
over a few bars; see steps/rubberband.py). Bass, vocals and other are one continuous pass of
standard-window R3 with the downbeats as a key-frame map: no splices in held notes, timing within
~10 ms. --engine r3|r3short|r2 forces one engine for every part.

Tempo: the speed ratio is target / source. When the direct ratio is outside ±8% (--max-stretch)
and half or double time is inside, B is stretched to half or double A's tempo (each B beat then
spans 2 A beats, or half of one). Outside both, nothing is rendered (exit 2).

Paths are the pool's (--pool, analysis/pool.py; the default pool's are cache/ and data/).
Inputs: <cacheDir>/<B>/mix.flac and <dataDir>/analysis/<B>.json; with --stems, the drums/bass/vocals
windows from <dataDir>/stems/<B>.json (stored at stemGain 0.5) plus other = mix - (drums + bass +
vocals). Songs without stems, or whose windows don't cover the section, render the mix only
(meta.stems says why).

Output: <cacheDir>/stretch/<B>/<hookId>@<ratio>/<part>.flac (48 kHz stereo 16-bit, every part at
partGain 0.5: decoded / 0.5 is the real signal) and meta.json. <ratio> in the folder name is the
nominal speed ratio, effective BPM / the song's analysed BPM, 4 decimals; meta.ratio is the exact
one over the rendered bars. Cached: a render is reused when its inputs match and it covers the
requested bars and parts; the result's `request` block says where the requested bars start.

CLI (from experiments/mixer-poc):
    analysis/.venv/bin/python analysis/stretch.py --song 12 --hook 12-best-0 --to-bpm 126 \
        [--bars 4] [--after-bars 1] [--stems] [--max-stretch 0.08] [--force] [--verify] [--json] [--pool NAME]

Python (every function takes pool=; None means $QUINA_POOL, else the default pool):
    from stretch import render, verify
    result = render(12, "12-best-0", 126.0, bars=4, after_bars=1, stems=True)
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import shutil
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import pool as pools  # noqa: E402
from steps import rubberband as rb  # noqa: E402
from steps.tempo_match import MAX_STRETCH, choose_multiple  # noqa: E402

SR = 48000
VERSION = 1
PAD_BEATS = 0.25          # pre- and post-roll, in beats
CONTEXT_SEC = 0.25        # extra source rendered around each bar
PART_GAIN = 0.5           # every written part is stored at half scale, like the stems
STEM_PARTS = ("drums", "bass", "vocals")
ALL_PARTS = ("mix", "drums", "bass", "vocals", "other")
# Parts rendered bar by bar (exact downbeats, a splice before each one, masked by the transient), like
# a DJ tool's "beats" warp mode; the tonal stems are one continuous pass, where a splice in a held
# note or a bass line would be more audible than a few ms of timing.
SLICED_PARTS = ("mix", "drums")
# engine="auto": R3 with its short window for the sliced parts (transients land on the grid for both
# the flux check and Beat This!; the standard window's long low-frequency analysis makes Beat This
# place beats 10-60 ms off), standard R3 for the tonal stems.
ENGINE_NAMES = {"r3": "R3 (finer)", "r3short": "R3 (finer), short window", "r2": "R2 (faster)"}
GRID_WARN_MS = 30.0


class StretchError(Exception):
    pass


def _pool(pool: pools.Pool | None) -> pools.Pool:
    return pool if pool is not None else pools.load()


# ---------------------------------------------------------------- inputs

def load_analysis(song: int, pool: pools.Pool | None = None) -> dict:
    path = _pool(pool).analysis_dir / f"{song}.json"
    if not path.exists():
        raise StretchError(f"no analysis for song {song} ({path})")
    return json.loads(path.read_text())


def find_hook(analysis: dict, hook_id: str) -> dict:
    for hook in analysis["hooks"]:
        if hook["id"] == hook_id:
            return hook
    ids = ", ".join(h["id"] for h in analysis["hooks"])
    raise StretchError(f"song {analysis['songId']} has no hook {hook_id!r} (hooks: {ids})")


def section(analysis: dict, hook: dict, bars: int, after_bars: int) -> dict:
    """Source downbeats of the section (clamped to the song), their beat counts and local tempo."""
    downbeats = np.asarray(analysis["downbeats"], dtype=float)
    beat_idx = np.asarray(analysis["downbeatBeatIndex"], dtype=int)
    beats = np.asarray(analysis["beats"], dtype=float)
    k = hook.get("downbeatIndex")
    if k is None:
        raise StretchError(f"hook {hook['id']} has no downbeat")
    k0 = max(0, k - bars)
    k1 = min(len(downbeats) - 1, k + after_bars)
    if k1 - k0 < 1:
        raise StretchError(f"hook {hook['id']}: no complete bar around the hook")
    db = downbeats[k0:k1 + 1]
    beats_per_bar = np.diff(beat_idx[k0:k1 + 1])
    total_beats = int(beats_per_bar.sum())
    local_bpm = 60.0 * total_beats / (db[-1] - db[0])
    src_beats = beats[beat_idx[k0]:beat_idx[k1] + 1]
    return {
        "k0": k0, "k1": k1, "hookBar": k - k0, "bars": k - k0, "afterBars": k1 - k,
        "downbeats": db, "beatsPerBar": beats_per_bar, "totalBeats": total_beats,
        "localBpm": local_bpm, "beats": src_beats,
    }


def file_fingerprint(path: Path) -> str:
    st = path.stat()
    return f"{st.st_size}:{st.st_mtime_ns}"


def analysis_fingerprint(analysis: dict, hook: dict) -> str:
    payload = json.dumps([analysis["beats"], analysis["downbeats"], analysis["downbeatBeatIndex"],
                          hook.get("downbeatIndex")], separators=(",", ":"))
    return hashlib.sha1(payload.encode()).hexdigest()[:16]


def stems_source(song: int, start_sample: int, end_sample: int,
                 pool: pools.Pool | None = None) -> tuple[dict | None, str]:
    """(info, reason): the stems window covering [start, end) samples of mix.flac, or None and why."""
    pool = _pool(pool)
    meta_path = pool.stems_dir / f"{song}.json"
    if not meta_path.exists():
        return None, "no stems json (not separated yet)"
    try:
        meta = json.loads(meta_path.read_text())
    except (OSError, ValueError) as err:
        return None, f"unreadable stems json: {err}"
    # pathTemplate is relative to experiments/mixer-poc (or absolute, for a cache outside it).
    template = meta.get("pathTemplate", f"{pools.display(pool.stems_cache(song))}/{{stem}}.{{startSample}}.flac")
    for win in meta.get("windows", []):
        w0 = int(win["startSample"])
        w1 = w0 + int(win["lengthSamples"])
        if w0 <= start_sample and end_sample <= w1:
            paths = {s: pools.POC / template.format(stem=s, startSample=w0) for s in STEM_PARTS}
            missing = [s for s, p in paths.items() if not p.exists()]
            if missing:
                return None, f"window {w0} is missing {', '.join(missing)}"
            return {
                "window": {"startSample": w0, "lengthSamples": w1 - w0},
                "stemGain": float(meta.get("stemGain", 1.0)),
                "paths": paths,
                "fingerprint": f"{meta.get('createdAt')}:{w0}:" + ",".join(file_fingerprint(p) for p in paths.values()),
                "model": meta.get("model"),
            }, "ok"
    return None, "no stems window covers the section"


def read_region(path: Path, start: int, stop: int, file_offset: int = 0) -> np.ndarray:
    """(2, stop - start) float32 of samples [start, stop) of mix.flac's timeline, zero-padded."""
    length = stop - start
    out = np.zeros((2, length), dtype=np.float32)
    info = sf.info(str(path))
    lo = max(start - file_offset, 0)
    hi = min(stop - file_offset, info.frames)
    if hi > lo:
        data, _ = sf.read(str(path), start=lo, stop=hi, dtype="float32", always_2d=True)
        data = data.T
        if data.shape[0] == 1:
            data = np.repeat(data, 2, axis=0)
        dst = lo + file_offset - start
        out[:, dst:dst + data.shape[1]] = data[:2]
    return out


# ---------------------------------------------------------------- planning

def plan(song: int, hook_id: str, to_bpm: float, bars: int = 4, after_bars: int = 1,
         max_stretch: float = MAX_STRETCH, pool: pools.Pool | None = None) -> dict:
    """Everything about a render except the audio: tempo choice, span, grid, time map, folder."""
    pool = _pool(pool)
    analysis = load_analysis(song, pool)
    hook = find_hook(analysis, hook_id)
    sec = section(analysis, hook, bars, after_bars)
    choice = choose_multiple(sec["localBpm"], to_bpm, max_stretch)
    if not choice["ok"]:
        raise StretchError(
            f"song {song} at {sec['localBpm']:.2f} BPM can't reach {to_bpm:g} BPM within ±{max_stretch:.0%} "
            f"(closest: {choice['mode']} time, ratio {choice['ratio']:.4f}); use a stems-only overlap or an "
            f"effect-led cut instead")
    eff_bpm = choice["effectiveBpm"]
    beat_out = 60.0 / eff_bpm
    db = sec["downbeats"]
    bpb = sec["beatsPerBar"]
    duration = float(analysis["source"]["durationSec"])
    # Output downbeats sit on the constant grid; the pads use the first and last bar's ratio.
    pre_out = PAD_BEATS * beat_out
    out_db = pre_out + beat_out * np.concatenate([[0], np.cumsum(bpb)])
    src_beat_first = (db[1] - db[0]) / bpb[0]
    src_beat_last = (db[-1] - db[-2]) / bpb[-1]
    pre_src = min(PAD_BEATS * src_beat_first, db[0])
    post_src = min(PAD_BEATS * src_beat_last, duration - db[-1])
    ratio_first = (out_db[1] - out_db[0]) / (db[1] - db[0])
    ratio_last = (out_db[-1] - out_db[-2]) / (db[-1] - db[-2])
    start_src = db[0] - pre_src
    end_src = db[-1] + post_src
    out0 = out_db[0] - pre_src * ratio_first
    out_db = out_db - out0  # if the pre-roll was clamped at the song start, output 0 is still start_src
    out_end = out_db[-1] + post_src * ratio_last
    time_map = [[0.0, start_src]] + [[float(o), float(s)] for o, s in zip(out_db, db)] + [[float(out_end), end_src]]
    grid_beats = out_db[0] + beat_out * np.arange(sec["totalBeats"] + 1)
    mapped_beats = np.interp(sec["beats"], db, out_db)
    nominal = eff_bpm / float(analysis["tempo"]["bpm"])
    folder = pool.stretch_dir / str(song) / f"{hook_id}@{nominal:.4f}"
    return {
        "analysis": analysis, "hook": hook, "section": sec, "choice": choice,
        "effectiveBpm": eff_bpm, "beatOut": beat_out, "outDownbeats": out_db, "outEnd": out_end,
        "startSrc": start_src, "endSrc": end_src, "timeMap": time_map, "gridBeats": grid_beats,
        "mappedBeats": mapped_beats, "nominalRatio": nominal, "folder": folder,
    }


# ---------------------------------------------------------------- render

def _key(p: dict, stems_info: dict | None, engine: str, pool: pools.Pool) -> dict:
    song = p["analysis"]["songId"]
    return {
        "version": VERSION,
        "engine": f"rubberband-{engine}-sliced-mix-drums",
        "effectiveBpm": round(p["effectiveBpm"], 6),
        "mix": file_fingerprint(pool.mix_flac(song)),
        "analysis": analysis_fingerprint(p["analysis"], p["hook"]),
        "stems": stems_info["fingerprint"] if stems_info else None,
    }


def _request_block(meta: dict, p: dict, to_bpm: float) -> dict:
    """Where the requested bars sit inside a (possibly larger) cached render."""
    sec = p["section"]
    offset = meta["bars"] - sec["bars"]
    out_db = meta["output"]["downbeatsSec"]
    first = out_db[offset]
    end_db = out_db[meta["bars"] + sec["afterBars"]]
    pad = PAD_BEATS * meta["output"]["beatSec"]
    return {
        "song": meta["songId"], "hookId": meta["hookId"], "toBpm": to_bpm,
        "tempoMultiple": p["choice"]["multiple"], "mode": p["choice"]["mode"],
        "targetBeatSec": 60.0 / to_bpm, "bars": sec["bars"], "afterBars": sec["afterBars"],
        "targetBarsBefore": sec["bars"] / p["choice"]["multiple"],
        "startSec": round(max(0.0, first - pad), 6), "firstDownbeatSec": first,
        "hookSec": meta["output"]["hookSec"], "endSec": round(min(meta["output"]["durationSec"], end_db + pad), 6),
    }


def render(song: int, hook_id: str, to_bpm: float, bars: int = 4, after_bars: int = 1, stems: bool = False,
           max_stretch: float = MAX_STRETCH, force: bool = False, engine: str = "auto",
           pool: pools.Pool | None = None) -> dict:
    """Render (or reuse) B's section into the hook, stretched to `to_bpm`. Returns meta + `dir`,
    `cached` and `request` (the requested bars' position inside the render)."""
    t_start = time.perf_counter()
    pool = _pool(pool)
    p = plan(song, hook_id, to_bpm, bars, after_bars, max_stretch, pool)
    start_sample = int(np.floor(p["startSrc"] * SR))
    end_sample = int(np.ceil(p["endSrc"] * SR))
    stems_info, stems_reason = (None, "not requested")
    if stems:
        stems_info, stems_reason = stems_source(song, start_sample, end_sample, pool)
    key = _key(p, stems_info, engine, pool)
    folder: Path = p["folder"]
    want_parts = list(ALL_PARTS) if stems_info else ["mix"]
    want_bars, want_after = p["section"]["bars"], p["section"]["afterBars"]

    meta_path = folder / "meta.json"
    if meta_path.exists() and not force:
        try:
            old = json.loads(meta_path.read_text())
        except ValueError:
            old = None
        if old and old.get("key", {}) | {"stems": None} == key | {"stems": None}:
            same_stems = old["key"].get("stems") == key["stems"] or not stems_info
            files_ok = all((folder / f"{part}.flac").exists() for part in old["parts"])
            covers = (old["bars"] >= want_bars and old["afterBars"] >= want_after
                      and set(want_parts) <= set(old["parts"]) and same_stems)
            if files_ok and covers:
                hit = {**old, "dir": str(folder), "cached": True,
                       "request": _request_block(old, p, to_bpm),
                       "seconds": round(time.perf_counter() - t_start, 4)}
                if stems and not stems_info and not old["stems"]["available"]:
                    hit["stems"] = {"available": False, "reason": stems_reason}
                return hit
            if files_ok and same_stems:
                # Grow instead of thrashing between bar counts or part sets.
                want_bars = max(want_bars, old["bars"])
                want_after = max(want_after, old["afterBars"])
                if not stems_info and set(old["parts"]) > {"mix"}:
                    stems_info, stems_reason = stems_source(song, start_sample, end_sample, pool)
                    want_parts = list(ALL_PARTS) if stems_info else want_parts
        if (want_bars, want_after) != (p["section"]["bars"], p["section"]["afterBars"]):
            p = plan(song, hook_id, to_bpm, want_bars, want_after, max_stretch, pool)
            start_sample = int(np.floor(p["startSrc"] * SR))
            end_sample = int(np.ceil(p["endSrc"] * SR))
            if stems_info:
                stems_info, stems_reason = stems_source(song, start_sample, end_sample, pool)
                want_parts = list(ALL_PARTS) if stems_info else ["mix"]
            key = _key(p, stems_info, engine, pool)

    sec = p["section"]
    ctx = int(round(CONTEXT_SEC * SR)) + 1
    a0, a1 = start_sample - ctx, end_sample + ctx
    mix_path = pool.mix_flac(song)
    if not mix_path.exists():
        raise StretchError(f"missing {mix_path}")
    t_read = time.perf_counter()
    audio = {"mix": read_region(mix_path, a0, a1)}
    if stems_info:
        gain = stems_info["stemGain"]
        w0 = stems_info["window"]["startSample"]
        for stem in STEM_PARTS:
            audio[stem] = read_region(stems_info["paths"][stem], a0, a1, file_offset=w0) / gain
        audio["other"] = audio["mix"] - audio["drums"] - audio["bass"] - audio["vocals"]
    read_sec = time.perf_counter() - t_read

    # Anchors: span start, the interior downbeats, span end (pads ride the first and last bar).
    db = sec["downbeats"]
    out_db = p["outDownbeats"]
    src_anchor = np.concatenate([[p["startSrc"]], db[1:-1], [p["endSrc"]]]) * SR - a0
    out_anchor = np.concatenate([[0.0], out_db[1:-1], [p["outEnd"]]]) * SR
    t_rb = time.perf_counter()
    cpu0 = time.process_time()
    sliced = [part for part in want_parts if part in SLICED_PARTS]
    smooth = [part for part in want_parts if part not in SLICED_PARTS]
    rendered = {}
    sliced_engine, smooth_engine = ("r3short", "r3") if engine == "auto" else (engine, engine)
    y, info = rb.stretch_piecewise(np.concatenate([audio[part] for part in sliced], axis=0), SR,
                                   src_anchor, out_anchor, engine=sliced_engine, context_sec=CONTEXT_SEC)
    rendered.update({part: y[2 * i:2 * i + 2] for i, part in enumerate(sliced)})
    if smooth:
        y2, _ = rb.stretch_mapped(np.concatenate([audio[part] for part in smooth], axis=0), SR,
                                  src_anchor, out_anchor, engine=smooth_engine)
        rendered.update({part: y2[2 * i:2 * i + 2] for i, part in enumerate(smooth)})
    rb_sec = time.perf_counter() - t_rb
    rb_cpu = time.process_time() - cpu0

    tmp = folder.with_name(folder.name + f".tmp{os.getpid()}")
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    clipped = {}
    for part in want_parts:
        data = rendered[part].T * PART_GAIN
        clipped[part] = int(np.sum(np.abs(data) >= 1.0))
        sf.write(str(tmp / f"{part}.flac"), np.clip(data, -1.0, 32767 / 32768), SR, subtype="PCM_16")

    grid = p["gridBeats"]
    dev = (p["mappedBeats"] - grid) * 1000
    warnings = []
    if np.max(np.abs(dev)) > GRID_WARN_MS:
        warnings.append(f"the analysis beats sit up to {np.max(np.abs(dev)):.0f} ms off the bar grid in this section: "
                        "check this hook's grid in the audition page before layering it")
    if not p["hook"].get("valid"):
        warnings.append("the hook is not valid in the analysis")
    if any(clipped.values()):
        warnings.append(f"clipped samples: {clipped}")
    hook_sec = float(out_db[sec["bars"]])
    meta = {
        "schemaVersion": 1,
        "songId": song,
        "hookId": hook_id,
        "hookValid": bool(p["hook"].get("valid")),
        "key": key,
        "engine": {
            "name": "Rubber Band Library 4.0.0, offline, pitch preserved",
            "id": engine,
            "backend": rb.backend(),
            "method": {
                **{part: f"{ENGINE_NAMES[sliced_engine]}, sliced: constant ratio per bar, spliced 15 ms "
                         "before each downbeat (exact grid)" for part in sliced},
                **{part: f"{ENGINE_NAMES[smooth_engine]}, continuous: one pass, downbeats as a key-frame map "
                         "(no splices, timing within ~10 ms)" for part in smooth},
            },
            "contextSec": CONTEXT_SEC, **{k: v for k, v in info.items() if k != "timeRatios"},
        },
        "sourceBpm": round(sec["localBpm"], 4),
        "analysedBpm": float(p["analysis"]["tempo"]["bpm"]),
        "effectiveBpm": p["effectiveBpm"],
        "ratio": round(p["effectiveBpm"] / sec["localBpm"], 6),
        "ratioDefinition": "speed: output tempo / source tempo over the rendered bars (time ratio = 1 / ratio)",
        "nominalRatio": round(p["nominalRatio"], 6),
        "ratioPerBar": [round(1.0 / r, 6) for r in info["timeRatios"]],
        "bars": sec["bars"],
        "afterBars": sec["afterBars"],
        "padBeats": PAD_BEATS,
        "parts": want_parts,
        "partGain": PART_GAIN,
        "clippedSamples": clipped,
        "stems": ({"available": True, "window": stems_info["window"], "stemGain": stems_info["stemGain"],
                   "model": stems_info["model"], "other": "mix - (drums + bass + vocals), before stretching"}
                  if stems_info else {"available": False, "reason": stems_reason}),
        "source": {
            "pcm": pools.display(mix_path),
            "startSec": round(p["startSrc"], 6),
            "endSec": round(p["endSrc"], 6),
            "firstDownbeatSec": float(db[0]),
            "hookDownbeatSec": float(db[sec["bars"]]),
            "lastDownbeatSec": float(db[-1]),
            "downbeatIndex": [sec["k0"], sec["k1"]],
        },
        "output": {
            "sampleRate": SR,
            "durationSec": round(y.shape[1] / SR, 6),
            "beatSec": p["beatOut"],
            "beatsSec": [round(float(t), 6) for t in grid],
            "downbeatsSec": [round(float(t), 6) for t in out_db],
            "hookSec": round(hook_sec, 6),
            "hookBeatIndex": int(np.sum(sec["beatsPerBar"][:sec["bars"]])),
            "beatsPerBar": [int(b) for b in sec["beatsPerBar"]],
            "analysisBeatDeviationMs": {"maxAbs": round(float(np.max(np.abs(dev))), 2),
                                        "rms": round(float(np.sqrt(np.mean(dev ** 2))), 2)},
        },
        "timeMap": {
            "points": [[round(o, 6), round(s, 6)] for o, s in p["timeMap"]],
            "note": "[outputSec, sourceSec] pairs, linear in between (constant ratio per bar)",
        },
        "timing": {"readSec": round(read_sec, 4), "stretchSec": round(rb_sec, 4), "stretchCpuSec": round(rb_cpu, 4),
                   "audioSec": round(y.shape[1] / SR, 4)},
        "warnings": warnings,
        "createdAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    (tmp / "meta.json").write_text(json.dumps(meta, indent=1))
    folder.mkdir(parents=True, exist_ok=True)
    for old_file in folder.glob("*.flac"):
        if old_file.stem not in want_parts:
            old_file.unlink()
    for f in tmp.iterdir():
        if f.name != "meta.json":
            os.replace(f, folder / f.name)
    os.replace(tmp / "meta.json", folder / "meta.json")
    shutil.rmtree(tmp, ignore_errors=True)
    meta["timing"]["totalSec"] = round(time.perf_counter() - t_start, 4)
    (folder / "meta.json").write_text(json.dumps(meta, indent=1))
    p_req = plan(song, hook_id, to_bpm, bars, after_bars, max_stretch, pool)
    return {**meta, "dir": str(folder), "cached": False, "request": _request_block(meta, p_req, to_bpm),
            "seconds": meta["timing"]["totalSec"]}


# ---------------------------------------------------------------- verification

_FLUX_HOP = 48  # 1 ms


def _flux(mono: np.ndarray) -> np.ndarray:
    import librosa

    spec = np.abs(librosa.stft(mono, n_fft=1024, hop_length=_FLUX_HOP, center=True))
    log = np.log1p(100 * spec)
    return np.concatenate([[0.0], np.maximum(0.0, np.diff(log, axis=1)).sum(axis=0)])


def _beat_this(mono: np.ndarray) -> np.ndarray:
    from steps import beats as beats_step

    beats, _ = beats_step.run_beat_this(mono.astype(np.float32), SR)
    refined, _ = beats_step.refine_beats(beats)
    return refined


def _match(detected: np.ndarray, expected: np.ndarray, tol: float = 0.07) -> np.ndarray:
    errs = []
    for e in expected:
        if not len(detected):
            break
        j = int(np.argmin(np.abs(detected - e)))
        if abs(detected[j] - e) <= tol:
            errs.append(detected[j] - e)
    return np.asarray(errs) * 1000


def _stats(ms: np.ndarray) -> dict:
    if not len(ms):
        return {"n": 0}
    return {"n": int(len(ms)), "meanMs": round(float(ms.mean()), 2), "medianAbsMs": round(float(np.median(np.abs(ms))), 2),
            "p95AbsMs": round(float(np.percentile(np.abs(ms), 95)), 2), "maxAbsMs": round(float(np.max(np.abs(ms))), 2)}


def verify(result: dict, part: str | None = None, beat_this: bool = True, pool: pools.Pool | None = None) -> dict:
    """Check the output against the constant grid.

    - xcorr: per grid beat, the lag (±40 ms, 1 ms steps) that best aligns the output's spectral flux
      with the source's flux warped through the time map: the stretcher's own timing error.
    - beatThis: Beat This! (refined like the analysis) run on the output; each interior grid beat vs
      the nearest detected beat. The same run on the source section, mapped through the time map,
      gives the tracker's own scatter on this audio for comparison.
    """
    pool = _pool(pool)
    folder = Path(result["dir"])
    part = part or ("drums" if "drums" in result["parts"] else "mix")
    out, _ = sf.read(str(folder / f"{part}.flac"), dtype="float32", always_2d=True)
    out_mono = out.mean(axis=1) / PART_GAIN
    song = result["songId"]
    src_t0, src_t1 = result["source"]["startSec"], result["source"]["endSec"]
    s0, s1 = int(round(src_t0 * SR)), int(round(src_t1 * SR))
    if part == "mix":
        src = read_region(pool.mix_flac(song), s0, s1)
    else:
        info, _ = stems_source(song, s0, s1, pool)
        if info is None:
            raise StretchError("stems for verification are gone")
        stems = {st: read_region(info["paths"][st], s0, s1, info["window"]["startSample"]) / info["stemGain"]
                 for st in STEM_PARTS}
        if part == "other":
            src = read_region(pool.mix_flac(song), s0, s1) - sum(stems.values())
        else:
            src = stems[part]
    src_mono = src.mean(axis=0)
    tm = np.asarray(result["timeMap"]["points"])
    grid = np.asarray(result["output"]["beatsSec"])
    interior = grid[1:-1]

    # xcorr of flux envelopes
    f_out = _flux(out_mono)
    f_src = _flux(src_mono)
    frames = np.arange(len(f_out)) * _FLUX_HOP / SR
    src_times = np.interp(frames, tm[:, 0], tm[:, 1]) - src_t0
    ideal = np.interp(src_times * SR / _FLUX_HOP, np.arange(len(f_src)), f_src)
    lags = []
    win, maxlag = 60, 40
    for b in interior:
        c = int(round(b * SR / _FLUX_HOP))
        if c - win - maxlag < 0 or c + win + maxlag > len(f_out):
            continue
        a = ideal[c - win:c + win]
        a = a - a.mean()
        if not np.any(a):
            continue
        scores = [np.dot(a, f_out[c - win + lag:c + win + lag] - f_out[c - win + lag:c + win + lag].mean())
                  for lag in range(-maxlag, maxlag + 1)]
        lags.append((int(np.argmax(scores)) - maxlag) * _FLUX_HOP / SR * 1000)
    report = {"part": part, "xcorr": _stats(np.asarray(lags))}
    if beat_this:
        # Beat This! always runs on the mix, like the analysis.
        mix_out, _ = sf.read(str(folder / "mix.flac"), dtype="float32", always_2d=True)
        bt_out = _beat_this(mix_out.mean(axis=1) / PART_GAIN)
        src_bt = _beat_this(read_region(pool.mix_flac(song), s0, s1).mean(axis=0)) + src_t0
        src_bt_out = np.interp(src_bt, tm[:, 1], tm[:, 0])
        report["beatThis"] = {"output": _stats(_match(bt_out, interior)),
                              "sourceMapped": _stats(_match(src_bt_out, interior))}
    return report


# ---------------------------------------------------------------- CLI

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--song", type=int, required=True, help="song B id")
    ap.add_argument("--hook", required=True, help="hook id, e.g. 12-best-0")
    ap.add_argument("--to-bpm", type=float, required=True, help="target tempo (song A's BPM)")
    ap.add_argument("--bars", type=int, default=4, help="bars of B before the hook downbeat (default 4)")
    ap.add_argument("--after-bars", type=int, default=1, help="bars after the hook downbeat (default 1)")
    ap.add_argument("--stems", action="store_true", help="also render drums, bass, vocals and other")
    ap.add_argument("--max-stretch", type=float, default=MAX_STRETCH, help="max |ratio - 1| (default 0.08)")
    ap.add_argument("--force", action="store_true", help="re-render even when cached")
    ap.add_argument("--engine", default="auto", choices=["auto", "r3", "r3short", "r2"],
                    help="auto (default): R3 short window for mix/drums, R3 for the tonal stems")
    ap.add_argument("--verify", action="store_true", help="measure the output's timing against the grid")
    ap.add_argument("--json", action="store_true", help="print the full result as JSON")
    pools.add_argument(ap)
    args = ap.parse_args(argv)
    pool = pools.from_args(args)
    try:
        result = render(args.song, args.hook, args.to_bpm, args.bars, args.after_bars, args.stems,
                        args.max_stretch, args.force, args.engine, pool)
    except StretchError as err:
        print(f"stretch: {err}", file=sys.stderr)
        return 2
    if args.verify:
        result["verify"] = verify(result, pool=pool)
    if args.json:
        print(json.dumps(result, indent=1))
    else:
        req = result["request"]
        print(f"{result['dir']}  {'cached' if result['cached'] else 'rendered'} in {result['seconds']:.2f} s")
        print(f"  {result['sourceBpm']:.2f} → {result['effectiveBpm']:.2f} BPM ({req['mode']}, ratio {result['ratio']:.4f}), "
              f"parts {', '.join(result['parts'])}; stems: {result['stems'].get('reason', 'yes')}")
        print(f"  requested bars start at {req['firstDownbeatSec']:.3f} s, hook at {req['hookSec']:.3f} s, "
              f"file {result['output']['durationSec']:.3f} s")
        for warning in result.get("warnings", []):
            print("  warning:", warning)
        if "verify" in result:
            print("  verify:", json.dumps(result["verify"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
