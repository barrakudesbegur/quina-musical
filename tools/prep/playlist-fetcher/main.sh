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
# --format opus with --bitrate disable keeps YouTube's own Opus stream (copied, not re-encoded to MP3).
spotdl --output "output/songs/{list-position} {title} - {artist}.{output-ext}" --format opus --bitrate disable "https://open.spotify.com/playlist/$playlist_id"

echo "✅ Done"