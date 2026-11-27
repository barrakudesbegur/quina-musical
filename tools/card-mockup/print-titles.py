"""Clean print titles for the cards: Spotify's tags off, the main artist only, plus hand fixes.

Agreed by the user (27 Nov): "clean the song titles, and also artists (many times it is fine to not put all, it is just
for reference doesnt need to be fully accurate)". The same clean title shows on paper, phones and the projector; the
data side (one optional field per song, kept in a tracked file) is Sound engine's.

    python3 tools/card-mockup/print-titles.py data/repertoires/2026/songs.json tools/card-mockup/data/songs-print.json
"""
import json
import re
import sys

# Brackets holding these words are tags, not part of the title: "(feat. X)", "(Radio Edit)", "(versión …)".
TAG = r'(remaster|remasterizado|version|versión|edit|mix|from |feat\.|ft\.|with |prod\.|live|en directo|mono|stereo|bonus|single|acoustic|deluxe)'

# Where the rules get it wrong, by song id.
HAND_FIXES = {
    6: {'printTitle': 'Bailando por Ahí'},
    22: {'printTitle': 'El Último Vals'},
    24: {'printTitle': 'Fashion Girl'},  # "pt.2"
    50: {'printArtist': 'Comando Tiburón'},
    55: {'printArtist': 'La Quinta Estación'},
    90: {'printTitle': 'En el Amor Todo Es Empezar'},  # the rules keep "(A far l'amore comincia tu)"
    93: {'printTitle': 'Hay Que Venir al Sur'},  # Spotify's typo "Quel"
    106: {'printArtist': 'La Quinta Estación'},
    128: {'printTitle': 'Aserejé'},  # the user: "Asereje should just be called asereje" (#5 is the same song, kept for now)
}

# Duets known by both names keep the two.
KEEP_TWO = {70, 97, 129}  # Travolta & Newton-John, Carlos Vives & Shakira, Pitbull & Kesha


def clean_title(title):
    title = re.sub(r'\s+-\s+.*$', '', title)  # " - Remastered 2016", " - Prod. …", " - W Sound 05"
    title = re.sub(r'\s*[\(\[][^\)\]]*' + TAG + r'[^\)\]]*[\)\]]', '', title, flags=re.I)
    return title.strip()


def clean_artist(artist, keep):
    return ', '.join([p.strip() for p in artist.split(',')][:keep])


def main(src, dst):
    songs = json.load(open(src, encoding='utf-8'))
    out = []
    for s in songs:
        song = {**s, 'printTitle': clean_title(s['title']), 'printArtist': clean_artist(s['artist'], 2 if s['id'] in KEEP_TWO else 1)}
        song.update(HAND_FIXES.get(s['id'], {}))
        out.append(song)
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    changed = [s for s in out if s['printTitle'] != s['title'] or s['printArtist'] != s['artist']]
    print(f'{len(changed)} of {len(out)} songs print differently from Spotify')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
