"""Check each source recording of a repertoire before anyone listens: flags for the user to check by ear.

    <dataDir>/quality.json   schema 1: { songs: [{ id, codec, bitrateKbps, sampleRate, durationSec, spotifyDurationSec,
                                                   lowpassHz, flags: [...] }], flagged }

Flags (none is a hard error: a flagged song still plays):
- low_bitrate: the source is under about 128 kbps (QUALITY.min_kbps);
- lowpass: the spectrum has a brick-wall cut below QUALITY.min_lowpass_hz (a low-bitrate encode somewhere upstream,
  even if the file's own bitrate looks fine: a re-encode can't bring the treble back);
- duration_off: more than QUALITY.max_duration_off_sec away from Spotify's length (another version or a bad match);
- version_words: the title says live, remix, sped up, karaoke, cover, acoustic, instrumental… (the playlist's own
  pick, or a match to check);
- no_audio: the song has no source file.
Spotify's length comes from songs.json `durationMs` (the playlist fetcher writes it). The low-pass is measured on the
decoded mix (<cacheDir>/<id>/mix.flac), so run it after decode.

    tools/prep/.venv/bin/python tools/prep/quality.py [--repertoire NAME|PATH] [--song N ...]
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import repertoire as repertoires  # noqa: E402
from steps.output import write_text_if_changed  # noqa: E402

SCHEMA_VERSION = 1


class QUALITY:
    # A little under 128 kbps, so a VBR stream that averages 125 doesn't flag.
    min_kbps = 120
    # A 128 kbps MP3 or AAC keeps about 16–17 kHz (last year's songs: 16.5 kHz median); clearly less means a worse
    # source.
    min_lowpass_hz = 15000.0
    max_duration_off_sec = 5.0
    # The spectrum: one frame every `hop_sec`, `n_fft` bins, smoothed over about 200 Hz. A brick wall is a fall of
    # at least `wall_db` within `wall_hz` that stays down above it.
    n_fft = 8192
    hop_sec = 2.0
    wall_db = 25.0
    wall_hz = 600.0


# Version words count only where a title names its version: after " - " or inside brackets ("La Vaca Lola - Remix",
# "Bailando (Live)"), so a title like "Live Is Life" isn't flagged.
VERSION_WORDS = re.compile(
    r"\b(live|en directo|en vivo|en viu|directe|remix|sped ?up|speed ?up|slowed|nightcore|karaoke|cover|acoustic|"
    r"ac[uú]stic[oa]?|instrumental|8d|reverb|bass ?boosted)\b",
    re.IGNORECASE,
)


def version_part(title: str) -> str:
    """The parts of a title that name its version: after the first " - ", and anything in brackets."""
    after = title.split(" - ", 1)[1] if " - " in title else ""
    return " ".join([after, *re.findall(r"[(\[]([^)\]]*)[)\]]", title)])


def probe(path: Path) -> dict:
    """The audio stream's codec, bitrate (kbps, or None), sample rate and the file's duration."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name,bit_rate,sample_rate:format=bit_rate,duration",
         "-of", "json", str(path)], capture_output=True, text=True, check=True).stdout
    info = json.loads(out)
    stream = (info.get("streams") or [{}])[0]
    fmt = info.get("format") or {}
    rate = stream.get("bit_rate") or fmt.get("bit_rate")
    return {
        "codec": stream.get("codec_name"),
        "bitrateKbps": round(int(rate) / 1000) if rate and str(rate).isdigit() else None,
        "sampleRate": int(stream["sample_rate"]) if stream.get("sample_rate") else None,
        "durationSec": round(float(fmt["duration"]), 2) if fmt.get("duration") else None,
    }


