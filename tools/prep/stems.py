"""Stem separation for the mixer POC (M5): Demucs drums / bass / vocals / other.

Demucs runs on the whole song in memory (at the model's 44.1 kHz, resampled from and back to
mix.flac's 48 kHz with soxr VHQ, zero lag). Bar RMS for all four stems covers the whole song.
Only drums, bass and vocals are written, at half scale (stemGain 0.5, so loud masters don't clip);
the engine multiplies them by 2 and derives other = mix - 2 * (drums + bass + vocals).

Written audio is windowed by default, to save disk: the intro [0, 30 s] plus
[hook - 32 s, hook + 48 s] for every valid hook, clipped and merged. Each window is one FLAC per
stem, <cacheDir>/<id>/stems/<stem>.<startSample>.flac (48 kHz, 16-bit stereo), whose first sample is
sample <startSample> of mix.flac. --full writes one window covering the whole song instead.

Outputs: <dataDir>/stems/<id>.json per song and <dataDir>/stems/index.json (the pool's directories,
tools/prep/pool.py; the default pool's are cache/ and data/). Songs without a valid hook are skipped:
the engine never plays them.
Idempotent: a song is skipped when its JSON matches mix.flac (size + mtime), the model, the mode,
the downbeats and the windows, and all its files exist. --force redoes it.
Disk guards: stop (exit 3) before free space would drop under 10 GB, or the pool's stem files
would pass 4 GB.

Run: tools/prep/.venv-stems/bin/python tools/prep/stems.py [--pool NAME|PATH] [--song N ...] [--force] [--full]
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import random
import re
import shutil
import sys
import time
from pathlib import Path

os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
import soxr  # noqa: E402

sys.path.insert(0, str(Path(__file__).parent))
import pool as pools  # noqa: E402

SR = 48000
KEEP = ("drums", "bass", "vocals")
ALL = ("drums", "bass", "vocals", "other")
INTRO_SEC, PRE_SEC, POST_SEC = 30.0, 32.0, 48.0
MIN_FREE_BYTES = 10 * 1000**3        # keep >= 10 GB free at all times
MAX_STEM_BYTES = 4 * 1000**3         # all stem files of the pool together <= 4 GB
RESAMPLE_QUALITY = "VHQ"
SHIFTS, OVERLAP = 1, 0.25
# Loud masters make Demucs stems peak above full scale (drums up to several dB over), so stems are
# stored at half scale: decoded stem * (1 / STEM_GAIN) is the real stem. Exact power of two.
STEM_GAIN = 0.5
FILE_RE = re.compile(r"^(drums|bass|vocals|other)(\.\d+)?\.flac$")


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def db(x: float, floor: float = -120.0) -> float:
    x = float(x)
    return round(max(floor, 20 * np.log10(x)) if x > 0 else floor, 2)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def stems_bytes(pool: pools.Pool) -> int:
    return sum(p.stat().st_size for p in pool.cache_dir.glob("*/stems/*.flac"))


def free_bytes(pool: pools.Pool) -> int:
    """Free space on the volume of the pool's cache (its nearest existing folder)."""
    path = pool.cache_dir
    while not path.exists() and path != path.parent:
        path = path.parent
    return shutil.disk_usage(path).free


# ---------------------------------------------------------------- windows

def compute_windows(analysis: dict, n: int, full: bool) -> list[dict]:
    if full:
        spans = [(0, n)]
    else:
        spans = [(0, min(n, round(INTRO_SEC * SR)))]
        for h in analysis.get("hooks", []):
            if h.get("valid"):
                t = h["downbeatSec"]
                spans.append((max(0, round((t - PRE_SEC) * SR)), min(n, round((t + POST_SEC) * SR))))
    spans = sorted(s for s in spans if s[1] > s[0])
    merged: list[list[int]] = []
    for a, b in spans:
        if merged and a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    return [{"startSample": a, "lengthSamples": b - a,
             "startSec": round(a / SR, 6), "endSec": round(b / SR, 6)} for a, b in merged]


