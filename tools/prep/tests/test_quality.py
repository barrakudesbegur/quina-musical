"""The source quality check (tools/prep/quality.py): a brick-wall low-pass, the bitrate, the length against Spotify's
and version words, on made-up audio."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

import quality

SR = 48000


def noise(seconds: float, cutoff_hz: float | None = None, pink: bool = False, seed: int = 1) -> np.ndarray:
    rng = np.random.default_rng(seed)
    x = rng.normal(size=int(seconds * SR)) * 0.1
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    if pink:
        spec[1:] /= np.sqrt(freqs[1:] / 100)
    if cutoff_hz:
        spec[freqs > cutoff_hz] = 0
    return np.fft.irfft(spec, len(x)).astype("float32")


def lowpass_of(tmp_path: Path, audio: np.ndarray) -> float | None:
    path = tmp_path / "mix.flac"
    sf.write(path, np.stack([audio, audio], axis=1), SR)
    return quality.lowpass_hz(*quality.spectrum_db(path))


def test_a_brick_wall_is_found_where_it_cuts(tmp_path):
    assert abs(lowpass_of(tmp_path, noise(12, cutoff_hz=9000)) - 9000) <= 600
    assert abs(lowpass_of(tmp_path, noise(12, cutoff_hz=16500)) - 16500) <= 600


def test_a_natural_roll_off_or_full_band_has_no_wall(tmp_path):
    assert lowpass_of(tmp_path, noise(12)) is None
    assert lowpass_of(tmp_path, noise(12, pink=True)) is None


def test_version_words_only_where_a_title_names_its_version():
    flagged = ["La Vaca Lola - Remix", "Bailando (Live)", "Aserejé [Karaoke Version]", "Song - Sped Up", "Tema - Acústico"]
    fine = ["Live Is Life", "Titanium (feat. Sia)", "Sé lo que hicisteis - 2006 Remastered Version", "Llença't", "Cover Me"]
    for title in flagged:
        assert quality.VERSION_WORDS.search(quality.version_part(title)), title
    for title in fine:
        assert not quality.VERSION_WORDS.search(quality.version_part(title)), title


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="needs ffmpeg")
def test_a_low_bitrate_or_another_length_is_flagged(tmp_path):
    wav = tmp_path / "s.wav"
    sf.write(wav, np.stack([noise(20)] * 2, axis=1), SR)
    mp3 = tmp_path / "1 Song - Artist.mp3"
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "64k", str(mp3)], check=True)

    class Pool:
        def song_cache(self, sid: int) -> Path:
            return tmp_path / "cache" / str(sid)

    row = quality.song_quality(Pool(), {"id": 1, "title": "Song", "durationMs": 40_000}, mp3)
    assert row["codec"] == "mp3" and row["bitrateKbps"] == 64
    assert set(row["flags"]) == {"low_bitrate", "duration_off"}
    ok = quality.song_quality(Pool(), {"id": 1, "title": "Song", "durationMs": 21_000}, mp3)
    assert ok["flags"] == ["low_bitrate"], "within 5 s of Spotify's length"
    assert quality.song_quality(Pool(), {"id": 2, "title": "Song"}, None)["flags"] == ["no_audio"]
