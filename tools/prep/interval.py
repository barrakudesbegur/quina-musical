"""The Interval playlist: the music of the break between rounds. Global, like Hold music: no pool owns it.

Usage (from the repo root):
    tools/prep/.venv/bin/python tools/prep/interval.py             # every track in data/media/interval/
    tools/prep/.venv/bin/python tools/prep/interval.py --force     # re-decode, re-run Beat This!, re-derive
    npm run prep -- --steps interval                           # the same, as a prepare step

Source: data/media/interval/ (gitignored), spotDL's `NN Title - Artist.mp3` files plus its
playlist.spotdl (a JSON list of the playlist's entries; `list_position` is the file's NN). Title and artist come
from the playlist entry; a file without one falls back to its own name.

  1. Match every file to its playlist entry by NN. An entry without a file is listed as missing.
  2. Play a recording once: a file whose normalized title, primary artist and duration (±1.5 s) repeat an earlier
     file's is dropped as its duplicate (the playlist has "New Look" twice, #04 and #16).
  3. Decode each kept track to cache/interval/<slug>.flac (48 kHz, stereo, 16-bit, audio stream only), the PCM the
     engine plays from /intervalaudio/<slug>.flac: every time below is in this file's timeline.
  4. Beat This! (cached in cache/interval/<slug>.raw.json, keyed by the source's sha256), the sub-frame beat
     refinement and the regularized downbeats of analyze.py, and the tempo.
  5. Loudness (integrated LUFS, true peak, the gain to -14 LUFS) and the edges: where the sound starts and ends,
     where the closing fade starts, and the first downbeat.
  6. Two kept tracks whose loudness envelopes are the same (and durations within 1.5 s) are one recording under
     two names: the later one is dropped too.

Writes data/interval/<slug>.json and data/interval/index.json (playlist order). Copyrighted audio and anything
decoded from it stays in cache/ (gitignored); data/interval/ holds only metadata and beat grids.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import subprocess
import sys
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from steps import beats as beats_step  # noqa: E402
from steps import loudness as loud_step  # noqa: E402
from steps import tempo as tempo_step  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent  # the repo: the paths stored in index.json are relative to it
SOURCE = ROOT / "data/media/interval"
CACHE = ROOT / "data/cache/interval"
OUT = ROOT / "data/out/interval"
PLAYLIST = "playlist.spotdl"
EXTENSIONS = {".mp3", ".m4a", ".opus", ".ogg", ".flac", ".wav"}

SR = 48000
RAW_VERSION = 1
SCHEMA_VERSION = 1
DERIVE_VERSION = 2
TARGET_LUFS = loud_step.TARGET_LUFS

SLUG_MAX = 60
# Same recording: the same normalized title and primary artist, durations within this.
DUPLICATE_MAX_SEC = 1.5
# Same recording by ear: loudness envelopes (0.5 s RMS in dB) that correlate this well, within ±3 s of lag.
ENVELOPE_HOP_SEC = 0.5
ENVELOPE_MAX_LAG_SEC = 3.0
SAME_ENVELOPE_CORR = 0.97
# Edges: 10 ms frames; the sound starts/ends where a frame is within EDGE_REL_DB of the track's median 1 s level
# (and above EDGE_FLOOR_DB); the closing fade starts after the last 1 s window within FADE_DROP_DB of it.
FRAME_SEC = 0.01
EDGE_REL_DB = 35.0
EDGE_FLOOR_DB = -60.0
FADE_DROP_DB = 6.0
FADE_WINDOW_SEC = 1.0
FADE_HOP_SEC = 0.25
FIRST_DOWNBEAT_TOLERANCE_SEC = 0.05
# Flags for an audition pass.
SHORT_SEC = 45.0
LONG_FADE_SEC = 15.0
FAST_BPM = 135.0


# --------------------------------------------------------------------------------------------- metadata (pure)

@dataclass
class Track:
    """One audio file of the folder, with what the playlist says about it."""

    file: str
    position: int | None
    title: str
    artist: str
    artists: list[str]
    spotify_id: str | None = None
    duration_sec: float | None = None
    slug: str = ""
    duplicate_of: int | None = None  # the kept track's position
    duplicate_reason: str = ""


FILE_NAME = re.compile(r"^(\d+)\s+(.*)$")


def parse_file_name(name: str) -> tuple[int | None, str, str]:
    """spotDL's `NN Title - Artist.ext` → (NN, title, artist). The artist is after the last " - "."""
    stem = Path(name).stem
    match = FILE_NAME.match(stem)
    position = int(match.group(1)) if match else None
    rest = match.group(2) if match else stem
    title, sep, artist = rest.rpartition(" - ")
    return (position, title.strip(), artist.strip()) if sep else (position, rest.strip(), "")


