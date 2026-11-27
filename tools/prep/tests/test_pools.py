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


def test_pools_merge_with_night_wide_ids_and_share_the_songs_an_earlier_pool_has_d268():
    pool1 = [song("Ave María", "Bisbal", "t1", 1), song("NI BORRACHO", "Quevedo", "t2", 2), song("Solo", "Z", "s", 3)]
    pool2 = [song("Abba", "X", "n1"), song("Ave María", "Bisbal", "t1"), song("NI BORRACHO", "Quevedo", "single"),
             song("Viva", "Coldplay", "v"), song("Viva", "Coldplay", "v"), song("Zeta", "Y", "n2")]
    merged = pools.merge([(spec("1"), pool1), (spec("2", "order", 71), pool2)])
    # Every song once; the shared ones keep their pool 1 ids and join pool 2, and pool 2's own songs are numbered
    # from 71 in playlist order without them.
    assert [(s["id"], s["title"], s["pools"]) for s in merged.songs] == [
        (1, "Ave María", ["1", "2"]), (2, "NI BORRACHO", ["1", "2"]), (3, "Solo", ["1"]),
        (71, "Abba", ["2"]), (72, "Viva", ["2"]), (73, "Zeta", ["2"])]
    assert not any("pool" in s for s in merged.songs), "D268's step 3: `pools` only"
    assert merged.origin == {1: "1", 2: "1", 3: "1", 71: "2", 72: "2", 73: "2"}
    assert merged.notes == [
        "pool 2 #2 «Ave María»: shared with pool 1 (#1)",
        "pool 2 #3 «NI BORRACHO»: shared with pool 1 (#2)",
        'pool 2 #5 "Viva" (Coldplay): listed twice in its playlist; kept once',
    ]


def test_a_shared_song_keeps_its_earlier_entry_and_its_pools_stay_sorted():
    pool_b = [song("Ave María", "Bisbal", "t1", 1)]
    pool_a = [song("Ave María (feat. X)", "Bisbal", "other", 9)]
    pool_c = [song("Ave Maria", "BISBAL", "t1"), song("Nova", "N", "n")]
    merged = pools.merge([(spec("b"), pool_b), (spec("a"), pool_a), (spec("c", "order", 20), pool_c)])
    assert merged.songs == [
        {"id": 1, "title": "Ave María", "artist": "Bisbal", "spotifyId": "t1", "pools": ["a", "b", "c"]},
        {"id": 20, "title": "Nova", "artist": "N", "spotifyId": "n", "pools": ["c"]},
    ]
    assert merged.origin == {1: "b", 20: "c"}
    assert merged.notes == ["pool a #1 «Ave María (feat. X)»: shared with pool b (#1)",
                            "pool c #1 «Ave Maria»: shared with pool b (#1)"]


def test_a_shared_song_listed_twice_in_the_later_playlist_is_reported_once_as_shared():
    merged = pools.merge([(spec("1"), [song("A", sid="t", id=1)]), (spec("2", "order", 71), [song("A", sid="t"), song("A", sid="t")])])
    assert [(s["id"], s["pools"]) for s in merged.songs] == [(1, ["1", "2"])]
    assert merged.notes == ["pool 2 #1 «A»: shared with pool 1 (#1)", 'pool 2 #2 "A" (A): listed twice in its playlist; kept once']


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


def test_print_names_on_shared_songs_come_from_the_earlier_entry():
    pool1 = [song("Un Beso Y Una Flor - Remastered 2016", "Nino Bravo", "beso", 1)]
    pool2 = [song("Un Beso Y Una Flor", "Nino Bravo", "beso-single"), song("Timber", "Pitbull, Kesha", "timber")]
    merged = pools.with_print_names(pools.merge([(spec("1"), pool1), (spec("2", "order", 71), pool2)]), {})
    assert [(s["id"], s.get("printTitle"), s.get("printArtist"), s["pools"]) for s in merged.songs] == [
        (1, "Un Beso Y Una Flor", None, ["1", "2"]), (71, None, "Pitbull", ["2"])]


def test_the_analysis_index_carries_pools_only_d268():
    import analyze

    assert analyze.song_pools({"id": 6, "pools": ["2", "1"]}) == {"pools": ["1", "2"]}
    assert analyze.song_pools({"id": 71, "pools": ["2"]}) == {"pools": ["2"]}
    assert analyze.song_pools({"id": 3}) == {"pools": ["1"]}, "a repertoire never split into pools is all pool 1"
    assert analyze.song_pools({"id": 4, "pools": []}) == {"pools": ["1"]}
