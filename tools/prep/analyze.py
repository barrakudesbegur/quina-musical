"""Offline analysis for the mixer POC: beat/downbeat grid, tempo, hooks, loudness, energy, flags.

Usage (from the repo root; every command takes --repertoire NAME|PATH, see tools/prep/repertoire.py):
    tools/prep/.venv/bin/python tools/prep/analyze.py            # all songs
    tools/prep/.venv/bin/python tools/prep/analyze.py --song 12  # one song
    tools/prep/.venv/bin/python tools/prep/analyze.py --derive-only   # re-apply hooks/overrides, no model

Paths are the repertoire's (the default repertoire's in brackets): reads <cacheDir>/<id>/mix.flac [cache/],
writes <dataDir>/analysis/<id>.json and index.json [data/out/analysis/]. Expensive results (Beat This!,
loudness, onset envelope) are cached in <cacheDir>/<id>/raw.json keyed by the source audio's sha256,
so re-runs only redo the cheap derive step, and a file whose content would not change (apart from
its createdAt) is left as it is. Overrides in <overridesDir>/<id>.json [data/repertoires/default/overrides/] are
merged last.

Optional inputs: without Spotify features the tempo is checked against librosa only (no automatic
half time); a song without hook tags (songs.json timestamps) gets no hooks and the flag
`no_hook_tags`, so the engine leaves it out until it is tagged.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import repertoire as repertoires  # noqa: E402
from steps import beats as beats_step  # noqa: E402
from steps import energy as energy_step  # noqa: E402
from steps import hooks as hooks_step  # noqa: E402
from steps import loudness as loud_step  # noqa: E402
from steps import tempo as tempo_step  # noqa: E402
from steps.output import write_json_stable, write_text_if_changed  # noqa: E402

RAW_VERSION = 2
DURATION_MISMATCH_SEC = 1.0


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ffmpeg_version() -> str:
    try:
        line = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True).stdout.splitlines()[0]
        return " ".join(line.split()[:3])
    except Exception:
        return "unknown"


def tool_versions() -> dict:
    import importlib.metadata as md

    out = {}
    for name in ("beat-this", "librosa", "pyloudnorm", "torch", "numpy"):
        try:
            out[name] = md.version(name)
        except md.PackageNotFoundError:
            pass
    return out


def load_raw(repertoire: repertoires.Repertoire, song_id: int, mp3: Path, flac: Path, signal, sr, force: bool) -> dict:
    raw_path = repertoire.song_cache(song_id) / "raw.json"
    digest = sha256(mp3)
    if raw_path.exists() and not force:
        raw = json.loads(raw_path.read_text())
        if raw.get("sha256") == digest and raw.get("rawVersion") == RAW_VERSION:
            return raw
    if signal is None:
        signal, sr = sf.read(flac, dtype="float32", always_2d=True)
    mono = signal.mean(axis=1)
    t0 = time.time()
    beats, downbeats = beats_step.run_beat_this(signal, sr)
    t_beats = time.time() - t0
    onset_env = energy_step.onset_envelope(mono, sr)
    np.save(repertoire.song_cache(song_id) / "onset.npy", onset_env.astype(np.float32))
    raw = {
        "rawVersion": RAW_VERSION,
        "sha256": digest,
        "sampleRate": sr,
        "durationSec": len(signal) / sr,
        "beatsRaw": [round(float(b), 4) for b in beats],
        "downbeatsRaw": [round(float(b), 4) for b in downbeats],
        "integratedLufs": round(loud_step.integrated(signal, sr), 2),
        "truePeakDbtp": round(loud_step.true_peak_dbtp(signal), 2),
        "librosaTempo": tempo_step.librosa_tempo(onset_env, energy_step.ONSET_SR, energy_step.ONSET_HOP),
        "beatThisSec": round(t_beats, 2),
    }
    raw_path.write_text(json.dumps(raw))
    return raw


def analyze_song(repertoire: repertoires.Repertoire, song: dict, mp3: Path | None, spotify: dict, versions: dict, decoder: str,
                 force: bool, derive_only: bool) -> dict:
    song_id = song["id"]
    flac = repertoire.mix_flac(song_id)
    if not flac.exists():
        raise FileNotFoundError(f"{flac} missing: run the decode step first "
                                f"(tools/prep/prepare.py --repertoire {repertoire.name} --steps decode)")
    signal, sr = sf.read(flac, dtype="float32", always_2d=True)
    raw_path = repertoire.song_cache(song_id) / "raw.json"
    if derive_only and raw_path.exists():
        raw = json.loads(raw_path.read_text())
    elif mp3 is None:
        raise FileNotFoundError(f"song {song_id}: no source audio in {repertoire.audio_dir}")
    else:
        raw = load_raw(repertoire, song_id, mp3, flac, signal, sr, force)
    mono = signal.mean(axis=1)
    duration = len(signal) / sr

    override_path = repertoire.override_path(song_id)
    override = json.loads(override_path.read_text()) if override_path.exists() else {}
    # Approved automatic hooks (tools/prep/hooks_auto.py, the audition page) count like hand tags.
    song = hooks_step.with_auto_hooks(song, override)

    beats = np.asarray(raw["beatsRaw"], dtype=float)
    downbeats_raw = np.asarray(raw["downbeatsRaw"], dtype=float)
    db_idx = beats_step.downbeat_indices(beats, downbeats_raw)
    beats, refined_count = beats_step.refine_beats(beats)
    sp = (spotify.get(str(song_id)) or {}).get("features") or {}
    auto_notes: list[str] = []

    # Half time: when Spotify and librosa both put the tempo at half of Beat This!'s, trust them; with no Spotify
    # tempo, librosa alone when Beat This!'s is implausibly fast (steps/tempo.py half_time).
    tempo_factor = override.get("tempoFactor")
    raw_bpm = 60.0 / float(np.median(np.diff(beats))) if len(beats) > 1 else 0
    half_reason = tempo_step.half_time(raw_bpm, raw.get("librosaTempo"), sp.get("tempo")) if tempo_factor is None else None
    if half_reason:
        tempo_factor = 0.5
        auto_notes.append("auto_half_time" if half_reason == "spotify" else "auto_half_time_librosa")
    if tempo_factor in (0.5, 2):
        beats, db_idx = beats_step.apply_tempo_factor(beats, db_idx, tempo_factor)
    bpb = int(override.get("beatsPerBar") or 0) or beats_step.beats_per_bar(db_idx)
    if bpb < 2:
        auto_notes.append("meter_unknown")
        bpb = 4
    if tempo_factor == 0.5 and bpb == 2 and not override.get("beatsPerBar"):
        bpb = 4  # halving turns 4-beat bars into 2-beat ones; rebuild 4-beat bars (phase needs audition)
    if not override.get("noRegularize"):
        db_idx, reg_stats = beats_step.regularize_downbeats(len(beats), db_idx, bpb)
    else:
        reg_stats = {}
    # The hand tags lean toward downbeats on average, so they vote on the bar phase. After an automatic
    # halving the phase is a coin flip: let the tags decide. Otherwise only flag a much better fit.
    tag_times = [float(t["time"]) for t in song.get("timestamps", []) if float(t["time"]) < duration]
    phase_fit = beats_step.tag_phase_fit(beats, db_idx, tag_times, bpb)
    if half_reason and "downbeatShiftBeats" not in override and phase_fit:
        best_shift = min((0, 2), key=lambda k: phase_fit["meanDistBeats"][k])
        if best_shift:
            db_idx = db_idx + best_shift
            db_idx = db_idx[(db_idx >= 0) & (db_idx < len(beats))]
            auto_notes.append("auto_phase_from_tags")
            phase_fit = beats_step.tag_phase_fit(beats, db_idx, tag_times, bpb)
    db_idx, bpb = beats_step.apply_downbeat_overrides(beats, db_idx, {k: v for k, v in override.items() if k != "beatsPerBar"}, bpb)
    downbeats = beats[db_idx] if len(db_idx) else np.asarray([])

    tempo = tempo_step.tempo_summary(beats, downbeats, bpb)
    tempo["estimates"]["librosa"] = raw.get("librosaTempo")
    tempo["estimates"]["spotify"] = sp.get("tempo")
    tempo["estimates"]["beatThisRaw"] = round(raw_bpm, 2)
    tempo["vsSpotify"] = tempo_step.compare_to_reference(tempo["bpm"], sp.get("tempo"))
    tempo["vsLibrosa"] = tempo_step.compare_to_reference(tempo["bpm"], raw.get("librosaTempo"))
    tempo["regularized"] = reg_stats
    tempo["tagPhaseFit"] = phase_fit
    if tempo_factor in (0.5, 2):
        tempo["tempoFactor"] = tempo_factor
    if override.get("bpm"):
        tempo["bpmOverride"] = override["bpm"]

    hooks = hooks_step.snap_hooks(song, beats, downbeats, db_idx, duration, override, tempo["barSecMedian"], bpb)
    for hook in hooks:
        if "downbeatSec" not in hook:
            continue
        hook["energyDb"] = energy_step.rms_db(mono, sr, hook["downbeatSec"], 2 * hook["barSecLocal"])
        hook_lufs = loud_step.window_lufs(signal, sr, hook["downbeatSec"])
        hook["lufs8s"] = round(hook_lufs, 2) if hook_lufs is not None else None
        hook["gainToTargetDb"] = loud_step.gain_to_target(hook_lufs)

    onset_path = repertoire.song_cache(song_id) / "onset.npy"
    onset_env = np.load(onset_path) if onset_path.exists() else energy_step.onset_envelope(mono, sr)
    energy = energy_step.per_bar(mono, sr, downbeats, onset_env) if len(downbeats) > 1 else {}

    meta_duration = float(song.get("duration") or 0)
    flags: list[str] = list(auto_notes)
    if meta_duration and abs(duration - meta_duration) > DURATION_MISMATCH_SEC:
        flags.append("duration_mismatch")
    for issue in ("past_end", "near_end", "downbeat_past_end"):
        if any(issue in h.get("issues", []) for h in hooks):
            flags.append(f"hook_{issue}")
    best = next((h for h in hooks if h["tag"] == "best"), None)
    if best and "snap_ambiguous" in best.get("issues", []):
        flags.append("best_hook_ambiguous")
    if not song.get("timestamps"):
        flags.append("no_hook_tags")  # nothing to snap yet: no hooks, so the engine leaves the song out
    else:
        if not any(h["tag"] == "best" and h.get("valid") for h in hooks):
            flags.append("no_valid_best_hook")
        if not any(h.get("valid") for h in hooks):
            flags.append("no_valid_hook")
    if not tempo["isStable"]:
        flags.append("tempo_unstable")
    if bpb != 4:
        flags.append(f"meter_{bpb}")
    vs_sp = tempo["vsSpotify"]["status"]
    vs_lib = tempo["vsLibrosa"]["status"]
    if vs_sp in ("metre_ambiguous", "disagree"):
        flags.append(f"spotify_{vs_sp}")
    elif vs_sp == "half_double" and vs_lib != "agree":
        flags.append("spotify_half_double")
    if vs_sp == "missing" and vs_lib in ("metre_ambiguous", "disagree", "half_double"):
        flags.append(f"librosa_{vs_lib}")
    if (phase_fit and "downbeatShiftBeats" not in override and phase_fit["bestShift"] != 0
            and phase_fit["meanDistBeats"][phase_fit["bestShift"]] < 0.6 * phase_fit["meanDistBeats"][0]
            and phase_fit["tags"] >= 3):
        flags.append("tags_suggest_phase_shift")
    if reg_stats.get("phaseChanges", 0) > 2:
        flags.append("bar_phase_changes")
    if len(beats) and refined_count / len(beats) < 0.6:
        flags.append("grid_irregular")
    if override:
        flags.append("has_override")

    lufs = raw["integratedLufs"]
    return {
        "schemaVersion": 1,
        "songId": song_id,
        "title": song["title"],
        "artist": song["artist"],
        "source": {
            "mp3": repertoires.display(mp3, repertoires.REPO) if mp3 else None,
            "pcm": repertoires.display(flac),
            "sampleRate": sr,
            "durationSec": round(duration, 4),
            "sha256": raw["sha256"],
            "metadataDurationSec": meta_duration,
            "durationDeltaSec": round(duration - meta_duration, 2) if meta_duration else None,
            "decoder": decoder,
        },
        "tempo": tempo,
        "beats": [round(float(b), 4) for b in beats],
        "downbeats": [round(float(b), 4) for b in downbeats],
        "downbeatBeatIndex": [int(i) for i in db_idx],
        "hooks": hooks,
        "loudness": {
            "integratedLufs": lufs,
            "truePeakDbtp": raw["truePeakDbtp"],
            "targetLufs": loud_step.TARGET_LUFS,
            "gainToTargetDb": loud_step.gain_to_target(lufs),
        },
        "energy": energy,
        "key": None,
        "vocals": None,
        "stems": None,
        "volume": song.get("volume", 1),
        "flags": flags,
        "override": override or None,
        "analysis": {
            "createdAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "toolVersions": versions,
            "refinedBeatShare": round(refined_count / max(1, len(beats)), 3),
            "beatThisSec": raw.get("beatThisSec"),
        },
    }


def index_row(a: dict) -> dict:
    return {
        "id": a["songId"],
        "title": a["title"],
        "artist": a["artist"],
        "durationSec": a["source"]["durationSec"],
        "bpm": a["tempo"].get("bpmOverride") or a["tempo"]["bpm"],
        "beatsPerBar": a["tempo"]["beatsPerBar"],
        "barSec": a["tempo"]["barSecMedian"],
        "isStable": a["tempo"]["isStable"],
        "key": a["key"],
        "gainToTargetDb": a["loudness"]["gainToTargetDb"],
        "volume": a.get("volume", 1),
        "flags": a["flags"],
        "excluded": bool((a.get("override") or {}).get("exclude")),
        "hooks": [
            {"id": h["id"], "tag": h["tag"], "downbeatSec": h.get("downbeatSec"), "valid": h.get("valid"),
             "gainToTargetDb": h.get("gainToTargetDb"), "energyDb": h.get("energyDb")}
            for h in a["hooks"]
        ],
    }


def dumps_analysis(doc: dict) -> str:
    return json.dumps(doc, ensure_ascii=False)


def main() -> int:
    parser = argparse.ArgumentParser()
    repertoires.add_argument(parser)
    parser.add_argument("--song", type=int, action="append")
    parser.add_argument("--force", action="store_true", help="ignore the raw cache")
    parser.add_argument("--derive-only", action="store_true",
                        help="never run the model; reuse <cacheDir>/<id>/raw.json")
    args = parser.parse_args()
    repertoire = repertoires.from_args(args)

    try:
        songs = repertoire.songs()
        spotify = repertoire.spotify()
        audio = repertoire.audio_files() if not args.derive_only or repertoire.audio_dir.is_dir() else {}
    except repertoires.RepertoireError as err:
        print(f"analyze: {err}", file=sys.stderr)
        return 1
    out = repertoire.analysis_dir
    out.mkdir(parents=True, exist_ok=True)
    versions = tool_versions()
    decoder = ffmpeg_version()
    wanted = set(args.song or [])
    unknown = sorted(wanted - {s["id"] for s in songs})
    if unknown:
        print(f"analyze: songs {unknown} are not in {repertoires.display(repertoire.songs_json, repertoires.REPO)}", file=sys.stderr)
        return 1
    if not repertoire.has_spotify:
        print(f"note: no Spotify features ({repertoires.display(repertoire.spotify_features)}): tempo is checked against "
              "librosa only", flush=True)
    failed: dict[int, str] = {}
    for song in songs:
        if wanted and song["id"] not in wanted:
            continue
        t0 = time.time()
        try:
            result = analyze_song(repertoire, song, audio.get(song["id"]), spotify, versions, decoder, args.force,
                                  args.derive_only)
        except Exception as err:  # keep going; the summary and the exit code report it
            failed[song["id"]] = f"song {song['id']}: {type(err).__name__}: {err}"
            print("FAILED", failed[song["id"]], flush=True)
            continue
        changed = write_json_stable(out / f"{song['id']}.json", result, dumps_analysis, ("analysis", "createdAt"))
        print(f"{song['id']:>3} {song['title'][:32]:<32} bpm {result['tempo']['bpm']:>6} "
              f"bpb {result['tempo']['beatsPerBar']} flags {','.join(result['flags']) or '-'} "
              f"({time.time() - t0:.1f}s{'' if changed else ', unchanged'})", flush=True)

    rows = []
    for song in songs:
        path = out / f"{song['id']}.json"
        if path.exists() and song["id"] not in failed:  # a failed song's older file may be stale
            rows.append(index_row(json.loads(path.read_text())))
    write_text_if_changed(out / "index.json",
                          json.dumps({"schemaVersion": 1, "songs": rows}, ensure_ascii=False, indent=1))
    print(f"index.json ({repertoire.name}): {len(rows)} songs" + (f"; {len(failed)} failed" if failed else ""))
    for line in failed.values():
        print("ERROR", line)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
