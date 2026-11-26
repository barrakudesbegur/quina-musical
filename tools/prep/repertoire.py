"""Song repertoires: which songs the offline preparation works on, and where each repertoire's files live.

A Repertoire is an edition's prepared songs, all prepared together (GLOSSARY.md, D178): it holds the edition's
pools (Pool 1, Pool 2), each song tagged with its `pool`. Song ids are unique within a repertoire and restart at 1 in
every repertoire, so each repertoire keeps its own data, cache and overrides. A repertoire is described by a manifest,
data/repertoires/<name>.json; apps/show/README.md › "Repertoires" documents the format, and
apps/show/relay/repertoire.ts is the TypeScript twin of this module (tools/prep/tests/test_repertoire.py checks that
both resolve a manifest to the same paths).

Every repertoire-specific script takes --repertoire <name|path>. Without it: $QUINA_REPERTOIRE, then "default".

    tools/prep/.venv/bin/python tools/prep/repertoire.py [--repertoire NAME|PATH]   # print the resolved paths as JSON

Only the standard library: tools/prep/.venv-stems imports this module too.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

PREP = Path(__file__).resolve().parent
"""tools/prep: this pipeline (its venvs live here)."""
REPO = PREP.parent.parent
"""The repo root: manifests' relative paths, and the paths generated files store, resolve against it."""
SHOW = REPO / "apps" / "show"
DATA = REPO / "data"
REPERTOIRES_DIR = DATA / "repertoires"
"""Repertoire manifests, each repertoire's songs list and hand overrides (tracked)."""
MEDIA = DATA / "media"
"""Audio and covers: songs, effects, stingers, Hold music, celebration, Interval, covers."""
OUT = DATA / "out"
"""What the preparation writes: analysis, stems and keys metadata, Signatures, Hold and Interval indexes."""
CACHE = DATA / "cache"
"""Decoded audio, stems, Signatures, Blend renders, Hold and Interval audio."""
ENV_VAR = "QUINA_REPERTOIRE"
DEFAULT_REPERTOIRE = "default"
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")

REQUIRED = ("name", "songsJson", "audioDir")
OPTIONAL = ("description", "coversDir", "cardsJson", "spotifyFeatures", "dataDir", "cacheDir", "overridesDir")
# Source audio: <id>.<ext>, or the playlist-fetcher's (spotDL's) "<position> <title> - <artist>.<ext>".
AUDIO_EXTS = (".mp3", ".m4a", ".opus", ".ogg", ".flac", ".wav")
_AUDIO_NAME_RE = re.compile(r"^0*([1-9]\d*)(?:\s.*)?$")


class RepertoireError(Exception):
    """A missing or malformed manifest, songs.json or audio folder."""


def _resolve_path(value: str) -> Path:
    """Manifest paths: absolute as they are, relative ones against the repo root (no symlink resolution)."""
    return Path(os.path.normpath(os.path.join(REPO, value)))


def display(path: Path, base: Path = REPO) -> str:
    """`path` relative to `base` when inside it (POSIX separators), else absolute."""
    try:
        return path.relative_to(base).as_posix()
    except ValueError:
        return str(path)


