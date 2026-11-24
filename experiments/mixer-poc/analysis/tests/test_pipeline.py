"""End to end: prepare.py on a tiny synthetic pool in a temp dir, then the relay serving it.

The pool has two 30 s grooves: song 1 with hook tags and a cover, song 2 (named the spotDL way) with
neither, and no Spotify features: the state of a freshly fetched playlist. Every output goes to
pytest's temp dir. About 30 s on an M-series CPU, most of it Beat This!, Demucs and Vite start-up.
"""
from __future__ import annotations

import http.client
import json
import os
import shutil
import socket
import subprocess
import time
from pathlib import Path

import pool as pools
import pytest
from conftest import ANALYSIS, build_synth_pool, needs_ffmpeg, run_script, synth_song, write_manifest

pytestmark = needs_ffmpeg

STEMS_PY = ANALYSIS / ".venv-stems" / "bin" / "python"


def has_essentia() -> bool:
    return subprocess.run([str(ANALYSIS / ".venv/bin/python"), "-c", "import essentia"],
                          capture_output=True, check=False).returncode == 0


def playable(index: dict) -> list[int]:
    """engine/src/analysis.ts playableSongs: in the index, not excluded, with a valid hook."""
    return [s["id"] for s in index["songs"] if not s.get("excluded") and any(h.get("valid") for h in s["hooks"])]


def prepare(manifest: Path, *args: str) -> subprocess.CompletedProcess:
    return run_script("prepare.py", "--pool", str(manifest), *args)


def snapshot(directory: Path) -> dict[str, tuple[bytes, int]]:
    return {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in sorted(directory.glob("*.json"))}


@pytest.fixture(scope="module")
def prepared(tmp_path_factory):
    """The synthetic pool after one full prepare run (the stems steps only when their venv exists)."""
    root = tmp_path_factory.mktemp("pool")
    pool = build_synth_pool(root)
    steps = ["covers", "decode", "analyze", "validate"]
    if has_essentia():
        steps.append("keys")
    if STEMS_PY.exists():
        steps += ["stems", "signatures"]
    result = prepare(pool.manifest, "--steps", ",".join(steps))
    return pool, steps, result


def test_prepare_runs_every_step(prepared):
    pool, steps, result = prepared
    assert result.returncode == 0, result.stdout[-3000:] + result.stderr[-3000:]
    summary = result.stdout.split("── summary")[1]
    for step in steps:
        assert f"  {step} " in summary and "FAILED" not in summary
    assert "Spotify features: none (no tempo or key cross-check)" in result.stdout
    assert "hook tags: 1/2 songs" in result.stdout
    # Nothing landed in the repo's own pool folders.
    assert not (pools.POC / "data/pools" / pool.name).exists()
    assert not (pools.POC / "cache/pools" / pool.name).exists()


def test_decode_and_covers(prepared):
    pool, _, _ = prepared
    for sid in (1, 2):
        assert pool.mix_flac(sid).stat().st_size > 0
        meta = json.loads((pool.song_cache(sid) / "mix.json").read_text())
        assert meta["ffmpegArgs"] == ["-map", "0:a", "-ar", "48000", "-c:a", "flac", "-sample_fmt", "s16"]
    assert json.loads((pool.song_cache(2) / "mix.json").read_text())["source"]["path"].endswith(
        "02 Second Song - Test Band.mp3")
    assert pool.cover_path(1).read_bytes().startswith(b"\xff\xd8")
    assert not pool.cover_path(2).exists()


def test_analysis_marks_the_missing_inputs(prepared):
    pool, _, _ = prepared
    a1 = json.loads((pool.analysis_dir / "1.json").read_text())
    a2 = json.loads((pool.analysis_dir / "2.json").read_text())
    assert a1["tempo"]["bpm"] == pytest.approx(120, abs=1)
    assert a2["tempo"]["bpm"] == pytest.approx(100, abs=1)
    assert [h["id"] for h in a1["hooks"] if h["valid"]] == ["1-best-0", "1-main-0"]
    assert "no_hook_tags" not in a1["flags"]
    # No hook tags: no hooks at all, flagged, and not a "no valid hook" error.
    assert a2["hooks"] == [] and "no_hook_tags" in a2["flags"]
    assert "no_valid_hook" not in a2["flags"]
    # No Spotify features: the cross-check says so per song.
    assert a1["tempo"]["vsSpotify"] == {"status": "missing"} and a1["tempo"]["estimates"]["spotify"] is None
    assert a1["source"]["pcm"] == str(pool.mix_flac(1))
    index = json.loads(pool.analysis_index.read_text())
    assert [s["id"] for s in index["songs"]] == [1, 2]
    assert playable(index) == [1]


