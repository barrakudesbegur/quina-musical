"""A repertoire's songs.json from its pools' playlists (tools/prep/pools.py)."""
from __future__ import annotations

import json

import pytest

import pools


def song(title: str, artist: str = "A", sid: str | None = None, id: int | None = None) -> dict:
    return {"id": id, "title": title, "artist": artist, "spotifyId": sid or f"sp-{title}-{artist}"}


def spec(pool: str, ids: str = "keep", first: int | None = None) -> pools.PoolSpec:
    return pools.PoolSpec(pool, None, ids, first)  # type: ignore[arg-type]


def test_letter_by_letter_title_order_u58():
    titles = ["6 DE FEBRERO", "a la freSka", "AL GOLPITO", "All I Want for Christmas Is You", "A quién le importa",
              "Elefants", "El Ultimo Vals", "El universo sobre mí", "La Gozadera", "Las Divinas", "L'Empordà",
              "Only Girl (In The World)", "On The Floor", "Te Estoy Amando Locamente", "Tenía Tanto Que Darte",
              "The Fate of Ophelia", "Timber", "Una Vaina Loca", "Un Beso Y Una Flor"]
    assert sorted(titles, key=pools.title_key) == titles
    assert [s["title"] for s in pools.out_of_order([song(t) for t in ["Baila", "Abba", "Cami"]])] == ["Abba"]


def test_the_same_song_is_a_single_and_its_album_track_or_a_feat_suffix():
    assert pools.song_key(song("NI BORRACHO", "Quevedo")) == pools.song_key(song("Ni Borracho", "Quevedo, Other"))
    assert pools.song_key(song("Rain Over Me (feat. Marc Anthony)", "Pitbull")) == pools.song_key(song("Rain Over Me", "Pitbull"))
    assert pools.song_key(song("Cheerleader - Radio Edit", "OMI")) == pools.song_key(song("Cheerleader", "OMI"))
    assert pools.song_key(song("Judas", "Lady Gaga")) != pools.song_key(song("Judas", "Someone Else"))


def test_pools_merge_with_night_wide_ids_and_report_what_they_leave_out():
    pool1 = [song("Ave María", "Bisbal", "t1", 1), song("NI BORRACHO", "Quevedo", "t2", 2)]
    pool2 = [song("Abba", "X", "n1"), song("Ave María", "Bisbal", "t1"), song("NI BORRACHO", "Quevedo", "single"),
             song("Viva", "Coldplay", "v"), song("Viva", "Coldplay", "v"), song("Zeta", "Y", "n2")]
    merged = pools.merge([(spec("1"), pool1), (spec("2", "order", 71), pool2)])
    assert [(s["id"], s["title"], s["pool"]) for s in merged.songs] == [
        (1, "Ave María", "1"), (2, "NI BORRACHO", "1"), (71, "Abba", "2"), (72, "Viva", "2"), (73, "Zeta", "2")]
    assert merged.notes == [
        'pool 2 #2 "Ave María" (Bisbal): the same track is in pool 1; left out',
        'pool 2 #3 "NI BORRACHO" (Quevedo): the same song is in pool 1; left out',
        'pool 2 #5 "Viva" (Coldplay): listed twice in its playlist; kept once',
    ]


def test_a_pool_out_of_title_order_is_reported_and_keeps_the_playlist_order():
    merged = pools.merge([(spec("1", "order", 1), [song("Beta"), song("Alpha")])])
    assert [s["title"] for s in merged.songs] == ["Beta", "Alpha"]
    assert merged.notes == ['pool 1 "Alpha" (A): out of title order']


def test_colliding_ids_are_refused():
    with pytest.raises(pools.PoolsError, match="same song id: \\[2\\]"):
        pools.merge([(spec("1"), [song("A", id=1), song("B", id=2)]), (spec("2", "order", 2), [song("C")])])
    with pytest.raises(pools.PoolsError, match="positive id"):
        pools.merge([(spec("1"), [song("A")])])


def test_the_spec_is_checked(tmp_path):
    path = tmp_path / "pools.json"
    path.write_text(json.dumps({"pools": [{"pool": "1", "songsJson": "x.json"}, {"pool": "2", "songsJson": "y.json", "ids": "order", "firstId": 71}]}))
    specs = pools.read_spec(path)
    assert [(s.pool, s.ids, s.first_id) for s in specs] == [("1", "keep", None), ("2", "order", 71)]
    for bad, message in [
        ({"pools": []}, "non-empty"),
        ({"pools": [{"pool": "Pool 1", "songsJson": "x"}]}, "pool id"),
        ({"pools": [{"pool": "2", "songsJson": "y", "ids": "order"}]}, "firstId"),
        ({"pools": [{"pool": "1", "songsJson": "x"}, {"pool": "1", "songsJson": "y"}]}, "listed twice"),
    ]:
        path.write_text(json.dumps(bad))
        with pytest.raises(pools.PoolsError, match=message):
            pools.read_spec(path)


def test_print_names_follow_the_spotify_id_not_the_song_number():
    pool1 = [song("a la freSka", "Figa Flawas", "freska"), song("Timber", "Pitbull, Kesha", "timber"),
             song("Un Beso Y Una Flor - Remastered 2016", "Nino Bravo", "beso")]
    fixes = {"timber": {"printArtist": "Pitbull, Kesha"}, "beso": {"printTitle": "Un Beso y una Flor"},
             "elsewhere": {"printTitle": "X"}}
    merged = pools.with_print_names(pools.merge([(spec("1", "order", 1), pool1)]), fixes)
    by_track = {s["spotifyId"]: s for s in merged.songs}
    assert "printArtist" not in by_track["timber"] and "printTitle" not in by_track["timber"]  # the fix keeps Spotify's
    assert by_track["beso"]["printTitle"] == "Un Beso y una Flor" and "printArtist" not in by_track["beso"]
    assert not {"printTitle", "printArtist"} & set(by_track["freska"])  # nothing changes, nothing written
    assert [s["id"] for s in merged.songs] == [1, 2, 3]
    assert merged.notes == ["print-names.json: elsewhere isn't a song of this repertoire; its fix is unused"]
