"""Stable song ids for a changing playlist (tools/prep/playlist-fetcher/song_ids.py)."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "playlist-fetcher"))
import song_ids  # noqa: E402


def test_first_fetch_numbers_the_playlist_in_order():
    ids, record = song_ids.assign_ids(["a", "b", "c"], {})
    assert ids == [1, 2, 3]
    assert record == {"a": 1, "b": 2, "c": 3}


def test_a_reordered_playlist_keeps_every_id_and_new_tracks_get_new_ones():
    _, record = song_ids.assign_ids(["a", "b", "c"], {})
    ids, record = song_ids.assign_ids(["c", "d", "a"], record)
    assert ids == [3, 4, 1]
    # b left the playlist: its id is never given to another track, and it gets it back if it returns.
    ids, record = song_ids.assign_ids(["e", "b"], record)
    assert ids == [5, 2]
    assert record == {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5}


def test_the_same_track_twice_is_refused():
    with pytest.raises(ValueError, match="same track twice"):
        song_ids.assign_ids(["a", "a"], {})


def test_the_record_round_trips(tmp_path):
    path = tmp_path / "song-ids.json"
    assert song_ids.load(path) == {}
    song_ids.save(path, {"b": 2, "a": 1})
    assert song_ids.load(path) == {"a": 1, "b": 2}
