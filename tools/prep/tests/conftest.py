"""Shared fixtures for the pipeline tests: synthetic audio and throwaway repertoires in a temp dir.

Nothing here writes under the repo: every repertoire built by these fixtures keeps its data,
cache, overrides and covers inside pytest's temp dir, which pytest removes.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ANALYSIS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ANALYSIS))

import repertoire as repertoires  # noqa: E402

VENV_PY = ANALYSIS / ".venv" / "bin" / "python"

needs_ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH")


def synth_song(path: Path, beat_sec: float, seconds: float = 30.0) -> Path:
    """A short 4/4 groove as an MP3: kick on the one, noise snare on 2 and 4, hats on eighths and a bass
    note that changes every bar, so Beat This! finds beats and downbeats."""
    b, bar = beat_sec, 4 * beat_sec
    note = (f"if(eq(mod(floor(t/{bar}),4),0),110,if(eq(mod(floor(t/{bar}),4),1),147,"
            f"if(eq(mod(floor(t/{bar}),4),2),165,131)))")
    expr = (f"0.8*sin(2*PI*55*t)*exp(-18*mod(t,{bar}))"
            f"+0.35*(random(0)*2-1)*exp(-35*mod(t-{b},{2 * b}))*gte(t,{b})"
            f"+0.12*sin(2*PI*7000*t)*exp(-80*mod(t,{b / 2}))"
            f"+0.2*sin(2*PI*{note}*t)")
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "lavfi",
                    "-i", f"aevalsrc=exprs='{expr}|{expr}':s=48000:d={seconds}",
                    "-c:a", "libmp3lame", "-b:a", "128k", str(path)], check=True)
    return path


def tiny_jpeg(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=16x16",
                    "-frames:v", "1", str(path)], check=True)
    return path


def write_manifest(root: Path, name: str = "synth", **fields) -> Path:
    """A manifest in `root` whose inputs and outputs all live in `root` (absolute paths)."""
    doc = {
        "name": name,
        "songsJson": str(root / "input" / "songs.json"),
        "audioDir": str(root / "input" / "songs"),
        "dataDir": str(root / "data"),
        "cacheDir": str(root / "cache"),
        "overridesDir": str(root / "overrides"),
        "coversDir": str(root / "covers"),
        **fields,
    }
    path = root / f"{name}.json"
    path.write_text(json.dumps(doc, indent=1))
    return path


def build_synth_repertoire(root: Path) -> repertoires.Repertoire:
    """Two songs as the playlist-fetcher writes them: song 1 is `1.mp3` with hook tags and a cover URL;
    song 2 uses spotDL's '<position> <title> - <artist>.mp3' name and has no timestamps and no cover.
    No Spotify features."""
    songs_dir = root / "input" / "songs"
    synth_song(songs_dir / "1.mp3", 0.5)                       # 120 BPM
    synth_song(songs_dir / "02 Second Song - Test Band.mp3", 0.6)  # 100 BPM
    cover = tiny_jpeg(root / "input" / "cover1.jpg")
    songs = [
        {"id": 1, "title": "First Song", "artist": "Test Band", "cover": cover.as_uri(),
         "timestamps": [{"time": 9.9, "tag": "best"}, {"time": 17.9, "tag": "main"}]},
        {"id": 2, "title": "Second Song", "artist": "Test Band", "cover": ""},
    ]
    (root / "input" / "songs.json").write_text(json.dumps(songs, indent=1))
    return repertoires.load(write_manifest(root))


def run_script(script: str, *args: str, python: Path = VENV_PY) -> subprocess.CompletedProcess:
    return subprocess.run([str(python), str(ANALYSIS / script), *args], cwd=repertoires.REPO,
                          capture_output=True, text=True, timeout=600, check=False)
