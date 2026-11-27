"""Automatic hook candidates and hand-tag refinements (tools/prep/steps/hook_detect.py), per song:

    <dataDir>/hooks/<id>.json   schema 1: { songId, phase, candidates: [...], refine: [...] }

- candidates: where a chorus lands, best first (a bar, its downbeat, a score and the evidence: chorus, energy
  jump, vocal onset), for songs nobody tagged (this year's playlist); the audition page approves, rejects or nudges
  each, and only approved ones become hooks (the override's `autoHooks`, applied by analyze.py).
- provisional (`--provisional`, D227): the top candidate of each song without a best hook, approved as its best and
  marked `provisional: true`, so a new repertoire plays before the user's approval pass (U14). The flag rides along
  into the analysis (each hook's `provisional`) for the audition page and the laptop's preflight WARN; any decision
  on the audition page replaces it.
- refine: for each hand-tagged hook, a suggested shift of one bar when the bar next to it is clearly the better
  landing on the phrase grid; the audition page asks yes or no, and the tag itself is always kept.

Needs the analysis (downbeats, bar levels) and the mix; the stems' vocal bar levels when there are any.
Run: tools/prep/.venv/bin/python tools/prep/hooks_auto.py [--repertoire NAME|PATH] [--song N ...] [--report]
     tools/prep/.venv/bin/python tools/prep/hooks_auto.py [--repertoire NAME|PATH] [--song N ...] --provisional
     (then analyze again: npm run prep -- --repertoire NAME --steps analyze,snippets,validate,stems,signatures)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import repertoire as repertoires  # noqa: E402
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


def song_hooks(repertoire: repertoires.Repertoire, song_id: int) -> dict | None:
    analysis = load_json(repertoire.data_dir / "analysis" / f"{song_id}.json")
    mix = repertoire.song_cache(song_id) / "mix.flac"
    if not analysis or not mix.exists() or len(analysis.get("downbeats", [])) < 12:
        return None
    downbeats = analysis["downbeats"]
    stems = load_json(repertoire.data_dir / "stems" / f"{song_id}.json")
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


def provisional_override(song: dict, override: dict, doc: dict | None) -> dict | None:
    """The override with the song's top automatic candidate approved as its best hook, marked provisional; None when
    the song already has a best hook (a hand tag, or any approved candidate, provisional or not) or no candidate is
    left that the page hasn't decided on."""
    if any(stamp.get("tag") == "best" for stamp in song.get("timestamps") or []):
        return None
    approved = override.get("autoHooks") or {}
    if any(v.get("tag") == "best" for v in approved.values()):
        return None
    rejected = set(override.get("autoHooksRejected") or [])
    for c in (doc or {}).get("candidates", []):
        if c["id"] not in rejected and c["id"] not in approved:
            best = {"tag": "best", "downbeatSec": c["downbeatSec"], "provisional": True}
            return {**override, "autoHooks": {**approved, c["id"]: best}}
    return None


def approve_provisional(repertoire: repertoires.Repertoire, ids: list[int]) -> int:
    songs = {s["id"]: s for s in repertoire.songs()}
    done, kept, none = [], [], []
    for song_id in ids:
        path = repertoire.override_path(song_id)
        override = load_json(path) or {}
        new = provisional_override(songs.get(song_id, {}), override, load_json(repertoire.data_dir / "hooks" / f"{song_id}.json"))
        if new is None:
            (kept if (override.get("autoHooks") or songs.get(song_id, {}).get("timestamps")) else none).append(song_id)
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(new, indent=2, ensure_ascii=False) + "\n")  # as the relay writes overrides
        done.append(song_id)
    print(f"provisional best hooks: {len(done)} approved, {len(kept)} already had a best hook or a decision, "
          f"{len(none)} with no candidate left" + (f" ({', '.join(map(str, none))})" if none else ""))
    return 0


def report(docs: list[dict], repertoire: repertoires.Repertoire) -> None:
    """How the candidates compare with the hand tags: a tagged hook within a bar of the top candidate, of one of
    the top three, and how many hand tags get a suggested shift."""
    top1 = top3 = total = shifts = tags = 0
    for doc in docs:
        analysis = load_json(repertoire.data_dir / "analysis" / f"{doc['songId']}.json")
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
    repertoires.add_argument(ap)
    ap.add_argument("--song", type=int, action="append", help="song id (repeatable); default all analysed")
    ap.add_argument("--report", action="store_true", help="compare the candidates with the hand tags")
    ap.add_argument("--provisional", action="store_true",
                    help="approve each song's top candidate as its best hook, marked provisional (no detection)")
    args = ap.parse_args()
    repertoire = repertoires.from_args(args)
    if args.provisional:
        ids = args.song or sorted(int(p.stem) for p in (repertoire.data_dir / "hooks").glob("*.json") if p.stem.isdigit())
        return approve_provisional(repertoire, ids)
    out = repertoire.data_dir / "hooks"
    out.mkdir(parents=True, exist_ok=True)
    ids = args.song or sorted(int(p.stem) for p in (repertoire.data_dir / "analysis").glob("*.json") if p.stem.isdigit())
    docs = []
    for song_id in ids:
        doc = song_hooks(repertoire, song_id)
        if not doc:
            print(f"song {song_id}: no analysis or mix")
            continue
        (out / f"{song_id}.json").write_text(json.dumps(doc, indent=1) + "\n")
        docs.append(doc)
        print(f"song {song_id}: bars {[c['bar'] for c in doc['candidates']]} (phase {doc['phase']})")
    if args.report:
        report(docs, repertoire)
    return 0


if __name__ == "__main__":
    sys.exit(main())
