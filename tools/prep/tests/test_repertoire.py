"""Repertoire resolution (tools/prep/repertoire.py) and its TypeScript twin (apps/show/relay/repertoire.ts)."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import repertoire as repertoires
import pytest
from conftest import run_script, write_manifest

REPO = repertoires.REPO


@pytest.fixture
def repertoires_dir(tmp_path, monkeypatch):
    """A private data/repertoires/ so name lookups never touch the real one."""
    d = tmp_path / "repertoires"
    d.mkdir()
    monkeypatch.setattr(repertoires, "REPERTOIRES_DIR", d)
    monkeypatch.delenv(repertoires.ENV_VAR, raising=False)
    return d


def named_manifest(repertoires_dir: Path, name: str, **fields) -> Path:
    path = repertoires_dir / f"{name}.json"
    path.write_text(json.dumps({"name": name, "songsJson": "in/songs.json", "audioDir": "in/songs", **fields}))
    return path


# ---------------------------------------------------------------- the default repertoire

def test_default_repertoire_points_at_the_existing_locations(monkeypatch):
    monkeypatch.delenv(repertoires.ENV_VAR, raising=False)
    p = repertoires.load()
    assert p.name == "default"
    assert p.manifest == REPO / "data/repertoires/default.json"
    assert p.songs_json == REPO / "data/repertoires/default/songs.json"
    assert p.audio_dir == REPO / "data/media/song"
    assert p.covers_dir == REPO / "data/media/covers"
    assert p.cards_json == REPO / "apps/cards/dist/cards.json"
    assert p.spotify_features == REPO / "data/out/spotify_features.json"
    assert (p.data_dir, p.cache_dir, p.overrides_dir) == (REPO / "data/out", REPO / "data/cache", REPO / "data/repertoires/default/overrides")
    assert p.analysis_dir == REPO / "data/out/analysis"
    assert p.mix_flac(12) == REPO / "data/cache/12/mix.flac"
    assert p.signatures_cache(12) == REPO / "data/cache/12/signatures"
    assert repertoires.display(p.stems_cache(12)) == "data/cache/12/stems"  # stems.py's pathTemplate, relative to the repo


# ---------------------------------------------------------------- precedence: --repertoire, $QUINA_REPERTOIRE, default

def test_precedence_spec_then_env_then_default(repertoires_dir, monkeypatch):
    named_manifest(repertoires_dir, "default")
    named_manifest(repertoires_dir, "next")
    named_manifest(repertoires_dir, "other")
    assert repertoires.load().name == "default"
    monkeypatch.setenv(repertoires.ENV_VAR, "next")
    assert repertoires.load().name == "next"
    assert repertoires.load("other").name == "other"


def test_spec_can_be_a_manifest_path(tmp_path, monkeypatch):
    path = write_manifest(tmp_path, "elsewhere")
    monkeypatch.chdir(tmp_path)
    assert repertoires.load("elsewhere.json").manifest == path  # relative to the working directory
    assert repertoires.load(str(path)).name == "elsewhere"


def test_from_args_uses_the_repertoire_option(tmp_path):
    import argparse

    ap = argparse.ArgumentParser()
    repertoires.add_argument(ap)
    path = write_manifest(tmp_path, "cli")
    assert repertoires.from_args(ap.parse_args(["--repertoire", str(path)])).name == "cli"


# ---------------------------------------------------------------- paths and defaults

def test_relative_paths_resolve_against_the_repo_and_new_repertoires_get_their_own_dirs(repertoires_dir):
    named_manifest(repertoires_dir, "next", songsJson="tools/prep/playlist-fetcher/output/songs.json",
                   audioDir="/Volumes/Music/next")
    p = repertoires.load("next")
    assert p.songs_json == REPO / "tools/prep/playlist-fetcher/output/songs.json"
    assert p.audio_dir == Path("/Volumes/Music/next")
    assert p.data_dir == REPO / "data/out/repertoires/next"
    assert p.cache_dir == REPO / "data/cache/repertoires/next"
    assert p.overrides_dir == REPO / "data/repertoires/next/overrides"
    assert p.covers_dir == REPO / "data/cache/repertoires/next/covers"
    assert p.spotify_features == REPO / "data/out/repertoires/next/spotify_features.json"
    assert p.cards_json is None
    assert not p.has_spotify and p.spotify() == {}
    assert p.report_path == REPO / "data/out/repertoires/next/report.md"
    assert p.signatures_dir == REPO / "data/out/repertoires/next/signatures"


# ---------------------------------------------------------------- errors

def test_missing_manifest_names_the_available_repertoires(repertoires_dir):
    named_manifest(repertoires_dir, "default")
    with pytest.raises(repertoires.RepertoireError, match=r"no repertoire manifest .*nope\.json \(available: default\)"):
        repertoires.load("nope")


def test_missing_manifest_path(tmp_path):
    with pytest.raises(repertoires.RepertoireError, match="no such file"):
        repertoires.load(str(tmp_path / "missing.json"))


@pytest.mark.parametrize("doc, message", [
    ({"name": "x", "songsJson": "a"}, "missing audioDir"),
    ({"name": "x", "songsJson": "a", "audioDir": "b", "songJson": "typo"}, "unknown field"),
    ({"name": "X Y", "songsJson": "a", "audioDir": "b"}, "bad name"),
    ({"name": "x", "songsJson": "a", "audioDir": "b", "dataDir": 3}, "dataDir must be a string"),
])
def test_malformed_manifests(tmp_path, doc, message):
    path = tmp_path / "m.json"
    path.write_text(json.dumps(doc))
    with pytest.raises(repertoires.RepertoireError, match=message):
        repertoires.load(str(path))


def test_name_must_match_the_file_name_in_the_repertoires_dir(repertoires_dir):
    (repertoires_dir / "a.json").write_text(json.dumps({"name": "b", "songsJson": "s", "audioDir": "d"}))
    with pytest.raises(repertoires.RepertoireError, match="must match the file name"):
        repertoires.load("a")


def test_bad_repertoire_names_are_refused(repertoires_dir):
    with pytest.raises(repertoires.RepertoireError, match="bad repertoire name"):
        repertoires.load("Next Year")


def test_cli_reports_a_missing_repertoire_clearly():
    result = run_script("repertoire.py", "--repertoire", "no-such-repertoire")
    assert result.returncode != 0
    assert "repertoire error: no repertoire manifest data/repertoires/no-such-repertoire.json" in result.stderr


# ---------------------------------------------------------------- songs.json and the audio folder

def test_songs_json_is_checked(tmp_path):
    p = repertoires.load(write_manifest(tmp_path))
    songs = tmp_path / "input" / "songs.json"
    songs.parent.mkdir(parents=True)
    with pytest.raises(repertoires.RepertoireError, match="songs.json not found"):
        p.songs()
    songs.write_text(json.dumps([{"id": 1, "title": "a", "artist": "b"}, {"id": 1, "title": "c", "artist": "d"}]))
    with pytest.raises(repertoires.RepertoireError, match="duplicate id 1"):
        p.songs()
    songs.write_text(json.dumps([{"id": 1, "title": "a", "artist": "b", "timestamps": {"main": [3]}}]))
    with pytest.raises(repertoires.RepertoireError, match="timestamps must be a list"):
        p.songs()
    # The playlist-fetcher's shape: no timestamps, no spotifyId, no duration.
    songs.write_text(json.dumps([{"id": 1, "title": "a", "artist": "b", "cover": "https://x/y.jpg"}]))
    assert p.song_ids() == [1]


def test_audio_files_accept_both_naming_conventions(tmp_path):
    p = repertoires.load(write_manifest(tmp_path))
    d = p.audio_dir
    d.mkdir(parents=True)
    for name in ("1.mp3", "1 Duplicate Of One - X.mp3", "02 Two - Band.mp3", "3 Three - Band.m4a",
                 "notes.txt", "cover.jpg", "Intro.mp3", ".5.mp3"):
        (d / name).write_bytes(b"x")
    files = p.audio_files()
    assert files == {1: d / "1.mp3", 2: d / "02 Two - Band.mp3", 3: d / "3 Three - Band.m4a"}
    (d / "2 Two again - Band.mp3").write_bytes(b"x")
    with pytest.raises(repertoires.RepertoireError, match="several audio files for song 2"):
        p.audio_files()


def test_audio_files_named_by_spotify_id_follow_the_playlist_order(tmp_path):
    p = repertoires.load(write_manifest(tmp_path))
    d = p.audio_dir
    d.mkdir(parents=True)
    for name in ("0kosUz0jePvjiz4ctmR6wL.opus", "7BKLCZ1jbUBVqRi2FVlTVw.opus", "4uLU6hMCjMI75M1A2tKUQC.mp3"):
        (d / name).write_bytes(b"x")
    songs = [{"id": 1, "title": "a", "artist": "x", "spotifyId": "7BKLCZ1jbUBVqRi2FVlTVw"},
             {"id": 2, "title": "b", "artist": "y", "spotifyId": "0kosUz0jePvjiz4ctmR6wL"},
             {"id": 3, "title": "c", "artist": "z"}]
    p.songs_json.parent.mkdir(parents=True, exist_ok=True)
    p.songs_json.write_text(json.dumps(songs))
    # The third file's song left the playlist: ignored.
    assert p.audio_files() == {1: d / "7BKLCZ1jbUBVqRi2FVlTVw.opus", 2: d / "0kosUz0jePvjiz4ctmR6wL.opus"}
    # The playlist reordered: the same files follow their songs.
    songs[0]["id"], songs[1]["id"] = 2, 1
    p.songs_json.write_text(json.dumps(songs))
    assert p.audio_files() == {1: d / "0kosUz0jePvjiz4ctmR6wL.opus", 2: d / "7BKLCZ1jbUBVqRi2FVlTVw.opus"}
    # A hand download by id for a song that already has one is two candidates.
    (d / "1.mp3").write_bytes(b"x")
    with pytest.raises(repertoires.RepertoireError, match="several audio files for song 1"):
        p.audio_files()


# ---------------------------------------------------------------- relay/repertoire.ts resolves the same paths

@pytest.mark.skipif(shutil.which("node") is None, reason="node not on PATH")
@pytest.mark.parametrize("which", ["default", "relative", "absolute"])
def test_typescript_twin_resolves_the_same_paths(tmp_path, which):
    if which == "default":
        spec = "default"
    elif which == "relative":
        spec = str(tmp_path / "rel.json")
        Path(spec).write_text(json.dumps({"name": "rel", "songsJson": "../../x/songs.json", "audioDir": "in/a/../songs/",
                                          "cardsJson": "cards/cards.json"}))
    else:
        spec = str(write_manifest(tmp_path, "abs", spotifyFeatures=str(tmp_path / "sp.json")))
    node = subprocess.run(["node", str(repertoires.SHOW / "relay/repertoire.ts"), spec], cwd=REPO, capture_output=True, text=True,
                          timeout=60, check=False)
    assert node.returncode == 0, node.stderr
    assert json.loads(node.stdout) == repertoires.load(spec).to_json()


@pytest.mark.skipif(shutil.which("node") is None, reason="node not on PATH")
def test_typescript_twin_refuses_what_python_refuses(tmp_path):
    path = tmp_path / "bad.json"
    path.write_text(json.dumps({"name": "bad", "songsJson": "a", "audioDir": "b", "dataDirectory": "c"}))
    node = subprocess.run(["node", str(repertoires.SHOW / "relay/repertoire.ts"), str(path)], cwd=REPO, capture_output=True, text=True,
                          timeout=60, check=False)
    assert node.returncode == 1 and "unknown field(s) dataDirectory" in node.stderr
    with pytest.raises(repertoires.RepertoireError, match="unknown field"):
        repertoires.load(str(path))
