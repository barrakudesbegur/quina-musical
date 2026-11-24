"""Signature candidates (tools/prep/steps/signatures.py) and the automatic pick (tools/prep/signatures.py), on
made-up bar levels: instrumental pieces only (the intro riff, the build into a chorus, the chorus's
instrumental line), never a vocal line.
"""
from __future__ import annotations

import signatures as cutter
from steps import signatures as sg

BAR = 2.0
BARS = 40
SILENT, QUIET, SUNG, LOUD = -60.0, -45.0, -18.0, -16.0


def analysis(hooks: list[tuple[str, int]]) -> dict:
    """A steady 120 bpm 4/4 song with a downbeat every 2 s and valid hooks at the given bars."""
    downbeats = [k * BAR for k in range(BARS)]
    return {
        "downbeats": downbeats,
        "tempo": {"bpm": 120.0, "beatsPerBar": 4},
        "hooks": [{"id": f"h{k}", "tag": tag, "valid": True, "downbeatIndex": k, "downbeatSec": downbeats[k], "pickupSec": 0.0}
                  for tag, k in hooks],
    }


def levels(**spans: list[tuple[range, float]]) -> dict[str, list[float]]:
    """Bar levels per stem: quiet everywhere, then each (bars, dB) span."""
    out = {stem: [QUIET] * BARS for stem in ("drums", "bass", "vocals", "other")}
    for stem, parts in spans.items():
        for bars, db in parts:
            for k in bars:
                out[stem][k] = db
    return out


def test_the_intro_riff_is_instrumental_two_bars_on_a_downbeat_before_the_first_sung_bar():
    bars = levels(other=[(range(0, 8), LOUD)], drums=[(range(0, 8), -24.0)], vocals=[(range(8, BARS), SUNG)])
    [riff] = sg.riff_candidates(analysis([("best", 16)]), bars)
    assert riff.kind == "riff" and riff.stem == "instrumental"
    assert riff.start_sec % BAR == 0 and riff.end_sec - riff.start_sec == 2 * BAR and riff.anchor_sec == 0
    assert riff.end_sec <= 8 * BAR, "within the intro"
    assert riff.score >= cutter.AUTO_MIN_SCORE
    # Sung from the first bar: no intro, no riff.
    assert sg.riff_candidates(analysis([("best", 16)]), levels(other=[(range(0, 8), LOUD)], vocals=[(range(0, BARS), SUNG)])) == []


def test_the_build_ends_on_the_chorus_and_an_instrumental_one_scores_above_a_sung_one():
    song = analysis([("best", 16)])
    rising = dict(drums=[(range(14, 16), -22.0), (range(16, 24), -14.0)], other=[(range(14, 24), LOUD)])
    [instrumental] = sg.build_candidates(song, levels(**rising))
    [sung] = sg.build_candidates(song, levels(**rising, vocals=[(range(14, 24), SUNG)]))
    for build in (instrumental, sung):
        assert build.kind == "build" and build.stem == "instrumental", "the vocals are always cut out"
        assert build.end_sec == 16 * BAR and build.start_sec == 14 * BAR and build.source == "h16"
    assert instrumental.score >= cutter.AUTO_MIN_SCORE > sung.score


def test_the_motif_is_the_choruss_other_stem_when_it_carries():
    song = analysis([("best", 16), ("main", 30)])
    [motif] = sg.motif_candidates(song, levels(other=[(range(16, 18), -14.0)], vocals=[(range(16, 18), -16.0)]))
    assert motif.kind == "motif" and motif.stem == "other" and motif.start_sec == 16 * BAR and motif.end_sec == 18 * BAR
    assert sg.motif_candidates(song, levels(vocals=[(range(16, 18), SUNG)])) == [], "nothing but the singer: no motif"


def test_no_vocal_line_is_ever_a_candidate():
    bars = levels(other=[(range(0, BARS), LOUD)], drums=[(range(0, BARS), -20.0)], vocals=[(range(4, BARS), -12.0)])
    found = sg.candidates(analysis([("best", 12), ("main", 28)]), bars)
    assert found and {c.kind for c in found} <= {"riff", "build", "motif"}
    assert all(c.stem in ("instrumental", "other") for c in found)


def doc(*scores: float) -> dict:
    return {"signatures": [{"id": f"1-riff-{k}", "score": s, "startSec": float(k)} for k, s in enumerate(scores)]}


def playing(d: dict) -> list[tuple[str, str]]:
    return [(s["id"], s["pick"]) for s in d["signatures"] if s["approved"]]


def test_the_automatic_pick_the_veto_a_manual_pick_and_off():
    assert playing(cutter.apply_decisions(doc(0.7, 0.9, 0.5), None)) == [("1-riff-1", "auto")]
    assert playing(cutter.apply_decisions(doc(0.5, 0.55), None)) == [], "nothing above the score: none plays"
    vetoed = cutter.apply_decisions(doc(0.7, 0.9), {"signatures": {"1-riff-1": False}})
    assert playing(vetoed) == [("1-riff-0", "auto")] and vetoed["signatures"][1]["vetoed"]
    assert playing(cutter.apply_decisions(doc(0.7, 0.9, 0.3), {"signatures": {"1-riff-2": True}})) == [("1-riff-2", "manual")]
    off = cutter.apply_decisions(doc(0.7, 0.9), {"signaturesOff": True, "signatures": {"1-riff-0": True}})
    assert playing(off) == [] and off["off"]
