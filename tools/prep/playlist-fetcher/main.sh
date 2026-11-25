if [[ -z "$1" ]]; then
  echo "Error: playlist_id or playlist URL is required."
  echo "Usage: $0 <playlist_id|playlist_url>"
  exit 1
fi

input="$1"

if [[ "$input" =~ open\.spotify\.com/playlist/([a-zA-Z0-9]+) ]]; then
  playlist_id="${BASH_REMATCH[1]}"
else
  playlist_id="$input"
fi

python3 fetch.py "$playlist_id"

echo "Downloading songs..."
# Files are named by Spotify id (tools/prep/pool.py maps them to playlist positions through songs.json), so a
# reordered playlist re-downloads nothing; a rerun fetches only the songs not downloaded yet.
# --format opus with --bitrate disable keeps YouTube's own Opus stream (copied, not re-encoded to MP3).
# One song at a time with short pauses. YouTube asks a VPN's address to sign in ("confirm you're not a bot"):
# download with the VPN off.
spotdl download "https://open.spotify.com/playlist/$playlist_id" \
  --output "output/songs/{track-id}.{output-ext}" --format opus --bitrate disable \
  --threads 1 --lyrics --yt-dlp-args "--sleep-requests 0.75 --sleep-interval 3 --max-sleep-interval 8" \
  --print-errors --save-errors output/download-errors.txt

echo "✅ Done"