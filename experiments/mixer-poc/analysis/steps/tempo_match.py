"""Tempo matching rules for layering: direct stretch up to ±8%, else half or double time.

The ratio is a speed ratio: target tempo / source tempo (1.04 = play B 4% faster).
"""
from __future__ import annotations

import math

MAX_STRETCH = 0.08
TIGHT_STRETCH = 0.04
MULTIPLES = (1.0, 0.5, 2.0)


def within(ratio: float, limit: float) -> bool:
    """|ratio - 1| <= limit, with a hair of float tolerance."""
    return abs(ratio - 1.0) <= limit + 1e-9


def choose_multiple(source_bpm: float, target_bpm: float, limit: float = MAX_STRETCH) -> dict:
    """Pick how B's beat relates to A's: 1 (direct), 0.5 (B at half A's tempo) or 2 (double).

    Direct is used whenever it is inside `limit`; half or double only when direct is outside and the
    half/double ratio is inside. Otherwise the closest multiple is returned with ok=False.
    """
    options = []
    for m in MULTIPLES:
        ratio = target_bpm * m / source_bpm
        options.append({"multiple": m, "ratio": ratio, "ok": within(ratio, limit)})
    direct = options[0]
    if direct["ok"]:
        chosen = direct
    else:
        inside = [o for o in options[1:] if o["ok"]]
        chosen = inside[0] if inside else min(options, key=lambda o: abs(math.log(o["ratio"])))
        if not inside:
            chosen = {**chosen, "ok": False}
    mode = {1.0: "direct", 0.5: "half", 2.0: "double"}[chosen["multiple"]]
    return {**chosen, "mode": mode, "effectiveBpm": target_bpm * chosen["multiple"], "limit": limit}


def pair_class(a_bpm: float, b_bpm: float) -> str:
    """How B can be beat-matched to A's tempo: 'tight' (±4%), 'direct' (±8%), 'halfdouble', 'none'."""
    r = a_bpm / b_bpm
    if within(r, TIGHT_STRETCH):
        return "tight"
    if within(r, MAX_STRETCH):
        return "direct"
    if within(r * 0.5, MAX_STRETCH) or within(r * 2.0, MAX_STRETCH):
        return "halfdouble"
    return "none"