def file_for(pool: pools.Pool, song_id: int, stem: str, start: int) -> Path:
    return pool.stems_cache(song_id) / f"{stem}.{start}.flac"


# ---------------------------------------------------------------- separation

class Separator:
    def __init__(self, model_name: str, device: str):
        import torch
        from demucs.pretrained import get_model
        self.torch = torch
        if device == "auto":
            device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.device = device
        self.model_name = model_name
        self.model = get_model(model_name)
        self.model.eval()
        self.model_sr = int(self.model.samplerate)
        self.sources = list(self.model.sources)

    def __call__(self, mix48: np.ndarray, seed: int) -> dict[str, np.ndarray]:
        """mix48: (n, 2) float32 at 48 kHz. Returns {stem: (n, 2) float32 at 48 kHz}."""
        from demucs.apply import apply_model
        torch = self.torch
        n = mix48.shape[0]
        x = soxr.resample(mix48, SR, self.model_sr, quality=RESAMPLE_QUALITY)  # (m, 2)
        wav = torch.from_numpy(np.ascontiguousarray(x.T, dtype=np.float32))
        ref = wav.mean(0)
        mean, std = ref.mean(), ref.std() + 1e-8
        random.seed(seed)
        torch.manual_seed(seed)
        with torch.no_grad():
            out = apply_model(self.model, ((wav - mean) / std)[None], shifts=SHIFTS, split=True,
                              overlap=OVERLAP, progress=False, device=self.device)[0]
        # Each stem gets mean/4 so the four stems sum back to the mix (Demucs' api adds mean to each).
        out = (out * std + mean / len(self.sources)).cpu().numpy()
        if self.device == "mps":
            torch.mps.empty_cache()
        stems = {}
        for k, name in enumerate(self.sources):
            y = soxr.resample(np.ascontiguousarray(out[k].T), self.model_sr, SR, quality=RESAMPLE_QUALITY)
            if y.shape[0] >= n:
                y = y[:n]
            else:
                y = np.pad(y, ((0, n - y.shape[0]), (0, 0)))
            stems[name] = y.astype(np.float32)
        return stems


# ---------------------------------------------------------------- measurements

def measure_lag(mix: np.ndarray, est: np.ndarray, seg_sec: float = 5.0, max_lag: int = 2000) -> tuple[int, float]:
    """Cross-correlate mono est against mono mix on 3 segments; return (median integer lag, fractional)."""
    m, e = mix.mean(1).astype(np.float64), est.mean(1).astype(np.float64)
    n, L = len(m), int(seg_sec * SR)
    lags, fracs = [], []
    for pos in (0.3, 0.5, 0.7):
        a = int(pos * n) - L // 2
        if a < max_lag or a + L + max_lag > n:
            continue
        x, y = m[a:a + L], e[a:a + L]
        if np.sqrt(np.mean(x ** 2)) < 1e-4:
            continue
        size = 1 << int(np.ceil(np.log2(2 * L)))
        c = np.fft.irfft(np.fft.rfft(y, size) * np.conj(np.fft.rfft(x, size)), size)
        c = np.concatenate([c[-max_lag:], c[:max_lag + 1]])  # lags -max_lag..max_lag
        i = int(np.argmax(c))
        frac = 0.0
        if 0 < i < len(c) - 1:
            den = c[i - 1] - 2 * c[i] + c[i + 1]
            frac = float(0.5 * (c[i - 1] - c[i + 1]) / den) if den else 0.0
        lags.append(i - max_lag)
        fracs.append(i - max_lag + frac)
    if not lags:
        return 0, 0.0
    return int(np.median(lags)), round(float(np.median(fracs)), 3)


def rms(get, n: int, block: int = 1 << 20) -> float:
    """RMS of get(a, b) over [0, n), in blocks to keep memory flat."""
    acc, cnt = 0.0, 0
    for a in range(0, n, block):
        x = np.asarray(get(a, min(n, a + block)), dtype=np.float64)
        acc += float(np.sum(x * x))
        cnt += x.size
    return float(np.sqrt(acc / cnt)) if cnt else 0.0


