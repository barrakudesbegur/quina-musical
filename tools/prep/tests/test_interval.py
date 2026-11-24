"""The Interval playlist (analysis/interval.py): matching files to playlist.spotdl, playing a recording once, the
slugs, the edges; then the whole step on three synthetic tracks in a temp dir (one of them a duplicate).

Nothing here reads the real playlist: its audio is copyrighted and gitignored.
"""
from __future__ import annotations

import json

import numpy as np
import pytest
from conftest import needs_ffmpeg, run_script, synth_song

import interval as iv

# The real playlist's shape: spotDL entries with `list_position`; #4 and #16 are one recording, #15 has no file.
PLAYLIST = [
    {"name": "Apartment Theme - Style Savvy Bitcrushed Old Speaker Lofi Mix", "artists": ["Nostalgiacore"],
     "artist": "Nostalgiacore", "duration": 186, "list_position": 1, "song_id": "a1", "list_name": "[Intermedi]"},
    {"name": "New Look - Wii U Mii Maker Lofi Mix", "artists": ["Secret Potion", "Nostalgiacore"],
     "artist": "Secret Potion", "duration": 162, "list_position": 4, "song_id": "n4"},
    {"name": "Island Broadcast (From \"Animal Crossing: New Horizons\") [Cover]", "artists": ["Masters of Sound"],
     "artist": "Masters of Sound", "duration": 89, "list_position": 15, "song_id": "i15"},
    {"name": "New Look (Wii U Mii Maker Lofi Mix)", "artists": ["Secret Potion"], "artist": "Secret Potion",
     "duration": 162, "list_position": 16, "song_id": "n16"},
    {"name": "Beedle's Shop (From \"The Legend Of Zelda: The Wind Waker\")", "artists": ["Good Knight Productions"],
     "artist": "Good Knight Productions", "duration": 208, "list_position": 14, "song_id": "b14"},
]
FILES = [
    "01 Apartment Theme - Style Savvy Bitcrushed Old Speaker Lofi Mix - Nostalgiacore.mp3",
    "04 New Look - Wii U Mii Maker Lofi Mix - Secret Potion.mp3",
    "14 Beedle's Shop (From 'The Legend Of Zelda- The Wind Waker') - Good Knight Productions.mp3",
    "16 New Look (Wii U Mii Maker Lofi Mix) - Secret Potion.mp3",
    "20 Extra Track - Somebody.mp3",
]


def test_file_names_are_parsed_the_spotdl_way():
    assert iv.parse_file_name(FILES[1]) == (4, "New Look - Wii U Mii Maker Lofi Mix", "Secret Potion")
    assert iv.parse_file_name("ditto - frad.flac") == (None, "ditto", "frad")
    assert iv.parse_file_name("07 untitled.mp3") == (7, "untitled", "")


def test_files_take_their_title_and_artist_from_the_playlist():
    playlist = iv.read_playlist(json.dumps(PLAYLIST))
    tracks, missing = iv.match_tracks(FILES, playlist)
    assert [t.position for t in tracks] == [1, 4, 14, 16, 20]
    beedle = tracks[2]
    assert beedle.title == "Beedle's Shop (From \"The Legend Of Zelda: The Wind Waker\")"  # not the file's sanitized one
    assert (beedle.artist, beedle.spotify_id, beedle.duration_sec) == ("Good Knight Productions", "b14", 208.0)
    assert tracks[1].artists == ["Secret Potion", "Nostalgiacore"]
    extra = tracks[4]
    assert (extra.title, extra.artist, extra.spotify_id) == ("Extra Track", "Somebody", None)  # no entry: its name
    assert missing == [{"position": 15, "title": PLAYLIST[2]["name"], "artist": "Masters of Sound"}]
    assert iv.read_playlist(json.dumps({"songs": PLAYLIST[:1]})) == {1: PLAYLIST[0]}
    assert iv.read_playlist("[1, {\"name\": \"no position\"}]") == {}


def test_a_recording_plays_once():
    tracks, _ = iv.match_tracks(FILES, iv.read_playlist(json.dumps(PLAYLIST)))
    kept, dropped = iv.dedupe(tracks)
    assert [t.position for t in kept] == [1, 4, 14, 20]
    assert [(t.position, t.duplicate_of, t.duplicate_reason) for t in dropped] == [(16, 4, "same title, artist and duration")]
    # The same title and artist but another length is another recording (a remix, an extended mix).
    a = iv.Track("a.mp3", 1, "Song", "Band", ["Band"], duration_sec=180.0)
    b = iv.Track("b.mp3", 2, "Song!", "band", ["band"], duration_sec=240.0)
    c = iv.Track("c.mp3", 3, "song", "BAND", ["BAND"], duration_sec=181.2)
    kept, dropped = iv.dedupe([a, b, c])
    assert [t.file for t in kept] == ["a.mp3", "b.mp3"] and [t.file for t in dropped] == ["c.mp3"]
    assert iv.norm("New Look (Wii U Mii Maker Lofi Mix)") == iv.norm("New Look - Wii U Mii Maker Lofi Mix")
    assert iv.norm("Beedle’s Café Niño") == "beedles cafe nino"


