#!/usr/bin/env python3

import argparse
import json
import subprocess
import sys
from pathlib import Path

def extract_song_id(filename: str) -> int | None:
    """Extract song ID from filename like '01 Song Name.mp3' or '1 Song.mp3'"""
    try:
        return int(filename.split(" ", 1)[0])
    except (ValueError, IndexError):
        return None

def run_ffmpeg(args: list[str], error_context: str) -> bool:
    """Run ffmpeg command with error handling"""
    try:
        subprocess.run(args, check=True, capture_output=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"{error_context}: {e.stderr.decode()}", file=sys.stderr)
        return False

def copy_file(src: Path, dst: Path, ffmpeg_bin: str) -> bool:
    """Copy file preserving metadata (album art, tags, etc.)"""
    return run_ffmpeg(
        [ffmpeg_bin, "-i", str(src), "-c", "copy", "-map_metadata", "0", str(dst), "-y"],
        f"Error copying {src.name}"
    )

def crop_file(src: Path, dst: Path, start_sec: float, ffmpeg_bin: str) -> bool:
    """Crop file from start_sec, preserving metadata and quality"""
    return run_ffmpeg(
        [
            ffmpeg_bin,
            "-ss", str(start_sec),
            "-i", str(src),
            "-map", "0:a",
            "-map", "0:v?",
            "-c:a", "libmp3lame", "-q:a", "0",
            "-c:v", "copy",
            "-map_metadata", "0",
            "-id3v2_version", "3",
            "-disposition:v", "attached_pic",
            str(dst), "-y"
        ],
        f"Error cropping {src.name}"
    )

def load_songs_json(json_path: Path) -> dict[int, dict]:
    """Load songs JSON and return dictionary indexed by song ID"""
    try:
        songs_list = json.loads(json_path.read_text(encoding="utf-8"))
        return {song["id"]: song for song in songs_list if "id" in song}
    except (FileNotFoundError, json.JSONDecodeError) as e:
        sys.exit(f"Error reading {json_path}: {e}")
    except KeyError as e:
        sys.exit(f"Invalid song data in {json_path}: {e}")

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Copy and crop audio files based on timestamp data"
    )
    parser.add_argument("--songs-json", required=True, help="Path to songs JSON file")
    parser.add_argument("--input-dir", default="output/songs", help="Input directory")
    parser.add_argument("--output-dir", default="output/cropped", help="Output directory")
    parser.add_argument("--ffmpeg-bin", default="ffmpeg", help="FFmpeg binary path")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing files")
    args = parser.parse_args()

    ffmpeg_path = subprocess.run(
        ["which", args.ffmpeg_bin], capture_output=True, text=True
    ).stdout.strip()
    
    if not ffmpeg_path:
        sys.exit(f'FFmpeg "{args.ffmpeg_bin}" not found in PATH')

    songs_by_id = load_songs_json(Path(args.songs_json))
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)

    if not input_dir.exists():
        sys.exit(f"Input directory does not exist: {input_dir}")
    
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Processing files...")
    cropped = 0
    copied = 0
    skipped = 0
    
    for src in sorted(input_dir.glob("*")):
        if not src.is_file() or src.name.startswith("."):
            continue
        
        dst = output_dir / src.name
        
        if dst.exists() and not args.overwrite:
            skipped += 1
            print(f"Skipping {src.name} (already exists)")
            continue
        
        song_id = extract_song_id(src.name)
        if song_id is None:
            if copy_file(src, dst, args.ffmpeg_bin):
                copied += 1
                print(f"✓ Copied {src.name} (no song ID)")
            continue
        
        song = songs_by_id.get(song_id)
        if song is None:
            if copy_file(src, dst, args.ffmpeg_bin):
                copied += 1
                print(f"✓ Copied {src.name} (not in JSON)")
            continue
        
        timestamp = song.get("timestamps", {}).get("main", [])
        if not timestamp:
            if copy_file(src, dst, args.ffmpeg_bin):
                copied += 1
                print(f"✓ Copied {src.name} (no timestamp)")
            continue
        
        start_sec = float(timestamp[0])
        if crop_file(src, dst, start_sec, args.ffmpeg_bin):
            cropped += 1
            print(f"✓ Cropped {src.name} from {start_sec}s")

    print(f"\nFinished! Cropped {cropped}, copied {copied}, skipped {skipped}.")


if __name__ == "__main__":
    main()
