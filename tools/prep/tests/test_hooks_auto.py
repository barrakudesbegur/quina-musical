"""Automatic hooks (tools/prep/steps/hook_detect.py) on made-up per-bar features, and approved candidates becoming
hooks (tools/prep/steps/hooks.py with_auto_hooks)."""
from __future__ import annotations

import numpy as np

from steps import hook_detect as hd
from steps import hooks as hooks_step


def structure(*sections: tuple[str, int]) -> list[str]:
    """Bar by bar, the section each bar belongs to: ("verse", 8), ("chorus", 8)…"""
    return [name for name, bars in sections for _ in range(bars)]


SONG = structure(("intro", 4), ("verse", 8), ("chorus", 8), ("verse", 8), ("chorus", 8), ("bridge", 4), ("chorus", 8), ("outro", 4))
CHORUS_STARTS = [k for k in range(1, len(SONG)) if SONG[k] == "chorus" and SONG[k - 1] != "chorus"]


def features(seed: int = 1) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Chroma and MFCC that repeat by section (with a little noise), bar levels (the chorus loudest) and vocals
    (silent in the intro, bridge and outro)."""
    rng = np.random.default_rng(seed)
    names = sorted(set(SONG))
    chroma_of = {n: rng.random(12) for n in names}
    mfcc_of = {n: rng.normal(size=13) * 3 for n in names}
    chroma = np.array([chroma_of[n] + 0.05 * rng.random(12) for n in SONG])
    mfcc = np.array([mfcc_of[n] + 0.2 * rng.normal(size=13) for n in SONG])
    level = {"intro": -19, "verse": -18, "chorus": -12, "bridge": -20, "outro": -26}
    bar_db = np.array([level[n] + rng.normal() * 0.3 for n in SONG])
    vocals = np.array([-60.0 if n in ("intro", "bridge", "outro") else -18.0 for n in SONG])
    return chroma, mfcc, bar_db, vocals


def test_the_sections_are_found_and_the_loudest_returning_one_scores_at_its_starts():
    chroma, mfcc, bar_db, _ = features()
    kinds = hd.section_kinds(chroma, mfcc, 5)
    # Every chorus bar is one kind, and no verse bar is that kind.
    chorus_kind = {int(kinds[k]) for k, n in enumerate(SONG) if n == "chorus"}
    assert len(chorus_kind) == 1
    assert all(int(kinds[k]) not in chorus_kind for k, n in enumerate(SONG) if n == "verse")
    starts = hd.chorus_starts(kinds, bar_db)
    best = sorted(range(len(starts)), key=lambda k: -starts[k])[:3]
    assert sorted(best) == CHORUS_STARTS


def test_the_candidates_are_the_chorus_starts_at_least_8_bars_apart_and_on_the_phrase_grid():
    chroma, mfcc, bar_db, vocals = features()
    score, evidence = hd.bar_scores(chroma, mfcc, bar_db, vocals)
    candidates, phase = hd.detect(score, evidence)
    bars = [c.bar for c in candidates]
    # Proposals, not answers: every chorus start is among the top four (the verse after a quiet intro can look like
    # one, and which comes first can change with the BLAS build: a human approves them anyway).
    assert set(CHORUS_STARTS) <= set(bars[:4])
    assert all(abs(a - b) >= hd.MIN_GAP_BARS for i, a in enumerate(bars) for b in bars[i + 1:])
    assert phase == CHORUS_STARTS[0] % 4
    assert set(candidates[0].evidence) == {"chorus", "jump", "vocal"}


def test_energy_jumps_and_vocal_onsets():
    bar_db = np.array([-20.0] * 8 + [-12.0] * 8)
    jump = hd.energy_jump(bar_db)
    assert int(np.argmax(jump)) == 8 and jump[8] == 8.0
    vocals = np.array([-60.0, -60.0, -60.0, -18.0, -18.0, -60.0, -20.0, -60.0, -60.0, -16.0])
    # The first entrance (the first verse) is left out; a single silent bar is no entrance; the return is.
    assert list(hd.vocal_onset(vocals)) == [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]


def test_refine_moves_a_bar_onto_the_grid_only_when_the_grid_bar_scores_nearly_as_well():
    score = np.zeros(20)
    score[9], score[8] = 1.0, 0.95
    assert hd.refine(score, 9, phase=0) == 8
    score[8] = 0.5
    assert hd.refine(score, 9, phase=0) == 9, "not when the grid bar is much weaker"
    assert hd.refine(score, 12, phase=0) == 12, "already on the grid"


def test_a_hand_tag_is_suggested_a_shift_only_onto_a_clearly_better_grid_bar():
    score = np.full(20, 0.2)
    score[8] = 0.6
    assert hd.suggest_shift(score, phase=0, bar=9) == -1
    assert hd.suggest_shift(score, phase=0, bar=8) == 0, "already the best"
    score[8] = 0.3
    assert hd.suggest_shift(score, phase=0, bar=9) == 0, "not clearly better"
    score[10] = 0.9
    assert hd.suggest_shift(score, phase=0, bar=9) == 0, "bar 10 is off the grid"


def test_approved_candidates_become_hooks_after_the_hand_tags():
    song = {"id": 7, "timestamps": [{"tag": "best", "time": 40.0}]}
    override = {"autoHooks": {"7-auto-1": {"tag": "main", "downbeatSec": 90.5}, "7-auto-0": {"tag": "main", "downbeatSec": 62.0}}}
    merged = hooks_step.with_auto_hooks(song, override)
    assert [(s["tag"], s["time"], s.get("auto")) for s in merged["timestamps"]] == [
        ("best", 40.0, None), ("main", 62.0, "7-auto-0"), ("main", 90.5, "7-auto-1")]
    assert hooks_step.with_auto_hooks(song, {}) is song
    downbeats = np.arange(0, 120, 2.0)
    hooks = hooks_step.snap_hooks(merged, downbeats, downbeats, np.arange(len(downbeats)), 120.0, {}, 2.0, 4)
    assert [h["id"] for h in hooks] == ["7-best-0", "7-main-0", "7-main-1"], "the hand tag keeps its id"
    assert hooks[1]["auto"] == "7-auto-0" and hooks[1]["downbeatSec"] == 62.0
