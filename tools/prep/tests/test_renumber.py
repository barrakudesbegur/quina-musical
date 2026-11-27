"""Renumbering a repertoire's prepared data when its song ids change (tools/prep/renumber.py), on a throwaway
repertoire in pytest's temp dir: every per-song thing holds its song's Spotify id, so each check can see whose it is."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

import renumber
import repertoire as repertoires
from conftest import write_manifest


def songs(*pairs: tuple[int, str]) -> list[dict]:
    return [{"id": sid, "title": f"Song {sp}", "artist": "A", "spotifyId": sp} for sid, sp in pairs]


def lay_out(rep: repertoires.Repertoire, old: list[dict]) -> None:
    """What the prep leaves for each song, every file naming the song's track."""
    snippets, stems_index = [], []
    for s in old:
        sid, sp = s["id"], s["spotifyId"]
        cache = rep.song_cache(sid)
        (cache / "stems").mkdir(parents=True)
        (cache / "mix.flac").write_text(f"mix {sp}")
        (cache / "mix.json").write_text(json.dumps({"source": {"path": f"data/media/x/songs/{sp}.opus"}}))
        (cache / "stems" / "vocals.0.flac").write_text(f"vocals {sp}")
        (cache / "signatures").mkdir()
        (cache / "signatures" / f"{sid}-motif-0.flac").write_text(f"clip {sp}")
        for folder in (rep.analysis_dir, rep.data_dir / "hooks", rep.keys_dir, rep.key_cache_dir):
            folder.mkdir(parents=True, exist_ok=True)
        (rep.analysis_dir / f"{sid}.json").write_text(json.dumps(
            {"songId": sid, "track": sp, "source": {"mp3": f"data/media/x/songs/{sp}.opus"}}))
        (rep.data_dir / "hooks" / f"{sid}.json").write_text(json.dumps({"songId": sid, "track": sp}))
        (rep.keys_dir / f"{sid}.json").write_text(json.dumps({"songId": sid, "track": sp}))
        (rep.key_cache_dir / f"{sid}.json").write_text(json.dumps({"songId": sid, "track": sp}))
        rep.stems_dir.mkdir(parents=True, exist_ok=True)
        (rep.stems_dir / f"{sid}.json").write_text(json.dumps({
            "songId": sid, "track": sp,
            "pathTemplate": f"{repertoires.display(rep.stems_cache(sid))}/{{stem}}.{{startSample}}.flac",
            "source": {"path": repertoires.display(rep.mix_flac(sid)), "size": 1}}, indent=1))
        rep.signatures_dir.mkdir(parents=True, exist_ok=True)
        (rep.signatures_dir / f"{sid}.json").write_text(json.dumps({
            "songId": sid, "track": sp, "signatures": [{"id": f"{sid}-motif-0", "source": f"{sid}-best-0"}]}))
        rep.covers_dir.mkdir(parents=True, exist_ok=True)
        (rep.covers_dir / f"{sid}.jpg").write_text(f"cover {sp}")
        rep.overrides_dir.mkdir(parents=True, exist_ok=True)
        rep.override_path(sid).write_text(json.dumps({
            "note": f"{sid}-best-0 is the chorus",  # a sentence, not an id: left as it is
            "track": sp,
            "autoHooks": {f"{sid}-auto-0": {"tag": "best", "downbeatSec": 12.5, "provisional": True}},
            "autoHooksRejected": [f"{sid}-auto-1", f"{sid}-auto-2"],
            "hookTimes": {f"{sid}-best-0": 30.0},
            "signatures": {f"{sid}-motif-0": True},
        }, indent=2))
        snippets.append({"id": sid, "hookId": f"{sid}-best-0", "track": sp})
        stems_index.append({"id": sid, "ok": True, "track": sp})
    (rep.data_dir / "snippets").mkdir(parents=True, exist_ok=True)
    (rep.data_dir / "snippets" / "index.json").write_text(json.dumps({"schemaVersion": 1, "songs": snippets}))
    (rep.stems_dir / "index.json").write_text(json.dumps({"schemaVersion": 1, "songs": stems_index}))
    replaced = rep.covers_dir.with_name(rep.covers_dir.name + "-replaced")
    replaced.mkdir(exist_ok=True)
    (replaced / f"{old[-1]['id']}.jpg").write_text(f"original cover {old[-1]['spotifyId']}")