@dataclass(frozen=True)
class Repertoire:
    name: str
    manifest: Path
    songs_json: Path
    audio_dir: Path
    covers_dir: Path
    cards_json: Path | None
    spotify_features: Path
    data_dir: Path
    cache_dir: Path
    overrides_dir: Path
    description: str = ""

    # ---------------------------------------------------------------- outputs (derived, fixed layout)
    @property
    def analysis_dir(self) -> Path:
        return self.data_dir / "analysis"

    @property
    def analysis_index(self) -> Path:
        return self.analysis_dir / "index.json"

    @property
    def report_path(self) -> Path:
        return self.data_dir / "report.md"

    @property
    def keys_dir(self) -> Path:
        return self.data_dir / "keys"

    @property
    def stems_dir(self) -> Path:
        return self.data_dir / "stems"

    @property
    def signatures_dir(self) -> Path:
        return self.data_dir / "signatures"

    @property
    def key_cache_dir(self) -> Path:
        return self.cache_dir / "keys"

    @property
    def stretch_dir(self) -> Path:
        return self.cache_dir / "stretch"

    def song_cache(self, song_id: int) -> Path:
        return self.cache_dir / str(song_id)

    def mix_flac(self, song_id: int) -> Path:
        return self.song_cache(song_id) / "mix.flac"

    def stems_cache(self, song_id: int) -> Path:
        return self.song_cache(song_id) / "stems"

    def signatures_cache(self, song_id: int) -> Path:
        return self.song_cache(song_id) / "signatures"

    def override_path(self, song_id: int) -> Path:
        return self.overrides_dir / f"{song_id}.json"

    def cover_path(self, song_id: int) -> Path:
        return self.covers_dir / f"{song_id}.jpg"

    # ---------------------------------------------------------------- inputs
    def songs(self) -> list[dict]:
        """songs.json, checked: a list of {id, title, artist, timestamps?: [{time, tag?}], ...}."""
        try:
            songs = json.loads(self.songs_json.read_text())
        except FileNotFoundError:
            raise RepertoireError(f"repertoire {self.name}: songs.json not found: {self.songs_json}") from None
        except ValueError as err:
            raise RepertoireError(f"repertoire {self.name}: {self.songs_json} is not valid JSON: {err}") from None
        if not isinstance(songs, list):
            raise RepertoireError(f"repertoire {self.name}: {self.songs_json} must be a list of songs")
        seen: set[int] = set()
        for i, song in enumerate(songs):
            where = f"repertoire {self.name}: {display(self.songs_json, REPO)} entry {i}"
            if not isinstance(song, dict):
                raise RepertoireError(f"{where} is not an object")
            sid = song.get("id")
            if not isinstance(sid, int) or isinstance(sid, bool) or sid < 1:
                raise RepertoireError(f"{where}: id must be a positive integer, got {sid!r}")
            if sid in seen:
                raise RepertoireError(f"{where}: duplicate id {sid}")
            seen.add(sid)
            for key in ("title", "artist"):
                if not isinstance(song.get(key), str):
                    raise RepertoireError(f"{where} (id {sid}): {key} must be a string")
            stamps = song.get("timestamps")
            if stamps is None:
                continue
            if not isinstance(stamps, list):
                raise RepertoireError(f"{where} (id {sid}): timestamps must be a list of {{time, tag}}")
            for stamp in stamps:
                ok = isinstance(stamp, dict) and isinstance(stamp.get("time"), (int, float)) \
                    and not isinstance(stamp.get("time"), bool) and stamp["time"] >= 0 \
                    and isinstance(stamp.get("tag", "main"), str)
                if not ok:
                    raise RepertoireError(f"{where} (id {sid}): bad timestamp {stamp!r} (want {{time: seconds, tag}})")
        return songs

    def song_ids(self) -> list[int]:
        return [song["id"] for song in self.songs()]

    @property
    def has_spotify(self) -> bool:
        return self.spotify_features.is_file()

    def spotify(self) -> dict:
        """Spotify audio features by song id (as a string); {} when the repertoire has none."""
        if not self.has_spotify:
            return {}
        try:
            songs = json.loads(self.spotify_features.read_text()).get("songs", {})
        except (ValueError, AttributeError) as err:
            raise RepertoireError(f"repertoire {self.name}: unreadable {self.spotify_features}: {err}") from None
        if not isinstance(songs, dict):
            raise RepertoireError(f"repertoire {self.name}: {self.spotify_features}: `songs` must be an object")
        return songs

    def audio_files(self) -> dict[int, Path]:
        """Source audio by song id. `<id>.mp3`, or `<spotifyId>.mp3` for a song whose songs.json entry has that
        `spotifyId` (the playlist fetcher's names: they survive a reordered playlist), wins over a
        "<id> <title> - <artist>.mp3" name; two candidates of the same kind for one id are an error. A file
        named after a Spotify id that isn't in songs.json (a song taken off the playlist) is ignored."""
        if not self.audio_dir.is_dir():
            raise RepertoireError(f"repertoire {self.name}: audio folder not found: {self.audio_dir}")
        by_spotify = {s["spotifyId"]: s["id"] for s in self.songs() if isinstance(s.get("spotifyId"), str)} \
            if self.songs_json.is_file() else {}
        exact: dict[int, list[Path]] = {}
        named: dict[int, list[Path]] = {}
        for path in sorted(self.audio_dir.iterdir()):
            if path.name.startswith(".") or path.suffix.lower() not in AUDIO_EXTS or not path.is_file():
                continue
            if path.stem in by_spotify:
                exact.setdefault(by_spotify[path.stem], []).append(path)
                continue
            match = _AUDIO_NAME_RE.match(path.stem)
            if not match:
                continue
            sid = int(match.group(1))
            (exact if path.stem == str(sid) else named).setdefault(sid, []).append(path)
        out: dict[int, Path] = {}
        for sid in sorted(set(exact) | set(named)):
            candidates = exact.get(sid) or named[sid]
            if len(candidates) > 1:
                names = ", ".join(p.name for p in candidates)
                raise RepertoireError(f"repertoire {self.name}: several audio files for song {sid}: {names}")
            out[sid] = candidates[0]
        return out

    # ---------------------------------------------------------------- display
    def describe(self) -> str:
        return f"repertoire {self.name} ({display(self.manifest)})"

    def to_json(self) -> dict:
        """The resolved manifest, as relay/repertoire.ts resolves it."""
        return {
            "name": self.name,
            "manifest": str(self.manifest),
            "songsJson": str(self.songs_json),
            "audioDir": str(self.audio_dir),
            "coversDir": str(self.covers_dir),
            "cardsJson": str(self.cards_json) if self.cards_json else None,
            "spotifyFeatures": str(self.spotify_features),
            "dataDir": str(self.data_dir),
            "cacheDir": str(self.cache_dir),
            "overridesDir": str(self.overrides_dir),
        }