def test_report_flags_the_missing_inputs(prepared):
    pool, _, _ = prepared
    report = pool.report_path.read_text()
    assert f"pool **{pool.name}**" in report
    assert "**Songs without hook tags: 1** (2)" in report
    assert "**No Spotify features**" in report
    assert "playable (a valid hook, not excluded): **1**" in report
    assert "Hard errors: **0**" in report


def test_keys_without_spotify_use_the_default_method(prepared):
    pool, steps, _ = prepared
    if "keys" not in steps:
        pytest.skip("essentia is not installed (requirements-layering.txt)")
    index = json.loads((pool.keys_dir / "index.json").read_text())
    assert index["method"] == "essentia-temperley"
    assert index["accuracyVsSpotify"]["reference"].startswith("none")
    assert [s["songId"] for s in index["songs"]] == [1, 2]


def test_stems_and_signatures_use_the_pool_dirs(prepared):
    pool, steps, _ = prepared
    if "stems" not in steps:
        pytest.skip("no analysis/.venv-stems")
    meta = json.loads((pool.stems_dir / "1.json").read_text())
    assert meta["pathTemplate"] == f"{pool.stems_cache(1)}/{{stem}}.{{startSample}}.flac"
    assert all((pool.stems_cache(1) / f"{s}.{w['startSample']}.flac").exists()
               for s in meta["stems"] for w in meta["windows"])
    assert not (pool.stems_dir / "2.json").exists()  # no valid hook: skipped
    assert (pool.signatures_dir / "index.json").exists()


def test_a_second_run_changes_nothing(prepared):
    pool, steps, first = prepared
    assert first.returncode == 0
    before = {d: snapshot(d) for d in (pool.analysis_dir, pool.keys_dir) if d.exists()}
    report = pool.report_path.read_bytes()
    again = prepare(pool.manifest, "--steps", ",".join(s for s in steps if s != "stems"))
    assert again.returncode == 0, again.stdout[-3000:]
    assert "decode (synth): 2 songs: 2 skipped" in again.stdout
    assert "1 present" in again.stdout
    assert {d: snapshot(d) for d in before} == before  # same bytes, same mtimes
    assert pool.report_path.read_bytes() == report


def test_a_failing_step_stops_the_run(tmp_path):
    pool = pools.load(write_manifest(tmp_path, "broken"))
    synth_song(pool.audio_dir / "1.mp3", 0.5, seconds=3)
    pool.songs_json.write_text(json.dumps([{"id": 1, "title": "a", "artist": "b"}, {"id": 2, "title": "c", "artist": "d"}]))
    result = prepare(pool.manifest, "--steps", "decode,analyze")
    assert result.returncode == 1
    assert "song 2: no audio file" in result.stdout
    assert "decode      FAILED (exit 1)" in result.stdout
    assert "not run: analyze" in result.stdout
    assert pool.mix_flac(1).exists() and not pool.analysis_dir.exists()


def test_decode_follows_the_source_and_adopts_old_decodes(tmp_path):
    pool = pools.load(write_manifest(tmp_path, "decode"))
    source = synth_song(pool.audio_dir / "1.mp3", 0.5, seconds=3)
    pool.songs_json.write_text(json.dumps([{"id": 1, "title": "a", "artist": "b"}]))
    flac, meta = pool.mix_flac(1), pool.song_cache(1) / "mix.json"

    assert "1 decoded" in run_script("decode.py", "--pool", str(pool.manifest)).stdout
    first = flac.stat().st_mtime_ns
    assert "1 skipped" in run_script("decode.py", "--pool", str(pool.manifest)).stdout
    os.utime(source)  # touched, same content
    assert "1 skipped" in run_script("decode.py", "--pool", str(pool.manifest)).stdout
    assert flac.stat().st_mtime_ns == first

    meta.unlink()  # a mix.flac from the old decode_all.sh: adopted, never decoded again
    assert "1 adopted" in run_script("decode.py", "--pool", str(pool.manifest)).stdout
    assert flac.stat().st_mtime_ns == first and meta.exists()

    synth_song(source, 0.6, seconds=3)  # a re-fetch put another recording under id 1
    assert "1 redecoded" in run_script("decode.py", "--pool", str(pool.manifest)).stdout
    assert flac.stat().st_mtime_ns != first


