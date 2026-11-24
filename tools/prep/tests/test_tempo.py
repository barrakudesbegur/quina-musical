"""Half time (steps/tempo.py half_time): when Beat This! counts twice the tempo, with and without Spotify features."""
from __future__ import annotations

from steps import tempo


def test_with_spotify_both_references_must_agree_on_half():
    assert tempo.half_time(214.0, 107.5, 106.9) == "spotify"
    assert tempo.half_time(214.0, 107.5, 214.0) is None, "Spotify says Beat This! is right"
    assert tempo.half_time(214.0, 140.0, 107.0) is None, "librosa doesn't confirm"


def test_without_spotify_librosa_halves_only_an_implausibly_fast_tempo():
    # Last year's Besos (song 6): Beat This! 214, librosa 103.4 (3.4% off half), no Spotify this year.
    assert tempo.half_time(214.0, 103.4, None) == "librosa"
    # Fast songs that really are fast keep their tempo (last year's 19 and 59: librosa not at half).
    assert tempo.half_time(176.0, 117.5, None) is None
    assert tempo.half_time(167.0, 112.3, None) is None
    # At half, but slow enough to be real (a 150 BPM song whose librosa says 75).
    assert tempo.half_time(150.0, 75.0, None) is None
    assert tempo.half_time(214.0, None, None) is None
    assert tempo.half_time(0, 100.0, None) is None