def spectrum_db(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """The song's average power spectrum (mono), smoothed, in dB relative to its strongest band below 5 kHz."""
    sr = sf.info(str(path)).samplerate
    n = QUALITY.n_fft
    window = np.hanning(n)
    total = np.zeros(n // 2 + 1)
    count = 0
    with sf.SoundFile(str(path)) as f:
        for start in range(0, max(0, f.frames - n), int(QUALITY.hop_sec * sr)):
            f.seek(start)
            x = f.read(n, dtype="float32", always_2d=True).mean(axis=1)
            total += np.abs(np.fft.rfft(x * window)) ** 2
            count += 1
    freqs = np.fft.rfftfreq(n, 1 / sr)
    db = 10 * np.log10(total / max(count, 1) + 1e-20)
    k = max(1, int(200 / (sr / n)))
    db = np.convolve(db, np.ones(k) / k, mode="same")
    ref = np.max(db[(freqs > 100) & (freqs < 5000)])
    return freqs, db - ref


def lowpass_hz(freqs: np.ndarray, db: np.ndarray) -> float | None:
    """Where a brick-wall low-pass cuts the spectrum (the highest such fall), or None for a natural roll-off."""
    step = freqs[1] - freqs[0]
    w = max(1, int(QUALITY.wall_hz / step))
    edge = len(freqs) - 2 * w  # the smoothing's edge effects
    for i in range(edge, int(4000 / step), -1):
        before = float(np.median(db[max(0, i - w):i]))
        after = db[i + w:edge + w]
        if len(after) and before - float(np.max(after)) >= QUALITY.wall_db:
            return round(float(freqs[i]), -1)
    return None


def song_quality(repertoire: repertoires.Repertoire, song: dict, audio: Path | None) -> dict:
    sid = int(song["id"])
    spotify = round(song["durationMs"] / 1000, 2) if isinstance(song.get("durationMs"), (int, float)) else None
    out: dict = {"id": sid, "spotifyDurationSec": spotify, "flags": []}
    if VERSION_WORDS.search(version_part(song.get("title", ""))):
        out["flags"].append("version_words")
    if audio is None:
        out["flags"].append("no_audio")
        return out
    out.update(probe(audio))
    if out.get("bitrateKbps") is not None and out["bitrateKbps"] < QUALITY.min_kbps:
        out["flags"].append("low_bitrate")
    if spotify and out.get("durationSec") and abs(out["durationSec"] - spotify) > QUALITY.max_duration_off_sec:
        out["flags"].append("duration_off")
    mix = repertoire.song_cache(sid) / "mix.flac"
    if mix.exists():
        cut = lowpass_hz(*spectrum_db(mix))
        out["lowpassHz"] = cut
        if cut is not None and cut < QUALITY.min_lowpass_hz:
            out["flags"].append("lowpass")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    repertoires.add_argument(ap)
    ap.add_argument("--song", type=int, action="append", help="song id (repeatable); default all")
    args = ap.parse_args()
    repertoire = repertoires.from_args(args)
    songs = [s for s in repertoire.songs() if not args.song or int(s["id"]) in args.song]
    audio = repertoire.audio_files()
    rows = [song_quality(repertoire, s, audio.get(int(s["id"]))) for s in songs]
    path = repertoire.data_dir / "quality.json"
    old = json.loads(path.read_text())["songs"] if path.exists() and args.song else []
    merged = {r["id"]: r for r in old} | {r["id"]: r for r in rows}
    doc = {"schemaVersion": SCHEMA_VERSION, "songs": [merged[k] for k in sorted(merged)]}
    doc["flagged"] = sum(1 for r in doc["songs"] if r["flags"])
    repertoire.data_dir.mkdir(parents=True, exist_ok=True)
    write_text_if_changed(path, json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
    for r in rows:
        if r["flags"]:
            title = next((s.get("title") for s in songs if int(s["id"]) == r["id"]), "")
            detail = f"{r.get('codec')} {r.get('bitrateKbps')} kbps, {r.get('durationSec')} s vs Spotify {r.get('spotifyDurationSec')} s, low-pass {r.get('lowpassHz')}"
            print(f"song {r['id']} {title}: {', '.join(r['flags'])} ({detail})")
    print(f"quality: {len(rows)} songs checked, {sum(1 for r in rows if r['flags'])} flagged → {repertoires.display(path)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
