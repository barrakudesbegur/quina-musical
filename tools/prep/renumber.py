"""Renumber a repertoire's prepared data when its song ids change (D103, D238, D268).

Song ids follow each pool's playlist order, so a song taken off a playlist, or one added or shared, moves the ids
of the songs after it. Everything prepared is keyed by song id (per-song cache dirs, analysis, hooks, keys, stems and
Signatures files, covers, the tracked hand overrides), so before songs.json takes the new numbering, this step moves
each song's things from its old id to its new one. Songs are matched by Spotify id: the old ids come from the
repertoire's current songs.json, the new ones from its pools (tools/prep/pools.py's merge, print names included) or
from --new-songs.

- A song whose Spotify id is in both keeps its things, under its new id. Every move is two-phase (first into a
  `_renumber-staging` folder next to the file, then to its final name), so a shift chain (6→5, 7→6…) or a swap
  never overwrites anything; no step ever replaces an existing file.
- A song that is gone (retired) has its things moved aside to `<folder>/_retired/<spotifyId>/`, never deleted. The
  prep steps list ids by digit-only names (`p.stem.isdigit()`, the cloud's /^\\d+\\.jpg$/), so they skip `_retired`.
- A song that is new has nothing yet; the prep makes its files.
- The overrides' hook and Signature ids carry the song id (`autoHooks` "62-auto-0", `hookTimes` "70-best-0",
  `autoHooksRejected`, `signatures`…): they are rewritten to the new id. So are the generated files that the prep
  steps keep instead of rebuilding: stems/<id>.json (`songId`, `pathTemplate`, `source.path`; stems.py skips a song
  whose mix is unchanged), stems/index.json and snippets/index.json (both keep entries of songs they don't
  process), and signatures/<id>.json with its clips <cacheDir>/<id>/signatures/<id>-<kind>-<n>.flac (signatures.py
  keeps a file it has). The rest is rebuilt by the prep (analyze: analysis/<id>.json and index.json; hooks:
  hooks/<id>.json; keys: keys/ and its cache; quality.json; validate: report.md).
- Before anything moves, the data is checked against the old songs.json: a song's analysis and decoded mix name
  their source audio, <spotifyId>.<ext>, which must be that song's track. So data already renumbered (or a
  songs.json already rewritten) is refused, and so is a plan already applied: each apply writes
  <dataDir>/renumber-<date>.json (the mapping, every move, every rewrite), first as "applying", then "applied".

After an apply, write the new songs.json (tools/prep/pools.py) and run the prep again.

Run: tools/prep/.venv/bin/python tools/prep/renumber.py [--repertoire NAME|PATH] [--old-songs PATH]
         [--new-songs PATH] [--dry-run]
Only the standard library.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import print_names  # noqa: E402
import pools  # noqa: E402
import repertoire as repertoires  # noqa: E402

RETIRED = "_retired"
STAGING = "_renumber-staging"
RECORD_PREFIX = "renumber-"
ID_NAME_RE = re.compile(r"^(\d+)(\..+)?$")
"""A per-song entry of a folder: "62" (a dir), "62.json", "62.jpg"; hidden temp files aside."""
PREFIXED_RE = re.compile(r"^(\d+)(-[A-Za-z][\w-]*-\d+)$")
"""A hook or Signature id: "<songId>-<tag or kind>-<n>" ("70-best-0", "62-auto-0", "13-motif-0")."""


class RenumberError(Exception):
    pass


# ---------------------------------------------------------------- the plan (pure)

@dataclass(frozen=True)
class Plan:
    moves: dict[int, int]
    """old id → new id, for the songs whose id changes."""
    kept: list[int]
    """Ids that stay."""
    retired: dict[int, str]
    """old id → Spotify id, for the songs that are gone."""
    added: dict[int, str]
    """new id → Spotify id, for the songs that are new."""
    mapping: dict[str, list[int | None]] = field(default_factory=dict)
    """Spotify id → [old id, new id] (None for a song that is new or gone): what a record keeps."""
    titles: dict[str, str] = field(default_factory=dict, compare=False)

    @property
    def empty(self) -> bool:
        return not (self.moves or self.retired or self.added)


def _by_spotify(songs: list[dict], which: str) -> dict[str, int]:
    out: dict[str, int] = {}
    ids: set[int] = set()
    for song in songs:
        sid, sp = song.get("id"), song.get("spotifyId")
        if not isinstance(sid, int) or isinstance(sid, bool) or sid < 1:
            raise RenumberError(f"{which} songs: a song without a positive id: {song.get('title')!r}")
        if not isinstance(sp, str) or not sp:
            raise RenumberError(f"{which} songs: song {sid} has no spotifyId, so it can't be matched")
        if sp in out:
            raise RenumberError(f"{which} songs: {sp} is listed twice (ids {out[sp]} and {sid})")
        if sid in ids:
            raise RenumberError(f"{which} songs: id {sid} is used twice")
        out[sp] = sid
        ids.add(sid)
    return out


def plan(old_songs: list[dict], new_songs: list[dict]) -> Plan:
    """Every song's old id → new id, matched by Spotify id."""
    old, new = _by_spotify(old_songs, "old"), _by_spotify(new_songs, "new")
    titles = {s["spotifyId"]: f"«{s.get('title')}» ({s.get('artist')})" for s in [*old_songs, *new_songs]}
    moves = {old[sp]: new[sp] for sp in old if sp in new and old[sp] != new[sp]}
    kept = sorted(old[sp] for sp in old if sp in new and old[sp] == new[sp])
    retired = {old[sp]: sp for sp in sorted(old, key=old.get) if sp not in new}
    added = {new[sp]: sp for sp in sorted(new, key=new.get) if sp not in old}
    mapping = {sp: [old.get(sp), new.get(sp)] for sp in sorted(set(old) | set(new))}
    return Plan(dict(sorted(moves.items())), kept, retired, added, mapping, titles)