def test_slugs_are_short_unique_and_safe():
    taken: set[str] = set()
    assert iv.slugify("cupcake.", "Carpe", taken) == "cupcake-carpe"
    assert iv.slugify("Beedle's Shop (From \"The Legend Of Zelda: The Wind Waker\")", "Good Knight Productions", taken) \
        == "beedles-shop-from-the-legend-of-zelda-the-wind-waker"  # the artist only when it fits whole
    assert iv.slugify("cupcake", "Carpe", taken) == "cupcake-carpe-2"
    assert iv.slugify("cupcake", "Carpe", taken) == "cupcake-carpe-3"
    assert iv.slugify("¿¡!?", "", taken) == "track"
    long = iv.slugify("a" * 70, "b", taken)
    assert long == "a" * iv.SLUG_MAX
    assert iv.slugify("a" * 70, "b", taken) == "a" * (iv.SLUG_MAX - 2) + "-2"
    assert all(len(s) <= iv.SLUG_MAX and s == s.lower() for s in taken)


def test_edges_find_the_sound_its_fade_and_the_first_downbeat():
    sr = 1000
    t = np.arange(int(20 * sr)) / sr
    level = np.where((t >= 1) & (t < 17), 1.0, 0.0)
    level = np.where((t >= 14) & (t < 17), 1.0 - (t - 14) / 3, level)  # a 3 s fade to silence
    tone = 0.3 * np.sin(2 * np.pi * 110 * t) * level
    signal = np.stack([tone, tone], axis=1).astype(np.float32)
    edges = iv.edges(signal, sr, np.array([-0.004, 1.0, 3.0, 5.0]))
    assert edges["startSec"] == pytest.approx(1.0, abs=0.02)
    assert edges["endSec"] == pytest.approx(16.9, abs=0.15)
    assert 14.0 <= edges["fadeStartSec"] <= 16.0
    assert edges["firstDownbeatSec"] == 1.0
    assert iv.edges(signal, sr, np.array([]))["firstDownbeatSec"] is None
    starts_at_zero = np.stack([0.3 * np.sin(2 * np.pi * 110 * t)] * 2, axis=1).astype(np.float32)
    assert iv.edges(starts_at_zero, sr, np.array([-0.004, 2.0]))["firstDownbeatSec"] == 0.0  # the grid reached before 0


def test_the_same_envelope_is_the_same_recording():
    rng = np.random.default_rng(3)
    a = rng.normal(-20, 4, 300)
    shifted = np.concatenate([rng.normal(-60, 0.1, 4), a])[:300] + rng.normal(0, 0.3, 300)  # 2 s later, re-encoded
    assert iv.same_recording(a, shifted) > iv.SAME_ENVELOPE_CORR
    assert iv.same_recording(a, rng.normal(-20, 4, 300)) < 0.5
    assert iv.same_recording(np.full(50, -20.0), np.full(50, -20.0)) == -1.0  # flat: no evidence


@needs_ffmpeg
def test_the_step_on_a_synthetic_playlist(tmp_path):
    source, out, cache = tmp_path / "interval", tmp_path / "data", tmp_path / "cache"
    synth_song(source / "01 First Groove - Test Band.mp3", 0.5, seconds=24)
    synth_song(source / "02 Second Groove - Other Band.mp3", 0.6, seconds=24)
    synth_song(source / "03 First Groove - Test Band.mp3", 0.5, seconds=24)  # the playlist has it twice
    entries = [
        {"name": "First Groove", "artist": "Test Band", "artists": ["Test Band"], "list_position": 1, "duration": 24},
        {"name": "Second Groove", "artist": "Other Band", "artists": ["Other Band"], "list_position": 2, "duration": 24},
        {"name": "First Groove", "artist": "Test Band", "artists": ["Test Band"], "list_position": 3, "duration": 24},
        {"name": "Not Downloaded", "artist": "Nobody", "artists": ["Nobody"], "list_position": 4, "duration": 60},
    ]
    (source / iv.PLAYLIST).write_text(json.dumps(entries))
    args = ("--source", str(source), "--out", str(out), "--cache", str(cache))
    first = run_script("interval.py", *args)
    assert first.returncode == 0, first.stdout + first.stderr
    index = json.loads((out / "index.json").read_text())
    assert [t["slug"] for t in index["tracks"]] == ["first-groove-test-band", "second-groove-other-band"]
    assert [(d["position"], d["duplicateOf"]) for d in index["dropped"]] == [(3, 1)]
    assert [m["position"] for m in index["missing"]] == [4]
    assert not (cache / "first-groove-test-band-2.flac").exists()  # a duplicate is never decoded
    track = json.loads((out / "first-groove-test-band.json").read_text())
    assert track["title"] == "First Groove" and track["sampleRate"] == 48000 and track["position"] == 1
    assert track["tempo"]["bpm"] == pytest.approx(120, rel=0.03)
    assert len(track["downbeats"]) >= 8 and track["edges"]["firstDownbeatSec"] is not None
    assert track["edges"]["startSec"] < 0.5 and track["edges"]["endSec"] > 23
    assert (cache / "first-groove-test-band.flac").exists() and track["pcm"] == "cache/interval/first-groove-test-band.flac"
    assert "gainToTargetDb" in track["loudness"]

    again = run_script("interval.py", *args)
    assert again.returncode == 0
    assert again.stdout.count("up to date") == 2
    assert json.loads((out / "index.json").read_text()) == index
