"""Automatic hook candidates and hand-tag refinements (tools/prep/steps/hook_detect.py), per song:

    <dataDir>/hooks/<id>.json   schema 1: { songId, phase, candidates: [...], refine: [...] }

- candidates: where a chorus lands, best first (a bar, its downbeat, a score and the evidence: chorus, energy
  jump, vocal onset), for songs nobody tagged (this year's playlist); the audition page approves, rejects or nudges
  each, and only approved ones become hooks (the override's `autoHooks`, applied by analyze.py).
- refine: for each hand-tagged hook, a suggested shift of one bar when the bar next to it is clearly the better
  landing on the phrase grid; the audition page asks yes or no, and the tag itself is always kept.

Needs the analysis (downbeats, bar levels) and the mix; the stems' vocal bar levels when there are any.
Run: tools/prep/.venv/bin/python tools/prep/hooks_auto.py [--pool NAME|PATH] [--song N ...] [--report]
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
from steps import hook_detect as hd  # noqa: E402

SCHEMA_VERSION = 1
FEATURE_SR = 22050
HOP = 512


def load_json(path: Path):
    return json.loads(path.read_text()) if path.exists() else None


def bar_features(mix: Path, downbeats: list[float]) -> tuple[np.ndarray, np.ndarray]:
    """Per bar: its mean chroma (12) and MFCC (13), each dimension standardized over the song."""
    import librosa

    audio, sr = sf.read(mix, dtype="float32", always_2d=True)
    y = librosa.resample(audio.mean(axis=1), orig_sr=sr, target_sr=FEATURE_SR, res_type="soxr_hq")
    chroma = librosa.feature.chroma_stft(y=y, sr=FEATURE_SR, hop_length=HOP)
    mfcc = librosa.feature.mfcc(y=y, sr=FEATURE_SR, hop_length=HOP, n_mfcc=13)
    frames = np.vstack([chroma, mfcc])
    frame_sec = HOP / FEATURE_SR
    rows = []
    for a, b in zip(downbeats[:-1], downbeats[1:]):
        fa, fb = int(a / frame_sec), max(int(a / frame_sec) + 1, int(b / frame_sec))
        rows.append(frames[:, fa:fb].mean(axis=1) if fa < frames.shape[1] else np.zeros(frames.shape[0]))
    feats = np.array(rows)
    if len(feats):
        feats = (feats - feats.mean(axis=0)) / (feats.std(axis=0) + 1e-9)
    return feats[:, :12], feats[:, 12:]


def song_hooks(pool: pools.Pool, song_id: int) -> dict | None:
    analysis = load_json(pool.data_dir / "analysis" / f"{song_id}.json")
    mix = pool.song_cache(song_id) / "mix.flac"
    if not analysis or not mix.exists() or len(analysis.get("downbeats", [])) < 12:
        return None
    downbeats = analysis["downbeats"]
    stems = load_json(pool.data_dir / "stems" / f"{song_id}.json")
    vocals = np.asarray(stems["bars"]["vocals"], dtype=float) if stems and stems.get("bars", {}).get("vocals") else None
    chroma, mfcc = bar_features(mix, downbeats)
    bar_db = np.asarray(analysis["energy"]["barRmsDb"], dtype=float)
    score, evidence = hd.bar_scores(chroma, mfcc, bar_db, vocals)
    candidates, phase = hd.detect(score, evidence)
    refine = []
    for h in analysis.get("hooks", []):
        d = h.get("downbeatIndex")
        if d is None or d >= len(score):
            continue
        shift = hd.suggest_shift(score, phase, d)
        refine.append({"hookId": h["id"], "bar": d, "suggestShiftBars": shift,
                       "score": round(float(score[d]), 3), "suggestedScore": round(float(score[d + shift]), 3)})
    return {
        "schemaVersion": SCHEMA_VERSION, "songId": song_id, "phase": phase,
        "candidates": [{"id": f"{song_id}-auto-{k}", "bar": c.bar, "downbeatSec": round(float(downbeats[c.bar]), 4),
                        "score": c.score, "evidence": c.evidence, "snappedBars": c.snapped,
                        "suggestedTag": "best" if k == 0 else "main"} for k, c in enumerate(candidates)],
        "refine": refine,
    }


def report(docs: list[dict], pool: pools.Pool) -> None:
    """How the candidates compare with the hand tags: a tagged hook within a bar of the top candidate, of one of
    the top three, and how many hand tags get a suggested shift."""
    top1 = top3 = total = shifts = tags = 0
    for doc in docs:
        analysis = load_json(pool.data_dir / "analysis" / f"{doc['songId']}.json")
        tagged = [h["downbeatIndex"] for h in analysis.get("hooks", []) if h.get("valid") and h.get("downbeatIndex") is not None]
        tags += len(doc["refine"])
        shifts += sum(1 for r in doc["refine"] if r["suggestShiftBars"])
        if not tagged:
            continue
        total += 1
        hits = [any(abs(c["bar"] - b) <= 1 for b in tagged) for c in doc["candidates"][:3]]
        top1 += bool(hits and hits[0])
        top3 += any(hits)
    print(f"a tagged hook within a bar: of the top candidate {top1}/{total}, of one of the top three {top3}/{total}; "
          f"hand tags with a suggested shift: {shifts}/{tags}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    pools.add_argument(ap)
    ap.add_argument("--song", type=int, action="append", help="song id (repeatable); default all analysed")
    ap.add_argument("--report", action="store_true", help="compare the candidates with the hand tags")
    args = ap.parse_args()
    pool = pools.from_args(args)
    out = pool.data_dir / "hooks"
    out.mkdir(parents=True, exist_ok=True)
    ids = args.song or sorted(int(p.stem) for p in (pool.data_dir / "analysis").glob("*.json") if p.stem.isdigit())
    docs = []
    for song_id in ids:
        doc = song_hooks(pool, song_id)
        if not doc:
            print(f"song {song_id}: no analysis or mix")
            continue
        (out / f"{song_id}.json").write_text(json.dumps(doc, indent=1) + "\n")
        docs.append(doc)
        print(f"song {song_id}: bars {[c['bar'] for c in doc['candidates']]} (phase {doc['phase']})")
    if args.report:
        report(docs, pool)
    return 0


if __name__ == "__main__":
    sys.exit(main())
