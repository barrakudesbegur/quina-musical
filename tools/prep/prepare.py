"""Prepare a repertoire for the show with one command: every offline step, in order, each skipping work already done.

    tools/prep/.venv/bin/python tools/prep/prepare.py --repertoire NAME|PATH [--steps covers,decode,...] [--song N ...]
    npm run prep -- --repertoire NAME

Steps (default: all, always run in this order):
    covers      covers.py      songs.json `cover` URLs → <coversDir>/<id>.jpg
    decode      decode.py      source audio → <cacheDir>/<id>/mix.flac
    quality     quality.py     each source's bitrate, low-pass and length against Spotify's → <dataDir>/quality.json (flags only)
    analyze     analyze.py     beat grid, tempo, hooks, loudness → <dataDir>/analysis/
    snippets    snippets.py    3 s from each song's best hook, for the Check → <cacheDir>/<id>/snippet.flac, <dataDir>/snippets/
    validate    validate.py    flags and audition queue → <dataDir>/report.md (hard errors stop here)
    keys        keys.py        musical keys → <dataDir>/keys/
    stems       stems.py       Demucs stems (in tools/prep/.venv-stems) → <cacheDir>/<id>/stems/, <dataDir>/stems/
    signatures  signatures.py  Signature candidates from the stems → <dataDir>/signatures/
    hooks       hooks_auto.py  automatic hook candidates and hand-tag refinements → <dataDir>/hooks/ (approved on the audition page)
    interval    interval.py    the music sets, global (no repertoire owns them) → cache/interval/<set>/, data/interval/<set>/

--song limits covers, decode, analyze, snippets, stems, signatures and hooks to those songs; validate and keys always
cover the whole repertoire (their cached work is skipped); interval is the same for every repertoire. Each step is its own process, given the
repertoire's manifest path. The first failing step stops the run (--keep-going runs the rest anyway);
the exit status is 0 when every step succeeded, 3 when the stems disk guard stopped the run, else 1.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import repertoire as repertoires  # noqa: E402

ANALYSIS = repertoires.PREP
VENV_PY = ANALYSIS / ".venv" / "bin" / "python"
STEMS_PY = ANALYSIS / ".venv-stems" / "bin" / "python"
DISK_GUARD_EXIT = 3  # stems.py: the disk guard stopped the run


@dataclass(frozen=True)
class Step:
    name: str
    script: str
    python: Path
    per_song: bool  # takes --song
    setup_hint: str = ""
    takes_repertoire: bool = True  # takes --repertoire (the Interval playlist belongs to no repertoire)


STEPS = (
    Step("covers", "covers.py", VENV_PY, True),
    Step("decode", "decode.py", VENV_PY, True),
    Step("quality", "quality.py", VENV_PY, True),
    Step("analyze", "analyze.py", VENV_PY, True),
    Step("snippets", "snippets.py", VENV_PY, True),
    Step("validate", "validate.py", VENV_PY, False),
    Step("keys", "keys.py", VENV_PY, False,
         "uv pip install --python tools/prep/.venv/bin/python -r tools/prep/requirements-layering.txt"),
    Step("stems", "stems.py", STEMS_PY, True,
         "uv venv --python /opt/homebrew/bin/python3.13 tools/prep/.venv-stems && "
         "uv pip install --python tools/prep/.venv-stems/bin/python -r tools/prep/requirements-stems.txt"),
    Step("signatures", "signatures.py", VENV_PY, True),
    Step("hooks", "hooks_auto.py", VENV_PY, True),
    Step("interval", "interval.py", VENV_PY, False, takes_repertoire=False),
    Step("voices", "voices.py", VENV_PY, False, takes_repertoire=False),
)
STEP_NAMES = tuple(s.name for s in STEPS)


def _load(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


# ---------------------------------------------------------------- per-step summaries (from the outputs)

def _sum_covers(repertoire: repertoires.Repertoire, ids: list[int]) -> str:
    return f"{sum(repertoire.cover_path(i).is_file() for i in ids)}/{len(ids)} covers in {repertoires.display(repertoire.covers_dir)}"


def _sum_decode(repertoire: repertoires.Repertoire, ids: list[int]) -> str:
    return f"{sum(repertoire.mix_flac(i).is_file() for i in ids)}/{len(ids)} songs decoded"


def _sum_analyze(repertoire: repertoires.Repertoire, ids: list[int]) -> str:
    index = _load(repertoire.analysis_index)
    if not index:
        return "no index.json"
    rows = index["songs"]
    playable = sum(1 for r in rows if not r.get("excluded") and any(h.get("valid") for h in r["hooks"]))
    untagged = sum(1 for r in rows if "no_hook_tags" in r.get("flags", []))
    return (f"{len(rows)}/{len(ids)} analysed, {playable} playable"
            + (f", {untagged} without hook tags" if untagged else ""))


def _sum_quality(repertoire: repertoires.Repertoire, ids: list[int]) -> str:
    doc = _load(repertoire.data_dir / "quality.json")
    if not doc:
        return "no quality check"
    rows = [r for r in doc.get("songs", []) if r["id"] in set(ids)]
    flagged = [r for r in rows if r.get("flags")]
    return f"{len(rows)} sources checked, {len(flagged)} to check by ear" + (f" ({repertoires.display(repertoire.data_dir / 'quality.json')})" if flagged else "")


def _sum_snippets(repertoire: repertoires.Repertoire, ids: list[int]) -> str:
    index = _load(repertoire.data_dir / "snippets" / "index.json")
    if not index:
        return "no snippets index"
    have = {s["id"] for s in index.get("songs", [])}
    return f"{len(have & set(ids))}/{len(ids)} songs with a Check snippet"


def _sum_validate(repertoire: repertoires.Repertoire, ids: list[int]) -> str:
    return f"report {repertoires.display(repertoire.report_path)}"


def _sum_keys(repertoire: repertoires.Repertoire, ids: list[int]) -> str:
    index = _load(repertoire.keys_dir / "index.json")
    if not index:
        return "no keys index"
    scored = str(index.get("accuracyVsSpotify", {}).get("reference", "")).startswith("Spotify")
    return f"{len(index['songs'])} songs, method {index['method']}" + ("" if scored else " (unscored: no Spotify)")


def _sum_stems(repertoire: repertoires.Repertoire, ids: list[int]) -> str:
    index = _load(repertoire.stems_dir / "index.json")
    if not index:
        return "no stems index"
    ok = {s["id"] for s in index["songs"] if s.get("ok")}
    return f"{len(ok & set(ids))}/{len(ids)} songs with stems, {index.get('stemsBytes', 0) / 1e9:.2f} GB"


def _sum_signatures(repertoire: repertoires.Repertoire, ids: list[int]) -> str:
    index = _load(repertoire.signatures_dir / "index.json")
    if not index:
        return "no signatures index"
    songs = index.get("songs", [])
    return (f"{len(songs)} songs, {sum(s.get('candidates', 0) for s in songs)} candidates, "
            f"{sum(s.get('approved', 0) for s in songs)} approved")


def _sum_hooks(repertoire: repertoires.Repertoire, ids: list[int]) -> str:
    docs = [d for i in ids if (d := _load(repertoire.data_dir / "hooks" / f"{i}.json"))]
    if not docs:
        return "no hook candidates"
    return (f"{len(docs)} songs, {sum(len(d.get('candidates', [])) for d in docs)} candidates, "
            f"{sum(1 for d in docs for r in d.get('refine', []) if r.get('suggestShiftBars'))} hand tags with a suggested shift")


def _sum_interval(repertoire: repertoires.Repertoire, ids: list[int]) -> str:
    root = repertoires.OUT / "interval"
    sets = sorted(d for d in root.iterdir() if (d / "index.json").exists()) if root.is_dir() else []
    if not sets:
        return "no music sets"

    def one(d: Path) -> str:
        index = _load(d / "index.json")
        dropped, missing = len(index.get("dropped", [])), len(index.get("missing", []))
        return (f"{d.name} {len(index['tracks'])} tracks" + (f", {dropped} duplicates dropped" if dropped else "")
                + (f", {missing} missing" if missing else ""))
    return "music sets (global): " + "; ".join(one(d) for d in sets)


SUMMARIES: dict[str, Callable[[repertoires.Repertoire, list[int]], str]] = {
    "covers": _sum_covers, "decode": _sum_decode, "quality": _sum_quality, "analyze": _sum_analyze, "snippets": _sum_snippets, "validate": _sum_validate,
    "keys": _sum_keys, "stems": _sum_stems, "signatures": _sum_signatures, "hooks": _sum_hooks, "interval": _sum_interval,
}


# ---------------------------------------------------------------- running

def parse_steps(text: str | None) -> list[Step]:
    if not text:
        return list(STEPS)
    wanted = [s.strip() for s in text.split(",") if s.strip()]
    unknown = [s for s in wanted if s not in STEP_NAMES]
    if unknown:
        raise SystemExit(f"prepare: unknown step(s) {', '.join(unknown)} (steps: {', '.join(STEP_NAMES)})")
    return [s for s in STEPS if s.name in wanted]


def command(step: Step, repertoire: repertoires.Repertoire, songs: list[int]) -> list[str]:
    cmd = [str(step.python), str(ANALYSIS / step.script)]
    if step.takes_repertoire:
        cmd += ["--repertoire", str(repertoire.manifest)]
    if step.per_song:
        for sid in songs:
            cmd += ["--song", str(sid)]
    return cmd


def run_step(step: Step, repertoire: repertoires.Repertoire, songs: list[int]) -> int:
    if not step.python.exists():
        print(f"prepare: {step.name} needs {repertoires.display(step.python)}, which is missing"
              + (f"; set it up with:\n  {step.setup_hint}" if step.setup_hint else ""), file=sys.stderr)
        return 1
    return subprocess.run(command(step, repertoire, songs), cwd=repertoires.REPO, check=False).returncode


def header(repertoire: repertoires.Repertoire) -> list[str]:
    songs = repertoire.songs()
    ids = {s["id"] for s in songs}
    untagged = [s["id"] for s in songs if not s.get("timestamps")]
    try:
        audio = repertoire.audio_files()
        missing = sorted(ids - set(audio))
        audio_line = f"{len(ids) - len(missing)}/{len(ids)} songs have audio in {repertoires.display(repertoire.audio_dir, repertoires.REPO)}"
        if missing:
            audio_line += f" (missing: {', '.join(map(str, missing))})"
    except repertoires.RepertoireError as err:
        audio_line = f"audio: {err}"
    return [
        f"{repertoire.describe()}: {len(songs)} songs from {repertoires.display(repertoire.songs_json, repertoires.REPO)}",
        f"  {audio_line}",
        (f"  hook tags: {len(songs) - len(untagged)}/{len(songs)} songs"
         + (f" (untagged songs are analysed but not playable: {', '.join(map(str, untagged))})" if untagged else "")),
        "  Spotify features: " + (repertoires.display(repertoire.spotify_features) if repertoire.has_spotify
                                  else "none (no tempo or key cross-check)"),
        (f"  outputs: {repertoires.display(repertoire.data_dir)}/, {repertoires.display(repertoire.cache_dir)}/; "
         f"overrides: {repertoires.display(repertoire.overrides_dir)}/"),
    ]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0],
                                 epilog="Steps: " + ", ".join(STEP_NAMES))
    repertoires.add_argument(ap)
    ap.add_argument("--steps", metavar="A,B,...", help="comma-separated steps to run (default: all)")
    ap.add_argument("--song", type=int, action="append", help="limit the per-song steps to this song (repeatable)")
    ap.add_argument("--keep-going", action="store_true", help="run the remaining steps after a failure")
    args = ap.parse_args(argv)
    steps = parse_steps(args.steps)
    repertoire = repertoires.from_args(args)
    try:
        lines = header(repertoire)
        all_ids = repertoire.song_ids()
    except repertoires.RepertoireError as err:
        print(f"prepare: {err}", file=sys.stderr)
        return 1
    unknown = sorted(set(args.song or []) - set(all_ids))
    if unknown:
        print(f"prepare: songs {unknown} are not in the repertoire", file=sys.stderr)
        return 1
    songs = sorted(set(args.song or []))
    print("\n".join(lines), flush=True)

    results: list[tuple[Step, str, float]] = []
    code = 0
    for step in steps:
        print(f"\n── {step.name} " + "─" * max(4, 60 - len(step.name)), flush=True)
        t0 = time.time()
        try:
            rc = run_step(step, repertoire, songs)
        except KeyboardInterrupt:
            results.append((step, "interrupted", time.time() - t0))
            code = 130
            break
        if rc == 0:
            status = "ok"
        elif step.name == "stems" and rc == DISK_GUARD_EXIT:
            status = "STOPPED (disk guard)"
        else:
            status = f"FAILED (exit {rc})"
        results.append((step, status, time.time() - t0))
        if rc != 0:
            code = code or (DISK_GUARD_EXIT if status.startswith("STOPPED") else 1)
            if not args.keep_going:
                break

    ids = songs or all_ids
    print(f"\n── summary: {repertoire.describe()} " + "─" * 20)
    for step, status, seconds in results:
        try:
            note = SUMMARIES[step.name](repertoire, ids)
        except Exception as err:  # a summary must never hide the run's own result
            note = f"(no summary: {type(err).__name__})"
        print(f"  {step.name:<11} {status:<22} {seconds:7.1f} s   {note}")
    not_run = [s.name for s in steps if s.name not in {r[0].name for r in results}]
    if not_run:
        print(f"  not run: {', '.join(not_run)}")
    if code == DISK_GUARD_EXIT:
        print("  The stems disk guard stopped the run (free space under 10 GB, or this repertoire's stems over 4 GB): "
              "free some space and run again; finished songs are skipped.")
    elif code:
        print("  Fix the failure above and run the same command again: finished work is skipped.")
    return code


if __name__ == "__main__":
    sys.exit(main())
