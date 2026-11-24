#!/usr/bin/env python3

import json
import sys
import os
import csv
import traceback
import html
import urllib.request
import urllib.error
from pathlib import Path

def main():
    if len(sys.argv) < 2:
        print("Usage: python fetch-playlist.py <playlist_id>", file=sys.stderr)
        print("\nExample: python fetch-playlist.py 7oNyO96MXA46l6KXpFgx9K", file=sys.stderr)
        sys.exit(1)
    
    playlist_id = sys.argv[1]
    playlist_url = f"https://open.spotify.com/playlist/{playlist_id}"
    raw_output_file = 'output/playlist-raw.json'
    summary_file = 'output/playlist.json'
    csv_file = 'output/songs.csv'
    json_file = 'output/songs.json'
    songs_dir = 'output/songs'
    
    # Create output directories if they don't exist
    Path('output').mkdir(exist_ok=True)
    Path(songs_dir).mkdir(exist_ok=True)
    
    print("Fetching playlist data...")
    try:
        # Fetch and save raw playlist metadata
        playlist_data = fetch_playlist(playlist_id)
        save_json(playlist_data, raw_output_file)
        print(f"✓ Saved {raw_output_file}")
        
        # Save playlist summary
        playlist_summary = create_playlist_summary(playlist_data)
        save_json(playlist_summary, summary_file)
        print(f"✓ Saved {summary_file}")
        
        # Save CSV with track list
        tracks_data = save_csv(playlist_data, csv_file)
        print(f"✓ Saved {csv_file}")
        
        # Save JSON with track list
        save_json(tracks_data, json_file)
        print(f"✓ Saved {json_file}")
        
        if playlist_data:
            name = playlist_data.get('name', 'Unknown')
            print(f"  Name: {name}")
            owner = playlist_data.get('owner', {}).get('display_name', 'Unknown')
            print(f"  Owner: {owner}")
            total = playlist_data.get('tracks', {}).get('total', 0)
            print(f"  Total tracks: {total}")

    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        print("\nFull traceback:", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

def fetch_playlist(playlist_id: str) -> dict:
    """Fetch playlist data from Spotify's public embed API."""
    # Use Spotify's embed/oembed API which doesn't require authentication
    embed_url = f"https://open.spotify.com/embed/playlist/{playlist_id}"
    
    # First get the access token from the embed page
    try:
        req = urllib.request.Request(embed_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            html_content = response.read().decode('utf-8')
            
        # Extract the access token from the HTML
        token_start = html_content.find('"accessToken":"')
        if token_start == -1:
            raise ValueError("Could not find access token in embed page")
        
        token_start += len('"accessToken":"')
        token_end = html_content.find('"', token_start)
        access_token = html_content[token_start:token_end]
        
    except urllib.error.URLError as e:
        raise ValueError(f"Failed to fetch embed page: {e}")
    
    # Now fetch the actual playlist data using the Spotify Web API
    api_url = f"https://api.spotify.com/v1/playlists/{playlist_id}"
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'User-Agent': 'Mozilla/5.0'
    }
    
    try:
        req = urllib.request.Request(api_url, headers=headers)
        with urllib.request.urlopen(req) as response:
            playlist_data = json.loads(response.read().decode('utf-8'))
        
        # Fetch all tracks if there are more than 100
        all_tracks = playlist_data['tracks']['items']
        next_url = playlist_data['tracks']['next']
        
        while next_url:
            req = urllib.request.Request(next_url, headers=headers)
            with urllib.request.urlopen(req) as response:
                tracks_data = json.loads(response.read().decode('utf-8'))
                all_tracks.extend(tracks_data['items'])
                next_url = tracks_data['next']
        
        playlist_data['tracks']['items'] = all_tracks
        
        return playlist_data
        
    except urllib.error.URLError as e:
        raise ValueError(f"Failed to fetch playlist data: {e}")

def get_largest_cover_url(images: list) -> str:
    """Return the URL of the largest cover art available."""
    if not images:
        return ''
    best = max(
        images,
        key=lambda img: (
            img.get('height') or 0,
            img.get('width') or 0
        )
    )
    return best.get('url', '')

def create_playlist_summary(playlist_data: dict) -> dict:
    """Create a summary of the playlist with key information."""
    title = playlist_data.get('name', 'Unknown Playlist')
    description = html.unescape(playlist_data.get('description', ''))
    
    images = playlist_data.get('images', [])
    cover_url = get_largest_cover_url(images)
    
    total_tracks = playlist_data.get('tracks', {}).get('total', 0)
    
    return {
        'title': title,
        'artist': 'Barrakudes',
        'cover': cover_url,
        'description': description,
        'totalTracks': total_tracks
    }

def save_json(data, filename: str) -> None:
    """Save data as JSON file."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def save_csv(playlist_data: dict, filename: str) -> list:
    """Save songs as CSV file."""
    tracks = []
    items = playlist_data.get('tracks', {}).get('items', [])
    
    for position, item in enumerate(items, start=1):
        if not item or not item.get('track'):
            continue
            
        track = item['track']
        
        # Get track name
        title = track.get('name', 'Unknown')
        
        # Get artists (join multiple artists with comma)
        artists = track.get('artists', [])
        artist_names = [a.get('name', '') for a in artists]
        artist = ', '.join(filter(None, artist_names)) or 'Unknown'

        # Get largest available cover from album
        album = track.get('album', {})
        images = album.get('images', [])
        cover_url = get_largest_cover_url(images)
        
        # Get Spotify track ID
        track_id = track.get('id', '')
        
        tracks.append({
            'id': position,
            'title': title,
            'artist': artist,
            'cover': cover_url,
            'spotifyId': track_id
        })
    
    # Write CSV
    with open(filename, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'title', 'artist', 'cover', 'spotifyId'])
        writer.writeheader()
        writer.writerows(tracks)
    
    return tracks

if __name__ == "__main__":
    main()

