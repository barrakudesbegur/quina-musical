#!/usr/bin/env python3

import json
import sys
import os
import csv
import traceback
import html
from pathlib import Path
from spotapi import Public
from spotapi.playlist import PublicPlaylist

import song_ids

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
            owner = playlist_data.get('ownerV2', {}).get('data', {}).get('name', 'Unknown')
            print(f"  Owner: {owner}")
            content = playlist_data.get('content', {})
            total = content.get('totalCount', len(content.get('items', [])))
            print(f"  Total tracks: {total}")

    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        print("\nFull traceback:", file=sys.stderr)
        traceback.print_exc()
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

def get_largest_cover_url(sources: list) -> str:
    """Return the URL of the largest cover art source available."""
    if not sources:
        return ''
    best = max(
        sources,
        key=lambda src: (
            src.get('height') or 0,
            src.get('width') or 0
        )
    )
    return best.get('url', '')

def create_playlist_summary(playlist_data: dict) -> dict:
    """Create a summary of the playlist with key information."""
    title = playlist_data.get('name', 'Unknown Playlist')
    description = html.unescape(playlist_data.get('description', ''))
    
    cover_sources = playlist_data.get('images', {}).get('items', [])
    if not cover_sources:
        cover_sources = playlist_data.get('images', {}).get('sources', [])
    else:
        cover_sources = cover_sources[0].get('sources', []) if cover_sources else []
    cover_url = get_largest_cover_url(cover_sources)
    
    content = playlist_data.get('content', {})
    total_tracks = content.get('totalCount', len(content.get('items', [])))
    
    return {
        'title': title,
        'artist': 'Barrakudes',
        'cover': cover_url,
        'description': description,
        'totalTracks': total_tracks
    }

def save_json(data, filename: str) -> None:
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def save_csv(playlist_data: dict, filename: str) -> list:
    tracks = []
    content = playlist_data.get('content', {})
    items = content.get('items', [])
    
    for position, item in enumerate(items, start=1):
        item_data = item.get('itemV2', {}).get('data', {})
        uri = item_data.get('uri', '')
        if not uri.startswith('spotify:track:'):
            raise ValueError(f"playlist position {position} is not a Spotify track ({uri or 'no uri'}): take it off the playlist")
        
        # Get track name
        title = item_data.get('name', 'Unknown')
        
        # Get artists (join multiple artists with comma)
        artists_items = item_data.get('artists', {}).get('items', [])
        artist_names = [a.get('profile', {}).get('name', '') for a in artists_items]
        artist = ', '.join(filter(None, artist_names)) or 'Unknown'

        # Get largest available cover
        cover_sources = item_data.get('albumOfTrack', {}).get('coverArt', {}).get('sources', [])
        cover_url = get_largest_cover_url(cover_sources)
        
        # Spotify's length and id: tools/prep/quality.py flags a download whose length is off (another version).
        duration_ms = item_data.get('trackDuration', {}).get('totalMilliseconds')
        tracks.append({
            'id': None,
            'title': title,
            'artist': artist,
            'cover': cover_url,
            'durationMs': duration_ms if isinstance(duration_ms, int) else None,
            'spotifyId': uri.split(':')[-1],
        })

    # A track listed twice keeps its first place, with a warning: the playlist still needs fixing, but the fetch goes on.
    seen = set()
    unique = []
    for position, track in enumerate(tracks, start=1):
        if track['spotifyId'] in seen:
            print(f"⚠️  playlist position {position} repeats \"{track['title']}\" ({track['artist']}): kept once", file=sys.stderr)
            continue
        seen.add(track['spotifyId'])
        unique.append(track)
    tracks = unique

    # Stable ids: a track keeps the id it got when first fetched, so a reordered playlist moves no hook decision,
    # cache or download onto another song (song_ids.py).
    record_path = Path(filename).parent / 'song-ids.json'
    ids, record = song_ids.assign_ids([t['spotifyId'] for t in tracks], song_ids.load(record_path))
    for track, sid in zip(tracks, ids):
        track['id'] = sid
    song_ids.save(record_path, record)
    
    # Write CSV
    with open(filename, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'title', 'artist', 'cover', 'durationMs', 'spotifyId'])
        writer.writeheader()
        writer.writerows(tracks)
    
    return tracks

if __name__ == "__main__":
    main()

