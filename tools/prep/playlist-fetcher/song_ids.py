"""Stable song ids for a playlist that is still changing.

A repertoire keys everything by song id: the audio, the analysis and caches, the hook approvals (overrides) and, once
printed, the cards. So a Spotify track keeps the id it got the first time it was fetched, whatever its position
later; a new track gets the next id never used; a removed track's id is never given to another song. The record
is `song-ids.json` next to songs.json: { "<Spotify id>": id } for every track ever fetched.

Only the standard library, so tools/prep/tests can import it without the fetcher's venv.
"""
from __future__ import annotations

import json
from pathlib import Path


def assign_ids(spotify_ids: list[str], known: dict[str, int]) -> tuple[list[int], dict[str, int]]:
    """The id of each track, in playlist order, and the updated record."""
    if len(set(spotify_ids)) != len(spotify_ids):
        raise ValueError("the playlist lists the same track twice")
    record = dict(known)
    next_id = max(record.values(), default=0) + 1
    for sid in spotify_ids:
        if sid not in record:
            record[sid] = next_id
            next_id += 1
    return [record[sid] for sid in spotify_ids], record


def load(path: Path) -> dict[str, int]:
    return json.loads(path.read_text()) if path.is_file() else {}


def save(path: Path, record: dict[str, int]) -> None:
    path.write_text(json.dumps(dict(sorted(record.items(), key=lambda kv: kv[1])), indent=2) + "\n")