def read_playlist(text: str) -> dict[int, dict]:
    """playlist.spotdl → its entries by `list_position`. Entries without a position are ignored."""
    doc = json.loads(text)
    entries = doc if isinstance(doc, list) else doc.get("songs", []) if isinstance(doc, dict) else []
    out: dict[int, dict] = {}
    for entry in entries:
        if isinstance(entry, dict) and isinstance(entry.get("list_position"), int):
            out.setdefault(entry["list_position"], entry)
    return out


def match_tracks(files: list[str], playlist: dict[int, dict]) -> tuple[list[Track], list[dict]]:
    """Every file with its playlist entry (by NN), in playlist order, and the entries no file has."""
    tracks = []
    for name in files:
        position, title, artist = parse_file_name(name)
        entry = playlist.get(position) if position is not None else None
        if entry:
            artists = [a for a in entry.get("artists") or [] if isinstance(a, str) and a]
            title = entry.get("name") or title
            artist = entry.get("artist") or (artists[0] if artists else artist)
            tracks.append(Track(name, position, title, artist, artists or [artist], entry.get("song_id"),
                                float(entry["duration"]) if isinstance(entry.get("duration"), (int, float)) else None))
        else:
            tracks.append(Track(name, position, title, artist, [artist] if artist else []))
    have = {t.position for t in tracks}
    missing = [{"position": p, "title": e.get("name"), "artist": e.get("artist")}
               for p, e in sorted(playlist.items()) if p not in have]
    tracks.sort(key=lambda t: (t.position is None, t.position or 0, t.file))
    return tracks, missing