def make(tmp_path: Path, old: list[dict]) -> repertoires.Repertoire:
    (tmp_path / "input").mkdir()
    (tmp_path / "input" / "songs.json").write_text(json.dumps(old))
    rep = repertoires.load(write_manifest(tmp_path))
    lay_out(rep, old)
    return rep


def new_songs_file(tmp_path: Path, new: list[dict]) -> Path:
    path = tmp_path / "new-songs.json"
    path.write_text(json.dumps(new))
    return path


def snapshot(root: Path) -> dict[str, str]:
    return {p.relative_to(root).as_posix(): (p.read_text() if p.is_file() else "<dir>") for p in sorted(root.rglob("*"))}


def owner(rep: repertoires.Repertoire, sid: int) -> dict[str, str]:
    """Whose song every per-id thing under `sid` is."""
    load = lambda p: json.loads(p.read_text())["track"]  # noqa: E731
    return {
        "mix": rep.mix_flac(sid).read_text().removeprefix("mix "),
        "stem": (rep.stems_cache(sid) / "vocals.0.flac").read_text().removeprefix("vocals "),
        "analysis": load(rep.analysis_dir / f"{sid}.json"),
        "hooks": load(rep.data_dir / "hooks" / f"{sid}.json"),
        "keys": load(rep.keys_dir / f"{sid}.json"),
        "keyCache": load(rep.key_cache_dir / f"{sid}.json"),
        "stems": load(rep.stems_dir / f"{sid}.json"),
        "signatures": load(rep.signatures_dir / f"{sid}.json"),
        "cover": rep.cover_path(sid).read_text().removeprefix("cover "),
        "override": load(rep.override_path(sid)),
    }


def run(rep: repertoires.Repertoire, new_path: Path, *extra: str) -> int:
    return renumber.main(["--repertoire", str(rep.manifest), "--new-songs", str(new_path), *extra])


# ---------------------------------------------------------------- the plan


def test_the_plan_matches_songs_by_spotify_id():
    p = renumber.plan(songs((1, "a"), (2, "b"), (3, "c"), (4, "d")), songs((1, "b"), (2, "c"), (4, "d"), (5, "e")))
    assert p.moves == {2: 1, 3: 2}
    assert p.kept == [4]
    assert p.retired == {1: "a"}
    assert p.added == {5: "e"}
    assert p.mapping == {"a": [1, None], "b": [2, 1], "c": [3, 2], "d": [4, 4], "e": [None, 5]}


def test_a_song_without_a_spotify_id_or_listed_twice_is_refused():
    with pytest.raises(renumber.RenumberError, match="no spotifyId"):
        renumber.plan([{"id": 1, "title": "x"}], [])
    with pytest.raises(renumber.RenumberError, match="listed twice"):
        renumber.plan(songs((1, "a"), (2, "a")), [])


def test_hook_and_signature_ids_are_renamed_as_keys_and_strings_but_sentences_are_not():
    foreign: list[str] = []
    doc = {"autoHooks": {"7-auto-0": {"tag": "best"}}, "autoHooksRejected": ["7-auto-1", "8-auto-0"],
           "hookTimes": {"7-best-0": 3.0}, "note": "7-best-0 is late", "n": 7}
    assert renumber.reprefix(doc, 7, 70, foreign) == {
        "autoHooks": {"70-auto-0": {"tag": "best"}}, "autoHooksRejected": ["70-auto-1", "8-auto-0"],
        "hookTimes": {"70-best-0": 3.0}, "note": "7-best-0 is late", "n": 7}
    assert foreign == ["8-auto-0"]


# ---------------------------------------------------------------- apply


