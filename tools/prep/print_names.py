"""Print names: each song's clean title and artist, the same on the cards, the phones and the projector.

The user (27 Nov): "clean the song titles, and also artists (many times it is fine to not put all, it is just for
reference doesnt need to be fully accurate)". The rules, first written by the card design session
(tools/card-mockup/print-titles.py), are:

- the title loses Spotify's tags: a dashed suffix (" - Remastered 2016", " - Radio Edit", " - From “Grease”") and any
  bracket holding a tag word ("(feat. Nayer)", "(Felix Jaehn Remix)", "(versión …)"); other brackets stay
  ("Only Girl (In The World)");
- the artist is the main one, the first of Spotify's comma-separated list.

Where the rules get it wrong, a hand fix wins: data/repertoires/<name>/print-names.json, keyed by Spotify id so a
renumbered playlist can't move a fix onto another song:

    { "<spotifyId>": { "printTitle"?: "...", "printArtist"?: "...", "note": "who asked, and why" } }

A song carries `printTitle` / `printArtist` only when they differ from its `title` / `artist`, so a reader shows
`printTitle ?? title`. tools/prep/pools.py applies them when it writes the repertoire's songs.json.
Only the standard library; pure functions apart from read_fixes.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

TAG = r"(remaster|remasterizado|version|versión|edit|mix|from |feat\.|ft\.|with |prod\.|live|en directo|mono|stereo|bonus|single|acoustic|deluxe)"
"""Brackets holding these words are tags, not part of the title."""
_DASHED = re.compile(r"\s+-\s+.*$")
_TAGGED_BRACKET = re.compile(r"\s*[\(\[][^\)\]]*" + TAG + r"[^\)\]]*[\)\]]", re.I)
FIX_FIELDS = ("printTitle", "printArtist")


class PrintNamesError(ValueError):
    """A malformed fixes file."""


def clean_title(title: str) -> str:
    """Spotify's tags off: the dashed suffix, then every bracket that holds a tag word. A title that would be left
    empty stays as it is."""
    cleaned = _TAGGED_BRACKET.sub("", _DASHED.sub("", title)).strip()
    return cleaned or title


def main_artist(artist: str) -> str:
    """The first of Spotify's comma-separated artists."""
    return artist.split(",")[0].strip()


@dataclass
class Applied:
    songs: list[dict]
    warnings: list[str] = field(default_factory=list)


def check_fixes(doc: object, where: str = "print-names.json") -> dict[str, dict]:
    """The fixes file's shape: an object of Spotify id → { printTitle?, printArtist?, note? }, each a non-empty
    string, at least one of the two print fields."""
    if not isinstance(doc, dict):
        raise PrintNamesError(f"{where}: an object of Spotify id → {{ printTitle?, printArtist?, note }}")
    fixes: dict[str, dict] = {}
    for sid, fix in doc.items():
        at = f"{where} {sid!r}"
        if not isinstance(fix, dict):
            raise PrintNamesError(f"{at}: an object")
        unknown = set(fix) - {*FIX_FIELDS, "note"}
        if unknown:
            raise PrintNamesError(f"{at}: unknown field(s) {', '.join(sorted(unknown))}")
        for key, value in fix.items():
            if not isinstance(value, str) or not value.strip():
                raise PrintNamesError(f"{at}.{key}: a non-empty string")
        if not any(k in fix for k in FIX_FIELDS):
            raise PrintNamesError(f"{at}: needs printTitle or printArtist")
        fixes[sid] = {k: fix[k] for k in FIX_FIELDS if k in fix}
    return fixes


def read_fixes(path: Path) -> dict[str, dict]:
    """A repertoire's fixes; none (no file) is no fixes."""
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    try:
        doc = json.loads(text)
    except ValueError as err:
        raise PrintNamesError(f"{path.name} is not valid JSON: {err}") from None
    return check_fixes(doc, path.name)


def print_names(song: dict, fix: dict | None = None) -> dict:
    """The song's printTitle / printArtist: the rules, then the fix; a field only where it differs."""
    title, artist = song.get("title", ""), song.get("artist", "")
    names = {"printTitle": clean_title(title), "printArtist": main_artist(artist), **(fix or {})}
    out = {}
    if names["printTitle"] != title:
        out["printTitle"] = names["printTitle"]
    if names["printArtist"] != artist:
        out["printArtist"] = names["printArtist"]
    return out


def apply(songs: list[dict], fixes: dict[str, dict]) -> Applied:
    """Every song with its print names (any it had before are recomputed); a fix for a track not in the songs warns."""
    out = []
    for s in songs:
        base = {k: v for k, v in s.items() if k not in FIX_FIELDS}
        out.append({**base, **print_names(base, fixes.get(s.get("spotifyId") or ""))})
    present = {s.get("spotifyId") for s in songs}
    warnings = [f"print-names.json: {sid} isn't a song of this repertoire; its fix is unused"
                for sid in fixes if sid not in present]
    return Applied(out, warnings)