def norm(text: str) -> str:
    """Lowercase ASCII words: "New Look (Wii U Mii Maker Lofi Mix)" and "New Look - Wii U…" are the same, and
    an apostrophe joins its word ("Beedle's" → "beedles")."""
    ascii_text = unicodedata.normalize("NFKD", text.replace("'", "").replace("’", "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", ascii_text.lower()).strip()


def dedupe(tracks: list[Track]) -> tuple[list[Track], list[Track]]:
    """Keep the first of every recording: a later track with the same normalized title and primary artist and
    a duration within DUPLICATE_MAX_SEC (when both are known) is its duplicate."""
    kept: list[Track] = []
    dropped: list[Track] = []
    for track in tracks:
        twin = next((k for k in kept if norm(k.title) == norm(track.title) and norm(k.artist) == norm(track.artist)
                     and (k.duration_sec is None or track.duration_sec is None
                          or abs(k.duration_sec - track.duration_sec) <= DUPLICATE_MAX_SEC)), None)
        if twin:
            track.duplicate_of = twin.position
            track.duplicate_reason = "same title, artist and duration"
            dropped.append(track)
        else:
            kept.append(track)
    return kept, dropped


def slugify(title: str, artist: str, taken: set[str]) -> str:
    """`title-artist` as lowercase ASCII words joined by "-", at most SLUG_MAX characters: the artist only when it
    fits whole, the title cut at a word. Unique among `taken` (which it extends). The file name in cache/ and
    data/, and the URL."""
    title_words = norm(title).split() or ["track"]
    both = "-".join(title_words + norm(artist).split())
    if len(both) <= SLUG_MAX:
        slug = both
    else:
        slug = ""
        for word in title_words:
            candidate = f"{slug}-{word}" if slug else word
            if len(candidate) > SLUG_MAX:
                break
            slug = candidate
        slug = slug or title_words[0][:SLUG_MAX]
    unique, n = slug, 2
    while unique in taken:
        suffix = f"-{n}"
        unique = slug[:SLUG_MAX - len(suffix)].rstrip("-") + suffix
        n += 1
    taken.add(unique)
    return unique


# --------------------------------------------------------------------------------------------- audio (pure)

def frames_db(signal: np.ndarray, sr: int, frame_sec: float, hop_sec: float | None = None) -> np.ndarray:
    """RMS in dBFS of `frame_sec` windows every `hop_sec` (default: the frame), stereo mean square."""
    power = np.square(signal, dtype=np.float64).mean(axis=1) if signal.ndim == 2 else np.square(signal, dtype=np.float64)
    frame = max(1, int(round(frame_sec * sr)))
    hop = max(1, int(round((hop_sec or frame_sec) * sr)))
    csum = np.concatenate([[0.0], np.cumsum(power)])
    starts = np.arange(0, max(1, len(power) - frame + 1), hop)
    mean = (csum[np.minimum(starts + frame, len(power))] - csum[starts]) / frame
    return 10 * np.log10(np.maximum(mean, 1e-12))


def edges(signal: np.ndarray, sr: int, downbeats: np.ndarray) -> dict:
    """Where the sound starts and ends, where the closing fade starts, and the first downbeat of the music."""
    duration = len(signal) / sr
    windows = frames_db(signal, sr, FADE_WINDOW_SEC, FADE_HOP_SEC)
    ref = float(np.median(windows)) if len(windows) else -120.0
    frames = frames_db(signal, sr, FRAME_SEC)
    audible = np.flatnonzero(frames >= max(EDGE_FLOOR_DB, ref - EDGE_REL_DB))
    start = float(audible[0] * FRAME_SEC) if len(audible) else 0.0
    end = float(min(duration, (audible[-1] + 1) * FRAME_SEC)) if len(audible) else duration
    loud = np.flatnonzero(windows >= ref - FADE_DROP_DB)
    fade = float(min(end, loud[-1] * FADE_HOP_SEC + FADE_WINDOW_SEC)) if len(loud) else end
    # The regularized grid may reach a few ms before the file's start: that downbeat is the file's start.
    first = next((max(0.0, float(d)) for d in downbeats if d >= start - FIRST_DOWNBEAT_TOLERANCE_SEC), None)
    return {"startSec": round(start, 3), "endSec": round(end, 3), "fadeStartSec": round(max(start, fade), 3),
            "firstDownbeatSec": None if first is None else round(first, 4), "medianLevelDb": round(ref, 2)}


def same_recording(a: np.ndarray, b: np.ndarray, hop_sec: float = ENVELOPE_HOP_SEC) -> float:
    """The best correlation of two loudness envelopes (dB) within ±ENVELOPE_MAX_LAG_SEC: ~1 for one recording."""
    max_lag = int(round(ENVELOPE_MAX_LAG_SEC / hop_sec))
    best = -1.0
    for lag in range(-max_lag, max_lag + 1):
        x, y = (a[lag:], b) if lag >= 0 else (a, b[-lag:])
        n = min(len(x), len(y))
        if n < 8:
            continue
        x, y = x[:n], y[:n]
        if np.std(x) < 1e-6 or np.std(y) < 1e-6:
            continue
        best = max(best, float(np.corrcoef(x, y)[0, 1]))
    return best


# --------------------------------------------------------------------------------------------- the work

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def probe_duration(path: Path) -> float | None:
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                             capture_output=True, text=True, check=False).stdout.strip()
        return float(out.splitlines()[0])
    except (OSError, ValueError, IndexError):
        return None


def ffmpeg_version() -> str:
    try:
        line = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, check=False).stdout.splitlines()[0]
        return " ".join(line.split()[:3])
    except (OSError, IndexError):
        return "unknown"


def decode(src: Path, flac: Path) -> None:
    flac.parent.mkdir(parents=True, exist_ok=True)
    tmp = flac.with_suffix(".tmp.flac")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(src), "-map", "0:a:0", "-ar", str(SR),
                    "-ac", "2", "-c:a", "flac", "-sample_fmt", "s16", str(tmp)], check=True)
    tmp.replace(flac)


def load_raw(src: Path, flac: Path, raw_path: Path, digest: str, force: bool) -> dict:
    """Decode and run Beat This! once per source content (sha256); later runs re-derive from the cache."""
    if raw_path.exists() and flac.exists() and not force:
        raw = json.loads(raw_path.read_text())
        if raw.get("sha256") == digest and raw.get("rawVersion") == RAW_VERSION:
            return raw
    import soundfile as sf

    decode(src, flac)
    signal, sr = sf.read(flac, dtype="float32", always_2d=True)
    t0 = time.time()
    beats, downbeats = beats_step.run_beat_this(signal, sr)
    raw = {
        "rawVersion": RAW_VERSION,
        "sha256": digest,
        "source": src.name,
        "sampleRate": sr,
        "frames": len(signal),
        "beatsRaw": [round(float(b), 4) for b in beats],
        "downbeatsRaw": [round(float(b), 4) for b in downbeats],
        "decoder": ffmpeg_version(),
        "beatThisSec": round(time.time() - t0, 2),
    }
    raw_path.write_text(json.dumps(raw))
    return raw


