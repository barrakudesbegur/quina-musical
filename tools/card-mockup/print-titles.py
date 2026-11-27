"""Clean print titles for the cards: Spotify's tags off, at most two artists, plus hand fixes.

A proposal waiting for the user's OK: the same clean title would show on paper, phones and the projector. Once agreed,
the data side (one optional field per song, kept in a tracked file) is Sound engine's.

    python3 tools/card-mockup/print-titles.py data/repertoires/2026/songs.json tools/card-mockup/data/songs-print.json
"""
import json
import re
import sys

# Brackets holding these words are tags, not part of the title: "(feat. X)", "(Radio Edit)", "(versión …)".
TAG = r'(remaster|remasterizado|version|versión|edit|mix|from |feat\.|ft\.|with |prod\.|live|en directo|mono|stereo|bonus|single|acoustic|deluxe)'

# Where the rules get it wrong, by song id.
HAND_FIXES = {
    90: {'printTitle': 'En el Amor Todo Es Empezar'},  # the rules keep "(A far l'amore comincia tu)"
}


def clean_title(title):
    title = re.sub(r'\s+-\s+.*$', '', title)  # " - Remastered 2016", " - Prod. …", " - W Sound 05"
    title = re.sub(r'\s*[\(\[][^\)\]]*' + TAG + r'[^\)\]]*[\)\]]', '', title, flags=re.I)
    return title.strip()


def clean_artist(artist):
    return ', '.join([p.strip() for p in artist.split(',')][:2])


def main(src, dst):
    songs = json.load(open(src, encoding='utf-8'))
    out = []
    for s in songs:
        song = {**s, 'printTitle': clean_title(s['title']), 'printArtist': clean_artist(s['artist'])}
        song.update(HAND_FIXES.get(s['id'], {}))
        out.append(song)
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    changed = [s for s in out if s['printTitle'] != s['title'] or s['printArtist'] != s['artist']]
    print(f'{len(changed)} of {len(out)} songs print differently from Spotify')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
