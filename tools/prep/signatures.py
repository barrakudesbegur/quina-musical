"""Signature candidates (GLOSSARY: Signature): short, recognizable instrumental pieces of a song (its intro
riff, the build into its chorus, the chorus's instrumental line), teased just before it lands. The candidates
come from tools/prep/steps/signatures.py; this script cuts their audio from the stems (tools/prep/stems.py),
always without the vocals, and writes, per song:

    <dataDir>/signatures/<id>.json   schema 1: { songId, sampleRate, signatures: [...] } (engine/src/analysis.ts)
    <cacheDir>/<id>/signatures/<sigId>.flac   48 kHz 16-bit stereo, short fades, at the stems' real level

Per song the best candidate at or above AUTO_MIN_SCORE plays automatically. The audition page vetoes or picks
one through <overridesDir>/<id>.json `signatures: { <sigId>: bool }`, or turns the song's Signatures off
(`signaturesOff: true`); --derive-only re-applies those without touching the audio (the relay runs it after a
Save). Only approved Signatures play in the show.

Run: tools/prep/.venv/bin/python tools/prep/signatures.py [--repertoire NAME|PATH] [--song N ...] [--derive-only] [--force]
(the directories are the repertoire's: tools/prep/repertoire.py; the default repertoire's are data/out/, data/cache/, data/repertoires/default/overrides/)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import repertoire as repertoires  # noqa: E402
from steps import signatures as sg  # noqa: E402

SCHEMA_VERSION = 1
SR = 48000
TARGET_RMS_DB = -18.0
FADE_IN_SEC = 0.004
FADE_OUT_SEC = 0.03
STEM_NAMES = ("drums", "bass", "vocals")


@dataclass(frozen=True)
class Paths:
    data: Path  # analysis/, stems/, signatures/ live under it
    cache: Path  # <id>/mix.flac, <id>/stems/, <id>/signatures/
    overrides: Path


def resolve_paths(args: argparse.Namespace) -> Paths:
    """The song repertoire's directories (--repertoire, else $QUINA_REPERTOIRE, else the default repertoire)."""
    repertoire = repertoires.from_args(args)
    return Paths(data=repertoire.data_dir, cache=repertoire.cache_dir, overrides=repertoire.overrides_dir)


def load_json(path: Path):
    return json.loads(path.read_text()) if path.exists() else None


class SongAudio:
    """Reads parts of a song: the mix, its stems (stored in windows at stemGain) and 'other' (derived)."""

    def __init__(self, paths: Paths, song_id: int, stems_meta: dict):
        self.mix_path = paths.cache / str(song_id) / "mix.flac"
        self.stem_dir = paths.cache / str(song_id) / "stems"
        self.meta = stems_meta
        self.scale = 1.0 / stems_meta["stemGain"]

    def window_for(self, start: float, end: float) -> dict | None:
        return next((w for w in self.meta["windows"] if w["startSec"] <= start + 1e-6 and w["endSec"] >= end - 1e-6), None)

    def stem(self, name: str, start: float, end: float) -> np.ndarray | None:
        w = self.window_for(start, end)
        if w is None:
            return None
        path = self.stem_dir / f"{name}.{w['startSample']}.flac"
        if not path.exists():
            return None
        first = int(round(start * SR)) - w["startSample"]
        last = int(round(end * SR)) - w["startSample"]
        audio, sr = sf.read(path, start=max(0, first), stop=last, dtype="float32", always_2d=True)
        assert sr == SR, f"{path}: {sr} Hz"
        return audio * self.scale

    def mix(self, start: float, end: float) -> np.ndarray:
        audio, sr = sf.read(self.mix_path, start=int(round(start * SR)), stop=int(round(end * SR)), dtype="float32", always_2d=True)
        assert sr == SR, f"{self.mix_path}: {sr} Hz"
        return audio

    def part(self, name: str, start: float, end: float) -> np.ndarray | None:
        if name == "mix":
            return self.mix(start, end)
        if name in STEM_NAMES:
            return self.stem(name, start, end)
        if name in ("other", "instrumental"):
            # "other": what is left without the drums, bass and vocals; "instrumental": the mix without the vocals.
            parts = [self.stem(n, start, end) for n in (STEM_NAMES if name == "other" else ("vocals",))]
            if any(p is None for p in parts):
                return None
            mix = self.mix(start, end)
            length = min(len(mix), *(len(p) for p in parts))
            return mix[:length] - sum(p[:length] for p in parts)
        raise ValueError(name)


def faded(audio: np.ndarray) -> np.ndarray:
    out = audio.copy()
    fin = min(len(out), int(FADE_IN_SEC * SR))
    fout = min(len(out), int(FADE_OUT_SEC * SR))
    if fin:
        out[:fin] *= np.linspace(0, 1, fin, dtype=np.float32)[:, None]
    if fout:
        out[-fout:] *= np.linspace(1, 0, fout, dtype=np.float32)[:, None]
    return np.clip(out, -1, 1)