def derive(track: Track, raw: dict, signal: np.ndarray, sr: int) -> dict:
    """The beat grid, tempo, loudness and edges of one decoded track."""
    beats_raw = np.asarray(raw["beatsRaw"], dtype=float)
    db_idx = beats_step.downbeat_indices(beats_raw, np.asarray(raw["downbeatsRaw"], dtype=float))
    beats, refined = beats_step.refine_beats(beats_raw)
    flags: list[str] = []
    bpb = beats_step.beats_per_bar(db_idx)
    if bpb < 2:
        flags.append("meter_unknown")
        bpb = 4
    db_idx, reg = beats_step.regularize_downbeats(len(beats), db_idx, bpb)
    downbeats = beats[db_idx] if len(db_idx) else np.asarray([])
    tempo = tempo_step.tempo_summary(beats, downbeats, bpb)
    tempo["regularized"] = reg
    tempo["refinedBeatShare"] = round(refined / max(1, len(beats)), 3)
    lufs = loud_step.integrated(signal, sr)
    lufs = float(lufs) if np.isfinite(lufs) else None
    edge = edges(signal, sr, downbeats)
    duration = len(signal) / sr
    if len(downbeats) < 4:
        flags.append("no_downbeats")
    if not tempo["isStable"]:
        flags.append("tempo_unstable")
    if len(beats) and refined / len(beats) < 0.6:
        flags.append("grid_irregular")
    if bpb != 4:
        flags.append(f"meter_{bpb}")
    if tempo["bpm"] > FAST_BPM:
        flags.append("fast_tempo")  # maybe double time: the echo's delay and the bars are then halved
    if duration < SHORT_SEC:
        flags.append("short")
    if edge["endSec"] - edge["fadeStartSec"] > LONG_FADE_SEC:
        flags.append("long_fade")
    return {
        "durationSec": round(duration, 4),
        "tempo": {k: tempo[k] for k in ("bpm", "beatsPerBar", "barSecMedian", "barSecIqrPct", "isStable", "regularized",
                                        "refinedBeatShare")},
        "beats": [round(float(b), 4) for b in beats],
        "downbeats": [round(float(d), 4) for d in downbeats],
        "edges": edge,
        "loudness": {
            "integratedLufs": None if lufs is None else round(lufs, 2),
            "truePeakDbtp": round(loud_step.true_peak_dbtp(signal), 2),
            "gainToTargetDb": loud_step.gain_to_target(lufs),
        },
        "flags": flags,
    }


def write_if_changed(path: Path, doc: dict) -> bool:
    """Write `doc` unless the file already holds the same content apart from its `createdAt`."""
    if path.exists():
        try:
            old = json.loads(path.read_text())
            if {k: v for k, v in old.items() if k != "createdAt"} == {k: v for k, v in doc.items() if k != "createdAt"}:
                return False
        except ValueError:
            pass
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=1, allow_nan=False) + "\n")
    return True


