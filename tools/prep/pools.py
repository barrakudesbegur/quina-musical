"""A repertoire's songs.json from its pools' playlists (D178, D193, D226).

Each pool is a Spotify playlist fetched on its own (tools/prep/playlist-fetcher writes <folder>/output/songs.json).
This step writes the repertoire's songs.json: every song once, with one id unique across the night, and the pools it
is in (D268: "all songs are available in a shared pool"; each pool lists its songs, so a song can be in several).
Each song has `pools`: sorted, one or more (D268's step 3 dropped the old `pool`). What to read is data/repertoires/<name>/pools.json:

    { "pools": [
        { "pool": "1", "songsJson": "data/media/2026/pool1/output/songs.json", "ids": "order", "firstId": 1 },
        { "pool": "2", "songsJson": "data/media/2026/pool2/output/songs.json", "ids": "order", "firstId": 71 } ] }

- `ids: "order"`: numbered from `firstId` in the playlist's order (D103, U57: pool 1 is 1–70, pool 2 from 71). The
  user sorts each playlist by title with an online tool, and every pool's order is checked against its convention
  (U58): letter by letter, accents, case, spaces and punctuation aside, so "AL GOLPITO" comes before "A quién le
  importa" and "Las Divinas" before "L'Empordà"; a leading "The" is a word like any other ("The Fate of Ophelia" under
  T). Each song out of place is reported.
- `ids: "keep"`: the playlist's own ids (the fetcher's stable ids), for a playlist numbered some other way.
- A track listed twice in one playlist keeps its first place. A song already in an earlier pool (the same Spotify
  track, or the same title and first artist) is shared (D268): the later pool is added to the earlier song's `pools`,
  and the song keeps its earlier id and entry; the later pool's own songs are numbered without it, so its ids don't
  move. Both are reported, never silent.
- Every song gets its print names (tools/prep/print_names.py): Spotify's tags off the title, the main artist only,
  then the hand fixes in data/repertoires/<name>/print-names.json (optional; keyed by Spotify id). `printTitle` /
  `printArtist` are written only where they differ from `title` / `artist`; a fix for a track not in the
  repertoire is reported.

Prepared data is keyed by song id: when a playlist change moves ids, run tools/prep/renumber.py (it reads the current
songs.json as the old numbering) before this step writes the new songs.json.

Run: tools/prep/.venv/bin/python tools/prep/pools.py [--repertoire NAME|PATH] [--check]
Only the standard library.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import print_names  # noqa: E402
import repertoire as repertoires  # noqa: E402

POOL_ID_RE = re.compile(r"^[a-z0-9]{1,8}$")
"""The same rule as @quina/protocol's isPoolId."""
ID_MODES = ("keep", "order")


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in text if not unicodedata.combining(c))


def title_key(title: str) -> str:
    """U58's order, as the user's sorting tool has it: letter by letter, accents and case folded, spaces and
    punctuation left out."""
    return re.sub(r"[^0-9a-z]", "", _fold(title))


def song_key(song: dict) -> tuple[str, str]:
    """Two entries are the same song when their titles (without a bracketed or dashed suffix: "(feat. …)",
    "- Remastered") and first artists match, accents, case and punctuation aside: a single and its album track."""
    title = re.sub(r"\s*[(\[].*?[)\]]|\s+-\s+.*$", "", song.get("title", ""))
    artist = song.get("artist", "").split(",")[0]
    clean = lambda s: re.sub(r"[^a-z0-9]+", " ", _fold(s)).strip()  # noqa: E731
    return clean(title), clean(artist)


@dataclass
class PoolSpec:
    pool: str
    songs_json: Path
    ids: str = "keep"
    first_id: int | None = None


@dataclass
class Merged:
    songs: list[dict]
    notes: list[str] = field(default_factory=list)
    # Each song id's own pool, the one whose playlist brought it in: for the summary only, not written (D268).
    origin: dict[int, str] = field(default_factory=dict)


class PoolsError(ValueError):
    pass


def read_spec(path: Path) -> list[PoolSpec]:
    try:
        doc = json.loads(path.read_text())
    except FileNotFoundError:
        raise PoolsError(f"{repertoires.display(path)} not found") from None
    except ValueError as err:
        raise PoolsError(f"{repertoires.display(path)} is not valid JSON: {err}") from None
    pools = doc.get("pools") if isinstance(doc, dict) else None
    if not isinstance(pools, list) or not pools:
        raise PoolsError(f"{repertoires.display(path)}: `pools` must be a non-empty list")
    specs = []
    for i, p in enumerate(pools):
        where = f"{repertoires.display(path)} pools[{i}]"
        if not isinstance(p, dict) or not isinstance(p.get("pool"), str) or not POOL_ID_RE.match(p["pool"]):
            raise PoolsError(f"{where}: `pool` must be a pool id (\"1\", \"2\")")
        if not isinstance(p.get("songsJson"), str):
            raise PoolsError(f"{where}: `songsJson` must be a path")
        ids = p.get("ids", "keep")
        if ids not in ID_MODES:
            raise PoolsError(f"{where}: `ids` must be one of {', '.join(ID_MODES)}")
        first = p.get("firstId")
        if ids == "order" and (not isinstance(first, int) or isinstance(first, bool) or first < 1):
            raise PoolsError(f"{where}: `ids: \"order\"` needs a positive `firstId`")
        specs.append(PoolSpec(p["pool"], repertoires._resolve_path(p["songsJson"]), ids, first))
    if len({s.pool for s in specs}) != len(specs):
        raise PoolsError(f"{repertoires.display(path)}: a pool is listed twice")
    return specs


