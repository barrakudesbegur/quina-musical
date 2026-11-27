"""Print names (tools/prep/print_names.py): the rules on the card design session's real cases, and the hand fixes."""
from __future__ import annotations

import json

import pytest

import print_names as pn


@pytest.mark.parametrize("title, clean", [
    ("Un Beso Y Una Flor - Remastered 2016", "Un Beso Y Una Flor"),
    ("Give Me Everything (feat. Nayer)", "Give Me Everything"),
    ("Cheerleader (Felix Jaehn Remix) - Radio Edit", "Cheerleader"),
    ("The Ketchup Song (Aserejé) - Spanglish Version", "The Ketchup Song (Aserejé)"),  # «Aserejé» is a hand fix
    ("You're The One That I Want - From “Grease”", "You're The One That I Want"),
    ("Only Girl (In The World)", "Only Girl (In The World)"),  # no tag word: the bracket is the title's
    ("Hay Quel Venir al Sur", "Hay Quel Venir al Sur"),
])
def test_spotify_tags_come_off_the_title(title, clean):
    assert pn.clean_title(title) == clean


def test_the_main_artist_only():
    assert pn.main_artist("Quevedo, Nueva Línea") == "Quevedo"
    assert pn.main_artist("Pitbull, Ne-Yo, Afrojack, Nayer") == "Pitbull"
    assert pn.main_artist("Figa Flawas") == "Figa Flawas"


def test_a_name_that_stays_the_same_writes_no_field():
    assert pn.print_names({"title": "a la freSka", "artist": "Figa Flawas"}) == {}
    assert pn.print_names({"title": "Give Me Everything (feat. Nayer)", "artist": "Pitbull, Ne-Yo"}) == {
        "printTitle": "Give Me Everything", "printArtist": "Pitbull"}


def test_a_fix_wins_over_the_rules_and_a_fix_equal_to_spotify_writes_nothing():
    ketchup = {"title": "The Ketchup Song (Aserejé) - Spanglish Version", "artist": "Las Ketchup"}
    assert pn.print_names(ketchup, {"printTitle": "Aserejé"}) == {"printTitle": "Aserejé"}
    timber = {"title": "Timber", "artist": "Pitbull, Kesha"}
    assert pn.print_names(timber) == {"printArtist": "Pitbull"}
    assert pn.print_names(timber, {"printArtist": "Pitbull, Kesha"}) == {}  # a duet keeping both names


def test_apply_by_spotify_id_recomputes_and_warns_on_an_unknown_id():
    songs = [{"id": 1, "title": "The Ketchup Song (Aserejé) - Spanglish Version", "artist": "Las Ketchup", "spotifyId": "k"},
             {"id": 2, "title": "Old (Live)", "artist": "A", "spotifyId": "o", "printTitle": "stale"}]
    applied = pn.apply(songs, {"k": {"printTitle": "Aserejé"}, "gone": {"printTitle": "X"}})
    assert [s.get("printTitle") for s in applied.songs] == ["Aserejé", "Old"]
    assert applied.warnings == ["print-names.json: gone isn't a song of this repertoire; its fix is unused"]


def test_the_fixes_file(tmp_path):
    path = tmp_path / "print-names.json"
    assert pn.read_fixes(path) == {}  # none: rules only
    path.write_text(json.dumps({"k": {"printTitle": "Aserejé", "note": "the user"}}))
    assert pn.read_fixes(path) == {"k": {"printTitle": "Aserejé"}}
    for bad, message in [([], "an object"), ({"k": "x"}, "an object"), ({"k": {"note": "n"}}, "printTitle or printArtist"),
                         ({"k": {"printTitle": ""}}, "non-empty"), ({"k": {"title": "x"}}, "unknown field")]:
        path.write_text(json.dumps(bad))
        with pytest.raises(pn.PrintNamesError, match=message):
            pn.read_fixes(path)


def test_the_2026_fixes_file_is_valid_and_noted():
    path = pn.Path(__file__).resolve().parents[3] / "data" / "repertoires" / "2026" / "print-names.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    pn.check_fixes(doc)
    assert all(fix.get("note") for fix in doc.values())


def test_the_analysis_and_its_index_show_the_print_names():
    import analyze
    ketchup = {"id": 128, "title": "The Ketchup Song (Aserejé) - Spanglish Version", "artist": "Las Ketchup",
               "printTitle": "Aserejé"}
    assert analyze.song_names(ketchup) == {"title": "Aserejé", "artist": "Las Ketchup"}
    assert analyze.song_names({"id": 1, "title": "a la freSka", "artist": "Figa Flawas"}) == {
        "title": "a la freSka", "artist": "Figa Flawas"}
    a = {"songId": 128, **analyze.song_names({**ketchup, "printArtist": "Ketchup"}), "source": {"durationSec": 200.0},
         "tempo": {"bpm": 120.0, "beatsPerBar": 4, "barSecMedian": 2.0, "isStable": True}, "key": None,
         "loudness": {"gainToTargetDb": 0.0}, "flags": [], "hooks": []}
    row = analyze.index_row(a)
    assert (row["title"], row["artist"]) == ("Aserejé", "Ketchup")