def analyze(track: Track, src: Path, out: Path, cache: Path, force: bool) -> dict:
    """Decode, analyse and write one kept track (skipped while its source, decode and derivation are current)."""
    import soundfile as sf

    flac = cache / f"{track.slug}.flac"
    digest = sha256(src)
    out_path = out / f"{track.slug}.json"
    if out_path.exists() and flac.exists() and not force:
        try:
            prev = json.loads(out_path.read_text())
        except ValueError:
            prev = {}
        if (prev.get("source", {}).get("sha256") == digest and prev.get("deriveVersion") == DERIVE_VERSION
                and prev.get("schemaVersion") == SCHEMA_VERSION and prev.get("title") == track.title
                and prev.get("artist") == track.artist and prev.get("position") == track.position):
            print(f"{track.position or '-':>3} {track.slug}: up to date")
            return prev
    raw = load_raw(src, flac, cache / f"{track.slug}.raw.json", digest, force)
    signal, sr = sf.read(flac, dtype="float32", always_2d=True)
    doc = {
        "schemaVersion": SCHEMA_VERSION,
        "deriveVersion": DERIVE_VERSION,
        "slug": track.slug,
        "title": track.title,
        "artist": track.artist,
        "artists": track.artists,
        "position": track.position,
        "spotifyId": track.spotify_id,
        "source": {"file": track.file, "sha256": digest, "decoder": raw.get("decoder")},
        "pcm": f"cache/interval/{track.slug}.flac",
        "sampleRate": sr,
        **derive(track, raw, signal, sr),
        "createdAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    changed = write_if_changed(out_path, doc)
    print(f"{track.position or '-':>3} {track.slug}: {doc['tempo']['bpm']} BPM, {doc['durationSec']:.0f} s, "
          f"gain {doc['loudness']['gainToTargetDb']:+.1f} dB{' ' + ','.join(doc['flags']) if doc['flags'] else ''}"
          f"{'' if changed else ' (unchanged)'}")
    return doc


def envelope(flac: Path) -> np.ndarray:
    """The loudness envelope of a decoded track (ENVELOPE_HOP_SEC RMS in dB)."""
    import soundfile as sf

    signal, sr = sf.read(flac, dtype="float32", always_2d=True)
    return frames_db(signal, sr, ENVELOPE_HOP_SEC)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--source", type=Path, default=SOURCE, help="the folder of the playlist's files and playlist.spotdl")
    ap.add_argument("--out", type=Path, default=OUT, help="where the JSON goes (default data/interval)")
    ap.add_argument("--cache", type=Path, default=CACHE, help="where the decoded audio goes (default cache/interval)")
    ap.add_argument("--force", action="store_true", help="re-decode, re-run Beat This!, re-derive")
    args = ap.parse_args(argv)
    source, out, cache = args.source.resolve(), args.out.resolve(), args.cache.resolve()
    if not source.is_dir():
        print(f"interval: {source} does not exist; nothing to do")
        return 0
    playlist_path = source / PLAYLIST
    playlist = read_playlist(playlist_path.read_text()) if playlist_path.exists() else {}
    files = sorted(p.name for p in source.iterdir() if p.suffix.lower() in EXTENSIONS and not p.name.startswith("."))
    tracks, missing = match_tracks(files, playlist)
    for track in tracks:
        track.duration_sec = probe_duration(source / track.file) or track.duration_sec
    kept, dropped = dedupe(tracks)
    taken: set[str] = set()
    for track in kept:
        track.slug = slugify(track.title, track.artist, taken)
    out.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True, exist_ok=True)

    docs: list[dict] = []
    envelopes: dict[str, np.ndarray] = {}

    def envelope_of(slug: str) -> np.ndarray:
        if slug not in envelopes:
            envelopes[slug] = envelope(cache / f"{slug}.flac")
        return envelopes[slug]

    for track in kept:
        doc = analyze(track, source / track.file, out, cache, args.force)
        # One recording under two names: a later track that sounds the same as a kept one (durations close) is
        # dropped too. Envelopes are read only for such pairs.
        twin = next((d for d in docs if abs(d["durationSec"] - doc["durationSec"]) <= DUPLICATE_MAX_SEC
                     and same_recording(envelope_of(d["slug"]), envelope_of(doc["slug"])) >= SAME_ENVELOPE_CORR), None)
        if twin:
            track.duplicate_of, track.duplicate_reason = twin["position"], "same loudness envelope"
            dropped.append(track)
            continue
        docs.append(doc)

    index = {
        "schemaVersion": SCHEMA_VERSION,
        "targetLufs": TARGET_LUFS,
        "sampleRate": SR,
        "playlist": next(({"name": e.get("list_name"), "url": e.get("list_url"), "length": e.get("list_length")}
                          for e in playlist.values()), None),
        "tracks": [{
            "slug": d["slug"], "title": d["title"], "artist": d["artist"], "position": d["position"],
            "durationSec": d["durationSec"], "bpm": d["tempo"]["bpm"], "flags": d["flags"],
            "json": f"data/interval/{d['slug']}.json",
        } for d in docs],
        "dropped": [{"file": t.file, "position": t.position, "title": t.title, "artist": t.artist,
                     "duplicateOf": t.duplicate_of, "reason": t.duplicate_reason} for t in dropped],
        "missing": missing,
    }
    write_if_changed(out / "index.json", index)
    print(f"index.json: {len(docs)} tracks, {len(dropped)} duplicates dropped"
          + "".join(f"\n  dropped #{t.position} {t.title} (= #{t.duplicate_of}: {t.duplicate_reason})" for t in dropped)
          + "".join(f"\n  missing #{m['position']} {m['title']}: no file" for m in missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