def reprefix(value, old: int, new: int, foreign: list[str] | None = None):
    """`value` with every hook or Signature id of song `old` ("<old>-best-0"), as a dict key or a string anywhere,
    renamed to song `new`. Ids of another song are collected in `foreign` (they shouldn't be there)."""
    def one(text: str) -> str:
        m = PREFIXED_RE.match(text)
        if not m:
            return text
        if int(m.group(1)) == old:
            return f"{new}{m.group(2)}"
        if foreign is not None:
            foreign.append(text)
        return text
    if isinstance(value, dict):
        return {(one(k) if isinstance(k, str) else k): reprefix(v, old, new, foreign) for k, v in value.items()}
    if isinstance(value, list):
        return [reprefix(v, old, new, foreign) for v in value]
    if isinstance(value, str):
        return one(value)
    return value


# ---------------------------------------------------------------- the file steps

@dataclass(frozen=True)
class Step:
    src: Path
    dst: Path
    old: int
    new: int | None
    """None: retired."""


def id_folders(repertoire: repertoires.Repertoire) -> list[Path]:
    """Every folder whose entries are named by song id."""
    covers_replaced = repertoire.covers_dir.with_name(repertoire.covers_dir.name + "-replaced")
    folders = [repertoire.cache_dir, repertoire.key_cache_dir, repertoire.stretch_dir, repertoire.analysis_dir,
               repertoire.data_dir / "hooks", repertoire.keys_dir, repertoire.stems_dir, repertoire.signatures_dir,
               repertoire.covers_dir, covers_replaced, repertoire.overrides_dir]
    seen: list[Path] = []
    for f in folders:
        if f not in seen:
            seen.append(f)
    return seen


def id_entries(folder: Path) -> dict[int, list[Path]]:
    out: dict[int, list[Path]] = {}
    if not folder.is_dir():
        return out
    for p in sorted(folder.iterdir()):
        m = ID_NAME_RE.match(p.name)
        if m:
            out.setdefault(int(m.group(1)), []).append(p)
    return out


def steps_for(repertoire: repertoires.Repertoire, p: Plan) -> tuple[list[Step], dict[Path, list[int]]]:
    """The moves, and per folder the stray ids (entries of an id that isn't in the old songs)."""
    steps: list[Step] = []
    strays: dict[Path, list[int]] = {}
    known = set(p.moves) | set(p.kept) | set(p.retired)
    for folder in id_folders(repertoire):
        for sid, paths in id_entries(folder).items():
            if sid not in known:
                strays.setdefault(folder, []).append(sid)
                continue
            for src in paths:
                suffix = src.name[len(str(sid)):]
                if sid in p.moves:
                    steps.append(Step(src, folder / f"{p.moves[sid]}{suffix}", sid, p.moves[sid]))
                elif sid in p.retired:
                    steps.append(Step(src, folder / RETIRED / p.retired[sid] / src.name, sid, None))
    return steps, strays


