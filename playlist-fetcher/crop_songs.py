#!/usr/bin/env python3

import argparse
import json
import shutil
import sys
from pathlib import Path

from pydub import AudioSegment

def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--songs-json", required=True)
    p.add_argument("--input-dir", default="output/songs")
    p.add_argument("--output-dir", default="output/cropped")
    p.add_argument("--ffmpeg-bin", default="ffmpeg")
    p.add_argument("--overwrite", action="store_true")
    args = p.parse_args()

    if shutil.which(args.ffmpeg_bin) is None:
        sys.exit(f'FFmpeg "{args.ffmpeg_bin}" not found')
    AudioSegment.converter = args.ffmpeg_bin

    songs = json.loads(Path(args.songs_json).read_text(encoding="utf-8"))
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    done = 0
    for song in songs:
        song_id = song.get("id")
        main_ts = (song.get("timestamps") or {}).get("main") or []
        if not main_ts:
            continue
        start_ms = int(float(main_ts[0]) * 1000)

        src = None
        for prefix in (str(song_id), str(song_id).zfill(2), str(song_id).zfill(3)):
            match = sorted(input_dir.glob(f"{prefix} *"))
            if match:
                src = match[0]
                break
        if src is None:
            continue

        dst = output_dir / src.name
        if dst.exists() and not args.overwrite:
            continue

        audio = AudioSegment.from_file(src)
        audio[start_ms:].export(dst, format=src.suffix.lstrip(".") or "mp3")
        done += 1
        print(f"Cropped {src.name}")

    print(f"Finished. Cropped {done} file(s).")


if __name__ == "__main__":
    main()

# # TODO
# - If timestamp not found, just copy the original
# - Keep file metadata (album cover, etc)
# - Quality decreases a lot! keep original quality
# - It's better if you initially copy all the files and then proces them one by one, finding them in them in the json.
