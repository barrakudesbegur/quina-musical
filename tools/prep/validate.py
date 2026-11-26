"""Validate a repertoire's <dataDir>/analysis/*.json and write <dataDir>/report.md (default repertoire: data/).

Usage (from the repo root): tools/prep/.venv/bin/python tools/prep/validate.py [--repertoire NAME|PATH]
Exits non-zero on hard errors: a missing analysis file, or a song whose hook tags gave no valid hook
and that is not excluded by an override ({"exclude": true} in <overridesDir>/<id>.json).
Missing optional inputs are reported, not errors: songs without hook tags (not playable until tagged)
and a repertoire without Spotify features (no tempo or key cross-check).
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import repertoire as repertoires  # noqa: E402
from steps.output import write_text_if_changed  # noqa: E402

# Ordered by how likely they are to break a landing; drives the audition queue.
SEVERITY = {
    "no_valid_hook": 100, "no_hook_tags": 95, "no_valid_best_hook": 90, "hook_past_end": 80, "hook_downbeat_past_end": 80,
    "meter_unknown": 70, "grid_irregular": 60, "spotify_disagree": 55, "spotify_metre_ambiguous": 50,
    "auto_half_time": 50, "auto_half_time_librosa": 50, "spotify_half_double": 45, "tempo_unstable": 40, "tags_suggest_phase_shift": 38, "auto_phase_from_tags": 45, "bar_phase_changes": 35,
    "duration_mismatch": 30, "librosa_disagree": 20, "best_hook_ambiguous": 15, "hook_near_end": 10,
    "has_override": 0,
}
EXPLAIN = {
    "duration_mismatch": "MP3 length differs from songs.json by more than 1 s; hooks may be shifted",
    "hook_past_end": "a hook is past the end of the file",
    "hook_downbeat_past_end": "a snapped hook downbeat is in the last second of the file",
    "hook_near_end": "a hook is within 8 s of the end",
    "no_valid_best_hook": "the `best` hook is unusable",
    "no_valid_hook": "no usable hook at all",
    "no_hook_tags": "no hook tags and no approved automatic hook: not playable until one is approved on the audition page (hooks step)",
    "best_hook_ambiguous": "the `best` tag sits mid-bar; check which downbeat is the chorus start",
    "tempo_unstable": "bar length spread (IQR) above 3%",
    "bar_phase_changes": "the bar phase changes more than twice; check the downbeats",
    "grid_irregular": "under 60% of beats sit on a steady local grid",
    "auto_half_time": "Beat This! tempo halved because Spotify and librosa agree on half; bar phase is a guess",
    "auto_half_time_librosa": "no Spotify tempo: Beat This! tempo (160 BPM or more) halved because librosa is at half; check it, bar phase is a guess",
    "librosa_half_double": "no Spotify value and librosa is at half or double our tempo",
    "spotify_half_double": "Spotify is at half/double our tempo and librosa does not confirm ours",
    "spotify_metre_ambiguous": "3:2 or 4:3 ratio against Spotify (metre ambiguity)",
    "spotify_disagree": "tempo disagrees with Spotify",
    "librosa_disagree": "no Spotify value and librosa disagrees",
    "meter_unknown": "Beat This! found no usable bars",
    "meter_3": "3 beats per bar",
    "has_override": "hand fixes applied from the repertoire's overrides",
    "tags_suggest_phase_shift": "the hand tags sit much closer to downbeats with another bar phase (see tempo.tagPhaseFit); try Downbeats ±1 beat",
    "auto_phase_from_tags": "after halving, the bar phase was chosen to fit the hand tags",
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    repertoires.add_argument(ap)
    repertoire = repertoires.from_args(ap.parse_args())
    try:
        songs = repertoire.songs()
    except repertoires.RepertoireError as err:
        print(f"validate: {err}", file=sys.stderr)
        return 1
    out_dir, report = repertoire.analysis_dir, repertoire.report_path
    errors: list[str] = []
    rows = []
    for song in songs:
        path = out_dir / f"{song['id']}.json"
        if not path.exists():
            errors.append(f"song {song['id']}: missing {path.name}")
            continue
        a = json.loads(path.read_text())
        override = a.get("override") or {}
        excluded = bool(override.get("exclude"))
        if "no_valid_hook" in a["flags"] and not excluded:
            errors.append(f"song {song['id']}: no valid hook (add an override or exclude it)")
        severity = max((SEVERITY.get(f, 25) for f in a["flags"] if f != "has_override"), default=0)
        rows.append((severity, a, excluded))

    flag_counts = Counter(f for _, a, _ in rows for f in a["flags"])
    hooks = [h for _, a, _ in rows for h in a["hooks"]]
    ambiguous = sum(1 for h in hooks if "snap_ambiguous" in h.get("issues", []))
    pickups = sum(1 for h in hooks if h.get("pickupBeats"))
    valid = sum(1 for h in hooks if h.get("valid"))
    untagged = [a["songId"] for _, a, _ in rows if "no_hook_tags" in a["flags"]]
    playable = sum(1 for _, a, excluded in rows if not excluded and any(h.get("valid") for h in a["hooks"]))
    spotify = repertoire.spotify() if repertoire.has_spotify else {}

    lines = [
        "# Mixer POC analysis report",
        "",
        (f"Generated by `tools/prep/validate.py` for repertoire **{repertoire.name}** (`{repertoires.display(repertoire.manifest)}`) from "
         f"`{repertoires.display(repertoire.analysis_dir)}/*.json` ({len(rows)} songs)."),
        "",
        "## Summary",
        "",
        (f"- Songs analysed: **{len(rows)}** of {len(songs)}; playable (a valid hook, not excluded): **{playable}**; "
         f"with no flags: **{sum(1 for _, a, _ in rows if not [f for f in a['flags'] if f != 'has_override'])}**; "
         f"excluded by override: **{sum(1 for *_, e in rows if e)}**"),
        ("- Hook tags: every song has them" if not untagged else
         f"- **Songs without hook tags: {len(untagged)}** ({', '.join(map(str, untagged))}). They have no hooks, so the "
         "engine leaves them out until songs.json tags them (there is no automatic hook detection yet)."),
        (f"- Spotify features: `{repertoires.display(repertoire.spotify_features)}`, "
         f"{sum(1 for r in spotify.values() if (r or {}).get('features'))} songs"
         if repertoire.has_spotify else
         f"- **No Spotify features** (`{repertoires.display(repertoire.spotify_features)}` not found): no tempo or key cross-check "
         "against Spotify and no automatic half time; tempo is checked against librosa only, and keys.py uses its "
         "default method unscored."),
        f"- Hooks: **{len(hooks)}**, valid **{valid}**; landing with a pickup (tag ≤ 1.5 beats before the downbeat): **{pickups}**; tag mid-bar (`snap_ambiguous`): **{ambiguous}**",
        "- The hand tags scatter about ±2 beats around downbeats (no bar position dominates), so snapping is positional: tag ≤ 1.5 beats before a downbeat → land it with a pickup; otherwise land the downbeat before the tag.",
        f"- Hard errors: **{len(errors)}**",
        "",
        "| Flag | Songs | Meaning |",
        "|---|---|---|",
    ]
    for flag, count in sorted(flag_counts.items(), key=lambda kv: -SEVERITY.get(kv[0], 25)):
        lines.append(f"| `{flag}` | {count} | {EXPLAIN.get(flag, '')} |")

    lines += ["", "## Audition queue (most severe first)", "",
              (f"Open `/show/audition.html?song=N`. Fix with `{repertoires.display(repertoire.overrides_dir)}/<id>.json`, "
               f"then re-run `tools/prep/analyze.py{'' if repertoire.name == repertoires.DEFAULT_REPERTOIRE else ' --repertoire ' + repertoire.name}"
               " --derive-only --song N`."), "",
              "| # | Song | BPM (ours / Spotify / librosa) | Δ duration | Best hook | Flags |", "|---|---|---|---|---|---|"]
    for severity, a, excluded in sorted(rows, key=lambda r: (-r[0], r[1]["songId"])):
        if severity == 0:
            continue
        t = a["tempo"]
        est = t["estimates"]
        best = next((h for h in a["hooks"] if h["tag"] == "best"), None)
        best_txt = "—"
        if best and "downbeatSec" in best:
            best_txt = f"tag {best['tagTimeSec']:.2f} → {best['downbeatSec']:.2f}" + (f" (+{best['pickupBeats']:g} beat pickup)" if best.get("pickupBeats") else "")
        delta = a["source"].get("durationDeltaSec")
        name = f"[{a["songId"]}](/show/audition.html?song={a["songId"]}) {a['title']} — {a['artist']}" + (" **(excluded)**" if excluded else "")
        lines.append(f"| {a['songId']} | {name} | {t['bpm']} / {est.get('spotify') or '—'} / {est.get('librosa') or '—'} | "
                     f"{'' if delta is None else f'{delta:+.1f} s'} | {best_txt} | {', '.join('`'+f+'`' for f in a['flags'])} |")

    lines += ["", "## All songs", "", "| # | Song | BPM | Bar s | LUFS | Hook gain dB (best) | Hooks valid |", "|---|---|---|---|---|---|---|"]
    for _, a, _ in sorted(rows, key=lambda r: r[1]["songId"]):
        best = next((h for h in a["hooks"] if h["tag"] == "best"), {})
        lines.append(f"| {a['songId']} | {a['title']} — {a['artist']} | {a['tempo']['bpm']} | {a['tempo']['barSecMedian']} | "
                     f"{a['loudness']['integratedLufs']} | {best.get('gainToTargetDb', '—')} | "
                     f"{sum(1 for h in a['hooks'] if h.get('valid'))}/{len(a['hooks'])} |")
    if errors:
        lines += ["", "## Hard errors", ""] + [f"- {e}" for e in errors]
    write_text_if_changed(report, "\n".join(lines) + "\n")
    print(f"wrote {repertoires.display(report)} ({repertoire.name}): {len(rows)} songs, {playable} playable, "
          f"{len(errors)} hard errors")
    if untagged:
        print(f"  not playable until tagged (no hook tags): {', '.join(map(str, untagged))}")
    if not repertoire.has_spotify:
        print("  no Spotify features: no tempo or key cross-check")
    for flag, count in flag_counts.most_common():
        print(f"  {flag}: {count}")
    for e in errors:
        print("ERROR", e)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
