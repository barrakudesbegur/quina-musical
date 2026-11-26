"""End to end: prepare.py on a tiny synthetic repertoire in a temp dir, then the relay serving it.

The repertoire has two 30 s grooves: song 1 with hook tags and a cover, song 2 (named the spotDL way) with
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

import repertoire as repertoires
import pytest
from conftest import ANALYSIS, build_synth_repertoire, needs_ffmpeg, run_script, synth_song, write_manifest

pytestmark = needs_ffmpeg

STEMS_PY = ANALYSIS / ".venv-stems" / "bin" / "python"


def has_essentia() -> bool:
    return subprocess.run([str(ANALYSIS / ".venv/bin/python"), "-c", "import essentia"],
                          capture_output=True, check=False).returncode == 0


def playable(index: dict) -> list[int]:
    """engine/src/analysis.ts playableSongs: in the index, not excluded, with a valid hook."""
    return [s["id"] for s in index["songs"] if not s.get("excluded") and any(h.get("valid") for h in s["hooks"])]


def prepare(manifest: Path, *args: str) -> subprocess.CompletedProcess:
    return run_script("prepare.py", "--repertoire", str(manifest), *args)


def snapshot(directory: Path) -> dict[str, tuple[bytes, int]]:
    return {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in sorted(directory.glob("*.json"))}


@pytest.fixture(scope="module")
def prepared(tmp_path_factory):
    """The synthetic repertoire after one full prepare run (the stems steps only when their venv exists)."""
    root = tmp_path_factory.mktemp("repertoire")
    repertoire = build_synth_repertoire(root)
    steps = ["covers", "decode", "analyze", "snippets", "validate"]
    if has_essentia():
        steps.append("keys")
    if STEMS_PY.exists():
        steps += ["stems", "signatures"]
    result = prepare(repertoire.manifest, "--steps", ",".join(steps))
    return repertoire, steps, result


def test_prepare_runs_every_step(prepared):
    repertoire, steps, result = prepared
    assert result.returncode == 0, result.stdout[-3000:] + result.stderr[-3000:]
    summary = result.stdout.split("── summary")[1]
    for step in steps:
        assert f"  {step} " in summary and "FAILED" not in summary
    assert "Spotify features: none (no tempo or key cross-check)" in result.stdout
    assert "hook tags: 1/2 songs" in result.stdout
    # Nothing landed in the repo's own repertoire folders.
    assert not (repertoires.OUT / "repertoires" / repertoire.name).exists()
    assert not (repertoires.CACHE / "repertoires" / repertoire.name).exists()


def test_decode_and_covers(prepared):
    repertoire, _, _ = prepared
    for sid in (1, 2):
        assert repertoire.mix_flac(sid).stat().st_size > 0
        meta = json.loads((repertoire.song_cache(sid) / "mix.json").read_text())
        assert meta["ffmpegArgs"] == ["-map", "0:a", "-ar", "48000", "-c:a", "flac", "-sample_fmt", "s16"]
    assert json.loads((repertoire.song_cache(2) / "mix.json").read_text())["source"]["path"].endswith(
        "02 Second Song - Test Band.mp3")
    assert repertoire.cover_path(1).read_bytes().startswith(b"\xff\xd8")
    assert not repertoire.cover_path(2).exists()


def test_analysis_marks_the_missing_inputs(prepared):
    repertoire, _, _ = prepared
    a1 = json.loads((repertoire.analysis_dir / "1.json").read_text())
    a2 = json.loads((repertoire.analysis_dir / "2.json").read_text())
    assert a1["tempo"]["bpm"] == pytest.approx(120, abs=1)
    assert a2["tempo"]["bpm"] == pytest.approx(100, abs=1)
    assert [h["id"] for h in a1["hooks"] if h["valid"]] == ["1-best-0", "1-main-0"]
    assert "no_hook_tags" not in a1["flags"]
    # No hook tags: no hooks at all, flagged, and not a "no valid hook" error.
    assert a2["hooks"] == [] and "no_hook_tags" in a2["flags"]
    assert "no_valid_hook" not in a2["flags"]
    # No Spotify features: the cross-check says so per song.
    assert a1["tempo"]["vsSpotify"] == {"status": "missing"} and a1["tempo"]["estimates"]["spotify"] is None
    assert a1["source"]["pcm"] == str(repertoire.mix_flac(1))
    index = json.loads(repertoire.analysis_index.read_text())
    assert [s["id"] for s in index["songs"]] == [1, 2]
    assert playable(index) == [1]


def test_snippets_cut_from_the_best_hook(prepared):
    repertoire, _, _ = prepared
    import soundfile as sf
    index = json.loads((repertoire.data_dir / "snippets" / "index.json").read_text())
    assert [e["id"] for e in index["songs"]] == [1]  # song 2 has no hook: no snippet
    entry = index["songs"][0]
    analysis = json.loads((repertoire.analysis_dir / "1.json").read_text())
    best = next(h for h in analysis["hooks"] if h["id"] == "1-best-0")
    assert entry["hookId"] == "1-best-0"
    assert entry["startSec"] == pytest.approx(best["downbeatSec"] - best["pickupSec"], abs=1e-3)
    assert -12 <= entry["gainDb"] <= 6
    info = sf.info(repertoire.song_cache(1) / "snippet.flac")
    assert (info.samplerate, info.channels, info.subtype) == (48000, 2, "PCM_16")
    assert info.duration == pytest.approx(3.0, abs=0.01)
    assert not (repertoire.song_cache(2) / "snippet.flac").exists()


def test_report_flags_the_missing_inputs(prepared):
    repertoire, _, _ = prepared
    report = repertoire.report_path.read_text()
    assert f"repertoire **{repertoire.name}**" in report
    assert "**Songs without hook tags: 1** (2)" in report
    assert "**No Spotify features**" in report
    assert "playable (a valid hook, not excluded): **1**" in report
    assert "Hard errors: **0**" in report


def test_keys_without_spotify_use_the_default_method(prepared):
    repertoire, steps, _ = prepared
    if "keys" not in steps:
        pytest.skip("essentia is not installed (requirements-layering.txt)")
    index = json.loads((repertoire.keys_dir / "index.json").read_text())
    assert index["method"] == "essentia-temperley"
    assert index["accuracyVsSpotify"]["reference"].startswith("none")
    assert [s["songId"] for s in index["songs"]] == [1, 2]


def test_stems_and_signatures_use_the_repertoire_dirs(prepared):
    repertoire, steps, _ = prepared
    if "stems" not in steps:
        pytest.skip("no tools/prep/.venv-stems")
    meta = json.loads((repertoire.stems_dir / "1.json").read_text())
    assert meta["pathTemplate"] == f"{repertoire.stems_cache(1)}/{{stem}}.{{startSample}}.flac"
    assert all((repertoire.stems_cache(1) / f"{s}.{w['startSample']}.flac").exists()
               for s in meta["stems"] for w in meta["windows"])
    assert not (repertoire.stems_dir / "2.json").exists()  # no valid hook: skipped
    assert (repertoire.signatures_dir / "index.json").exists()


def test_a_second_run_changes_nothing(prepared):
    repertoire, steps, first = prepared
    assert first.returncode == 0
    before = {d: snapshot(d) for d in (repertoire.analysis_dir, repertoire.keys_dir, repertoire.data_dir / "snippets") if d.exists()}
    snippet = (repertoire.song_cache(1) / "snippet.flac").stat().st_mtime_ns
    report = repertoire.report_path.read_bytes()
    again = prepare(repertoire.manifest, "--steps", ",".join(s for s in steps if s != "stems"))
    assert again.returncode == 0, again.stdout[-3000:]
    assert "decode (synth): 2 songs: 2 skipped" in again.stdout
    assert "1 present" in again.stdout
    assert {d: snapshot(d) for d in before} == before  # same bytes, same mtimes
    assert (repertoire.song_cache(1) / "snippet.flac").stat().st_mtime_ns == snippet  # not cut again
    assert repertoire.report_path.read_bytes() == report


def test_a_failing_step_stops_the_run(tmp_path):
    repertoire = repertoires.load(write_manifest(tmp_path, "broken"))
    synth_song(repertoire.audio_dir / "1.mp3", 0.5, seconds=3)
    repertoire.songs_json.write_text(json.dumps([{"id": 1, "title": "a", "artist": "b"}, {"id": 2, "title": "c", "artist": "d"}]))
    result = prepare(repertoire.manifest, "--steps", "decode,analyze")
    assert result.returncode == 1
    assert "song 2: no audio file" in result.stdout
    assert "decode      FAILED (exit 1)" in result.stdout
    assert "not run: analyze" in result.stdout
    assert repertoire.mix_flac(1).exists() and not repertoire.analysis_dir.exists()


def test_decode_follows_the_source_and_adopts_old_decodes(tmp_path):
    repertoire = repertoires.load(write_manifest(tmp_path, "decode"))
    source = synth_song(repertoire.audio_dir / "1.mp3", 0.5, seconds=3)
    repertoire.songs_json.write_text(json.dumps([{"id": 1, "title": "a", "artist": "b"}]))
    flac, meta = repertoire.mix_flac(1), repertoire.song_cache(1) / "mix.json"

    assert "1 decoded" in run_script("decode.py", "--repertoire", str(repertoire.manifest)).stdout
    first = flac.stat().st_mtime_ns
    assert "1 skipped" in run_script("decode.py", "--repertoire", str(repertoire.manifest)).stdout
    os.utime(source)  # touched, same content
    assert "1 skipped" in run_script("decode.py", "--repertoire", str(repertoire.manifest)).stdout
    assert flac.stat().st_mtime_ns == first

    meta.unlink()  # a mix.flac from the old decode_all.sh: adopted, never decoded again
    assert "1 adopted" in run_script("decode.py", "--repertoire", str(repertoire.manifest)).stdout
    assert flac.stat().st_mtime_ns == first and meta.exists()

    synth_song(source, 0.6, seconds=3)  # a re-fetch put another recording under id 1
    assert "1 redecoded" in run_script("decode.py", "--repertoire", str(repertoire.manifest)).stdout
    assert flac.stat().st_mtime_ns != first


# ---------------------------------------------------------------- the relay serves the repertoire

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
    repertoire, _, result = prepared
    assert result.returncode == 0
    port = free_port()
    proc = subprocess.Popen(["node", "relay/server.ts", "--host", "127.0.0.1", "--port", str(port),
                             "--repertoire", str(repertoire.manifest)], cwd=repertoires.SHOW,
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
        yield repertoire, port
    finally:
        proc.terminate()
        proc.wait(timeout=10)


def test_relay_maps_the_engine_urls_to_the_repertoire(relay):
    repertoire, port = relay
    assert json.loads(request(port, "GET", "/api/repertoire")[2]) == {"name": repertoire.name}
    status, headers, body = request(port, "GET", "/audio/1.flac")
    assert status == 200 and body == repertoire.mix_flac(1).read_bytes()
    assert headers["cache-control"] == "no-cache"  # same URL, other file in another repertoire: revalidate
    assert request(port, "GET", "/audio/1.flac", headers={"if-none-match": headers["etag"]})[0] == 304
    assert json.loads(request(port, "GET", "/analysis/index.json")[2]) == json.loads(repertoire.analysis_index.read_text())
    assert request(port, "GET", "/data/report.md")[2] == repertoire.report_path.read_bytes()
    assert request(port, "GET", "/covers/1.jpg")[2] == repertoire.cover_path(1).read_bytes()
    assert request(port, "GET", "/covers/2.jpg")[0] == 404
    assert request(port, "GET", "/cards/cards.json")[0] == 404  # this repertoire has no cards
    status, _, body = request(port, "GET", "/snippets/1.flac")
    assert status == 200 and body == (repertoire.song_cache(1) / "snippet.flac").read_bytes()
    assert request(port, "GET", "/snippets/2.flac")[0] == 404
    assert json.loads(request(port, "GET", "/data/snippets/index.json")[2])["songs"][0]["id"] == 1
    stems = repertoire.stems_dir / "1.json"
    if stems.exists():
        assert request(port, "GET", "/data/stems/1.json")[2] == stems.read_bytes()
        start = json.loads(stems.read_text())["windows"][0]["startSample"]
        drums = request(port, "GET", f"/stems/1/drums.{start}.flac")
        assert drums[0] == 200 and drums[2] == (repertoire.stems_cache(1) / f"drums.{start}.flac").read_bytes()
    # Hold music is global.
    hold = repertoires.OUT / "hold/index.json"
    if hold.exists():
        assert request(port, "GET", "/data/hold/index.json")[2] == hold.read_bytes()
    # So are the music sets: their data and audio whatever the repertoire (this one's dataDir has none).
    for interval in sorted((repertoires.OUT / "interval").glob("*/index.json")):
        name = interval.parent.name
        assert request(port, "GET", f"/data/interval/{name}/index.json")[2] == interval.read_bytes()
        slug = json.loads(interval.read_text())["tracks"][0]["slug"]
        status, headers, _ = request(port, "GET", f"/intervalaudio/{name}/{slug}.flac", headers={"range": "bytes=0-3"})
        assert status == 206 and headers["cache-control"] == "no-cache"


def test_relay_override_rederives_in_the_repertoire(relay):
    repertoire, port = relay
    status, _, body = request(port, "POST", "/api/override/1", {"note": "pipeline test"})
    result = json.loads(body)
    assert status == 200 and result["ok"], result
    assert json.loads(repertoire.override_path(1).read_text()) == {"note": "pipeline test"}
    assert result["analysis"]["override"] == {"note": "pipeline test"}
    assert "has_override" in json.loads((repertoire.analysis_dir / "1.json").read_text())["flags"]
    assert json.loads(request(port, "GET", "/api/override/1")[2]) == {"note": "pipeline test"}
    status, _, body = request(port, "POST", "/api/override/1", {})
    assert status == 200 and json.loads(body)["ok"] and not repertoire.override_path(1).exists()


def test_relay_stretch_renders_into_the_repertoire(relay):
    repertoire, port = relay
    status, _, body = request(port, "POST", "/api/stretch",
                              {"song": 1, "hook": "1-best-0", "toBpm": 123, "bars": 2, "afterBars": 1})
    result = json.loads(body)
    if not result.get("ok") and "rubberband" in result.get("log", "").lower():
        pytest.skip("Rubber Band library not installed")
    assert status == 200 and result["ok"], result
    folder = repertoire.stretch_dir / "1" / result["dir"]
    assert (folder / "mix.flac").exists()
    status, _, audio = request(port, "GET", f"/stretch/1/{result['dir']}/mix.flac")
    assert status == 200 and audio == (folder / "mix.flac").read_bytes()