def manifest_path(spec: str) -> Path:
    """A repertoire name → data/repertoires/<name>.json; anything with a slash or ending in .json → that file
    (relative to the working directory)."""
    if "/" in spec or os.sep in spec or spec.endswith(".json"):
        return Path(os.path.abspath(spec))
    if not NAME_RE.match(spec):
        raise RepertoireError(f"bad repertoire name {spec!r}: use lowercase letters, digits, - and _ (or a path to a manifest)")
    return REPERTOIRES_DIR / f"{spec}.json"


def available() -> list[str]:
    return sorted(p.stem for p in REPERTOIRES_DIR.glob("*.json"))


def load(spec: str | os.PathLike | None = None) -> Repertoire:
    """The repertoire named or pointed to by `spec`, else $QUINA_REPERTOIRE, else "default"."""
    spec = os.fspath(spec) if spec else (os.environ.get(ENV_VAR) or DEFAULT_REPERTOIRE)
    path = manifest_path(spec)
    by_name = path.parent == REPERTOIRES_DIR and path.stem == spec
    if not path.is_file():
        hint = f"available: {', '.join(available()) or 'none'}" if by_name else "no such file"
        raise RepertoireError(f"no repertoire manifest {display(path)} ({hint}); see README.md › Repertoires")
    try:
        doc = json.loads(path.read_text())
    except ValueError as err:
        raise RepertoireError(f"{display(path)} is not valid JSON: {err}") from None
    if not isinstance(doc, dict):
        raise RepertoireError(f"{display(path)} must be a JSON object")
    unknown = sorted(set(doc) - set(REQUIRED) - set(OPTIONAL))
    if unknown:
        raise RepertoireError(f"{display(path)}: unknown field(s) {', '.join(unknown)} "
                        f"(fields: {', '.join(REQUIRED + OPTIONAL)})")
    missing = [k for k in REQUIRED if not doc.get(k)]
    if missing:
        raise RepertoireError(f"{display(path)}: missing {', '.join(missing)}")
    for key in REQUIRED + OPTIONAL:
        if key in doc and not isinstance(doc[key], str):
            raise RepertoireError(f"{display(path)}: {key} must be a string")
    name = doc["name"]
    if not NAME_RE.match(name):
        raise RepertoireError(f"{display(path)}: bad name {name!r} (lowercase letters, digits, - and _)")
    if path.parent == REPERTOIRES_DIR and path.stem != name:
        raise RepertoireError(f"{display(path)}: name {name!r} must match the file name")

    def opt(key: str, fallback: str) -> Path:
        return _resolve_path(doc.get(key) or fallback)

    # Outputs default to data/out and data/cache, never to data/repertoires, which holds the tracked inputs.
    data_dir = opt("dataDir", f"data/out/repertoires/{name}")
    cache_dir = opt("cacheDir", f"data/cache/repertoires/{name}")
    return Repertoire(
        name=name,
        manifest=path,
        songs_json=_resolve_path(doc["songsJson"]),
        audio_dir=_resolve_path(doc["audioDir"]),
        covers_dir=opt("coversDir", str(cache_dir / "covers")),
        cards_json=_resolve_path(doc["cardsJson"]) if doc.get("cardsJson") else None,
        spotify_features=opt("spotifyFeatures", str(data_dir / "spotify_features.json")),
        data_dir=data_dir,
        cache_dir=cache_dir,
        overrides_dir=opt("overridesDir", f"data/repertoires/{name}/overrides"),
        description=doc.get("description", ""),
    )


def add_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--repertoire", metavar="NAME|PATH",
                        help=f"repertoire name (data/repertoires/<name>.json) or manifest path; default ${ENV_VAR}, "
                             f"then {DEFAULT_REPERTOIRE!r}")


def from_args(args: argparse.Namespace) -> Repertoire:
    """The repertoire for a script's parsed arguments; a repertoire error ends the script with a clear message."""
    try:
        return load(getattr(args, "repertoire", None))
    except RepertoireError as err:
        sys.exit(f"repertoire error: {err}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Print a repertoire's resolved paths as JSON.")
    add_argument(ap)
    repertoire = from_args(ap.parse_args())
    print(json.dumps(repertoire.to_json(), indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