def test_a_shift_chain_moves_every_song_to_its_new_id_without_clobbering(tmp_path):
    """Song a is gone and e is new: b, c, d each move down one (2→1, 3→2, 4→3), into ids just freed."""
    old = songs((1, "a"), (2, "b"), (3, "c"), (4, "d"))
    rep = make(tmp_path, old)
    assert run(rep, new_songs_file(tmp_path, songs((1, "b"), (2, "c"), (3, "d"), (4, "e")))) == 0
    for sid, sp in [(1, "b"), (2, "c"), (3, "d")]:
        assert set(owner(rep, sid).values()) == {sp}
    # The new song 4 has nothing yet: d's things moved to 3.
    assert not rep.song_cache(4).exists() and not (rep.analysis_dir / "4.json").exists()
    assert not rep.cover_path(4).exists() and not rep.override_path(4).exists()
    # The replaced cover's original follows its song (d: 4 → 3).
    replaced = rep.covers_dir.with_name(rep.covers_dir.name + "-replaced")
    assert (replaced / "3.jpg").read_text() == "original cover d" and not (replaced / "4.jpg").exists()
    # No staging left behind.
    assert not list(tmp_path.rglob(renumber.STAGING))


def test_a_swap_cycle_never_overwrites(tmp_path):
    rep = make(tmp_path, songs((1, "a"), (2, "b"), (3, "c")))
    assert run(rep, new_songs_file(tmp_path, songs((1, "c"), (2, "a"), (3, "b")))) == 0
    for sid, sp in [(1, "c"), (2, "a"), (3, "b")]:
        assert set(owner(rep, sid).values()) == {sp}


def test_a_retired_song_is_moved_aside_and_the_prep_listings_skip_it(tmp_path):
    rep = make(tmp_path, songs((1, "a"), (2, "b")))
    assert run(rep, new_songs_file(tmp_path, songs((1, "b")))) == 0
    aside = rep.cache_dir / renumber.RETIRED / "a" / "1"
    assert (aside / "mix.flac").read_text() == "mix a" and (aside / "stems" / "vocals.0.flac").exists()
    assert (rep.covers_dir / renumber.RETIRED / "a" / "1.jpg").read_text() == "cover a"
    for folder in (rep.analysis_dir, rep.data_dir / "hooks", rep.overrides_dir, rep.key_cache_dir, rep.stems_dir):
        assert json.loads((folder / renumber.RETIRED / "a" / "1.json").read_text())["track"] == "a"
        # As hooks_auto.py and signatures.py list ids: only b, now 1.
        assert [int(p.stem) for p in folder.glob("*.json") if p.stem.isdigit()] == [1]
        assert json.loads((folder / "1.json").read_text())["track"] == "b"
    # The retired override is kept as it was (its keys still name its old id).
    assert "1-auto-0" in json.loads((rep.overrides_dir / renumber.RETIRED / "a" / "1.json").read_text())["autoHooks"]
    # The indexes drop it; the record keeps what they dropped.
    assert [e["id"] for e in json.loads((rep.stems_dir / "index.json").read_text())["songs"]] == [1]
    record = json.loads(next(rep.data_dir.glob("renumber-*.json")).read_text())
    assert record["status"] == "applied" and record["droppedIndexEntries"]["stems/index.json"][0]["track"] == "a"


def test_the_override_keys_and_the_kept_generated_files_take_the_new_id(tmp_path):
    rep = make(tmp_path, songs((1, "a"), (2, "b"), (3, "c")))
    assert run(rep, new_songs_file(tmp_path, songs((1, "b"), (2, "c"), (3, "a")))) == 0
    over = json.loads(rep.override_path(1).read_text())
    assert over == {"note": "2-best-0 is the chorus", "track": "b",
                    "autoHooks": {"1-auto-0": {"tag": "best", "downbeatSec": 12.5, "provisional": True}},
                    "autoHooksRejected": ["1-auto-1", "1-auto-2"], "hookTimes": {"1-best-0": 30.0},
                    "signatures": {"1-motif-0": True}}
    stems = json.loads((rep.stems_dir / "1.json").read_text())
    assert stems["songId"] == 1
    assert stems["pathTemplate"] == f"{repertoires.display(rep.stems_cache(1))}/{{stem}}.{{startSample}}.flac"
    assert stems["source"] == {"path": repertoires.display(rep.mix_flac(1)), "size": 1}
    sig = json.loads((rep.signatures_dir / "1.json").read_text())
    assert sig["songId"] == 1 and sig["signatures"] == [{"id": "1-motif-0", "source": "1-best-0"}]
    assert [p.name for p in rep.signatures_cache(1).iterdir()] == ["1-motif-0.flac"]
    assert (rep.signatures_cache(1) / "1-motif-0.flac").read_text() == "clip b"
    snippets = json.loads((rep.data_dir / "snippets" / "index.json").read_text())["songs"]
    assert [(e["id"], e["hookId"], e["track"]) for e in snippets] == [(1, "1-best-0", "b"), (2, "2-best-0", "c"), (3, "3-best-0", "a")]
    assert [(e["id"], e["track"]) for e in json.loads((rep.stems_dir / "index.json").read_text())["songs"]] == [(1, "b"), (2, "c"), (3, "a")]


