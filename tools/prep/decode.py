"""Decode each song of a repertoire to the PCM every later step reads: <cacheDir>/<id>/mix.flac.

48 kHz 16-bit FLAC, audio stream only (the MP3s embed cover art as a video stream):
    ffmpeg -nostdin -v error -i <source> -map 0:a -ar 48000 -c:a flac -sample_fmt s16 <out>

Idempotent. <cacheDir>/<id>/mix.json records the source it was decoded from (path, size, mtime, sha256):
a song is skipped while its source is unchanged, and decoded again when the source's content changes
(a re-fetched playlist can put another recording under the same id); every later step is keyed on the
MP3's sha256 or on mix.flac, so it redoes that song. A mix.flac without mix.json (written by the old
decode_all.sh) is adopted as it is, never re-decoded.

    tools/prep/.venv/bin/python tools/prep/decode.py [--repertoire NAME|PATH] [--song N ...] [--force]
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import repertoire as repertoires  # noqa: E402

FFMPEG_ARGS = ["-map", "0:a", "-ar", "48000", "-c:a", "flac", "-sample_fmt", "s16"]
META_VERSION = 1


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ffmpeg_version() -> str:
    try:
        line = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True,
                              check=False).stdout.splitlines()[0]
        return " ".join(line.split()[:3])
    except (OSError, IndexError):
        return "unknown"


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class DecodeError(Exception):
    pass


def _source_record(source: Path, digest: str | None = None) -> dict:
    st = source.stat()
    return {"path": repertoires.display(source, repertoires.REPO), "size": st.st_size, "mtimeNs": st.st_mtime_ns,
            "sha256": digest or sha256(source)}


def _write_meta(path: Path, source: dict, decoder: str, how: str) -> None:
    doc = {"schemaVersion": META_VERSION, "source": source, "decoder": decoder,
           "ffmpegArgs": FFMPEG_ARGS, how: now_iso()}
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(json.dumps(doc, indent=1) + "\n")
    os.replace(tmp, path)


def decode_song(repertoire: repertoires.Repertoire, song_id: int, source: Path, decoder: str, force: bool = False) -> str:
    """Bring <cacheDir>/<id>/mix.flac up to date with `source`. Returns what happened:
    'skipped', 'adopted', 'decoded' or 'redecoded'."""
    out = repertoire.mix_flac(song_id)
    meta_path = out.with_name("mix.json")
    status = "decoded"
    if out.is_file() and out.stat().st_size > 0 and not force:
        try:
            meta = json.loads(meta_path.read_text())
        except (OSError, ValueError):
            meta = None
        if meta is None:
            _write_meta(meta_path, _source_record(source), decoder, "adoptedAt")
            return "adopted"
        prev = meta.get("source", {})
        st = source.stat()
        if (prev.get("path"), prev.get("size"), prev.get("mtimeNs")) == \
                (repertoires.display(source, repertoires.REPO), st.st_size, st.st_mtime_ns):
            return "skipped"
        digest = sha256(source)
        if prev.get("sha256") == digest:  # touched or renamed, same content
            _write_meta(meta_path, _source_record(source, digest), meta.get("decoder", decoder),
                        "adoptedAt" if "adoptedAt" in meta else "decodedAt")
            return "skipped"
        status = "redecoded"
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_name("mix.tmp.flac")
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), *FFMPEG_ARGS, str(tmp)]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except OSError as err:
        raise DecodeError(f"cannot run ffmpeg: {err}") from None
    if proc.returncode != 0 or not tmp.is_file() or tmp.stat().st_size == 0:
        tmp.unlink(missing_ok=True)
        raise DecodeError(f"ffmpeg failed on {source.name}: {proc.stderr.strip()[-500:]}")
    os.replace(tmp, out)
    _write_meta(meta_path, _source_record(source), decoder, "decodedAt")
    return status


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    repertoires.add_argument(ap)
    ap.add_argument("--song", type=int, action="append", help="song id (repeatable); default all")
    ap.add_argument("--force", action="store_true", help="decode again even when up to date")
    args = ap.parse_args(argv)
    repertoire = repertoires.from_args(args)
    try:
        songs = repertoire.songs()
        audio = repertoire.audio_files()
    except repertoires.RepertoireError as err:
        print(f"decode: {err}", file=sys.stderr)
        return 1
    decoder = ffmpeg_version()
    if decoder == "unknown":
        print("decode: ffmpeg not found on PATH", file=sys.stderr)
        return 1
    wanted = set(args.song or [])
    ids = [s["id"] for s in songs if not wanted or s["id"] in wanted]
    unknown = sorted(wanted - set(ids))
    if unknown:
        print(f"decode: songs {unknown} are not in {repertoires.display(repertoire.songs_json, repertoires.REPO)}", file=sys.stderr)
        return 1
    extra = sorted(set(audio) - {s["id"] for s in songs})
    if extra and not wanted:
        print(f"note: audio files for ids not in songs.json are ignored: {extra}")
    counts: dict[str, int] = {}
    failed: list[str] = []
    for sid in ids:
        source = audio.get(sid)
        if source is None:
            failed.append(f"song {sid}: no audio file in {repertoires.display(repertoire.audio_dir, repertoires.REPO)} "
                          f"(expected {sid}.mp3 or '{sid} <title> - <artist>.mp3')")
            print("FAILED", failed[-1], flush=True)
            continue
        t0 = time.time()
        try:
            status = decode_song(repertoire, sid, source, decoder, args.force)
        except (DecodeError, OSError) as err:
            failed.append(f"song {sid}: {err}")
            print("FAILED", failed[-1], flush=True)
            continue
        counts[status] = counts.get(status, 0) + 1
        if status != "skipped":
            print(f"{sid:>4} {status} {source.name} ({time.time() - t0:.1f}s)", flush=True)
    summary = ", ".join(f"{n} {k}" for k, n in sorted(counts.items())) or "nothing to do"
    print(f"decode ({repertoire.name}): {len(ids)} songs: {summary}" + (f", {len(failed)} failed" if failed else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
