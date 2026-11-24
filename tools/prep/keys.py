"""Musical key of every song, globally and around each valid hook, plus tempo-pair statistics.

    analysis/.venv/bin/python analysis/keys.py            # detect (cached), evaluate, write <dataDir>/keys/
    analysis/.venv/bin/python analysis/keys.py eval       # accuracy table only (needs the cache)
    analysis/.venv/bin/python analysis/keys.py pairs      # tempo-pair and key-compatibility statistics
    options: --pool NAME|PATH, --song N (repeatable), --force, --json

Paths are the pool's (analysis/pool.py); the default pool's are data/keys/, cache/keys/ and
data/spotify_features.json.

Methods (all on the mix, mono):
  - essentia-<profile>: Essentia's KeyExtractor (HPCP + key profile) with the bgate, edma,
    temperley, krumhansl and shaath profiles, at 44.1 kHz.
  - librosa-<profile>: librosa chroma_cqt (22.05 kHz, 36 bins per octave, hop 2048, tuning estimated),
    frame-normalised and averaged, correlated with the Krumhansl-Kessler, Temperley and
    Albrecht-Shanahan profiles over the 24 keys.
Global = the whole song; a hook = its downbeat ±8 bars. Every method is scored against Spotify's
key/mode (the pool's Spotify features, not committed: only aggregate numbers leave this script), and
the best one is written to <dataDir>/keys/<id>.json and index.json. A pool without Spotify features
can't score the methods: it uses DEFAULT_METHOD, the one that scored best on the default pool, and
index.json says the accuracy is unknown.

Confidence is the method's own strength in [0, 1] (Essentia's key strength; the profile
correlation for librosa). `margin` is how far ahead it is of the best key with another Camelot
number, so a relative major/minor tie doesn't count as doubt.

Per-song features are cached in <cacheDir>/keys/<id>.json (keyed by mix.flac size/mtime and the hooks).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import pool as pools  # noqa: E402
from steps.output import write_json_stable, write_text_if_changed  # noqa: E402
from steps.tempo_match import pair_class  # noqa: E402

CACHE_VERSION = 1
HOOK_BARS = 8
MIN_CONFIDENCE = 0.7  # below this the chosen method was right 0 of 5 times against Spotify

NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
ESSENTIA_NAMES = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
                  "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
ESSENTIA_PROFILES = ("bgate", "edma", "temperley", "krumhansl", "shaath")
PROFILES = {
    "kk": ([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
           [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]),
    "temperley": ([5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0],
                  [5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0]),
    "albrecht": ([0.238, 0.006, 0.111, 0.006, 0.137, 0.094, 0.016, 0.214, 0.009, 0.080, 0.008, 0.081],
                 [0.220, 0.006, 0.104, 0.123, 0.019, 0.103, 0.012, 0.214, 0.062, 0.022, 0.061, 0.052]),
}
METHODS = [f"essentia-{p}" for p in ESSENTIA_PROFILES] + [f"librosa-{p}" for p in PROFILES]
# Without a Spotify reference the methods can't be scored: use the best one on the default pool
# (MIREX 0.650 against Spotify over 68 songs, 2026-11).
DEFAULT_METHOD = "essentia-temperley"


# ---------------------------------------------------------------- Camelot

def camelot(pc: int, mode: str) -> str:
    """Camelot code: C major = 8B, A minor = 8A; a fifth up is +1."""
    major_pc = pc if mode == "major" else (pc + 3) % 12
    return f"{(7 * major_pc + 7) % 12 + 1}{'B' if mode == 'major' else 'A'}"


def parse_camelot(code: str) -> tuple[int, str]:
    return int(code[:-1]), code[-1]


def relation(a: str, b: str) -> str:
    """'same', 'adjacent' (±1, same letter), 'relative' (same number), or 'none'. Mirrors keys.js."""
    (na, la), (nb, lb) = parse_camelot(a), parse_camelot(b)
    if na == nb and la == lb:
        return "same"
    if la == lb and (na - nb) % 12 in (1, 11):
        return "adjacent"
    if na == nb:
        return "relative"
    return "none"


def compatible(a: str | None, b: str | None) -> bool:
    return bool(a and b) and relation(a, b) != "none"


def key_record(pc: int, mode: str, confidence: float, margin: float | None = None) -> dict:
    rec = {"key": NAMES[pc], "mode": mode, "camelot": camelot(pc, mode), "pitchClass": pc,
           "confidence": round(float(confidence), 3)}
    if margin is not None:
        rec["margin"] = round(float(margin), 3)
    return rec


# ---------------------------------------------------------------- detection

def _profile_scores(chroma_mean: np.ndarray, profile: str) -> list[tuple[float, int, str]]:
    major, minor = (np.asarray(p, dtype=float) for p in PROFILES[profile])
    scores = []
    for pc in range(12):
        for mode, prof in (("major", major), ("minor", minor)):
            r = np.corrcoef(chroma_mean, np.roll(prof, pc))[0, 1]
            scores.append((float(r), pc, mode))
    return sorted(scores, reverse=True)


def _from_scores(scores: list[tuple[float, int, str]]) -> dict:
    best_r, pc, mode = scores[0]
    code = camelot(pc, mode)
    other = next(r for r, p, m in scores[1:] if camelot(p, m)[:-1] != code[:-1])
    return key_record(pc, mode, max(0.0, best_r), best_r - other)


def _essentia(mono44: np.ndarray, profile: str) -> dict:
    import essentia.standard as es

    key, scale, strength = es.KeyExtractor(profileType=profile, sampleRate=44100)(mono44)
    return key_record(ESSENTIA_NAMES[key], "major" if scale == "major" else "minor", strength)


def hook_windows(analysis: dict) -> dict[str, tuple[float, float]]:
    db = analysis["downbeats"]
    out = {}
    for hook in analysis["hooks"]:
        k = hook.get("downbeatIndex")
        if not hook.get("valid") or k is None:
            continue
        lo = max(0.0, db[max(0, k - HOOK_BARS)])
        hi = min(float(analysis["source"]["durationSec"]), db[min(len(db) - 1, k + HOOK_BARS)])
        if hi - lo < 4.0:
            continue
        out[hook["id"]] = (float(lo), float(hi))
    return out


def detect_song(pool: pools.Pool, song: int, force: bool = False) -> dict:
    """All methods for one song (cached)."""
    import librosa
    import soxr

    analysis = json.loads((pool.analysis_dir / f"{song}.json").read_text())
    mix = pool.mix_flac(song)
    st = mix.stat()
    windows = hook_windows(analysis)
    fingerprint = {"version": CACHE_VERSION, "mix": f"{st.st_size}:{st.st_mtime_ns}",
                   "hooks": {k: [round(a, 4), round(b, 4)] for k, (a, b) in windows.items()}}
    cache_path = pool.key_cache_dir / f"{song}.json"
    if cache_path.exists() and not force:
        cached = json.loads(cache_path.read_text())
        if cached.get("fingerprint") == fingerprint:
            return cached
    audio, sr = sf.read(str(mix), dtype="float32", always_2d=True)
    mono = audio.mean(axis=1)
    mono44 = soxr.resample(mono, sr, 44100, "HQ").astype(np.float32)
    mono22 = soxr.resample(mono, sr, 22050, "HQ").astype(np.float32)
    hop = 2048
    chroma = librosa.feature.chroma_cqt(y=mono22, sr=22050, hop_length=hop, bins_per_octave=36)
    chroma = chroma / (chroma.max(axis=0, keepdims=True) + 1e-9)
    frame_t = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=22050, hop_length=hop)

    def run_all(t0: float | None, t1: float | None) -> dict:
        res = {}
        seg44 = mono44 if t0 is None else mono44[int(t0 * 44100):int(t1 * 44100)]
        for prof in ESSENTIA_PROFILES:
            res[f"essentia-{prof}"] = _essentia(seg44, prof)
        sel = slice(None) if t0 is None else (frame_t >= t0) & (frame_t < t1)
        cmean = chroma[:, sel].mean(axis=1)
        for prof in PROFILES:
            res[f"librosa-{prof}"] = _from_scores(_profile_scores(cmean, prof))
        return res

    result = {"songId": song, "fingerprint": fingerprint, "global": run_all(None, None),
              "hooks": {hid: {"startSec": round(a, 3), "endSec": round(b, 3), **run_all(a, b)}
                        for hid, (a, b) in windows.items()}}
    pool.key_cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(result))
    return result


# ---------------------------------------------------------------- evaluation

def spotify_keys(pool: pools.Pool) -> dict[int, tuple[int, str]]:
    songs = pool.spotify()
    out = {}
    for sid, rec in songs.items():
        feat = rec.get("features") or {}
        key, mode = feat.get("key"), feat.get("mode")
        if rec.get("found") and key is not None and mode is not None and int(key) >= 0:
            out[int(sid)] = (int(key), "major" if int(mode) == 1 else "minor")
    return out


def score(pred: dict, truth: tuple[int, str]) -> str:
    pc, mode = truth
    if pred["pitchClass"] == pc and pred["mode"] == mode:
        return "exact"
    rel = relation(pred["camelot"], camelot(pc, mode))
    if rel == "relative":
        return "relative"
    if rel == "adjacent":
        return "fifth"
    if pred["pitchClass"] == pc:
        return "parallel"
    return "other"


MIREX = {"exact": 1.0, "fifth": 0.5, "relative": 0.3, "parallel": 0.2, "other": 0.0}


def evaluate(results: dict[int, dict], truth: dict[int, tuple[int, str]]) -> dict:
    table = {}
    common = [s for s in results if s in truth]
    for method in METHODS:
        counts = {k: 0 for k in MIREX}
        for s in common:
            counts[score(results[s]["global"][method], truth[s])] += 1
        n = len(common)
        table[method] = {
            "n": n, **counts,
            "exactPct": round(100 * counts["exact"] / n, 1) if n else None,
            "camelotCompatiblePct": round(100 * (counts["exact"] + counts["relative"] + counts["fifth"]) / n, 1) if n else None,
            "mirex": round(sum(MIREX[k] * v for k, v in counts.items()) / n, 3) if n else None,
        }
    return table


def hook_agreement(results: dict[int, dict], method: str) -> dict:
    """How often a hook's key differs from the song's global key (same method)."""
    same = rel = other = 0
    for res in results.values():
        g = res["global"][method]["camelot"]
        for hk in res["hooks"].values():
            r = relation(hk[method]["camelot"], g)
            if r == "same":
                same += 1
            elif r != "none":
                rel += 1
            else:
                other += 1
    n = same + rel + other
    return {"hooks": n, "samePct": round(100 * same / n, 1) if n else None,
            "compatibleOtherPct": round(100 * rel / n, 1) if n else None,
            "incompatiblePct": round(100 * other / n, 1) if n else None}


# ---------------------------------------------------------------- output

def write_outputs(pool: pools.Pool, results: dict[int, dict], method: str, accuracy: dict) -> None:
    out_dir = pool.keys_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    index = []
    for song in sorted(results):
        res = results[song]
        doc = {
            "songId": song,
            "method": method,
            "global": res["global"][method],
            "hooks": {hid: {**hk[method], "startSec": hk["startSec"], "endSec": hk["endSec"]}
                      for hid, hk in res["hooks"].items()},
        }
        write_text_if_changed(out_dir / f"{song}.json", json.dumps(doc, indent=1) + "\n")
        index.append({"songId": song, "global": doc["global"],
                      "hooks": {hid: {k: v for k, v in hk.items() if k in ("key", "mode", "camelot", "confidence")}
                                for hid, hk in doc["hooks"].items()}})
    write_json_stable(out_dir / "index.json", {
        "schemaVersion": 1,
        "method": method,
        "hookWindowBars": HOOK_BARS,
        "createdAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "accuracyVsSpotify": accuracy,
        "songs": index,
    }, lambda doc: json.dumps(doc, indent=1) + "\n", ("createdAt",))


def load_cached(pool: pools.Pool, songs: list[int]) -> dict[int, dict]:
    out = {}
    for s in songs:
        p = pool.key_cache_dir / f"{s}.json"
        if p.exists():
            out[s] = json.loads(p.read_text())
    return out


def playable(pool: pools.Pool) -> list[dict]:
    return [s for s in json.loads(pool.analysis_index.read_text())["songs"] if not s.get("excluded")]


def choose_method(table: dict) -> str:
    if not any(row["n"] for row in table.values()):
        return DEFAULT_METHOD  # nothing to score against
    return max(METHODS, key=lambda m: (table[m]["mirex"] or 0, table[m]["exact"]))


# ---------------------------------------------------------------- pairs

def pair_stats(pool: pools.Pool) -> dict:
    keys_dir = pool.keys_dir
    songs = playable(pool)
    keys = {}
    for s in songs:
        p = keys_dir / f"{s['id']}.json"
        if p.exists():
            keys[s["id"]] = json.loads(p.read_text())
    classes = {"tight": 0, "direct": 0, "halfdouble": 0, "none": 0}
    key_rows = {"global": [0, 0], "bestHook": [0, 0], "anyHook": [0, 0], "hookPairsShare": [0.0, 0],
                "globalConfident": [0, 0]}
    by_class_compat = {c: [0, 0] for c in classes}
    n = 0
    for a in songs:
        for b in songs:
            if a["id"] == b["id"]:
                continue
            n += 1
            cls = pair_class(a["bpm"], b["bpm"])
            classes[cls] += 1
            ka, kb = keys.get(a["id"]), keys.get(b["id"])
            if not ka or not kb:
                continue
            g = compatible(ka["global"]["camelot"], kb["global"]["camelot"])
            by_class_compat[cls][0] += g
            by_class_compat[cls][1] += 1
            if cls == "none":
                continue
            key_rows["global"][0] += g
            key_rows["global"][1] += 1
            if min(ka["global"]["confidence"], kb["global"]["confidence"]) >= MIN_CONFIDENCE:
                key_rows["globalConfident"][0] += g
                key_rows["globalConfident"][1] += 1
            ha, hb = ka["hooks"], kb["hooks"]
            if ha and hb:
                best_a = next((h for h in ha if "-best-" in h), next(iter(ha)))
                best_b = next((h for h in hb if "-best-" in h), next(iter(hb)))
                key_rows["bestHook"][0] += compatible(ha[best_a]["camelot"], hb[best_b]["camelot"])
                key_rows["bestHook"][1] += 1
                combos = [compatible(x["camelot"], y["camelot"]) for x in ha.values() for y in hb.values()]
                key_rows["anyHook"][0] += any(combos)
                key_rows["anyHook"][1] += 1
                key_rows["hookPairsShare"][0] += sum(combos) / len(combos)
                key_rows["hookPairsShare"][1] += 1

    def pct(x: float, d: int) -> float | None:
        return round(100 * x / d, 1) if d else None

    matchable = classes["tight"] + classes["direct"] + classes["halfdouble"]

    # Options beyond the design's rule, for the recommendations:
    # - meet in the middle: A's exit bars are pre-rendered too, so each song moves up to 8% (±16% total);
    # - pitch-shifting B by up to 1 or 2 semitones to reach a compatible key.
    meet = 0
    shift_ok = {0: [0, 0], 1: [0, 0], 2: [0, 0]}
    for a in songs:
        for b in songs:
            if a["id"] == b["id"]:
                continue
            r = a["bpm"] / b["bpm"]
            if any(abs(r * m - 1) <= 0.16 + 1e-9 for m in (1.0, 0.5, 2.0)):
                meet += 1
            if pair_class(a["bpm"], b["bpm"]) == "none":
                continue
            ka, kb = keys.get(a["id"]), keys.get(b["id"])
            if not ka or not kb:
                continue
            ga, gb = ka["global"], kb["global"]
            for limit in shift_ok:
                ok = any(compatible(ga["camelot"], camelot((gb["pitchClass"] + st) % 12, gb["mode"]))
                         for st in range(-limit, limit + 1))
                shift_ok[limit][0] += ok
                shift_ok[limit][1] += 1

    return {
        "songs": len(songs),
        "orderedPairs": n,
        "tempo": {
            "within4pctDirectPct": pct(classes["tight"], n),
            "within8pctDirectPct": pct(classes["tight"] + classes["direct"], n),
            "only8pctAtHalfOrDoublePct": pct(classes["halfdouble"], n),
            "nonePct": pct(classes["none"], n),
            "matchablePct": pct(matchable, n),
            "counts": classes,
        },
        "keysOfMatchablePairs": {
            "pairs": key_rows["global"][1],
            "globalCompatiblePct": pct(*key_rows["global"]),
            "globalCompatibleBothConfidentPct": pct(*key_rows["globalConfident"]),
            "bothConfidentPairs": key_rows["globalConfident"][1],
            "bestHookCompatiblePct": pct(*key_rows["bestHook"]),
            "someHookPairCompatiblePct": pct(*key_rows["anyHook"]),
            "hookCombinationsCompatiblePct": pct(*key_rows["hookPairsShare"]),
        },
        "globalKeyCompatibleByTempoClassPct": {c: pct(*v) for c, v in by_class_compat.items()},
        "options": {
            "meetInMiddleWithin16PctPct": pct(meet, n),
            "keyCompatibleIfBShiftedUpTo1SemitonePct": pct(*shift_ok[1]),
            "keyCompatibleIfBShiftedUpTo2SemitonesPct": pct(*shift_ok[2]),
        },
        "randomPairCompatibleBaselinePct": round(100 * 5 / 24, 1),
    }


# ---------------------------------------------------------------- CLI

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("command", nargs="?", default="detect", choices=["detect", "eval", "pairs"])
    ap.add_argument("--song", type=int, action="append")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--method", choices=METHODS, help="write this method instead of the best one")
    ap.add_argument("--json", action="store_true")
    pools.add_argument(ap)
    args = ap.parse_args()
    pool = pools.from_args(args)
    if not pool.analysis_index.exists():
        print(f"keys: no {pools.display(pool.analysis_index)}: run the analyze step first", file=sys.stderr)
        return 1

    if args.command == "pairs":
        stats = pair_stats(pool)
        print(json.dumps(stats, indent=1))
        return 0

    ids = args.song or [s["id"] for s in playable(pool)]
    if args.command == "detect":
        for i, s in enumerate(ids, 1):
            detect_song(pool, s, args.force)
            print(f"\r{i}/{len(ids)} songs", end="", file=sys.stderr, flush=True)
        print(file=sys.stderr)
    results = load_cached(pool, ids)
    truth = spotify_keys(pool)
    table = evaluate(results, truth)
    method = args.method or choose_method(table)
    agreement = hook_agreement(results, method)
    if args.json:
        print(json.dumps({"accuracy": table, "method": method, "hooks": agreement}, indent=1))
    else:
        print(f"{'method':22s} {'n':>3s} {'exact':>6s} {'fifth':>6s} {'rel':>5s} {'par':>5s} {'other':>6s} "
              f"{'exact%':>7s} {'camelot%':>9s} {'mirex':>6s}")
        def num(x: float | None, fmt: str) -> str:
            return format(x, fmt) if x is not None else "—".rjust(int(fmt.split(".")[0]))

        for m, row in sorted(table.items(), key=lambda kv: -(kv[1]["mirex"] or 0)):
            print(f"{m:22s} {row['n']:3d} {row['exact']:6d} {row['fifth']:6d} {row['relative']:5d} {row['parallel']:5d} "
                  f"{row['other']:6d} {num(row['exactPct'], '7.1f')} {num(row['camelotCompatiblePct'], '9.1f')} "
                  f"{num(row['mirex'], '6.3f')}")
        print(f"chosen: {method}; hooks vs global key: {agreement}")
    if not truth:
        print(f"note: no Spotify keys in {pools.display(pool.spotify_features)}: accuracy unknown, using {method}")
    if args.command == "detect" and not args.song:
        acc = {m: {k: table[m][k] for k in ("n", "exact", "fifth", "relative", "parallel", "other", "exactPct",
                                              "camelotCompatiblePct", "mirex")} for m in METHODS}
        reference = ("Spotify key/mode (aggregate only)" if truth else
                     f"none: no Spotify features for this pool, so {method} (DEFAULT_METHOD) is unscored")
        write_outputs(pool, results, method, {"reference": reference, "methods": acc,
                                              "chosen": method, "hooksVsGlobal": agreement})
        print(f"wrote {pools.display(pool.keys_dir)}/ ({pool.name}: {len(results)} songs, method {method})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
