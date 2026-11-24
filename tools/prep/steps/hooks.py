"""Snap the hand-tagged hooks (songs.json timestamps[].time = the hook moment) to downbeats.

The tags were placed by ear and scatter about ±2 beats around the chorus downbeat, with a lean toward
tagging early (a vocal pickup). Bar RMS does not discriminate between neighbouring candidates (the
masters are compressed), so the rule is positional, biased toward landing early:
  - tag within PICKUP_MAX_BEATS before a downbeat → land that downbeat; B starts at the tag, rounded up
    to a half beat (the pickup), so the first syllable is never clipped;
  - otherwise → land the downbeat before the tag (we hear a little more pre-hook, never less).
Tags in the middle of a bar are marked `snap_ambiguous` so the audition page can confirm them.
"""
from __future__ import annotations

import math

import numpy as np

NEAR_END_SEC = 8.0
LOCAL_BARS = 8
PICKUP_MAX_BEATS = 1.5
AMBIGUOUS_AFTER_BEATS = 1.0


def legacy_lead(effect: dict | None) -> float | None:
    if not effect:
        return None
    if effect.get("type") == "crossfade":
        return effect.get("durationSeconds")
    if effect.get("type") == "fade-out-in":
        return effect.get("fadeInSeconds")
    return None


def _bar_local(downbeats: np.ndarray, d: int, fallback: float) -> float:
    lo = max(0, d - LOCAL_BARS)
    local = np.diff(downbeats[lo:d + 1])
    if len(local) >= 2:
        return float(np.median(local))
    if d + 1 < len(downbeats):
        return float(downbeats[d + 1] - downbeats[d])
    return fallback


def with_auto_hooks(song: dict, override: dict) -> dict:
    """The song with its approved automatic hooks (the override's `autoHooks`: candidate id → { tag, downbeatSec },
    from tools/prep/hooks_auto.py through the audition page) added after its hand tags, in time order, so the hand
    tags keep their ids."""
    approved = override.get("autoHooks") or {}
    stamps = sorted(
        ({"tag": v.get("tag", "main"), "time": float(v["downbeatSec"]), "auto": cand} for cand, v in approved.items() if "downbeatSec" in v),
        key=lambda stamp: stamp["time"],
    )
    return {**song, "timestamps": [*song.get("timestamps", []), *stamps]} if stamps else song


def snap_hooks(song: dict, beats: np.ndarray, downbeats: np.ndarray, db_idx: np.ndarray,
               duration: float, override: dict, bar_median: float, bpb: int) -> list[dict]:
    nudges = override.get("hookNudgesSec", {}) or {}
    disabled = set(override.get("disableHooks", []) or [])
    retag = override.get("hookTimes", {}) or {}
    forced_db = override.get("hookDownbeats", {}) or {}
    forced_pickup = override.get("hookPickupBeats", {}) or {}
    counters: dict[str, int] = {}
    hooks = []
    for stamp in song.get("timestamps", []):
        tag = stamp.get("tag", "main")
        counters[tag] = counters.get(tag, -1) + 1
        hook_id = f"{song['id']}-{tag}-{counters[tag]}"
        tag_time = float(retag.get(hook_id, stamp["time"]))
        issues: list[str] = []
        valid = True
        if tag_time >= duration:
            issues.append("past_end")
            valid = False
        elif tag_time > duration - NEAR_END_SEC:
            issues.append("near_end")
        if len(downbeats) < 2:
            hooks.append({"id": hook_id, "tag": tag, "tagTimeSec": round(tag_time, 4), "valid": False,
                          "issues": issues + ["no_downbeats"]})
            continue

        prev = int(np.searchsorted(downbeats, tag_time, side="right")) - 1
        prev = max(0, min(prev, len(downbeats) - 1))
        bar = _bar_local(downbeats, prev, bar_median)
        beat = bar / bpb
        position_beats = (tag_time - downbeats[prev]) / beat  # beats since the previous downbeat
        pickup_beats = 0.0
        if hook_id in forced_db:
            d = int(np.argmin(np.abs(downbeats - float(forced_db[hook_id]))))
            pickup_beats = float(forced_pickup.get(hook_id, 0.0))
            issues.append("downbeat_by_override")
        elif tag_time < downbeats[0]:
            d = 0
            pickup_beats = math.ceil(((downbeats[0] - tag_time) / beat) * 2) / 2
        elif position_beats >= bpb - PICKUP_MAX_BEATS and prev + 1 < len(downbeats):
            d = prev + 1
            pickup_beats = math.ceil((bpb - position_beats) * 2) / 2
        else:
            d = prev
            if AMBIGUOUS_AFTER_BEATS < position_beats < bpb - PICKUP_MAX_BEATS:
                issues.append("snap_ambiguous")
        if hook_id in forced_pickup and hook_id not in forced_db:
            pickup_beats = float(forced_pickup[hook_id])

        downbeat = float(downbeats[d]) + float(nudges.get(hook_id, 0.0))
        bar_local = _bar_local(downbeats, d, bar_median)
        pickup_sec = min(downbeat, pickup_beats * bar_local / bpb)
        if hook_id in disabled:
            valid = False
            issues.append("disabled_by_override")
        if downbeat >= duration - 1.0:
            valid = False
            issues.append("downbeat_past_end")
        hooks.append({
            "id": hook_id,
            "tag": tag,
            **({"auto": stamp["auto"]} if stamp.get("auto") else {}),
            "tagTimeSec": round(tag_time, 4),
            "downbeatSec": round(downbeat, 4),
            "downbeatIndex": d,
            "beatIndex": int(db_idx[d]) if d < len(db_idx) else None,
            "snapDeltaSec": round(downbeat - tag_time, 4),
            "tagBarPositionBeats": round(float(position_beats), 2),
            "pickupBeats": pickup_beats,
            "pickupSec": round(pickup_sec, 4),
            "barSecLocal": round(bar_local, 4),
            "legacyLeadSec": legacy_lead(stamp.get("playEffect")),
            "valid": valid,
            "issues": issues,
        })
    return hooks
