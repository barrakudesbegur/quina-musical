# Layering prep: stretch, keys and tempo pairs

Offline tooling for "real DJ layering" ([design decisions](../../../docs/mixer-design-decisions.md#transitions-real-dj-layering)): B's drums, or the bars leading into its Hook, layered under A at A's tempo, then B lands on its Hook at its own tempo. Built 2026-11-24 on the M1 Pro while other agents ran Demucs (load average 14–17), so every timing below is pessimistic.

**In short:**
- **Stretcher:** Rubber Band R3. Mix and drums use R3's short window, cut into one constant-ratio piece per bar. The tonal stems are one continuous standard-window R3 pass. A 4-bar section into a Hook (about 9.6 s of audio) renders in **0.15 s mix-only and 1.2 s with stems**, and a cached call returns in a few ms.
- **Timing:** beats land on a constant grid within **1 ms median and 2 ms p95** for the mix and drums. On the tonal stems, the median error is 3.5–4 ms and p95 is 7–9 ms.
- **Keys:** Essentia's KeyExtractor with the Temperley profile is the best of 8 methods. Against Spotify it gets 53% exact, 75% on the right Camelot number and **85% Camelot-compatible**. Every song tested with confidence below 0.7 was wrong, so treat those keys as unknown.
- **Tempo pairs:** only **37% of ordered pairs can be beat-matched** within ±8% (20% within ±4%; half or double time adds just 0.6%). Of those pairs, only **about 21% have compatible keys**, which is no better than random. So a melodic blend fits about 1 transition in 13, and a drums-only layer fits about 1 in 3. The other 63% need overlaps that aren't beat-matched.

## 1. What was installed

| What | Where | Why |
|---|---|---|
| `brew install rubberband` → Rubber Band **4.0.0** (GPL-2.0-or-later) and the new dependencies libsamplerate, libsndfile, flac, libogg and libvorbis | `/opt/homebrew/opt/rubberband/lib/librubberband.dylib`, loaded with ctypes by `analysis/steps/rubberband.py`. Override it with `RUBBERBAND_LIB` | It is the only route that has a usable key-frame map and R3 |
| `pylibrb==0.1.2` (GPL-2.0, bundles Rubber Band with R3) | `analysis/.venv` | Its `set_keyframe_map` binding is broken (nanobind's map caster is missing, so every dict raises `TypeError`). It is kept only as a constant-ratio fallback when the dylib is missing |
| `essentia==2.1b6.dev1389` (AGPL-3.0) plus `pyyaml==6.0.4` and `six==1.17.0` | `analysis/.venv` | KeyExtractor. The cp313 macOS arm64 wheel imports and runs fine with numpy 2.5.5 |
| `audiotsm==0.1.2` (MIT) | `analysis/.venv` | WSOLA, used only by the benchmark |

Nothing conflicted with `analysis/requirements.txt`, so no separate venv was needed. The new pins are in `analysis/requirements-layering.txt` (`-r requirements.txt` plus these). Install with `uv pip install --python analysis/.venv/bin/python -r analysis/requirements-layering.txt`. The GPL and AGPL licences only matter if the tools are distributed; here they run offline and only their audio and JSON outputs reach the show.

## 2. Stretcher

### 2.1 Engines compared

The benchmark ran 10 s clips, starting on a downbeat 6 bars before a valid best Hook, from songs 1, 46, 70 and 75. Each clip was stretched as the mix, and as the drums stem where one existed, at speed ratios 0.92, 0.96, 1.04 and 1.08, with a constant ratio per run. The figures are medians over 16 runs for the mix and 8 for the drums (`analysis/steps/stretch_bench.py engines`, raw rows in `cache/stretch/bench/engines.json`).

The table uses these metrics:
- **s per s:** wall seconds per second of input audio.
- **Timing bias / p95:** the per-beat lag that best aligns the output's spectral flux with the ideally scaled source flux (±40 ms in 1 ms steps).
- **Smear:** the >2 kHz attack rise time (10→90%), output minus source.
- **Pre-echo:** energy 40–10 ms before each beat relative to the 30 ms after it, output minus source.
- **Round trip:** the log-spectral distance after stretching by r and back by 1/r.
- **Beat This!:** the worst mean offset of Beat This! run on the output, against the scaled grid.

| Engine (mix) | s per s | Timing bias / p95 (ms) | Smear (ms) | Pre-echo (dB) | Round trip (dB) | Beat This! worst mean (ms) |
|---|---|---|---|---|---|---|
| **Rubber Band R3** (finer) | 0.064 (16× real time) | −1.9 / 8.0 | +2.0 | +0.5 | 6.2 | 62 |
| **Rubber Band R3, short window** | 0.025 (40×) | −0.3 / **2.0** | +4.4 | +0.3 | **5.6** | 41 |
| Rubber Band R2 (faster) | 0.008 (125×) | −0.6 / 4.7 | +1.8 | +0.2 | 5.8 | 22 |
| librosa phase vocoder | 0.009 | −3.2 / 15.0 | +7.2 | +0.2 | 11.3 | 65 |
| audiotsm WSOLA | 0.031 | +1.7 / 15.5 | +0.7 | +0.5 | 7.9 | **18** |

On the drums stem, the figures (smear / timing p95, in ms) were:

| Engine (drums) | Smear / timing p95 (ms) |
|---|---|
| R3 | −0.2 / 8.2 |
| R3, short window | 1.4 / 3.0 |
| R2 | 1.4 / 4.5 |
| Phase vocoder | **10.9 / 22.2** |
| WSOLA | 0.0 / 14.8 |

What the numbers say:
- **The librosa phase vocoder is clearly the worst:** about 7–11 ms of transient smear and twice the spectral damage of the others.
- **WSOLA keeps attacks sharp,** but its beats wander ±15–20 ms, because it picks its splice offsets by waveform similarity.
- **The Rubber Band engines are close on these proxies.** None of these proxies captures phasiness or warble well, and nothing here was listened to.
- **R3 was chosen** because it is Rubber Band's highest-quality engine for music, provided the timing problems below are handled.

### 2.2 Two things R3 does that shaped `stretch.py`

**1. R3 keeps a key-frame map only loosely.** The key-frame map is how a stretcher pins each source beat to a grid point.
- On a click track whose beat spacing steps from 0.60 s to 0.45 s, R3 had only reached 0.50 s after 8 beats; R2 followed the step at once.
- On real songs with a key frame on every beat, R3 landed with a p95 error of 6–16 ms.

**2. R3 drifts even at a constant ratio.** Over 10–12 s, the flux check measured up to 15–18 ms of drift: about +9 to +13 ms on average at 1.08 and −2 to −6 ms at 0.92. On a click track, the error grew steadily and then partly came back.

The fix was slicing. Each bar is rendered at its own constant ratio, with 0.25 s of context on both sides. The bars are spliced with a 10 ms crossfade that ends 15 ms before each downbeat, where the downbeat's transient masks it. The crossfade's gain law is normalised by the two renders' measured correlation; the renders turned out to be uncorrelated, so it acts as equal-power.

| Strategy, on 4 songs × 2 ratios × mix and drums | Timing p95 (ms) |
|---|---|
| One R3 pass at a constant ratio | 6–18 |
| One R3 pass with key frames on every beat | 6–16 |
| R3, one slice per bar | 2–5 |
| R3, one slice per beat | ≤ 2 |

**Beat This! disagreed with the standard window.** On 12 bar-sliced sections, the flux check said both R3 windows were within 2 ms (p95). Beat This!, run on the output, placed the beats differently:

| Engine for the sliced parts | Beat This! median per-beat error (ms) |
|---|---|
| R3, standard window | 15 (section means up to 63) |
| R3, short window | **2.9** |
| R2 | 5.5 |

The standard window analyses low frequencies over a long window, which evidently changes the kick's texture enough to mislead a learned beat tracker. That could also mean it sounds smeared to people. So the sliced parts use the short window.

**What `stretch.py` does:**
- The **mix and drums** are sliced, with R3's short window. Their downbeats sit exactly on the grid. This is like the "beats" warp mode in DJ software.
- **Bass, vocals and other** are one continuous standard-window R3 pass, with the downbeats as key frames. They have no splices in held notes or bass lines, at the cost of a few ms of timing.
- `--engine r3|r3short|r2` forces one engine for every part.

### 2.3 Timing accuracy of `stretch.py` output

`stretch_bench.py sections` rendered a random valid Hook from each of 24 random songs:
- each Hook used 4 bars before it and 1 after;
- each was stretched by a random 1–8% in either direction;
- two songs were skipped as out of range, because the local tempo at the Hook differs from the song's BPM;
- that left 22 sections mix-only and 20 with stems.

Each output was checked two ways. The flux check is the same lag measure as in section 2.1, taken per beat against the source warped through the section's time map. Beat This! was run on the stretched mix and compared with the constant grid.

| Part | Median per-beat error | p95, typical section | p95, worst section |
|---|---|---|---|
| mix (sliced) | 1 ms | 2 ms | 33 ms (song 14: its analysis grid is irregular, see below) |
| drums (sliced) | 1 ms | 2 ms | 4 ms |
| bass (continuous) | 3.5 ms | 8.6 ms | 39 ms |
| vocals (continuous) | 4 ms | 7.6 ms | 36 ms |
| other (continuous) | 3.5 ms | 6.6 ms | 39 ms |
| mix through Beat This! | 4.4 ms (source: 2.6 ms) | 9.8 ms | 2 sections with a mean offset of −22 and −38 ms |

Two of the sections with a clean grid tracked badly in Beat This! (song 1 at 0.925, song 21 at 1.070), even though their flux check gave a median error of 1 ms or less. Both are near the ±8% limit, so **the top of the range needs an ear check**.

**The analysis grid is the real accuracy limit.** Mapped through the per-bar time map, the analysis beats of a typical section are at most 2.2 ms off the constant grid (median over sections), so pinning only the downbeats is enough. But 2 of the 24 sections had broken grids: songs 58 and 14, with beats up to 335 and 282 ms off. `meta.json` now carries a warning whenever the deviation exceeds 30 ms, and such Hooks should be audited before they are layered.

### 2.4 Speed and size

| Section (bars before + after the Hook) | Audio | Mix only | With stems (5 parts) | Size, mix / stems |
|---|---|---|---|---|
| 4 + 1 | ~9.6 s | 0.15 s median, 0.27 s max (0.34 s CPU) | **1.2 s** median, 1.8 s max (2.8 s CPU) | 1.1 / 4.0 MB |
| 8 + 1 | ~17 s | 0.20–0.23 s | 1.6–1.9 s | 1.7–2.2 / 6–8.5 MB |
| Cache hit | n/a | ≤ 6 ms | ≤ 6 ms | n/a |

Renders run in parallel threads: ctypes releases Python's lock during each C call, and the default is 8 threads (`RUBBERBAND_THREADS` overrides it). With stems, the time is dominated by the continuous standard-R3 pass.

### 2.5 `analysis/stretch.py`

```sh
analysis/.venv/bin/python analysis/stretch.py --song B --hook <hookId> --to-bpm X \
    [--bars 4] [--after-bars 1] [--stems] [--max-stretch 0.08] [--engine auto|r3|r3short|r2] \
    [--force] [--verify] [--json]
```

It exits with code 2 when the hook is unknown, or when no multiple reaches the target; the message suggests a stems-only overlap or an effect-led cut instead.

```python
from stretch import render, verify, plan, StretchError
res = render(song, hook_id, to_bpm, bars=4, after_bars=1, stems=False, max_stretch=0.08, force=False, engine="auto")
verify(res, part=None, beat_this=True)  # {'xcorr': {...}, 'beatThis': {'output': {...}, 'sourceMapped': {...}}}
```

**Tempo:** the ratio is a speed ratio, target / source, so 1.04 means 4% faster. Direct is used whenever it is within ±8%. If it isn't, half or double time is chosen when that is within ±8%:
- **half:** B plays at half of A's tempo, so each B beat spans 2 of A's beats;
- **double:** B plays at double A's tempo.

The result reports which one was used in `request.mode` (`direct`, `half` or `double`) and `request.tempoMultiple`. For example, song 71 at 84.5 BPM, rendered to 165, is rendered in half time to 82.5 BPM, a ratio of 0.973.

**Input:**
- `cache/<B>/mix.flac` and `data/analysis/<B>.json`.
- With `--stems`, the drums, bass and vocals stem windows from `data/stems/<B>.json`. These are stored at `stemGain` 0.5, so they are divided by it. "Other" is derived as mix − drums − bass − vocals before stretching.
- Without stems, or when no window covers the section, the tool renders the mix only. `meta.stems.reason` says why.

**Output:** `cache/stretch/<B>/<hookId>@<ratio>/{mix,drums,bass,vocals,other}.flac` plus `meta.json`.
- The audio is 48 kHz, 16-bit stereo, with **every part at partGain 0.5**: decoded / 0.5 is the real signal, as with the stems.
- `<ratio>` in the folder name is the nominal ratio: the effective BPM over the song's analysed BPM, to 4 decimals.
- The render covers the section plus a quarter beat of padding at each end.

**meta.json** holds:
- `ratio`: the exact speed ratio over the rendered bars. Also `ratioPerBar`, `sourceBpm`, `effectiveBpm` and `nominalRatio`.
- `source`: `startSec`, `endSec`, `firstDownbeatSec`, `hookDownbeatSec` and `lastDownbeatSec`.
- `output`:
  - `beatsSec` and `downbeatsSec`: a constant grid at the effective tempo;
  - `hookSec`: where the Hook downbeat lands;
  - `beatSec`, `hookBeatIndex` and `beatsPerBar`;
  - `analysisBeatDeviationMs`.
- `timeMap.points`: `[outputSec, sourceSec]` pairs, linear in between. It is exact for the sliced parts.
- `parts`, `partGain`, `stems`, `engine` (method per part), `timing`, `warnings` and the cache `key`.

**Return value:** the meta plus:
- `dir`, `cached` and `seconds`;
- `request`: `toBpm`, `mode`, `tempoMultiple`, `targetBeatSec`, `bars`, `afterBars`, `targetBarsBefore`, `startSec`, `firstDownbeatSec`, `hookSec` and `endSec`.

**Caching:** a render is reused when its inputs match (the size and mtime of mix.flac, the analysis grid and Hook, the stems files, the effective BPM and the engine) and it covers the requested bars and parts. A smaller request reuses a larger render, and `request.firstDownbeatSec` tells the engine where its bars start. A larger request grows the render instead of thrashing between sizes. Writes go to a temporary folder and are then renamed into place.

**Listening set:** these renders are left in `cache/stretch/` for an ear check, each with 8 bars before the Hook and 1 after:
- `2/2-best-0@1.0300`, `31/31-best-0@1.0700` and `46/46-main-0@0.9400`, with stems;
- `71/71-best-0@0.9809`, half time, mix only.

The whole cache is 24 MB.

### 2.6 Quality notes and what still needs ears

Nothing here was listened to. Check by ear:
1. The bar splices in the mix and drums, especially in held synths and pads.
2. R3's short window on the full mix: it smears attacks 2–4 ms more than the standard window, and its tone may be grainier.
3. Tonal stems at 6–8%, where keylock artifacts grow.
4. Drums layered under A at ±7–8%, where Beat This! disagreed on 2 of 19 sections.

If the top of the range flams or sounds processed, narrow `--max-stretch` to 0.06. That changes the share of tempo-matchable pairs from 37% to 29%.

## 3. Keys

### 3.1 Methods and accuracy

`analysis/keys.py` runs 8 methods on the mono mix, for the whole song and for each valid Hook's bar ±8 bars:
- **Essentia** KeyExtractor with five profiles: bgate, edma, temperley, krumhansl and shaath;
- **librosa** `chroma_cqt` (36 bins per octave, tuning estimated) with three profiles: Krumhansl–Kessler, Temperley and Albrecht–Shanahan.

The cost is about 3 s per song, mostly decoding and the CQT; Essentia takes 0.08 s per profile on a whole song. Spotify's key and mode exist for 68 of the 77 songs. Only aggregate numbers leave the script.

| Method | Exact | Fifth | Relative | Parallel | Other | Exact % | Camelot-compatible % | MIREX |
|---|---|---|---|---|---|---|---|---|
| **essentia-temperley** (chosen) | 36 | 7 | 15 | 1 | 9 | 52.9 | **85.3** | **0.650** |
| essentia-krumhansl | 37 | 6 | 11 | 1 | 13 | 54.4 | 79.4 | 0.640 |
| librosa-albrecht | 36 | 7 | 11 | 2 | 12 | 52.9 | 79.4 | 0.635 |
| librosa-temperley | 33 | 9 | 16 | 3 | 7 | 48.5 | 85.3 | 0.631 |
| librosa-kk | 34 | 12 | 8 | 2 | 12 | 50.0 | 79.4 | 0.629 |
| essentia-shaath | 35 | 6 | 12 | 1 | 14 | 51.5 | 77.9 | 0.615 |
| essentia-bgate | 36 | 4 | 10 | 2 | 16 | 52.9 | 73.5 | 0.609 |
| essentia-edma | 32 | 9 | 9 | 1 | 17 | 47.1 | 73.5 | 0.579 |

How the columns are defined:
- **Fifth:** ±1 on the Camelot wheel, same letter.
- **Relative:** the same Camelot number, the other letter.
- **Camelot-compatible:** exact + fifth + relative.
- **MIREX:** 1 for exact, 0.5 for a fifth, 0.3 for relative, 0.2 for parallel.

Voting ensembles across methods did not beat the chosen one; the best scored 0.650 too. The right Camelot number (exact or relative) is what the compatibility check depends on, and the chosen method gets it for 75% of songs.

**Confidence is informative.** It is Essentia's key strength:

| Confidence | Songs | Exact | Right Camelot number | Compatible |
|---|---|---|---|---|
| ≥ 0.8 | 50 | 31 (62%) | 44 (88%) | 46 (92%) |
| 0.7–0.8 | 13 | 5 | 7 | 11 |
| < 0.7 | 5 | **0** | **0** | 1 |

That is why `MIN_CONFIDENCE` is 0.7.

**Spotify is a noisy reference.** In 6 of the chosen method's 17 misses, all 8 methods agree with each other against Spotify. The MP3s came from YouTube Music, so some may be different masters or edits, or Spotify's label may be wrong. When all 8 methods agree on the Camelot number (37 songs), they match Spotify's in 31 of them (84%).

**Hooks vs the whole song:** of 386 Hook windows, 86.5% have the global key, 10.4% have a different but compatible key, and **3.1% have an incompatible one**. So the compatibility check should use the Hook key.

**Files** (committed data, no Spotify values):
- `data/keys/<id>.json`:

  ```json
  { "songId": 1, "method": "essentia-temperley",
    "global": { "key": "G", "mode": "major", "camelot": "9B", "pitchClass": 7, "confidence": 0.843 },
    "hooks": { "1-best-0": { "key": "G", "mode": "major", "camelot": "9B", "pitchClass": 7, "confidence": 0.801, "startSec": 33.0, "endSec": 65.156 } } }
  ```

- `data/keys/index.json`: every song's keys, the method, and the aggregate accuracy table.
- The per-song results of all 8 methods are cached in `cache/keys/<id>.json`.

**CLI:** `analysis/.venv/bin/python analysis/keys.py [detect|eval|pairs] [--song N] [--force] [--method M] [--json]`.

### 3.2 `engine/js/plan/keys.js`

This is a pure, `// @ts-check` module with full JSDoc types, tested by `tests/keys.test.js` (6 tests). The tests cover:
- all 24 keys against the wheel;
- parsing;
- symmetry;
- the four-code neighbourhood for every pair;
- the confidence gate;
- agreement with `data/keys/index.json`.

```js
import { compatible, relation, camelotOf, toCamelot, compatibleCodes } from './plan/keys.js';
compatible(a, b, { minConfidence = 0 } = {})   // true for same, ±1 (same letter, 12↔1 wraps) or relative; false if unknown or under minConfidence
relation(a, b)            // 'same' | 'adjacent' | 'relative' | 'none' | null (unknown)
camelotOf(k)              // '8A' from '8A', 'Am', 'A minor', { key, mode }, { pitchClass, mode } or { camelot }
toCamelot(keyOrPc, mode)  // 'C' or 0, 'major' → '8B'
compatibleCodes(k)        // ['8A', '9A', '7A', '8B']
// plus NOTE_NAMES, pitchClass(name), parseCamelot(code), parseKeyName(text)
```

`a` and `b` accept a Camelot code, a key name, or a record from `data/keys` (global or Hook). The engine should call `compatible(hookKeyA, hookKeyB, { minConfidence: 0.7 })`.

## 4. Tempo pairs

The statistics cover all 77 playable songs: 5,852 ordered pairs (A→B), with B stretched to A's analysed BPM (`analysis/keys.py pairs`).

| B can be beat-matched to A… | Share of ordered pairs |
|---|---|
| within ±4% directly | **20.1%** |
| within ±8% directly (includes the ±4%) | **36.4%** |
| within ±8% only at half or double time | **0.6%** |
| none of these | **63.0%** |

That makes **37.0% tempo-matchable** (2,164 pairs). The tempos cluster at 120–139 BPM (45 songs). There are 21 songs at 80–119, 6 at 140–149 and 5 at 150–173; the slow songs mostly don't reach the others even at double time (162–210 BPM, where only 2 songs sit).

**Keys of the tempo-matchable pairs:**

| Which keys are compared | Compatible |
|---|---|
| Global keys | 20.3% |
| Global keys, both with confidence ≥ 0.7 (1,848 pairs) | 21.7% |
| A's best Hook and B's best Hook | **20.5%** |
| At least one combination of their valid Hooks | 28.5% |
| All Hook combinations, averaged | 20.7% |
| Random pair (4 compatible keys of 24) | 20.8% |

Key compatibility doesn't depend on the tempo class: 20–25% everywhere. **So a melodic blend (tempo + key) fits about 7.5% of transitions, about 6 per 77-song round. A drums-only beat-matched layer fits 37%, about 28 per round.**

Ways to widen it:
- **Wider stretch limits:** ±10% reaches 43.7% of pairs and ±12% reaches 49.4%, with half and double included.
- **Meet in the middle:** pre-render A's exit bars toward B's tempo too, so each song moves at most 8% (±16% in total). That reaches 58.5%.
- **Pitch-shifting B's melodic stems:** a shift of up to ±1 semitone makes 59.3% of the matchable pairs key-compatible, and ±2 semitones makes 91.2%. Rubber Band can shift pitch in the same pass.

## 5. Recommendations

1. **Pre-render at the Shuffle.**
   - **Which pairs:** for every queue pair whose chosen Hook is tempo-matchable, run `stretch.py --song B --hook H --to-bpm <A's BPM> --bars 8 --after-bars 1 --stems`. That is about 28 pairs per round, taking about 1 minute and about 210 MB with stems; mix-only takes about 6 s and 55 MB.
   - **Why 8 bars:** they cover the longest Spin (11 s is at most about 6 bars at 128 BPM, 7 at 150) with room for a drum layer plus a build. The engine starts at `downbeatsSec[8 − N]` for an N-bar layer.
   - **Prerequisite:** this requires choosing the Hook offline. Today `pickHook` is random at runtime: seed it per queue position, or render best plus one main Hook.
   - **Back and replays:** a 1.2 s just-in-time render covers a pair changed by Back. Because renders are cached, replays are free.
2. **Choose the layer by pair class.**
   - **±4% and keys compatible** (confidence ≥ 0.7, Hook keys): a full blend. B's drums come in for 4–8 bars under A; B's bass and other parts join for the last 1–2 bars while A's bass is high-passed (a bass swap); then the drum stops, B lands at its own tempo, and the impact covers the up-to-8% tempo jump.
   - **±8%, or keys incompatible or unknown:** **drums only**. B's vocals, bass and other parts only after A's melodic parts have been cut or filtered out. Drums hold up best under stretching and have the tightest timing.
   - **Half or double time** (0.6%): drums only.
   - **Not matchable** (63%): no beat-matched overlap. Options:
     - the S2 "exit, bridge, land" shape, using **B's real drums stem, unstretched, on B's own grid** for the bridge bars after A has exited (this works for every pair that has stems);
     - an effect-led cut (R1–R10);
     - a Signature or vocal Tease of B through reverb or a filter, not locked to A's beat.
   - **Don't layer, except as a filtered Tease, when:** B has no stems (a full mix under A is mud), the Hook is invalid, or `meta.warnings` reports a broken grid (more than 30 ms off).
3. **Scheduling in the engine.**
   - Start the stretched buffer so that `request.firstDownbeatSec` lands on an A downbeat.
   - Apply gain ×2 (partGain) times B's trim.
   - At the landing, switch to `mix.flac` exactly at `hookSec` ↔ the Hook downbeat, with a 5–10 ms crossfade on the shared transient.
   - The timing error left over is about 1–2 ms in B's drums, plus A's own grid error.
4. **Before widening coverage, do the ear check** in section 2.6. The most useful next step is a "meet in the middle" option (stretching A's exit bars too, from 37% to 59% of pairs); pitch-shifting B is next, for short filtered Teases only.
5. **Audit first** the Hooks that will be layered. `meta.warnings` flags broken grids (2 of 24 random sections had them), and the analysis report's audition queue still applies.

## Reproduce

```sh
cd experiments/mixer-poc
uv pip install --python analysis/.venv/bin/python -r analysis/requirements-layering.txt   # + brew install rubberband
analysis/.venv/bin/python analysis/steps/stretch_bench.py engines --songs 4    # section 2.1 (~6 min)
analysis/.venv/bin/python analysis/steps/stretch_bench.py sections --songs 24  # sections 2.3–2.4 (~1 min)
analysis/.venv/bin/python analysis/keys.py           # section 3, writes data/keys/ (~4 min, then cached)
analysis/.venv/bin/python analysis/keys.py pairs     # section 4
npx tsc -p . && node --test tests/
```
