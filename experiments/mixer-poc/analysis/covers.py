"""Fetch each song's cover (songs.json `cover`, an image URL) to <coversDir>/<id>.jpg, which the relay
serves at /covers/<id>.jpg for the drum. Existing files are kept (--force fetches again); songs
without a URL are listed, since the drum shows them without art.

    analysis/.venv/bin/python analysis/covers.py [--pool NAME|PATH] [--song N ...] [--force]
"""
from __future__ import annotations

import argparse
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import pool as pools  # noqa: E402

TIMEOUT_SEC = 30
MAX_BYTES = 10 * 1000**2
# Spotify serves JPEG; PNG and WebP still display (browsers sniff the type).
IMAGE_MAGIC = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n", b"RIFF")


class CoverError(Exception):
    pass


def fetch(url: str, dest: Path) -> int:
    """Download `url` to `dest` atomically. Returns the size in bytes."""
    if not url.startswith(("https://", "http://", "file://")):
        raise CoverError(f"unsupported cover URL {url!r}")
    request = urllib.request.Request(url, headers={"User-Agent": "quina-mixer-poc/1"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SEC) as response:
            data = response.read(MAX_BYTES + 1)
    except (urllib.error.URLError, OSError, ValueError) as err:
        raise CoverError(f"{url}: {err}") from None
    if len(data) > MAX_BYTES:
        raise CoverError(f"{url}: larger than {MAX_BYTES // 1000**2} MB")
    if not data.startswith(IMAGE_MAGIC):
        raise CoverError(f"{url}: not an image")
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(f".{dest.name}.tmp")
    tmp.write_bytes(data)
    os.replace(tmp, dest)
    return len(data)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    pools.add_argument(ap)
    ap.add_argument("--song", type=int, action="append", help="song id (repeatable); default all")
    ap.add_argument("--force", action="store_true", help="fetch again even when the file exists")
    args = ap.parse_args(argv)
    pool = pools.from_args(args)
    try:
        songs = pool.songs()
    except pools.PoolError as err:
        print(f"covers: {err}", file=sys.stderr)
        return 1
    wanted = set(args.song or [])
    have = fetched = 0
    no_url: list[int] = []
    failed: list[str] = []
    for song in songs:
        sid = song["id"]
        if wanted and sid not in wanted:
            continue
        dest = pool.cover_path(sid)
        if dest.is_file() and dest.stat().st_size > 0 and not args.force:
            have += 1
            continue
        url = song.get("cover")
        if not isinstance(url, str) or not url:
            no_url.append(sid)
            continue
        try:
            size = fetch(url, dest)
        except CoverError as err:
            failed.append(f"song {sid}: {err}")
            print("FAILED", failed[-1], flush=True)
            continue
        fetched += 1
        print(f"{sid:>4} cover {size / 1000:.0f} kB", flush=True)
    if no_url:
        print(f"warning: no cover URL in songs.json for songs {no_url} (the drum shows them without art)")
    print(f"covers ({pool.name}) in {pools.display(pool.covers_dir, pools.REPO)}: {have} present, {fetched} fetched"
          + (f", {len(no_url)} without URL" if no_url else "") + (f", {len(failed)} failed" if failed else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