def test_the_dry_run_changes_nothing(tmp_path, capsys):
    rep = make(tmp_path, songs((1, "a"), (2, "b"), (3, "c")))
    new = new_songs_file(tmp_path, songs((1, "b"), (2, "c"), (3, "z")))
    before = snapshot(tmp_path)
    assert run(rep, new, "--dry-run") == 0
    assert snapshot(tmp_path) == before
    out = capsys.readouterr().out
    assert "0 keep their id, 2 change id, 1 retired, 1 new" in out and "dry run: nothing changed" in out


def test_a_second_apply_is_refused_and_after_the_new_songs_json_there_is_nothing_to_do(tmp_path, capsys):
    rep = make(tmp_path, songs((1, "a"), (2, "b")))
    new = new_songs_file(tmp_path, songs((1, "b"), (2, "a")))
    assert run(rep, new) == 0
    after = snapshot(tmp_path)
    # songs.json still has the old numbering: the same plan again is refused, and nothing moves.
    assert run(rep, new) == 1
    assert "already applied" in capsys.readouterr().err
    assert snapshot(tmp_path) == after
    # Once songs.json has the new numbering, there is nothing to renumber.
    rep.songs_json.write_text(new.read_text())
    after = snapshot(tmp_path)
    assert run(rep, new) == 0
    assert "nothing to renumber" in capsys.readouterr().out
    assert snapshot(tmp_path) == after


def test_data_that_doesnt_follow_the_old_songs_json_is_refused(tmp_path, capsys):
    """Without a record (another machine, a lost file), the data itself shows it was renumbered already."""
    rep = make(tmp_path, songs((1, "a"), (2, "b")))
    new = new_songs_file(tmp_path, songs((1, "b"), (2, "a")))
    assert run(rep, new) == 0
    next(rep.data_dir.glob("renumber-*.json")).rename(tmp_path / "moved-record.json")
    after = snapshot(tmp_path)
    assert run(rep, new) == 1
    assert "doesn't follow the old numbering" in capsys.readouterr().err
    assert snapshot(tmp_path) == after


def test_an_unknown_entry_on_a_new_id_or_a_leftover_staging_dir_is_refused(tmp_path, capsys):
    rep = make(tmp_path, songs((1, "a"), (2, "b")))
    new = new_songs_file(tmp_path, songs((1, "b"), (2, "a"), (3, "c")))
    (rep.analysis_dir / "3.json").write_text("{}")
    before = snapshot(tmp_path)
    assert run(rep, new) == 1
    assert "aren't songs of the old songs.json but are new ids" in capsys.readouterr().err
    assert snapshot(tmp_path) == before
    (rep.analysis_dir / "3.json").rename(tmp_path / "3.json")
    (rep.covers_dir / renumber.STAGING).mkdir()
    assert run(rep, new) == 1
    assert "stopped half way" in capsys.readouterr().err


def test_a_rename_never_replaces_an_existing_file(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    a.write_text("a")
    b.write_text("b")
    with pytest.raises(renumber.RenumberError, match="refusing to overwrite"):
        renumber._rename(a, b)
    assert a.read_text() == "a" and b.read_text() == "b"