def source_track(repertoire: repertoires.Repertoire, sid: int) -> list[tuple[str, str]]:
    """What the data under id `sid` says its source audio is: (where, file stem)."""
    out = []
    try:
        mp3 = json.loads((repertoire.analysis_dir / f"{sid}.json").read_text()).get("source", {}).get("mp3")
        if isinstance(mp3, str):
            out.append((f"analysis/{sid}.json", Path(mp3).stem))
    except (OSError, ValueError, AttributeError):
        pass
    try:
        path = json.loads((repertoire.song_cache(sid) / "mix.json").read_text()).get("source", {}).get("path")
        if isinstance(path, str):
            out.append((f"{sid}/mix.json", Path(path).stem))
    except (OSError, ValueError, AttributeError):
        pass
    return out


def records(repertoire: repertoires.Repertoire) -> list[tuple[Path, dict]]:
    out = []
    for path in sorted(repertoire.data_dir.glob(f"{RECORD_PREFIX}*.json")):
        try:
            out.append((path, json.loads(path.read_text())))
        except ValueError:
            out.append((path, {}))
    return out


def problems(repertoire: repertoires.Repertoire, p: Plan, steps: list[Step], strays: dict[Path, list[int]],
             old_songs: list[dict]) -> list[str]:
    """Why the apply would be unsafe; empty when it can run."""
    out: list[str] = []
    for path, rec in records(repertoire):
        if rec.get("status") != "applied":
            out.append(f"{repertoires.display(path)} is an unfinished renumber ({rec.get('status')!r}): finish or "
                       "undo it by hand from its steps first")
        elif rec.get("mapping") == p.mapping:
            out.append(f"this renumber is already applied ({repertoires.display(path)}); write the new songs.json "
                       "with tools/prep/pools.py")
    for folder in id_folders(repertoire):
        if (folder / STAGING).exists():
            out.append(f"{repertoires.display(folder / STAGING)} exists: an earlier apply stopped half way")
    targets = set(p.moves.values()) | set(p.added)
    for folder, ids in strays.items():
        clash = sorted(set(ids) & targets)
        if clash:
            out.append(f"{repertoires.display(folder)} has entries for ids {clash}, which aren't songs of the old "
                       "songs.json but are new ids: move them away first")
    sources = {s.src for s in steps}
    for s in steps:
        if s.new is None and s.dst.exists():
            out.append(f"{repertoires.display(s.dst)} already exists")
        elif s.new is not None and s.dst.exists() and s.dst not in sources:
            out.append(f"{repertoires.display(s.dst)} exists and isn't moving away")
    track = {s["id"]: s.get("spotifyId") for s in old_songs}
    for sid in [*p.moves, *p.kept, *p.retired]:
        for where, stem in source_track(repertoire, sid):
            if not stem.isdigit() and stem != track[sid]:
                out.append(f"{where} is from {stem}, but the old songs.json's song {sid} is {track[sid]}: the data "
                           "doesn't follow the old numbering (already renumbered?)")
    return out


# ---------------------------------------------------------------- apply

