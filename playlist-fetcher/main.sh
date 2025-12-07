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
spotdl --output "output/songs/{list-position} {title} - {artist}.{output-ext}" --bitrate disable "https://open.spotify.com/playlist/$playlist_id"

echo "✅ Done"