def candidates_for(paths: Paths, song_id: int) -> tuple[list[dict], list[str]]:
    """Cut every candidate's audio; returns the entries and warnings."""
    analysis = load_json(paths.data / "analysis" / f"{song_id}.json")
    stems_meta = load_json(paths.data / "stems" / f"{song_id}.json")
    if not analysis or not stems_meta or not stems_meta.get("bars"):
        return [], ["no analysis or stems"]
    audio = SongAudio(paths, song_id, stems_meta)
    bpm = analysis["tempo"]["bpm"]
    found = sg.candidates(analysis, stems_meta["bars"])
    out_dir = paths.cache / str(song_id) / "signatures"
    out_dir.mkdir(parents=True, exist_ok=True)
    entries: list[dict] = []
    warnings: list[str] = []
    counters: dict[str, int] = {}
    for c in found:
        clip = audio.part(c.stem, c.start_sec, c.end_sec)
        if clip is None or len(clip) < int(0.1 * SR):
            warnings.append(f"{c.kind} at {c.start_sec:.2f}: no {c.stem} audio there")
            continue
        n = counters.get(c.kind, 0)
        counters[c.kind] = n + 1
        sig_id = f"{song_id}-{c.kind}-{n}"
        clip = faded(clip)
        sf.write(out_dir / f"{sig_id}.flac", clip, SR, subtype="PCM_16")
        entries.append({
            "id": sig_id,
            "kind": c.kind,
            "stem": c.stem,
            "startSec": round(c.start_sec, 4),
            "endSec": round(c.end_sec, 4),
            "durationSec": round(len(clip) / SR, 4),
            "anchorSec": round(c.anchor_sec, 4),
            "beats": round(c.beats, 3),
            "bpm": bpm,
            "gainDb": sg.gain_to_target_db(clip, SR, TARGET_RMS_DB),
            "score": c.score,
            "source": c.source,
            "approved": None,
        })
    return entries, warnings


# The automatic pick (the user's decision, Q27 a): per song, the best-scoring candidate at or above this plays,
# unless someone vetoed it on the audition page; a veto promotes the next best. A manual approve is an
# explicit pick and replaces the automatic one; `signaturesOff` in the song's override turns them all off.
AUTO_MIN_SCORE = 0.6


def apply_decisions(doc: dict, override: dict | None) -> dict:
    """Set `approved` (plays or not) and `pick` ('manual', 'auto' or None) from the audition decisions."""
    o = override or {}
    decisions = o.get("signatures") or {}
    doc["off"] = bool(o.get("signaturesOff"))
    for s in doc["signatures"]:
        decision = decisions.get(s["id"])
        s["vetoed"] = decision is False
        s["approved"] = False
        s["pick"] = None
    if doc["off"]:
        return doc
    manual = [s for s in doc["signatures"] if decisions.get(s["id"]) is True]
    for s in manual:
        s["approved"] = True
        s["pick"] = "manual"
    if not manual:
        eligible = [s for s in doc["signatures"] if not s["vetoed"] and s["score"] >= AUTO_MIN_SCORE]
        if eligible:
            best = max(eligible, key=lambda s: (s["score"], -s["startSec"]))
            best["approved"] = True
            best["pick"] = "auto"
    return doc


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    repertoires.add_argument(ap)
    ap.add_argument("--song", type=int, action="append", help="song id (repeatable); default all with stems")
    ap.add_argument("--derive-only", action="store_true", help="only re-apply the audition decisions")
    ap.add_argument("--force", action="store_true", help="cut the audio again even if the song has a file")
    args = ap.parse_args()
    paths = resolve_paths(args)
    out = paths.data / "signatures"
    out.mkdir(parents=True, exist_ok=True)
    ids = args.song or sorted(int(p.stem) for p in (paths.data / "stems").glob("*.json") if p.stem.isdigit())
    summary = []
    for song_id in ids:
        file = out / f"{song_id}.json"
        override = load_json(paths.overrides / f"{song_id}.json")
        doc = load_json(file)
        if args.derive_only or (doc and not args.force):
            if not doc:
                print(f"song {song_id}: no Signatures file yet (run without --derive-only)")
                continue
            warnings = doc.get("warnings", [])
        else:
            entries, warnings = candidates_for(paths, song_id)
            doc = {"schemaVersion": SCHEMA_VERSION, "songId": song_id, "sampleRate": SR,
                   "createdAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                   "targetRmsDb": TARGET_RMS_DB, "signatures": entries, "warnings": warnings}
        apply_decisions(doc, override)
        file.write_text(json.dumps(doc, indent=1) + "\n")
        approved = sum(1 for s in doc["signatures"] if s["approved"])
        summary.append({"id": song_id, "candidates": len(doc["signatures"]), "approved": approved})
        kinds = ", ".join(s["id"].split("-", 1)[1] for s in doc["signatures"]) or "none"
        print(f"song {song_id}: {kinds}" + (f" ({approved} approved)" if approved else "") + (f" · {'; '.join(warnings)}" if warnings else ""))
    index = {"schemaVersion": SCHEMA_VERSION, "songs": sorted(
        ({"id": int(p.stem), "candidates": len(d["signatures"]), "approved": sum(1 for s in d["signatures"] if s["approved"])}
         for p in out.glob("*.json") if p.stem.isdigit() and (d := json.loads(p.read_text()))),
        key=lambda s: s["id"])}
    (out / "index.json").write_text(json.dumps(index, indent=1) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