def _rename(src: Path, dst: Path) -> None:
    """Rename without ever replacing: refuse when `dst` exists."""
    if dst.exists() or dst.is_symlink():
        raise RenumberError(f"refusing to overwrite {dst}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    os.rename(src, dst)


def _write_json(path: Path, doc, indent: int, newline: bool, ascii_only: bool = True) -> None:
    tmp = path.with_name(f".{path.name}.renumber-tmp")
    tmp.write_text(json.dumps(doc, indent=indent, ensure_ascii=ascii_only) + ("\n" if newline else ""))
    os.replace(tmp, path)


def _write_record(path: Path, doc: dict) -> None:
    _write_json(path, doc, 1, True, ascii_only=False)


def record_path(repertoire: repertoires.Repertoire, today: dt.date) -> Path:
    base = repertoire.data_dir / f"{RECORD_PREFIX}{today.isoformat()}.json"
    n = 2
    path = base
    while path.exists():
        path = base.with_name(f"{RECORD_PREFIX}{today.isoformat()}-{n}.json")
        n += 1
    return path


def rewrite_overrides(repertoire: repertoires.Repertoire, p: Plan, log: list[str], warnings: list[str]) -> None:
    for old, new in p.moves.items():
        path = repertoire.override_path(new)
        if not path.is_file():
            continue
        doc = json.loads(path.read_text())
        foreign: list[str] = []
        new_doc = reprefix(doc, old, new, foreign)
        if foreign:
            warnings.append(f"override {new} (was {old}) names other songs' ids, left as they are: {foreign}")
        if new_doc != doc:
            _write_json(path, new_doc, 2, True, ascii_only=False)  # as the relay writes overrides
            log.append(f"{repertoires.display(path)}: ids {old}-… → {new}-…")


def rewrite_stems(repertoire: repertoires.Repertoire, p: Plan, log: list[str], warnings: list[str],
                  dropped: dict[str, list]) -> None:
    for old, new in p.moves.items():
        path = repertoire.stems_dir / f"{new}.json"
        if not path.is_file():
            continue
        doc = json.loads(path.read_text())
        doc["songId"] = new
        old_template = f"{repertoires.display(repertoire.stems_cache(old))}/{{stem}}.{{startSample}}.flac"
        if doc.get("pathTemplate") == old_template:
            doc["pathTemplate"] = f"{repertoires.display(repertoire.stems_cache(new))}/{{stem}}.{{startSample}}.flac"
        elif "pathTemplate" in doc:
            warnings.append(f"stems/{new}.json (was {old}): unexpected pathTemplate {doc['pathTemplate']!r}, left")
        src = doc.get("source") or {}
        if src.get("path") == repertoires.display(repertoire.mix_flac(old)):
            src["path"] = repertoires.display(repertoire.mix_flac(new))
        doc = reprefix(doc, old, new)
        _write_json(path, doc, 1, False)  # as stems.py writes it
        log.append(f"{repertoires.display(path)}: songId, pathTemplate, source.path {old} → {new}")
    index = repertoire.stems_dir / "index.json"
    if index.is_file():
        doc = json.loads(index.read_text())
        doc["songs"], dropped["stems/index.json"] = _remap_entries(doc.get("songs", []), "id", p)
        _write_json(index, doc, 1, False)
        log.append(f"{repertoires.display(index)}: ids renumbered, {len(dropped['stems/index.json'])} retired entries dropped")


def rewrite_signatures(repertoire: repertoires.Repertoire, p: Plan, log: list[str]) -> None:
    for old, new in p.moves.items():
        clips = repertoire.signatures_cache(new)
        if clips.is_dir():
            for f in sorted(clips.iterdir()):
                m = PREFIXED_RE.match(f.stem)
                if m and int(m.group(1)) == old:
                    _rename(f, f.with_name(f"{new}{m.group(2)}{f.suffix}"))
                    log.append(f"{repertoires.display(f)} → {new}{m.group(2)}{f.suffix}")
        path = repertoire.signatures_dir / f"{new}.json"
        if path.is_file():
            doc = reprefix(json.loads(path.read_text()), old, new)
            doc["songId"] = new
            _write_json(path, doc, 1, True)  # as signatures.py writes it
            log.append(f"{repertoires.display(path)}: songId and Signature ids {old} → {new}")


def rewrite_snippets(repertoire: repertoires.Repertoire, p: Plan, log: list[str], dropped: dict[str, list]) -> None:
    index = repertoire.data_dir / "snippets" / "index.json"
    if not index.is_file():
        return
    doc = json.loads(index.read_text())
    doc["songs"], dropped["snippets/index.json"] = _remap_entries(doc.get("songs", []), "id", p)
    _write_json(index, doc, 1, True)  # as snippets.py writes it
    log.append(f"{repertoires.display(index)}: ids and hook ids renumbered, "
               f"{len(dropped['snippets/index.json'])} retired entries dropped")


def _remap_entries(entries: list[dict], key: str, p: Plan) -> tuple[list[dict], list[dict]]:
    """An index's entries under their new ids (sorted), and the retired songs' entries taken out."""
    kept, dropped = [], []
    for e in entries:
        sid = e.get(key)
        if sid in p.retired:
            dropped.append(e)
        elif sid in p.moves:
            kept.append({**reprefix(e, sid, p.moves[sid]), key: p.moves[sid]})
        else:
            kept.append(e)
    return sorted(kept, key=lambda e: (e.get(key) is None, e.get(key) or 0)), dropped


def apply(repertoire: repertoires.Repertoire, p: Plan, old_songs: list[dict], today: dt.date | None = None) -> Path:
    """Move everything to its new id; returns the record's path. Raises RenumberError before touching anything when
    `problems` finds one."""
    steps, strays = steps_for(repertoire, p)
    found = problems(repertoire, p, steps, strays, old_songs)
    if found:
        raise RenumberError("refusing to apply:\n  " + "\n  ".join(found))
    path = record_path(repertoire, today or dt.date.today())
    record = {
        "schemaVersion": 1, "repertoire": repertoire.name, "status": "applying",
        "startedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mapping": p.mapping,
        "moves": {str(k): v for k, v in p.moves.items()},
        "retired": {str(k): v for k, v in p.retired.items()},
        "added": {str(k): v for k, v in p.added.items()},
        "steps": [{"from": repertoires.display(s.src), "to": repertoires.display(s.dst)} for s in steps],
        "strays": {repertoires.display(f): ids for f, ids in strays.items()},
    }
    repertoire.data_dir.mkdir(parents=True, exist_ok=True)
    _write_record(path, record)
    # Phase 1: every moving entry into its folder's staging dir (retired ones straight to _retired).
    staged: list[tuple[Path, Step]] = []
    for s in steps:
        if s.new is None:
            _rename(s.src, s.dst)
            continue
        tmp = s.src.parent / STAGING / s.src.name
        _rename(s.src, tmp)
        staged.append((tmp, s))
    # Phase 2: staging → the new names, which phase 1 freed.
    for tmp, s in staged:
        _rename(tmp, s.dst)
    for folder in {s.src.parent for _, s in staged}:
        (folder / STAGING).rmdir()  # empty now: only this run's staging dir
    log: list[str] = []
    warnings: list[str] = []
    dropped: dict[str, list] = {}
    rewrite_overrides(repertoire, p, log, warnings)
    rewrite_stems(repertoire, p, log, warnings, dropped)
    rewrite_signatures(repertoire, p, log)
    rewrite_snippets(repertoire, p, log, dropped)
    record.update({"status": "applied",
                   "appliedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                   "rewrites": log, "warnings": warnings, "droppedIndexEntries": dropped})
    _write_record(path, record)
    return path


# ---------------------------------------------------------------- CLI

def describe(repertoire: repertoires.Repertoire, p: Plan, steps: list[Step], strays: dict[Path, list[int]]) -> list[str]:
    t = lambda sp: p.titles.get(sp, sp)  # noqa: E731
    track = {ids[0]: sp for sp, ids in p.mapping.items() if ids[0] is not None}
    lines = [f"{len(p.kept)} keep their id, {len(p.moves)} change id, {len(p.retired)} retired, {len(p.added)} new"]
    for old, new in p.moves.items():
        lines.append(f"  {old:>4} → {new:<7} {track[old]} {t(track[old])}")
    for old, sp in p.retired.items():
        lines.append(f"  {old:>4} → retired {sp} {t(sp)}")
    for new, sp in p.added.items():
        lines.append(f"   new → {new:<7} {sp} {t(sp)}")
    per_folder: dict[Path, list[int]] = {}
    for s in steps:
        c = per_folder.setdefault(s.src.parent, [0, 0])
        c[0 if s.new is not None else 1] += 1
    for folder, (moved, retired) in per_folder.items():
        lines.append(f"{repertoires.display(folder)}: {moved} to move, {retired} to {RETIRED}/")
    for folder, ids in strays.items():
        lines.append(f"⚠️  {repertoires.display(folder)}: entries for ids not in the old songs.json, left: {ids}")
    return lines


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    repertoires.add_argument(ap)
    ap.add_argument("--old-songs", type=Path, help="the numbering the data follows (default: the repertoire's songs.json)")
    ap.add_argument("--new-songs", type=Path, help="the new numbering (default: the pools merged, as pools.py writes it)")
    ap.add_argument("--dry-run", action="store_true", help="print the plan and change nothing")
    args = ap.parse_args(argv)
    repertoire = repertoires.from_args(args)
    try:
        old_songs = json.loads((args.old_songs or repertoire.songs_json).read_text())
        if args.new_songs:
            new_songs = json.loads(args.new_songs.read_text())
        else:
            _, merged, _ = pools.build(repertoire)
            new_songs = merged.songs
        p = plan(old_songs, new_songs)
    except (OSError, ValueError, RenumberError, pools.PoolsError, print_names.PrintNamesError) as err:
        print(f"renumber: {err}", file=sys.stderr)
        return 1
    steps, strays = steps_for(repertoire, p)
    for line in describe(repertoire, p, steps, strays):
        print(line)
    if p.empty:
        print("nothing to renumber")
        return 0
    found = problems(repertoire, p, steps, strays, old_songs)
    if args.dry_run:
        for line in found:
            print(f"❌ {line}")
        print("dry run: nothing changed" + (f"; an apply would refuse ({len(found)} problems)" if found else ""))
        return 1 if found else 0
    try:
        path = apply(repertoire, p, old_songs)
    except RenumberError as err:
        print(f"renumber: {err}", file=sys.stderr)
        return 1
    rec = json.loads(path.read_text())
    for line in rec["rewrites"]:
        print(f"rewrote {line}")
    for line in rec["warnings"]:
        print(f"⚠️  {line}")
    print(f"applied: {len(rec['steps'])} moves, record {repertoires.display(path)}")
    print(f"next: tools/prep/.venv/bin/python tools/prep/pools.py --repertoire {repertoire.name}, then the prep")
    return 0


if __name__ == "__main__":
    sys.exit(main())