# ---------------------------------------------------------------- the relay serves the pool

def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def request(port: int, method: str, url: str, body: dict | None = None, headers: dict | None = None):
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=120)
    conn.request(method, url, body=json.dumps(body) if body is not None else None, headers=headers or {})
    response = conn.getresponse()
    data = response.read()
    conn.close()
    return response.status, dict(response.getheaders()), data


@pytest.fixture(scope="module")
def relay(prepared):
    if shutil.which("node") is None:
        pytest.skip("node not on PATH")
    pool, _, result = prepared
    assert result.returncode == 0
    port = free_port()
    proc = subprocess.Popen(["node", "relay/server.ts", "--host", "127.0.0.1", "--port", str(port),
                             "--pool", str(pool.manifest)], cwd=pools.POC,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        for _ in range(120):
            try:
                if request(port, "GET", "/analysis/index.json")[0] == 200:
                    break
            except OSError:
                time.sleep(0.25)
        else:
            pytest.fail("the relay did not start")
        yield pool, port
    finally:
        proc.terminate()
        proc.wait(timeout=10)


def test_relay_maps_the_engine_urls_to_the_pool(relay):
    pool, port = relay
    assert json.loads(request(port, "GET", "/api/pool")[2]) == {"name": pool.name}
    status, headers, body = request(port, "GET", "/audio/1.flac")
    assert status == 200 and body == pool.mix_flac(1).read_bytes()
    assert headers["cache-control"] == "no-cache"  # same URL, other file in another pool: revalidate
    assert request(port, "GET", "/audio/1.flac", headers={"if-none-match": headers["etag"]})[0] == 304
    assert json.loads(request(port, "GET", "/analysis/index.json")[2]) == json.loads(pool.analysis_index.read_text())
    assert request(port, "GET", "/data/report.md")[2] == pool.report_path.read_bytes()
    assert request(port, "GET", "/covers/1.jpg")[2] == pool.cover_path(1).read_bytes()
    assert request(port, "GET", "/covers/2.jpg")[0] == 404
    assert request(port, "GET", "/cards/cards.json")[0] == 404  # this pool has no cards
    stems = pool.stems_dir / "1.json"
    if stems.exists():
        assert request(port, "GET", "/data/stems/1.json")[2] == stems.read_bytes()
        start = json.loads(stems.read_text())["windows"][0]["startSample"]
        drums = request(port, "GET", f"/stems/1/drums.{start}.flac")
        assert drums[0] == 200 and drums[2] == (pool.stems_cache(1) / f"drums.{start}.flac").read_bytes()
    # Hold music is global.
    hold = pools.POC / "data/hold/index.json"
    if hold.exists():
        assert request(port, "GET", "/data/hold/index.json")[2] == hold.read_bytes()


def test_relay_override_rederives_in_the_pool(relay):
    pool, port = relay
    status, _, body = request(port, "POST", "/api/override/1", {"note": "pipeline test"})
    result = json.loads(body)
    assert status == 200 and result["ok"], result
    assert json.loads(pool.override_path(1).read_text()) == {"note": "pipeline test"}
    assert result["analysis"]["override"] == {"note": "pipeline test"}
    assert "has_override" in json.loads((pool.analysis_dir / "1.json").read_text())["flags"]
    assert json.loads(request(port, "GET", "/api/override/1")[2]) == {"note": "pipeline test"}
    status, _, body = request(port, "POST", "/api/override/1", {})
    assert status == 200 and json.loads(body)["ok"] and not pool.override_path(1).exists()


def test_relay_stretch_renders_into_the_pool(relay):
    pool, port = relay
    status, _, body = request(port, "POST", "/api/stretch",
                              {"song": 1, "hook": "1-best-0", "toBpm": 123, "bars": 2, "afterBars": 1})
    result = json.loads(body)
    if not result.get("ok") and "rubberband" in result.get("log", "").lower():
        pytest.skip("Rubber Band library not installed")
    assert status == 200 and result["ok"], result
    folder = pool.stretch_dir / "1" / result["dir"]
    assert (folder / "mix.flac").exists()
    status, _, audio = request(port, "GET", f"/stretch/1/{result['dir']}/mix.flac")
    assert status == 200 and audio == (folder / "mix.flac").read_bytes()
