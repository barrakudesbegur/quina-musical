if [[ -z "$1" ]]; then
  echo "Error: playlist_id is required."
  echo "Usage: $0 <playlist_id>"
  exit 1
fi

playlist_id="$1"

python3 fetch.py "$playlist_id"

echo "Downloading songs..."
spotdl --output "output/songs/{list-position} - {title} - {artist}.{output-ext}" --bitrate disable "https://open.spotify.com/playlist/$playlist_id"

echo "✅ Done"