def bar_rms(mono: np.ndarray, downbeats: list[float]) -> list[float]:
    """Same convention as steps/energy.per_bar: mono, int(t * sr) slices, -120 floor."""
    out = []
    for a, b in zip(downbeats[:-1], downbeats[1:]):
        seg = mono[int(a * SR): int(b * SR)]
        rms = float(np.sqrt(np.mean(seg.astype(np.float64) ** 2))) if len(seg) else 0.0
        out.append(db(rms))
    return out


def vocal_bleed(vocals: np.ndarray, other: np.ndarray) -> dict:
    """Heuristic: fine-structure correlation of vocals vs other log spectrograms (200 Hz-4 kHz)
    over frames where the vocals stem is active. Shared harmonics = vocal leakage into "other"
    (or doubled melody lines). Also the vocals stem's level relative to other."""
    hop, nfft = 2048, 4096
    v, o = vocals.mean(1), other.mean(1)
    frames = (len(v) - nfft) // hop
    if frames < 10:
        return {}
    win = np.hanning(nfft).astype(np.float32)
    freqs = np.fft.rfftfreq(nfft, 1 / SR)
    band = (freqs >= 200) & (freqs <= 4000)
    V, O = [], []
    for f0 in range(0, frames, 256):
        idx = np.arange(nfft)[None, :] + hop * np.arange(f0, min(frames, f0 + 256))[:, None]
        V.append(np.abs(np.fft.rfft(v[idx] * win, axis=1))[:, band].astype(np.float32))
        O.append(np.abs(np.fft.rfft(o[idx] * win, axis=1))[:, band].astype(np.float32))
    V, O = np.concatenate(V), np.concatenate(O)
    ve = V.sum(1)
    active = ve > ve.max() * 10 ** (-30 / 20)
    if active.sum() < 10:
        return {"vocalsActiveShare": round(float(active.mean()), 3)}
    lv, lo = np.log(V[active] + 1e-6), np.log(O[active] + 1e-6)
    lv -= lv.mean(1, keepdims=True)
    lo -= lo.mean(1, keepdims=True)
    lv -= lv.mean(0, keepdims=True)
    lo -= lo.mean(0, keepdims=True)
    corr = float((lv * lo).sum() / np.sqrt((lv ** 2).sum() * (lo ** 2).sum()))
    rv = rms(lambda a, b: vocals[a:b], len(vocals))
    ro = rms(lambda a, b: other[a:b], len(other))
    return {"vocalsActiveShare": round(float(active.mean()), 3),
            "vocalsOtherSpecCorr": round(corr, 3),
            "vocalsVsOtherDb": db(rv / ro) if ro > 0 else None}


def to_int16(x: np.ndarray) -> tuple[np.ndarray, int, float]:
    """Inverse of soundfile's int16 -> float (/32768), so mix - stems is consistent in the browser.
    x is stored at STEM_GAIN; samples still past full scale after that are clipped."""
    y = np.round(x.astype(np.float64) * (STEM_GAIN * 32768.0))
    clipped = int(np.count_nonzero((y > 32767) | (y < -32768)))
    peak = float(np.max(np.abs(x))) if x.size else 0.0
    return np.clip(y, -32768, 32767).astype(np.int16), clipped, db(peak)


# ---------------------------------------------------------------- per song

