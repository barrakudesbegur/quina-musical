#!/usr/bin/env python3

import json
import sys
import os
import csv
from pathlib import Path
from spotapi import Public
from spotapi.playlist import PublicPlaylist

def main():
    if len(sys.argv) < 2:
        print("Usage: python fetch-playlist.py <playlist_id>", file=sys.stderr)
        print("\nExample: python fetch-playlist.py 7oNyO96MXA46l6KXpFgx9K", file=sys.stderr)
        sys.exit(1)
    
    playlist_id = sys.argv[1]
    playlist_url = f"https://open.spotify.com/playlist/{playlist_id}"
    output_file = 'output/playlist.json'
    csv_file = 'output/songs.csv'
    json_file = 'output/songs.json'
    songs_dir = 'output/songs'
    
    # Create output directories if they don't exist
    Path('output').mkdir(exist_ok=True)
    Path(songs_dir).mkdir(exist_ok=True)
    
    print("Fetching playlist data...")
    try:
        # Fetch and save playlist metadata
        playlist_data = fetch_playlist(playlist_id)
        save_json(playlist_data, output_file)
        print(f"✓ Saved {output_file}")
        
        # Save CSV with track list
        tracks_data = save_csv(playlist_data, csv_file)
        print(f"✓ Saved {csv_file}")
        
        # Save JSON with track list
        save_json(tracks_data, json_file)
        print(f"✓ Saved {json_file}")
        
        if playlist_data:
            name = playlist_data.get('name', 'Unknown')
            print(f"  Name: {name}")
            owner = playlist_data.get('ownerV2', {}).get('data', {}).get('name', 'Unknown')
            print(f"  Owner: {owner}")
            content = playlist_data.get('content', {})
            total = content.get('totalCount', len(content.get('items', [])))
            print(f"  Total tracks: {total}")

    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)

def fetch_playlist(playlist_id: str) -> dict:
    temp_playlist = PublicPlaylist(playlist_id)
    full_response = temp_playlist.get_playlist_info(limit=343)
    if 'data' not in full_response or 'playlistV2' not in full_response['data']:
        return full_response
    playlist_data = full_response['data']['playlistV2']
    all_items = []
    for content_page in Public.playlist_info(playlist_id):
        if 'items' in content_page:
            all_items.extend(content_page['items'])
    playlist_data['content']['items'] = all_items
    return playlist_data

def save_json(data, filename: str) -> None:
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def save_csv(playlist_data: dict, filename: str) -> list:
    tracks = []
    content = playlist_data.get('content', {})
    items = content.get('items', [])
    
    for position, item in enumerate(items, start=1):
        item_data = item.get('itemV2', {}).get('data', {})
        
        # Get track name
        title = item_data.get('name', 'Unknown')
        
        # Get artists (join multiple artists with comma)
        artists_items = item_data.get('artists', {}).get('items', [])
        artist_names = [a.get('profile', {}).get('name', '') for a in artists_items]
        artist = ', '.join(filter(None, artist_names)) or 'Unknown'
        
        tracks.append({
            'id': position,
            'title': title,
            'artist': artist
        })
    
    # Write CSV
    with open(filename, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'title', 'artist'])
        writer.writeheader()
        writer.writerows(tracks)
    
    return tracks

if __name__ == "__main__":
    main()

