"""Pool resolution (analysis/pool.py) and its TypeScript twin (relay/pool.ts)."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pool as pools
import pytest
from conftest import run_script, write_manifest

POC = pools.POC
REPO = pools.REPO


@pytest.fixture
def pools_dir(tmp_path, monkeypatch):
    """A private analysis/pools/ so name lookups never touch the real one."""
    d = tmp_path / "pools"
    d.mkdir()
    monkeypatch.setattr(pools, "POOLS_DIR", d)
    monkeypatch.delenv(pools.ENV_VAR, raising=False)
    return d


def named_manifest(pools_dir: Path, name: str, **fields) -> Path:
    path = pools_dir / f"{name}.json"
    path.write_text(json.dumps({"name": name, "songsJson": "in/songs.json", "audioDir": "in/songs", **fields}))
    return path


# ---------------------------------------------------------------- the default pool

def test_default_pool_points_at_the_existing_locations(monkeypatch):
    monkeypatch.delenv(pools.ENV_VAR, raising=False)
    p = pools.load()
    assert p.name == "default"
    assert p.manifest == POC / "analysis/pools/default.json"
    assert p.songs_json == REPO / "server/db/default/songs.json"
    assert p.audio_dir == REPO / "client/public/audios/song"
    assert p.covers_dir == REPO / "client/public/images/covers"
    assert p.cards_json == REPO / "card-generator/dist/cards.json"
    assert p.spotify_features == POC / "data/spotify_features.json"
    assert (p.data_dir, p.cache_dir, p.overrides_dir) == (POC / "data", POC / "cache", POC / "analysis/overrides")
    assert p.analysis_dir == POC / "data/analysis"
    assert p.mix_flac(12) == POC / "cache/12/mix.flac"
    assert p.signatures_cache(12) == POC / "cache/12/signatures"
    assert pools.display(p.stems_cache(12)) == "cache/12/stems"  # stems.py's pathTemplate stays as it was


# ---------------------------------------------------------------- precedence: --pool, $QUINA_POOL, default

def test_precedence_spec_then_env_then_default(pools_dir, monkeypatch):
    named_manifest(pools_dir, "default")
    named_manifest(pools_dir, "next")
    named_manifest(pools_dir, "other")
    assert pools.load().name == "default"
    monkeypatch.setenv(pools.ENV_VAR, "next")
    assert pools.load().name == "next"
    assert pools.load("other").name == "other"


def test_spec_can_be_a_manifest_path(tmp_path, monkeypatch):
    path = write_manifest(tmp_path, "elsewhere")
    monkeypatch.chdir(tmp_path)
    assert pools.load("elsewhere.json").manifest == path  # relative to the working directory
    assert pools.load(str(path)).name == "elsewhere"


def test_from_args_uses_the_pool_option(tmp_path):
    import argparse

    ap = argparse.ArgumentParser()
    pools.add_argument(ap)
    path = write_manifest(tmp_path, "cli")
    assert pools.from_args(ap.parse_args(["--pool", str(path)])).name == "cli"


# ---------------------------------------------------------------- paths and defaults

def test_relative_paths_resolve_against_the_poc_and_new_pools_get_their_own_dirs(pools_dir):
    named_manifest(pools_dir, "next", songsJson="../../playlist-fetcher/output/songs.json",
                   audioDir="/Volumes/Music/next")
    p = pools.load("next")
    assert p.songs_json == REPO / "playlist-fetcher/output/songs.json"
    assert p.audio_dir == Path("/Volumes/Music/next")
    assert p.data_dir == POC / "data/pools/next"
    assert p.cache_dir == POC / "cache/pools/next"
    assert p.overrides_dir == POC / "analysis/overrides/next"
    assert p.covers_dir == POC / "cache/pools/next/covers"
    assert p.spotify_features == POC / "data/pools/next/spotify_features.json"
    assert p.cards_json is None
    assert not p.has_spotify and p.spotify() == {}
    assert p.report_path == POC / "data/pools/next/report.md"
    assert p.signatures_dir == POC / "data/pools/next/signatures"


# ---------------------------------------------------------------- errors

def test_missing_manifest_names_the_available_pools(pools_dir):
    named_manifest(pools_dir, "default")
    with pytest.raises(pools.PoolError, match=r"no pool manifest .*nope\.json \(available: default\)"):
        pools.load("nope")


def test_missing_manifest_path(tmp_path):
    with pytest.raises(pools.PoolError, match="no such file"):
        pools.load(str(tmp_path / "missing.json"))


@pytest.mark.parametrize("doc, message", [
    ({"name": "x", "songsJson": "a"}, "missing audioDir"),
    ({"name": "x", "songsJson": "a", "audioDir": "b", "songJson": "typo"}, "unknown field"),
    ({"name": "X Y", "songsJson": "a", "audioDir": "b"}, "bad name"),
    ({"name": "x", "songsJson": "a", "audioDir": "b", "dataDir": 3}, "dataDir must be a string"),
])
def test_malformed_manifests(tmp_path, doc, message):
    path = tmp_path / "m.json"
    path.write_text(json.dumps(doc))
    with pytest.raises(pools.PoolError, match=message):
        pools.load(str(path))


def test_name_must_match_the_file_name_in_the_pools_dir(pools_dir):
    (pools_dir / "a.json").write_text(json.dumps({"name": "b", "songsJson": "s", "audioDir": "d"}))
    with pytest.raises(pools.PoolError, match="must match the file name"):
        pools.load("a")


def test_bad_pool_names_are_refused(pools_dir):
    with pytest.raises(pools.PoolError, match="bad pool name"):
        pools.load("Next Year")


def test_cli_reports_a_missing_pool_clearly():
    result = run_script("pool.py", "--pool", "no-such-pool")
    assert result.returncode != 0
    assert "pool error: no pool manifest analysis/pools/no-such-pool.json" in result.stderr


# ---------------------------------------------------------------- songs.json and the audio folder

def test_songs_json_is_checked(tmp_path):
    p = pools.load(write_manifest(tmp_path))
    songs = tmp_path / "input" / "songs.json"
    songs.parent.mkdir(parents=True)
    with pytest.raises(pools.PoolError, match="songs.json not found"):
        p.songs()
    songs.write_text(json.dumps([{"id": 1, "title": "a", "artist": "b"}, {"id": 1, "title": "c", "artist": "d"}]))
    with pytest.raises(pools.PoolError, match="duplicate id 1"):
        p.songs()
    songs.write_text(json.dumps([{"id": 1, "title": "a", "artist": "b", "timestamps": {"main": [3]}}]))
    with pytest.raises(pools.PoolError, match="timestamps must be a list"):
        p.songs()
    # The playlist-fetcher's shape: no timestamps, no spotifyId, no duration.
    songs.write_text(json.dumps([{"id": 1, "title": "a", "artist": "b", "cover": "https://x/y.jpg"}]))
    assert p.song_ids() == [1]


def test_audio_files_accept_both_naming_conventions(tmp_path):
    p = pools.load(write_manifest(tmp_path))
    d = p.audio_dir
    d.mkdir(parents=True)
    for name in ("1.mp3", "1 Duplicate Of One - X.mp3", "02 Two - Band.mp3", "3 Three - Band.m4a",
                 "notes.txt", "cover.jpg", "Intro.mp3", ".5.mp3"):
        (d / name).write_bytes(b"x")
    files = p.audio_files()
    assert files == {1: d / "1.mp3", 2: d / "02 Two - Band.mp3", 3: d / "3 Three - Band.m4a"}
    (d / "2 Two again - Band.mp3").write_bytes(b"x")
    with pytest.raises(pools.PoolError, match="several audio files for song 2"):
        p.audio_files()


# ---------------------------------------------------------------- relay/pool.ts resolves the same paths

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
    node = subprocess.run(["node", str(POC / "relay/pool.ts"), spec], cwd=POC, capture_output=True, text=True,
                          timeout=60, check=False)
    assert node.returncode == 0, node.stderr
    assert json.loads(node.stdout) == pools.load(spec).to_json()


@pytest.mark.skipif(shutil.which("node") is None, reason="node not on PATH")
def test_typescript_twin_refuses_what_python_refuses(tmp_path):
    path = tmp_path / "bad.json"
    path.write_text(json.dumps({"name": "bad", "songsJson": "a", "audioDir": "b", "dataDirectory": "c"}))
    node = subprocess.run(["node", str(POC / "relay/pool.ts"), str(path)], cwd=POC, capture_output=True, text=True,
                          timeout=60, check=False)
    assert node.returncode == 1 and "unknown field(s) dataDirectory" in node.stderr
    with pytest.raises(pools.PoolError, match="unknown field"):
        pools.load(str(path))
