# playlist-fetcher

Fetch Spotify playlist data and download songs using [SpotAPI](https://github.com/Aran404/SpotAPI) and [SpotDL](https://spotdl.readthedocs.io/).

```sh
# Install dependencies
# Install FFmpeg on your own
pip install -r requirements.txt

# Make the script executable
chmod +x main.sh

# Run the script
./main.sh <playlist_id|playlist_url>

# Crop downloaded songs from the first main timestamp to the end
python crop_songs.py --songs-json ../server/db/default/songs.json
```