def merge(pools: list[tuple[PoolSpec, list[dict]]]) -> Merged:
    """Every song once, in pool order, with its night-wide id and its `pools`: a later pool's song that an earlier pool
    already has (the same track, or the same `song_key`) is shared, not repeated (D268)."""
    out: list[dict] = []
    notes: list[str] = []
    by_track: dict[str, dict] = {}
    by_song: dict[tuple[str, str], dict] = {}
    origin: dict[int, str] = {}  # id() of each kept entry → its own pool
    for spec, playlist in pools:
        kept: list[dict] = []
        in_this: set[str] = set()
        for position, song in enumerate(playlist, start=1):
            track = song.get("spotifyId")
            if track and track in in_this:
                notes.append(f"pool {spec.pool} #{position} \"{song.get('title')}\" ({song.get('artist')}): listed twice in its playlist; kept once")
                continue
            if track:
                in_this.add(track)
            earlier = (by_track.get(track) if track else None) or by_song.get(song_key(song))
            if earlier is None:
                kept.append(song)
                continue
            # The earlier entry wins: its id, names and fields; this pool only joins its `pools`.
            if spec.pool not in earlier["pools"]:
                earlier["pools"] = sorted([*earlier["pools"], spec.pool])
            notes.append(f"pool {spec.pool} #{position} «{song.get('title')}»: shared with pool {origin[id(earlier)]} (#{earlier.get('id')})")
        for song in out_of_order(kept):
            notes.append(f"pool {spec.pool} \"{song.get('title')}\" ({song.get('artist')}): out of title order")
        if spec.ids == "order":
            numbered = [{**s, "id": spec.first_id + i, "pools": [spec.pool]} for i, s in enumerate(kept)]
        else:
            numbered = [{**s, "pools": [spec.pool]} for s in kept]
        for s in numbered:
            origin[id(s)] = spec.pool
            if s.get("spotifyId"):
                by_track.setdefault(s["spotifyId"], s)
            by_song.setdefault(song_key(s), s)
        out.extend(numbered)
    ids = [s.get("id") for s in out]
    bad = [i for i in ids if not isinstance(i, int) or isinstance(i, bool) or i < 1]
    if bad:
        raise PoolsError(f"songs without a positive id: {bad[:5]}")
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        raise PoolsError(f"two pools give the same song id: {dupes[:10]} (move a pool's firstId past the earlier pools)")
    return Merged(out, notes, {s["id"]: origin[id(s)] for s in out})


def with_print_names(merged: Merged, fixes: dict[str, dict]) -> Merged:
    """The merged songs with their print names: the rules, then the fixes by Spotify id; an unused fix is a note."""
    named = print_names.apply(merged.songs, fixes)
    return Merged(named.songs, merged.notes + named.warnings, merged.origin)


def out_of_order(songs: list[dict]) -> list[dict]:
    """The songs a title sort would move: each one that comes before the song above it (U58's convention)."""
    keys = [title_key(s.get("title", "")) for s in songs]
    return [songs[i] for i in range(1, len(songs)) if keys[i] < keys[i - 1]]


def pools_path(repertoire: repertoires.Repertoire) -> Path:
    return repertoires.REPERTOIRES_DIR / repertoire.name / "pools.json"


def print_names_path(repertoire: repertoires.Repertoire) -> Path:
    return repertoires.REPERTOIRES_DIR / repertoire.name / "print-names.json"


def build(repertoire: repertoires.Repertoire) -> tuple[list[PoolSpec], Merged, dict[str, dict]]:
    """The repertoire's pools merged, with their print names: what main writes as songs.json (tools/prep/renumber.py
    reads it too). Raises PoolsError or print_names.PrintNamesError."""
    specs = read_spec(pools_path(repertoire))
    playlists = []
    for spec in specs:
        try:
            playlists.append((spec, json.loads(spec.songs_json.read_text())))
        except FileNotFoundError:
            raise PoolsError(f"pool {spec.pool}: {repertoires.display(spec.songs_json)} not found (fetch its playlist first)") from None
    fixes = print_names.read_fixes(print_names_path(repertoire))
    return specs, with_print_names(merge(playlists), fixes), fixes


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    repertoires.add_argument(ap)
    ap.add_argument("--check", action="store_true", help="report without writing songs.json")
    args = ap.parse_args()
    repertoire = repertoires.from_args(args)
    try:
        specs, merged, fixes = build(repertoire)
    except (PoolsError, print_names.PrintNamesError) as err:
        sys.exit(f"pools error: {err}")
    for note in merged.notes:
        print(f"⚠️  {note}")
    for spec in specs:
        ids = [s["id"] for s in merged.songs if spec.pool in s["pools"]]
        own = [s["id"] for s in merged.songs if merged.origin.get(s["id"]) == spec.pool]
        span = f"own ids {min(own)}–{max(own)}" if own else "no own songs"
        print(f"pool {spec.pool}: {len(ids)} songs, {len(ids) - len(own)} of them shared with an earlier pool; {span} ({spec.ids})")
    shared = [s["id"] for s in merged.songs if len(s["pools"]) > 1]
    print(f"{len(merged.songs)} songs, {len(shared)} in more than one pool: {', '.join(map(str, shared)) or 'none'}")
    renamed = sum(1 for s in merged.songs if "printTitle" in s or "printArtist" in s)
    print(f"print names: {renamed} of {len(merged.songs)} songs print differently ({len(fixes)} hand fixes)")
    if args.check:
        return 0
    repertoire.songs_json.parent.mkdir(parents=True, exist_ok=True)
    repertoire.songs_json.write_text(json.dumps(merged.songs, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {repertoires.display(repertoire.songs_json)} ({len(merged.songs)} songs)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