def load_json(path: Path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def is_done(pool: pools.Pool, song_id: int, prev: dict | None, src: dict, model: str, mode: str,
            windows: list[dict], downbeats_sha: str) -> bool:
    if not prev:
        return False
    ps = prev.get("source", {})
    if (ps.get("size"), ps.get("mtimeNs")) != (src["size"], src["mtimeNs"]):
        return False
    if prev.get("model") != model or prev.get("mode") != mode or ps.get("downbeatsSha") != downbeats_sha \
            or prev.get("stemGain") != STEM_GAIN:
        return False
    if prev.get("windows") != windows:
        return False
    for w in windows:
        for stem in KEEP:
            p = file_for(pool, song_id, stem, w["startSample"])
            if not p.exists():
                return False
            if sf.info(str(p)).frames != w["lengthSamples"]:
                return False
    return True


class DiskStop(Exception):
    pass


def process(pool: pools.Pool, song_id: int, sep_factory, args) -> dict:
    t0 = time.time()
    mix_path = pool.mix_flac(song_id)
    analysis = json.loads((pool.analysis_dir / f"{song_id}.json").read_text())
    st = mix_path.stat()
    info = sf.info(str(mix_path))
    n = int(info.frames)
    mode = "full" if args.full else "windowed"
    windows = compute_windows(analysis, n, args.full)
    downbeats = analysis.get("downbeats", [])
    downbeats_sha = hashlib.sha256(json.dumps(downbeats).encode()).hexdigest()[:16]
    src = {"path": pools.display(mix_path), "size": st.st_size, "mtimeNs": st.st_mtime_ns}
    out_json = pool.stems_dir / f"{song_id}.json"
    prev = load_json(out_json)
    if not args.force and is_done(pool, song_id, prev, src, args.model, mode, windows, downbeats_sha):
        return {"id": song_id, "ok": True, "skipped": True, "seconds": prev.get("timing", {}).get("totalSec"),
                "warning": prev.get("warning"), "bytes": prev.get("bytes")}

    warnings = []
    if info.samplerate != SR or info.channels != 2:
        raise RuntimeError(f"mix.flac is {info.samplerate} Hz / {info.channels} ch, expected {SR} / 2")

    # Disk guard 1: raw 16-bit size is an upper bound for what this song writes.
    raw_bytes = sum(w["lengthSamples"] for w in windows) * 2 * 2 * len(KEEP)
    free = free_bytes(pool)
    if free - raw_bytes < MIN_FREE_BYTES:
        raise DiskStop(f"free {free / 1e9:.2f} GB - {raw_bytes / 1e9:.2f} GB would drop below "
                       f"{MIN_FREE_BYTES / 1e9:.2f} GB")

    sep = sep_factory()
    t_dec = time.time()
    mix, _ = sf.read(str(mix_path), dtype="float32", always_2d=True)
    src["sha256"] = sha256(mix_path)
    t_sep = time.time()
    stems = sep(mix, seed=song_id)
    t_post = time.time()

    total = sum(stems.values())
    mix_rms = rms(lambda a, b: mix[a:b], n)
    res_rms = rms(lambda a, b: mix[a:b].astype(np.float64) - total[a:b], n)
    lag, lag_frac = measure_lag(mix, total)
    del total
    if lag != 0:
        warnings.append(f"lag {lag} samples")
    residual_db = db(res_rms / mix_rms) if mix_rms > 0 else None
    if residual_db is not None and residual_db > -25:
        warnings.append(f"residual {residual_db} dB")
    bars = {name: bar_rms(stems[name].mean(1), downbeats) for name in ALL}
    diag = vocal_bleed(stems["vocals"], stems["other"])

    # Write kept stems window by window, to temp names first.
    stem_dir = pool.stems_cache(song_id)
    stem_dir.mkdir(parents=True, exist_ok=True)
    clipped, peaks = {}, {}
    quantized = {}
    written: list[tuple[Path, Path]] = []
    try:
        for stem in KEEP:
            q, clipped[stem], peaks[stem] = to_int16(stems[stem])
            quantized[stem] = q
            for w in windows:
                a, L = w["startSample"], w["lengthSamples"]
                final = file_for(pool, song_id, stem, a)
                tmp = final.with_name(f".{final.name}.tmp")
                sf.write(str(tmp), q[a:a + L], SR, subtype="PCM_16", format="FLAC",
                         compression_level=args.compression)
                written.append((tmp, final))
        new_bytes = sum(t.stat().st_size for t, _ in written)
        old_bytes = sum(p.stat().st_size for p in stem_dir.glob("*.flac"))
        others = stems_bytes(pool) - old_bytes
        if others + new_bytes > MAX_STEM_BYTES:
            raise DiskStop(f"stems would total {(others + new_bytes) / 1e9:.2f} GB > "
                           f"{MAX_STEM_BYTES / 1e9:.1f} GB cap")
        if free_bytes(pool) < MIN_FREE_BYTES:
            raise DiskStop("free space below 10 GB after writing")
    except BaseException:
        for t, _ in written:
            t.unlink(missing_ok=True)
        raise
    keep_names = {f.name for _, f in written}
    for p in stem_dir.iterdir():
        if FILE_RE.match(p.name) and p.name not in keep_names:
            p.unlink()
    for t, f in written:
        os.replace(t, f)

    # Engine view: other' = mix - q(drums) - q(bass) - q(vocals); compare with Demucs' other.
    k = 1.0 / (STEM_GAIN * 32768.0)
    derived_sq = rms(lambda a, b: mix[a:b].astype(np.float64) - stems["other"][a:b]
                     - sum(quantized[s][a:b].astype(np.float64) * k for s in KEEP), n)
    oth_rms = rms(lambda a, b: stems["other"][a:b], n)
    over = {k: v for k, v in peaks.items() if clipped[k]}
    if over:
        warnings.append("clipped despite half-scale storage: " + ", ".join(
            f"{k} peak {v:+.1f} dBFS, {clipped[k]} samples" for k, v in over.items()))

    t_end = time.time()
    rec = {
        "schemaVersion": 1,
        "songId": song_id,
        "model": args.model,
        "backend": f"demucs {demucs_version()} / torch {sep.torch.__version__} / {sep.device}",
        "device": sep.device,
        "modelSampleRate": sep.model_sr,
        "resampler": f"soxr {soxr.__version__} {RESAMPLE_QUALITY}",
        "params": {"shifts": SHIFTS, "overlap": OVERLAP, "split": True, "seed": song_id},
        "sampleRate": SR,
        "lengthSamples": n,
        "stems": list(KEEP),
        "stemGain": STEM_GAIN,                          # files hold stem * stemGain: multiply by 1/stemGain
        "stemGainDb": db(STEM_GAIN),
        "derived": {"other": "mix - (drums + bass + vocals) / stemGain"},
        "mode": mode,
        "pathTemplate": f"{pools.display(pool.stems_cache(song_id))}/{{stem}}.{{startSample}}.flac",
        "windows": windows,
        "createdAt": now_iso(),
        "alignment": {
            "lagSamples": lag,
            "lagFracSamples": lag_frac,
            "residualDb": residual_db,                 # mix - sum(4 Demucs stems), rel. to mix RMS
            "residualDbfs": db(res_rms),
            "derivedOtherErrorDb": db(derived_sq / oth_rms) if oth_rms > 0 else None,  # rel. to true other
            "clippedSamples": clipped,                  # after stemGain
            "peakDbfs": peaks,                          # real stem peak, before stemGain
        },
        "bars": bars,
        "diagnostics": diag,
        "source": {**src, "downbeatsSha": downbeats_sha},
        "bytes": new_bytes,
        "timing": {"decodeSec": round(t_sep - t_dec, 2), "separateSec": round(t_post - t_sep, 2),
                   "postSec": round(t_end - t_post, 2), "totalSec": round(t_end - t0, 2)},
        "warning": "; ".join(warnings) or None,
    }
    pool.stems_dir.mkdir(parents=True, exist_ok=True)
    tmp = out_json.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(rec, indent=1))
    os.replace(tmp, out_json)
    return {"id": song_id, "ok": True, "seconds": rec["timing"]["totalSec"], "warning": rec["warning"],
            "bytes": new_bytes}


