"""Check snippets (GLOSSARY: Check): for each song of a pool, 3 s from its best valid hook's pickup, which the
show plays as that song's ✓ step when a claimed card is checked. Fast, and it needs no stems.

    <cacheDir>/<id>/snippet.flac     48 kHz 16-bit, short fades (served by the relay at /snippets/<id>.flac)
    <dataDir>/snippets/index.json    schema 1: { sampleRate, durationSec, targetLufs,
                                       songs: [{ id, hookId, startSec, durationSec, lufs, gainDb, source }] }

The best hook is the first valid one tagged 'best', else 'main', else any (engine/src/plan/hookloop.ts
bestHook: the same rule). `gainDb` brings the snippet to the landings' loudness target (−14 LUFS), measured
on the snippet itself and capped like theirs (at most +6 dB). Idempotent: a song is cut again only when its
hook or its mix.flac changes (or with --force), and the index is rewritten only when it changes. A song
without a valid hook gets no snippet (it is not playable either).

    analysis/.venv/bin/python analysis/snippets.py [--pool NAME|PATH] [--song N ...] [--force]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import pool as pools  # noqa: E402
from steps import loudness  # noqa: E402

SCHEMA_VERSION = 1
SR = 48000
DURATION_SEC = 3.0
FADE_IN_SEC = 0.005
FADE_OUT_SEC = 0.15
TAG_ORDER = ("best", "main")


def snippet_path(pool: pools.Pool, song_id: int) -> Path:
    return pool.song_cache(song_id) / "snippet.flac"


def index_path(pool: pools.Pool) -> Path:
    return pool.data_dir / "snippets" / "index.json"


def best_hook(analysis: dict) -> dict | None:
    """The first valid hook tagged 'best', else 'main', else any valid one, in song order."""
    valid = [h for h in analysis.get("hooks", []) if h.get("valid")]
    rank = {tag: i for i, tag in enumerate(TAG_ORDER)}
    return min(valid, key=lambda h: rank.get(h.get("tag"), len(TAG_ORDER)), default=None)


def faded(audio: np.ndarray) -> np.ndarray:
    out = audio.copy()
    fin = min(len(out), int(FADE_IN_SEC * SR))
    fout = min(len(out), int(FADE_OUT_SEC * SR))
    if fin:
        out[:fin] *= np.linspace(0, 1, fin, dtype=np.float32)[:, None]
    if fout:
        out[-fout:] *= np.linspace(1, 0, fout, dtype=np.float32)[:, None]
    return np.clip(out, -1, 1)


def source_of(mix: Path) -> dict:
    stat = mix.stat()
    return {"size": stat.st_size, "mtimeNs": stat.st_mtime_ns}


def cut(pool: pools.Pool, song_id: int, hook: dict) -> dict:
    """Cut the snippet; returns its index entry."""
    mix = pool.mix_flac(song_id)
    start = max(0.0, float(hook["downbeatSec"]) - float(hook.get("pickupSec") or 0.0))
    audio, sr = sf.read(mix, start=int(round(start * SR)), stop=int(round((start + DURATION_SEC) * SR)),
                        dtype="float32", always_2d=True)
    if sr != SR:
        raise ValueError(f"{mix}: {sr} Hz, expected {SR}")
    if len(audio) < int(0.5 * SR):
        raise ValueError(f"the hook at {start:.2f} s leaves under 0.5 s of audio")
    clip = faded(audio)
    lufs = loudness.window_lufs(clip, SR, 0.0, seconds=DURATION_SEC)
    out = snippet_path(pool, song_id)
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(out, clip, SR, subtype="PCM_16")
    return {
        "id": song_id,
        "hookId": hook["id"],
        "startSec": round(start, 4),
        "durationSec": round(len(clip) / SR, 4),
        "lufs": None if lufs is None else round(lufs, 2),
        "gainDb": loudness.gain_to_target(lufs),
        "source": source_of(mix),
    }


def up_to_date(pool: pools.Pool, song_id: int, hook: dict, entry: dict | None) -> bool:
    if not entry or not snippet_path(pool, song_id).is_file():
        return False
    start = round(max(0.0, float(hook["downbeatSec"]) - float(hook.get("pickupSec") or 0.0)), 4)
    return (entry.get("hookId") == hook["id"] and entry.get("startSec") == start
            and entry.get("source") == source_of(pool.mix_flac(song_id)))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    pools.add_argument(ap)
    ap.add_argument("--song", type=int, action="append", help="song id (repeatable); default every analysed song")
    ap.add_argument("--force", action="store_true", help="cut again even when up to date")
    args = ap.parse_args(argv)
    pool = pools.from_args(args)
    try:
        analysed = json.loads(pool.analysis_index.read_text())["songs"]
    except (OSError, ValueError, KeyError) as err:
        print(f"snippets: no analysis index ({err}): run the analyze step first", file=sys.stderr)
        return 1
    ids = [s["id"] for s in analysed]
    wanted = sorted(set(args.song or ids))
    unknown = sorted(set(wanted) - set(ids))
    if unknown:
        print(f"snippets: songs {unknown} are not analysed", file=sys.stderr)
        return 1

    path = index_path(pool)
    try:
        old = json.loads(path.read_text())
        entries = {e["id"]: e for e in old.get("songs", [])} if old.get("schemaVersion") == SCHEMA_VERSION else {}
    except (OSError, ValueError):
        old, entries = None, {}
    counts = {"cut": 0, "skipped": 0, "no valid hook": 0}
    failed: list[str] = []
    for sid in wanted:
        try:
            analysis = json.loads((pool.analysis_dir / f"{sid}.json").read_text())
        except (OSError, ValueError) as err:
            failed.append(f"song {sid}: no analysis ({err})")
            continue
        hook = best_hook(analysis)
        if hook is None:
            entries.pop(sid, None)
            counts["no valid hook"] += 1
            continue
        if not pool.mix_flac(sid).is_file():
            failed.append(f"song {sid}: no {pools.display(pool.mix_flac(sid))} (run the decode step)")
            continue
        if not args.force and up_to_date(pool, sid, hook, entries.get(sid)):
            counts["skipped"] += 1
            continue
        try:
            entries[sid] = cut(pool, sid, hook)
        except (OSError, ValueError, RuntimeError) as err:
            failed.append(f"song {sid}: {err}")
            continue
        counts["cut"] += 1
        e = entries[sid]
        print(f"{sid:>4} {e['hookId']} from {e['startSec']:.2f} s, {e['lufs']} LUFS → {e['gainDb']:+.2f} dB", flush=True)
    for line in failed:
        print("FAILED", line, flush=True)

    doc = {"schemaVersion": SCHEMA_VERSION, "sampleRate": SR, "durationSec": DURATION_SEC,
           "targetLufs": loudness.TARGET_LUFS, "songs": [entries[k] for k in sorted(entries)]}
    if doc != old:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(doc, indent=1) + "\n")
    summary = ", ".join(f"{n} {k}" for k, n in counts.items() if n) or "nothing to do"
    print(f"snippets ({pool.name}): {len(wanted)} songs: {summary}" + (f", {len(failed)} failed" if failed else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