def demucs_version() -> str:
    try:
        from importlib.metadata import version
        return version("demucs")
    except Exception:
        return "?"


def write_index(pool: pools.Pool, results: dict[int, dict], args, free_before: int):
    pool.stems_dir.mkdir(parents=True, exist_ok=True)
    path = pool.stems_dir / "index.json"
    prev = load_json(path) or {}
    songs = {s["id"]: s for s in prev.get("songs", [])}
    songs.update(results)
    total = stems_bytes(pool)
    doc = {
        "schemaVersion": 1,
        "updatedAt": now_iso(),
        "model": args.model,
        "mode": "full" if args.full else "windowed",
        "stemsBytes": total,
        "freeBytesBeforeRun": free_before,
        "freeBytesNow": free_bytes(pool),
        "songs": [songs[k] for k in sorted(songs)],
    }
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(doc, indent=1))
    os.replace(tmp, path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--song", type=int, action="append", help="song id (repeatable); default all")
    ap.add_argument("--force", action="store_true", help="redo even if up to date")
    ap.add_argument("--full", action="store_true", help="write full-length stems instead of windows")
    ap.add_argument("--model", default="htdemucs", help="htdemucs (default) or htdemucs_ft")
    ap.add_argument("--device", default="auto", help="auto (mps if available), mps or cpu")
    ap.add_argument("--compression", type=float, default=1.0, help="FLAC compression level 0..1")
    pools.add_argument(ap)
    args = ap.parse_args()
    pool = pools.from_args(args)

    if not pool.analysis_index.exists():
        print(f"stems: no {pools.display(pool.analysis_index)}: run the analyze step first", file=sys.stderr)
        sys.exit(1)
    index = json.loads(pool.analysis_index.read_text())["songs"]
    no_hook = [s["id"] for s in index if not any(h.get("valid") for h in s.get("hooks", []))]
    ids = args.song or [s["id"] for s in index if s["id"] not in no_hook]
    sep_holder: dict = {}

    def sep_factory():
        if "sep" not in sep_holder:
            sep_holder["sep"] = Separator(args.model, args.device)
        return sep_holder["sep"]

    free_before = free_bytes(pool)
    print(f"{pool.describe()}: free {free_before / 1e9:.2f} GB, stems {stems_bytes(pool) / 1e9:.3f} GB, "
          f"songs {len(ids)}", flush=True)
    if no_hook and not args.song:
        print(f"skipped (no valid hook, not playable): {', '.join(map(str, no_hook))}", flush=True)
    results: dict[int, dict] = {}
    code = 0
    for i, sid in enumerate(ids):
        try:
            r = process(pool, sid, sep_factory, args)
        except DiskStop as e:
            print(f"[{i + 1}/{len(ids)}] song {sid}: STOP ({e})", flush=True)
            results[sid] = {"id": sid, "ok": False, "seconds": None, "warning": f"not run: {e}"}
            for rest in ids[i + 1:]:
                results[rest] = {"id": rest, "ok": False, "seconds": None,
                                 "warning": f"not run: stopped at song {sid} (disk guard)"}
            code = 3
            write_index(pool, results, args, free_before)
            break
        except Exception as e:  # keep going; re-run failures with --song
            print(f"[{i + 1}/{len(ids)}] song {sid}: FAILED {type(e).__name__}: {e}", flush=True)
            results[sid] = {"id": sid, "ok": False, "seconds": None, "warning": f"{type(e).__name__}: {e}"}
            code = 1
        else:
            results[sid] = r
            tag = "skip" if r.get("skipped") else f"{r['seconds']:.1f}s"
            print(f"[{i + 1}/{len(ids)}] song {sid}: {tag} {(r.get('bytes') or 0) / 1e6:.1f} MB"
                  f"{' WARN ' + r['warning'] if r.get('warning') else ''}", flush=True)
        write_index(pool, results, args, free_before)
    print(f"done: stems {stems_bytes(pool) / 1e9:.3f} GB, free {free_bytes(pool) / 1e9:.2f} GB", flush=True)
    sys.exit(code)


if __name__ == "__main__":
    main()
