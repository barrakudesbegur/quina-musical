# Existing automatic DJ mixing projects: what to fork, borrow or build (as of 2026-11-23)

Local reference clones (read-only, not installed or run). They are gitignored via `experiments/mixer-poc/.gitignore` (`reference/`):
- `experiments/mixer-poc/reference/AI-DJ-Mixing-System` (full clone, HEAD `d56bd28`, 2026-02-03; 464 MB because audio is committed)
- `experiments/mixer-poc/reference/passable` (shallow, HEAD `9ca11bf`, 2026-11-23)
- `experiments/mixer-poc/reference/pyCrossfade` (shallow, HEAD `5f85f4a`, 2026-08-09)
- `experiments/mixer-poc/reference/automix-engine` (shallow, HEAD `b2d4df9`, 2026-08-22)

Permalink base for code citations in kckDeepak's repo: `https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/<file>#L<n>`. The local paths and line numbers are the same.

## Q1. kckDeepak/AI-DJ-Mixing-System: architecture, libraries, real-time vs offline, transition quality, license, maturity, reusable parts

### Takeaway
This is an **offline, batch Python pipeline** (pydub + librosa + scipy + OpenAI APIs) that writes one MP3. It has no playback engine. At HEAD, the only transition actually wired up is **sequential**: the outgoing song plays to its "first chorus end", a 3 s echo tail plays, then the next song starts **from 0:00 with no overlap and no beat sync**. The beat-matching, phrase, scoring and tempo-ramp code the README advertises is **dead code** at HEAD; it was only wired in at commit `cfabb40` (2025-12-19). The repo is MIT-licensed with a single author and 66 stars, and has been inactive since 2026-02-03. Don't fork it. A few small ideas are worth borrowing.

### Cited findings

**Metadata and maturity**
- MIT license, "Copyright (c) 2025 Kuchi Chaitanya Krishna Deepak" — [LICENSE](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/LICENSE)
- 66 stars, 10 forks, 0 open issues and no issues or PRs ever (the issues endpoint returns nothing), 0 releases, 1 contributor (kckDeepak, 32 commits). Created 2025-10-01; last push 2026-02-03. Topics: ai, ai-agents, audio-analysis, audio-processing, dj, python — [GitHub API repo](https://api.github.com/repos/kckDeepak/AI-DJ-Mixing-System), [contributors](https://api.github.com/repos/kckDeepak/AI-DJ-Mixing-System/contributors), [issues](https://api.github.com/repos/kckDeepak/AI-DJ-Mixing-System/issues?state=all)
- Commit history (32 commits, Oct 2025 – Feb 2026) shows the approach changing repeatedly. It tried madmom ("more accurate but time consuming", 2025-11-13), then Gemini web lookups instead of analysis, then OpenAI Whisper for chorus detection (2025-12-01), then "downbeats are perfectly aligned" (2025-12-18). The last commit is "Echo-out transition type added" (2026-02-03) — [commits](https://github.com/kckDeepak/AI-DJ-Mixing-System/commits/main)
- About 271 MB of MP3/WAV audio is committed under `research_stuff/` (for example `input.mp3`, `song.mp3` and rendered mixes). The pack is 181 MB. Test code consists of ad-hoc scripts in `research_stuff/test_files/`; there is no unit-test suite or CI — [tree](https://github.com/kckDeepak/AI-DJ-Mixing-System/tree/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/research_stuff)
- `requirements.txt` is UTF-16LE with CRLF line endings (per `file(1)`). It pins librosa 0.9.2, numpy 1.26.4, scipy 1.10.1, pydub 0.25.1, numba 0.62.1, openai>=1.0 and matplotlib — [requirements.txt](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/requirements.txt). The matracey fork's first commit is "rewrite requirements.txt as clean UTF-8, bump librosa to 0.10, pin numpy<2" — [compare](https://github.com/kckDeepak/AI-DJ-Mixing-System/compare/main...matracey:main)

**Architecture (5 stages communicating through JSON files on disk)**
- `run_pipeline.py` L60-113 runs the stages in order:
  1. Song selection → `analyzed_setlist.json`
  2. BPM/genre/key → `basic_setlist.json`
  3. Chorus/transition detection → `structure_data.json`
  4. Mixing plan → `mixing_plan.json`
  5. Render → `mix.mp3`

  — [run_pipeline.py#L60-L113](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/run_pipeline.py#L60-L113)
- **Offline only.** `generate_mix` loads each whole track with `AudioSegment.from_file` (L1409), builds one in-memory `mix` by slicing and concatenating, then normalizes and exports a single 320 kbps MP3 (L1522-1527). There is no audio-device or streaming path — [mixing_engine.py#L1372-L1527](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/mixing_engine.py#L1372-L1527)
- **Stage 1:** GPT-4o (temperature 0.3) picks and orders songs from a filename list. Without an API key it falls back to the first 10 songs — [track_analysis_openai_approach.py#L33-L106](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/track_analysis_openai_approach.py#L33-L106). Stage 4 then **re-sorts all tracks by BPM ascending**, which throws away the LLM order — [generate_mixing_plan.py#L343-L373](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/generate_mixing_plan.py#L343-L373). `apply_energy_curve_ordering` (L142-198) is never called (verified with grep).

**Analysis libraries and methods**
- **BPM:** `librosa.beat.beat_track` on the first 120 s at 22.05 kHz, rounded to an integer BPM, default 120 — [bpm_lookup.py#L76-L116](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/bpm_lookup.py#L76-L116). A GPT "look up the BPM on Tunebat" path is commented out (L124-180).
- **Key and genre are not analyzed from the audio.** The code asks gpt-4o-mini by title and artist ("from reliable sources like Tunebat") — [bpm_lookup.py#L196-L241](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/bpm_lookup.py#L196-L241). The parse regex `Key: (\w+) Scale: (\w+)` (L234) cannot match sharp keys such as "C#" because `#` is not `\w`, so those fall through to the default `("C","major")` (L241). This is from reading the code; it was not executed.
- **Chorus/transition point:**
  - The whole MP3 is uploaded to the OpenAI `whisper-1` API with segment timestamps — [structure_detector.py#L83-L93](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/structure_detector.py#L83-L93).
  - gpt-4o-mini then gets the first 20 lyric segments and is asked to "Find the FIRST CHORUS… give me the END timestamp" — [structure_detector.py#L283-L342](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/structure_detector.py#L283-L342).
  - Any error falls back to a transition at 70 s and an 8 s intro (L498-504).
- **"Phrase" and "bar" grids are naive:**
  - Bars are every 4th beat counted from the first detected beat (L250). Phrases are every 32 beats from that same beat (L110-115). Both assume the first detected beat is a downbeat.
  - Beats are only computed for the first 90 s (L106), while transition points are clamped to 50–120 s (L474).
  - [structure_detector.py#L96-L262](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/structure_detector.py#L96-L262), [#L446-L475](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/structure_detector.py#L446-L475)
- **Energy:** RMS in 2 s windows, smoothed with Savitzky-Golay. A "buildup" is 3 consecutive rises > 0.005 and a "drop" is a step < -0.03, and only the 45–115 s range is reported — [structure_detector.py#L123-L187](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/structure_detector.py#L123-L187)

**Transition logic at HEAD**
- Every transition in the plan is `"echo-transition"` at the outgoing track's first chorus end, with a fixed 3 s echo — [generate_mixing_plan.py#L416-L452](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/generate_mixing_plan.py#L416-L452)
  - The README's "6-factor scoring" lives in `score_transition_candidate` (L165-241), which is only reachable from `select_best_transition_point` (L244-285). Neither that nor `calculate_dynamic_overlap` (L288-327) is called anywhere at HEAD (grep).
  - In any case only one candidate is ever produced — [structure_detector.py#L361-L367](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/structure_detector.py#L361-L367)
- **Echo render** (`apply_echo_transition`, [mixing_engine.py#L1206-L1278](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/mixing_engine.py#L1206-L1278)):
  - The last 1.5 s before the chorus end is copied 4 times at decay 0.5.
  - Echo spacing is `echo_duration_ms // (num_echoes + 1)` = 600 ms, which is **not tempo-synced** ([L1175](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/mixing_engine.py#L1175)).
  - The tail is progressively low-passed, then the incoming track starts from the beginning after the echo: "Outgoing → Echo (3s) → Incoming (sequential, no overlap)" (L1270-1272).
  - The **whole** incoming track is still time-stretched to the outgoing BPM, clamped to ±5% (L1227-1233), even though nothing overlaps.
  - The code comment reads "ECHO TRANSITION (Boss's requirement)" (L1447).
- **Time-stretch:** `librosa.effects.time_stretch`, a phase vocoder — [mixing_engine.py#L1128-L1147](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/mixing_engine.py#L1128-L1147)
- **Everything processed goes mono:** `audio_segment_to_np` averages the two channels (L119-123) and `np_to_audio_segment` writes `channels=1` (L125-128). Every filtered or stretched segment is therefore mono — [mixing_engine.py#L119-L128](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/mixing_engine.py#L119-L128)
- **EQ:**
  - 4th-order Butterworth low/high-pass with `scipy.signal.butter` + `sosfilt` (L131-165).
  - The "progressive EQ" cuts audio into 10 chunks, filters each one separately with a stepped cutoff (12 kHz→4 kHz LPF, 100→300 Hz HPF), and concatenates them. Filter state resets at every chunk boundary.
  - [mixing_engine.py#L131-L204](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/mixing_engine.py#L131-L204)

**Dead or unwired "pro" code at HEAD (verified with grep; only `apply_echo_transition` is called from `generate_mix`)**
- `align_beats_perfect` — [mixing_engine.py#L597-L1009](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/mixing_engine.py#L597):
  - librosa beat grid, with octave-error correction against the metadata BPM using ratios 1, 2, 0.5, 1.5, 0.75, 1.333, 0.666 (L648-679)
  - Stretches the entire incoming track (L693-700)
  - Builds a **synthetic constant-BPM grid** from the first strong onset (L330-412, L714-715)
  - Aligns first downbeat to first downbeat (L753-821)
  - "Phase alignment" by cross-correlation within ±50 ms (L208-278)
- `detect_beat_grid` finds the downbeat by checking which of the 4 beat positions has the highest bass-weighted onset strength over the first 32 beats — [mixing_engine.py#L415-L488](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/mixing_engine.py#L415-L488)
- `apply_gradual_tempo_sync` (the README's "32 micro-steps") stretches 32 chunks independently and concatenates them with no crossfade — [mixing_engine.py#L1011-L1085](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/mixing_engine.py#L1011-L1085)
- `apply_chorus_beatmatch` (L1282-1366), `get_genre_rules`/`GENRE_MIXING_RULES` (L37-99) and `detect_first_downbeat_and_trim` (L525) are also unused.
- At `cfabb40` (2025-12-19) the renderer **did** use `align_beats_perfect` for an overlap of about 8 s with a 1 s fade on the outgoing track — [mixing_engine.py@cfabb40#L1356-L1428](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/cfabb406b39420d2f9c3467259d3334e64487a90/mixing_engine.py#L1356-L1428). The planner then called `select_best_transition_point` and `calculate_dynamic_overlap` — [generate_mixing_plan.py@cfabb40#L364-L369](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/cfabb406b39420d2f9c3467259d3334e64487a90/generate_mixing_plan.py#L364-L369). The 2026-02-03 commit replaced that path — [commit d56bd28](https://github.com/kckDeepak/AI-DJ-Mixing-System/commit/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4)
- The README claims "Perfect Beat-Grid Alignment", "Gradual Tempo Sync (32 micro-steps)", "Multi-Factor Scoring", "Phrase-Based Transitions", and "Dynamic Overlap Duration 4–16 s" — [README.md#L11-L20](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/README.md#L11-L20). None of these are on the HEAD render path (code findings above).

**Possibly reusable pieces**
- A 24-key Camelot compatibility table in key-name form. Entries checked as correct, e.g. C ↔ G/F/Am and Am ↔ Em/Dm/C — [generate_mixing_plan.py#L54-L107](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/generate_mixing_plan.py#L54-L107)
- Snap helpers: `snap_to_phrase_boundary` / `snap_to_bar_boundary` / `snap_to_beat` — [structure_detector.py#L190-L280](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/structure_detector.py#L190-L280)
- matplotlib debug plots for waveform, beat alignment and phase cancellation — [waveform_visualizer.py#L38-L444](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/waveform_visualizer.py#L38)
- The declarative `mixing_plan.json` schema (`from_track`, `to_track`, `transition_point`, `incoming_start_sec`, `echo_duration_sec`, `transition_type`, `from_bpm`/`to_bpm`, `comment`) — [generate_mixing_plan.py#L456-L474](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/generate_mixing_plan.py#L456-L474)
- A human-annotated note on where transitions "should" happen for 7 songs (e.g. "jump - beginning of second verse - 67") — [research_stuff/openai/where the transition should happen.txt](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/research_stuff/openai/where%20the%20transition%20should%20happen.txt)

### Inferences
- It cannot serve as our engine. It only renders a whole set to a file, cannot react to a "next" press, and its active transition has no beat sync. Even as an offline pre-renderer its audio path is weaker than pyCrossfade's or Passable's: mono collapse, phase-vocoder stretch, a non-synced echo, and stepped chunk filtering that risks discontinuities.
- Its dependence on cloud LLM/Whisper calls is a poor fit for a 77-song Spanish/Catalan/English set. The calls are nondeterministic, cost money, and upload copyrighted audio. Key-by-LLM-lookup is unreliable for local Catalan songs. Local analysis (beat_this, a chroma key estimator) or hand-tagged data is a better choice.
- The idea worth keeping is architectural: **analysis → declarative per-transition plan (JSON) → renderer**, with the plan inspectable and editable. We should keep that, but with bar/beat-indexed fields (e.g. "enter at bar N of B, overlap 8 bars, FX = riser") rather than seconds.
- The 2-month "pro" rewrite being replaced by a simple echo-out suggests the author found the beat-matched overlap unreliable across mixed pop/afrobeats material. This is speculation, but it matches the dead-code evidence. It also hints that for very mixed genres, **echo-out/cut-style transitions are a valid primary mode**, not only a fallback.
- At 10 months without commits and with one contributor, the upstream is effectively abandoned.

### Gaps
- The code was not run (per instructions), so audio quality was not judged by ear. The committed renders in `research_stuff/mixing/*.wav` and `research_stuff/additional_outputs/mix.mp3` could be listened to manually.
- Not verified: whether pydub's `+` / `overlay` up-mixes the mono segments back to dual-mono when they are combined with stereo segments. Either way, the stereo image of processed regions is lost.

## Q2. Forks of AI-DJ-Mixing-System: do any add meaningful improvements?

### Takeaway
There are 10 forks; 7 are untouched mirrors. **matracey** adds the most useful engineering fixes: a local Whisper backend, an LLM base_url override, a long-blend with bass swap, and dependency fixes. **KaiwalPanchal** is a large, apparently AI-agent-written rewrite with a decent scipy DSP rack and a Web Audio console. **jakah2551** adds a Flask web UI. None changes the conclusion: these are still offline pydub/librosa renderers with naive grids.

### Cited findings
- Forks with no own commits (pushed_at equals upstream 2026-02-03T12:01:06Z): hungryshmorez, abdasis/ai-dj-mixing, chandrarosy04-pixel, tardix216, RobertHernandezArenas, geeks-accelerator, DasithEdirisinghe/emarus-house. All have 0 stars — [forks API](https://api.github.com/repos/kckDeepak/AI-DJ-Mixing-System/forks)
- **matracey/AI-DJ-Mixing-System**: 15 commits ahead, all dated 2026-06-14, 0 stars — [compare](https://github.com/kckDeepak/AI-DJ-Mixing-System/compare/main...matracey:main). Changes:
  - UTF-8 requirements, librosa 0.10 and `numpy<2`
  - `openai_compat` shim (base_url, model rewriting)
  - Pluggable `WHISPER_BACKEND` (local faster-whisper, OpenAI, or disabled)
  - Hardened GPT JSON parsing and an energy-curve fallback for instrumentals
  - .flac/.m4a/.wav/.ogg input and mutagen tag reading
  - Transitions moved near the end of the outgoing track instead of the first chorus
  - BPM estimated from the track body to avoid intro mis-locks
  - New `apply_long_blend` (in its `mixing_engine.py`): incoming beatmatched with stretch clamped to 0.88–1.12, gain-matched to the outgoing dBFS, both tracks −4.5 dB; incoming high-passed at 250 Hz with a 4 s fade-in for the first half of the overlap; then a "bass swap" where the outgoing fades out and the incoming gets full bass. The default overlap is 32 s for electronic tracks.
- **jakah2551/AI-DJ-Mixing-System**: 4 commits on 2026-08-17 adding Flask (`webui.py`) and pipeline progress callbacks — [compare](https://github.com/kckDeepak/AI-DJ-Mixing-System/compare/main...jakah2551:main)
- **KaiwalPanchal/AI-DJ-Mixing-System**: 13 commits dated 2026-09-09/10, last push 2026-09-13, 0 stars. Its description: "AI Music Brain: Camelot/phrase-aware transition matching, scipy DSP rack, Web Audio DJ console, 130+ pytest tests" — [compare](https://github.com/kckDeepak/AI-DJ-Mixing-System/compare/main...KaiwalPanchal:main), [repo](https://github.com/KaiwalPanchal/AI-DJ-Mixing-System). Contents:
  - `app/music_brain/dsp_rack.py`: 4th-order Linkwitz-Riley split and `bass_swap_mix`, isolator 3-band EQ, resonant `filter_sweep`, `tempo_synced_delay`, comb-bank reverb, peak limiter
  - `recipe_matcher.py`: scores track pairs against "28 transition recipes" parsed from an Obsidian `DJ/` wiki (Camelot distance, BPM compatibility, vocal-overlap penalty)
  - `stem_service.py`: Demucs via CLI, cached by content hash
  - `analyzer.py`: librosa beats, with downbeats taken as "every Nth beat starting from beat 0 (assumes 4/4 and that beat 0 is bar 1)", plus Krumhansl-Schmuckler chroma key → Camelot
  - `transition_renderer.py`: 15–30 s micro-previews
  - `app/ui/static/deck-controller.js` and `fx-rack.js`: a Web Audio console
  - Agent files `AGENTS.md`, `CLAUDE.md`, `CODEX.md`

  Sources: [dsp_rack.py](https://github.com/KaiwalPanchal/AI-DJ-Mixing-System/blob/main/app/music_brain/dsp_rack.py), [analyzer.py](https://github.com/KaiwalPanchal/AI-DJ-Mixing-System/blob/main/app/music_brain/analyzer.py)
- sanchitd5/null-set-ai-dj (MIT, created 2026-09-26, pushed 2026-11-23) also describes "an Obsidian DJ wiki in `DJ/`: 28 transition recipes", the same concept as the KaiwalPanchal fork — [README](https://github.com/sanchitd5/null-set-ai-dj)

### Inferences
- If someone wanted a Python offline renderer from this lineage, matracey's long-blend plus local Whisper is the most usable starting point. Even so, pyCrossfade (Q3) is cleaner for beat-matched blends.
- The KaiwalPanchal `dsp_rack.py` is a reasonable reference for Linkwitz-Riley bass swap and tempo-synced delay in numpy/scipy. Its grid assumptions are as naive as upstream's.

### Gaps
- Not confirmed whether null-set-ai-dj is code-derived from the KaiwalPanchal fork or only shares the "DJ wiki" idea. It is not a GitHub fork.

## Q3. Other open-source auto-DJ / automix projects (approach, language, real-time vs offline, quality, license, maintenance)

### Takeaway
No mature, maintained open-source "auto-DJ engine" fits our case off the shelf.
- **Mixxx** is the only large, active project, and its AutoDJ is time-based crossfading **without beatmatching**.
- The research systems (Vande Veire 2017, DJtransGAN 2022, CUE-DETR 2024) are offline and EDM/DnB-centric, and several are abandoned.
- A 2025–2026 wave of small, often AI-assisted repos copies Apple AutoMix: stems, Beat This!, Rubber Band, phrase-locked blends. The best of them, **Passable** (MIT, Swift, native macOS, Core ML), is an excellent design reference.
- The most reusable assets are **building blocks**: beat_this (MIT code and weights), allin1 (MIT, stale), Rubber Band (GPL), Signalsmith Stretch (MIT), Bungee (MPL-2.0).

### Cited findings

**Large, maintained engine**
- **Mixxx** (C++, GPL v2, 7,431 stars, pushed 2026-11-23, latest release 2.5.6 on 2026-03-27) — [repo](https://github.com/mixxxdj/mixxx), [COPYING](https://github.com/mixxxdj/mixxx/blob/main/COPYING), [release](https://github.com/mixxxdj/mixxx/releases/latest)
  - AutoDJ has 4 modes (Full Intro + Outro, Fade At Outro Start, Full Track, Skip Silence). The intro/outro modes compare the old track's outro with the new track's intro, and use the shorter one to set crossfade time and alignment. Silence detection places intro start and outro end at -60 dBFS.
  - The manual says: "Auto DJ does not take into account the volume of each track, nor the frequency content, nor the rhythms."
  - [Mixxx 2.5 manual](https://manual.mixxx.org/2.5/en/chapters/djing_with_mixxx.html), [2.3 intro/outro announcement](https://mixxx.org/news/2020-07-09-intro-outro-sections/)
  - `src/library/autodj/autodjprocessor.cpp` (1,969 lines) contains no references to "sync", "bpm" or "beat". Fade time is computed from the intro/outro cue times and the spinbox seconds (`calculateTransition` around L309-347, defined at L1362). Recent commits (2026-08-31) are AutoDJ stall fixes — [autodjprocessor.cpp](https://github.com/mixxxdj/mixxx/blob/main/src/library/autodj/autodjprocessor.cpp), [history](https://github.com/mixxxdj/mixxx/commits/main/src/library/autodj/autodjprocessor.cpp)
  - Known AutoDJ complaint: there is no sensible fallback when a track with a long outro meets one with no intro — [issue #11648](https://github.com/mixxxdj/mixxx/issues/11648)

**Research / academic**
- **lenvdv/auto-dj** (Len Vande Veire, master's thesis, Ghent 2017): drum & bass only, Python 2 (`raw_input` in `Application/main.py`), essentia plus librosa. Time stretching uses HPSS (`time_stretch_hpss` in `timestretching.py`). Transition types are "double drop", "rolling" and "relaxed", with 16/32-unit in/out lengths (`tracklister.py` L17-32). There is **no LICENSE file**, so all rights are reserved. 13 stars, last push 2017-09-08 (**abandoned**) — [repo](https://github.com/lenvdv/auto-dj), [tracklister.py](https://github.com/lenvdv/auto-dj/blob/master/Application/tracklister.py). Paper: "From raw audio to a seamless mix…", EURASIP JASMP 2018 — [doi:10.1186/s13636-018-0134-8](https://doi.org/10.1186/s13636-018-0134-8) (the DOI resolves; full text was not fetched).
- **ChenPaulYu/DJtransGAN** (ICASSP 2022, MIT, 119 stars, pushed 2025-11-07): GAN plus differentiable audio effects that learn fader/EQ transition curves. Offline research code — [repo](https://github.com/ChenPaulYu/DJtransGAN)
- **CUE-DETR** (ETH DISCO, MIT, 2024): DETR object detection on spectrograms for EDM cue points, trained on the EDM-CUE metadata set (~5k tracks from 4 DJs) — [paper arXiv 2407.06823](https://www.arxiv.org/abs/2407.06823), vendored at [automix-engine/vendor/cue-detr](https://github.com/VertexSelection/automix-engine/tree/main/vendor/cue-detr)
- **mir-aidj**:
  - all-in-one (`allin1`): MIT, 895 stars. Outputs beats, downbeats, beat positions and functional segment labels (start/intro/verse/chorus/bridge/outro/end…). Needs NATTEN (auto-installs on macOS) and Demucs. **Last push 2024-05-09, 21 open issues, no GitHub releases** — [repo](https://github.com/mir-aidj/all-in-one)
  - djmix-dataset (2022, metadata of human DJ mixes; "Tested on Python 3.9") and transition-analysis (2021) are data/analysis tools, not mixers — [djmix-dataset](https://github.com/mir-aidj/djmix-dataset), [transition-analysis](https://github.com/mir-aidj/transition-analysis)
  - `mir-aidj/djmix` returns 404. A PyPI package `djmix` 0.3.1 exists — [PyPI](https://pypi.org/project/djmix/)
- **ddman1101/DJustify** (MIT, 2026-09, "Reason-and-Verify DJ Planning for Pop Transitions and Story-Driven Sets", submitted to ICASSP 2027) — [repo](https://github.com/ddman1101/DJustify). Same author's **Auto-DJ** for EDM: no license, 44 stars, pushed 2025-04-23 — [repo](https://github.com/ddman1101/Auto-DJ)
- **MZehren/Automix** (MIT, 44 stars, single push 2020-02-11, **abandoned**) — [repo](https://github.com/MZehren/Automix). **menno4000/DiscGenius** (no license, 2021) — [repo](https://github.com/menno4000/DiscGenius)

**Python offline renderers**
- **oguzhan-yilmaz/pyCrossfade** (MIT, 154 stars, v0.4.0 in Aug 2026, last push 2026-08-09) — [repo](https://github.com/oguzhan-yilmaz/pyCrossfade)
  - Beat-matched crossfade between two songs, aligned on bars. Downbeats come from madmom `RNNDownBeatProcessor` + `DBNDownBeatTrackingProcessor` (`pycrossfade/song.py` L100-107). Stretching uses `pyrubberband`; essentia handles loading and replay gain.
  - The outgoing ("master") song's tempo is ramped linearly over `len_time_stretch` downbeats (default 8). Then each master bar is stretched to the matching slave bar for `len_crossfade` bars (default 8) (`transition.py` L81-145; README L247-251).
  - v0.4.0 added stereo I/O, a 3-band EQ crossfade, equal-power/cosine/linear fades, CLI, tests and CI.
  - Dependency licenses: essentia is AGPL, rubberband GPL, and **madmom's model files are CC BY-NC-SA 4.0** — [madmom LICENSE](https://github.com/CPJKU/madmom/blob/main/LICENSE)
- **VertexSelection/automix-engine** (LGPL-2.1, 11 stars, 12 commits all on 2026-08-22): "similar to Apple Music AutoMix" — [repo](https://github.com/VertexSelection/automix-engine)
  - Uses CUE-DETR transition candidates, HTDemucs stems and Rubber Band R3 `--fine` with a time map.
  - "maps 32 incoming beats onto 32 outgoing beats". Waits for a vocal gap before cutting a lyric. The incoming track "returns smoothly to its original tempo… after 6.48 seconds".
  - After rendering it verifies drum attacks, tempo and phase, and rejects drifting renders. Caching is by content hash.
  - It handles one hard-coded pair (`song1.mp3` → `song2.mp3`). `stem_transition.py` is a 136 KB monolith, and the pins target torch 2.2.2 for Intel macOS (`requirements.txt`).
- **LaRambla20/songs-automixer_python** (Textual TUI, live beat-matched crossfades, master FX, backspin; license NOASSERTION; pushed 2026-10-19) — [repo](https://github.com/LaRambla20/songs-automixer_python). **bvdr/autodeck** (MIT, auto-mixes YouTube playlists, 2026-10/11) — [repo](https://github.com/bvdr/autodeck). **clawd139/automix** (no license, 2026-02) — [repo](https://github.com/clawd139/automix)

**Native macOS / Swift**
- **nikolaus018/passable** (MIT © 2026 Nikolaus Marek, Swift, 133 commits, created 2026-09-26, pushed 2026-11-23, 4 stars) — [repo](https://github.com/nikolaus018/passable)
  - Stem separation on Core ML: HTDemucs v4 plus Mel-Band RoFormer for vocals.
  - Beat grids from **Beat This! exported to Core ML** (`Analysis/BeatTracker.swift`), refined by `TempoEstimator` against the drum hits. The README says a 4-minute track separates in about 5 s on an M5 and the models run in FP16 on the GPU (README L113-117).
  - Vocal-line timing comes from macOS on-device speech recognition plus a breath map. It also auto-orders the set and plans transitions with editable per-stem automation (volume, filter, 3-band EQ with kill, reverb and delay sends).
  - Presets: `stemSwap, dropSwap, longBlend, mashup, echoOut` (`Passable/Model/TransitionPreset.swift` L7). Build-up gestures include `snareRoll, loopHalve, riser, bassDrop, acappellaBreak, fakeoutDrop, stutterGate, polyRoll, spinbackDrop, brakeDrop, vocalChop, beatJuggle, echoFreeze, filterSlam` (L148-188).
  - Tempo policy from the README:
    - Up to 3% difference: only B is matched, during the overlap, then glides home.
    - Over 3%: the tempo shift is split between both songs, and neither is played more than 5% off.
    - Over 10%: a **Cut** — A finishes its phrase, its last beat goes into an echo, and B lands on its downbeat at its own tempo.
    - Glides run at about 0.5% per bar.
  - Its own sample-exact stretcher uses a phase-locked vocoder for tonal stems and copies drum transients. Its comment says Apple's **AUTimePitch "let the beat wander tens of milliseconds"**, audible as flamming kicks (`Passable/Audio/TimeStretcher.swift` L1-18).
  - Live playback uses an `AVAudioSourceNode` that pulls from `MixRenderer` (`Passable/Engine/PlaybackEngine.swift` L3-14). It can also render to AAC/WAV.
  - It is large: `SetPlanner.swift` is about 270 KB and `TrackStructure.swift` about 167 KB.
  - Releases are ad-hoc signed.
- **James-H42/YouTube-Music-with-AutoMixing** (Swift macOS, GPL-3.0, created 2026-11-14) — [repo](https://github.com/James-H42/YouTube-Music-with-AutoMixing)

**Web / JavaScript (browser DJ decks with automix)**
- **sanchitd5/null-set-ai-dj** (MIT, active 2026-11-23) — [README](https://github.com/sanchitd5/null-set-ai-dj)
  - A vanilla-JS WebAudio console (decks, 4-stem players, FX rack, sampler) driven by Python analysis: librosa grid, 8-bar phrases, Camelot, energy, Demucs, Rubber Band.
  - A local LLM picks songs (Qwen3-Omni via mlx-vlm on Apple Silicon).
  - Plays live on two decks with "merge → hold → drop" phrase-locked transitions.
- **caffettino87/auto-dj-ai** (MIT, 2 commits, 2026-06-06; Web Audio + Python Essentia; "vocal-aware intro/outro cut points") — [repo](https://github.com/caffettino87/auto-dj-ai)
- **heydavidf/automix** (AGPL-3.0, TypeScript Chrome auto-DJ) — [repo](https://github.com/heydavidf/automix); **waypostmaster/deckwave** (AGPL-3.0, in-browser library analysis) — [repo](https://github.com/waypostmaster/deckwave); **fabriziosalmi/mixi** (TypeScript + Rust/Wasm DSP, license unclear) — [repo](https://github.com/fabriziosalmi/mixi); **Manuekle/shift** (MIT, Nov 2026, browser two-deck with stems) — [repo](https://github.com/Manuekle/shift); **Arsh-S/segue** (MIT) — [repo](https://github.com/Arsh-S/segue); **spicetify-DJ-MOD-automix** (MIT, Spotify client mod) — [repo](https://github.com/ranveerthapar025-bit/spicetify-DJ-MOD-automix)

**Rust**
- **backrunner/mixless** (MPL-2.0, dual decks, Beat Sync, Automix, created 2026-09) — [repo](https://github.com/backrunner/mixless); **mmacy/dermixen** (GPL-3.0, timeline with automatic beatmatched transitions) — [repo](https://github.com/mmacy/dermixen); **sebedard-creator/MixCanvas** (AGPL-3.0) — [repo](https://github.com/sebedard-creator/MixCanvas); **eckonator/fadewerk-dj** (GPL-3.0, auto-fade) — [repo](https://github.com/eckonator/fadewerk-dj). All have 1–8 stars.

**Building blocks (analysis and stretch)**
- **CPJKU/beat_this** (ISMIR 2024 "Beat Tracking Without DBN Postprocessing"): **code and model weights are MIT**. 494 stars, pushed 2026-05-28. Outputs beats and downbeats and falls back to CPU. Its README notes that madmom on PyPI only supports Python < 3.10 — [repo](https://github.com/CPJKU/beat_this)
- **CPJKU/madmom**: BSD code but CC BY-NC-SA models, pushed 2026-03-20 — [LICENSE](https://github.com/CPJKU/madmom/blob/main/LICENSE). **MTG/essentia**: AGPL-3.0, active — [repo](https://github.com/MTG/essentia)
- Stretchers:
  - **Rubber Band** (GPL-2.0 per GitHub mirror, pushed 2025-03-03) — [repo](https://github.com/breakfastquay/rubberband)
  - **Signalsmith Stretch** (MIT, pushed 2026-10-22) — [repo](https://github.com/Signalsmith-Audio/signalsmith-stretch)
  - **Bungee** (MPL-2.0, "realtime or offline", pushed 2026-10-30) — [repo](https://github.com/bungee-audio-stretch/bungee)

### Inferences
- The field has converged on one design across Apple AutoMix clones, Passable, automix-engine and null-set:
  - **Offline**: neural beat/downbeat tracking, Demucs stems, phrase/section labels.
  - **Planner**: chooses entry/exit points on 8/16-bar boundaries and a transition style based on tempo distance and vocal activity.
  - **Renderer**: either pre-renders, or pulls from a sample-exact timeline at playback time.

  That matches our constraint that the next song is known in advance.
- For a macOS Apple Silicon engine, Passable is the closest prior art in both language and runtime (Swift, Core ML, `AVAudioSourceNode`). Its warning about AUTimePitch drift is directly relevant if we were tempted to use `AVAudioUnitTimePitch` live.
- Most 2026 repos have 0–13 stars and were created within weeks. Several show AI-agent authorship (agent instruction files, bursty commit dates). Treat them as idea sources, not dependencies.
- Licensing: our use is a private event tool, not distributed, so GPL/AGPL obligations matter little. madmom's **non-commercial** model license could matter if the bingo is a paid/commercial event; beat_this (MIT weights) avoids that.

### Gaps
- No open-source project was found that targets **short, recognizable-clip, mixed-genre pop/reggaeton/Christmas** transitions. Everything is EDM/DnB, or generic playlist automix.
- Audio quality of the 2026 repos was not auditioned. Passable links demo transitions at passable.ringtwo.win (not visited).
- Whether allin1 still installs cleanly on current macOS/PyTorch was not verified (stale since 2024-05).

## Q4. Commercial benchmarks: features and transition behavior, and which ideas apply to a live bingo show

### Takeaway
- **Apple AutoMix** and **Spotify Mix** set the consumer bar: automatic, beat-matched, time-stretched blends. Apple adds loops of intros/outros (iOS 27); Spotify adds editable presets with EQ and effect curves.
- **djay** has the richest automatic transition palette (Filter/Echo/Riser/Dissolve/Neural Mix) and specifies duration in bars.
- **VirtualDJ** and **rekordbox** precompute per-track mix points or phrases and **fall back to a cut when BPMs are too far apart**.
- Serato has no automix, and the Pacemaker app is dead (its tech lives on as B2B AutomixIQ).

For a bingo show the transferable ideas are:
- Precomputed per-song cue points
- Transition style chosen by tempo/key distance (beatmatch vs. echo/cut)
- Bar-quantized durations
- Loop-based bridging to fill a variable gap
- Escalating FX palettes (Fade → Filter → Echo → Riser)
- An auto plan the operator can override

### Cited findings

**Apple Music AutoMix**
- **iOS 26** (announced 2025-06-09; on by default, iPhone 11+) — [MacRumors how-to](https://www.macrumors.com/how-to/ios-enable-automix-feature-apple-music/), [9to5Mac](https://9to5mac.com/2025/06/16/automix-apple-music-ios-26/)
  - Apple: "Using AI to analyze audio features, it crafts unique transitions between songs with time stretching and beat matching."
  - Reviews say the beatmatching was applied aggressively and noticeably to every transition, and it sometimes skipped 30–40 s of an intro to find a match — [MacObserver](https://www.macobserver.com/tips/automix-explained-ios-26/), [documentarytube explainer](https://www.documentarytube.com/blog/ios-26-automix-explained-apple-musics-dj-style-transitions-and-their-limits/) (secondary sources)
- **iOS 27** (WWDC 2026-06-08) — [MacRumors iOS 27](https://www.macrumors.com/2026/06/09/apple-music-gains-automix-upgrades-and-more-in-ios-27/), [9to5Mac hands-on 2026-07-16](https://9to5mac.com/2026/07/16/ios-27-makes-one-of-my-favorite-apple-music-features-even-better/), [RouteNote guide](https://routenote.com/radar/how-to-use-apple-music-automix-in-ios-27-the-complete-guide/)
  - Improved algorithms "generate new transition types". The iOS 26 "underwater" default effect "has largely been replaced".
  - It "will even remix the outro and intro of songs to perfectly align the tempo" and "repeat parts of the outros and intros to bridge the transition".
  - It "may just crossfade or remove silence when a more complex transition wouldn't suit", and skips transitions for incompatible songs or albums played in order. Now also on tvOS and HomePod.
- iOS 26 AutoMix "tends to use a very similar and predictable style for most transitions" — [9to5Mac 2026-07-16](https://9to5mac.com/2026/07/16/ios-27-makes-one-of-my-favorite-apple-music-features-even-better/)

**Spotify Mix** (Premium; beta 2025-08-19; desktop rollout added 2026-05-19) — [Spotify newsroom](https://newsroom.spotify.com/2025-08-19/mix-your-favorite-playlists-seamlessly-by-adding-your-own-transitions/), [MBW](https://www.musicbusinessworldwide.com/spotify-launches-custom-playlist-transitions-to-compete-with-apples-automix/), [PiunikaWeb global rollout 2025-09-18](https://piunikaweb.com/2025/09/18/spotifys-mix-feature-is-now-rolling-out-for-everyone/)
- An "Auto" mode gives an instant blend. Presets include "Fade" and "Rise". Volume, EQ and effect curves are editable per transition, with waveform and beat data shown to pick start points.
- Key and BPM are shown per track, and the post advises matching tempos and Camelot keys. Spotify recommends the feature for house/techno.

**Algoriddim djay (Automix AI, Neural Mix, Crossfader FX)**
- Automix AI "finds rhythmic patterns and the best intro and outro sections… works out the best fade lengths, and automatically adjusts EQs and filters". Neural Mix transitions "crossfade pairs of musical parts from two songs separately" — [Algoriddim press release](https://www.algoriddim.com/press_releases/435-algoriddim-announces-major-update-to-djay-pro-ai), [9to5Mac 2021](https://9to5mac.com/2021/05/06/djay-pro-ios-update-taps-apple-neural-engine/)
- Transition options are Automatic (randomly picks types), Fade, Filter, EQ, Echo, Dissolve, Riser, Tremolo and Neural Mix. Duration is Automatic or a set number of **bars or seconds**. "Sync + Tempo blend" gradually adjusts the outgoing tempo to the incoming one — [Automix help](https://help.algoriddim.com/user-manual/djay-pro-windows/mixing-basics/using-automix), [Automix settings](https://help.algoriddim.com/user-manual/djay-pro-windows/settings/automix)
- Dissolve "evaporates" the outgoing track; Riser "builds energy before mixing"; Echo "mixes quickly into the new track while the old one fades out as a delay" — [DJ Mag](https://djmag.com/news/new-djay-ai-ios-adds-improved-ai-mixing)
- 5.3 (2025-04-08): Automix uses Crossfader FX transitions. 5.3.2 (2025-05-21): "Automix and Crossfader FX auto transitions now always use a 4-beat sync interval". Later releases are mostly fixes, up to 5.6.10/5.6.11 (Oct–Nov 2026) — [djay Pro Mac release notes](https://www.algoriddim.com/djay-pro-mac/releasenotes)

**rekordbox (AlphaTheta/Pioneer DJ)**
- Automix (since 5.1) uses phrase analysis (KORETECH) plus beat positions, BPM and key — [rekordbox 7.0.7 manual](https://cdn.rekordbox.com/files/20241213141602/rekordbox7.0.7_manual_EN.pdf), [DJ TechZone](https://djtechzone.com/pioneer-dj-launches-rekordbox-5-1-comes-with-automix/)
- Phrase labels are Intro/Up/Down/Chorus/Bridge/Verse/Outro, plus "Fill-in" at phrase ends. A track **mood** of High/Mid/Low selects the label vocabulary (High = EDM-style Up/Down; Mid/Low = Verse/Chorus/Bridge) — [Phrase Edit guide](https://cdn.rekordbox.com/files/20200312172204/rekordbox5.1.0_Phrase_Edit_operation_guide_EN.pdf), [Deep Symmetry ANLZ docs](https://djl-analysis.deepsymmetry.org/rekordbox-export-analysis/anlz.html)
- Users report that misclassifying pop as dance makes all phrase labels wrong — [Pioneer forum](https://forums.pioneerdj.com/hc/en-us/community/posts/360000117466-Phrase-Analysis-Limits-Edit-Options)
- MIX POINT LINK: user-set Mix In/Out cues with Beat Sync automate a timed transition — [rekordbox FAQ](https://rekordbox.com/en/support/faq/mixpoint-link-6/)

**Serato DJ**: "There is no function in Serato DJ that will auto-blend two tracks." Autoplay just plays the next track — [Serato support](https://support.serato.com/hc/en-us/articles/202304934-Can-Serato-DJ-auto-mix-my-songs)

**VirtualDJ**
- Automix types: Smart (tempo), with mix time "~4 to ~8 secs depending on the tracks"; Fade (remove intro/outro / silence / nothing); None (back-to-back) — [VirtualDJ manual: Automix](https://virtualdj.com/manuals/virtualdj/interface/browser/sideview/automix.html)
- Analysis creates "up to 8 different Automix points" per track: Mix Tempo Start/Exit, Mix Cut, Mix Fade. "Mix 'Cut' is used if the BPM of the outgoing and incoming tracks are too far apart to beat match" — [VirtualDJ POI Editor](https://virtualdj.com/manuals/virtualdj/editors/poieditor.html)
- `automixTempoMode`: return to 0% pitch, keep pitch, or keep BPM within ±10% — [VirtualDJ Automix forum](https://www.virtualdj.com/forums/211519/addons/Automix_Prepare.html?page=1) (forum, secondary)

**Pacemaker / AutomixIQ**
- The Pacemaker app was sunset on 2023-06-26 after the Tuned Global acquisition. Its "autopilot" let users crop starts and ends and set mixes "on more precise levels – phrase, bar and beat". The tech returned as B2B **AutomixIQ** (Tuned Global + Pacemaker, announced 2025-08-28) — [Tuned Global blog](https://blog.tunedglobal.com/news/tuned-global-acquires-award-winning-ai-and-dj-music-company-pacemaker), [MBW](https://www.musicbusinessworldwide.com/tuned-global-acquires-ai-powered-music-tech-and-dj-app-company-pacemaker12/), [Tuned Global on X](https://x.com/tunedglobal/status/1961024467993243683)

### Inferences (design ideas for the bingo show)
1. **Precompute per-song cue points offline and let the operator correct them.** This follows VirtualDJ's 8 POIs, Mixxx intro/outro cues and rekordbox Mix In/Out. For bingo the key cue is the **hook/recognition point** (we already hand-tag hooks) plus 1–3 "mix-in" downbeats leading into it and "mix-out" phrase ends.
2. **Choose the transition class from the tempo/key distance, as VirtualDJ (Tempo vs Cut), Passable (>10% → echo + cut) and Apple (crossfade or skip when incompatible) do.**
   - Our 77-song set mixes Christmas ballads, 2000s pop and reggaeton, so many adjacent pairs will be far apart.
   - "Echo-out / filter-out over the drum spin → hard land of B's hook on a downbeat" should be a first-class style, not a fallback. kckDeepak's dead-code history (Q1) points the same way.
3. **Quantize everything to bars.** Following djay (duration in bars, 4-beat sync interval), the engine should tell the UI the spin duration. It should pick 2/4/8/16 bars at the outgoing or bridge tempo, within the 5–11 s window, so the roulette stops on the downbeat where B's hook lands.
4. **Bridge variable gaps with loops**, as iOS 27 repeats outro/intro parts and Passable loops A's last 4 bars. This lets the engine fill exactly the time it needs while the drum spins.
5. **Escalate the FX palette with round progress.** Early in the round: short Fade/Cut/Echo, like VirtualDJ Smart at ~4–8 s. Near the end: Riser/build-ups, filter sweeps, snare rolls, loop-halving and drop swaps (djay Riser, Spotify "Rise", Passable build-up gestures).
6. **Avoid sameness.** iOS 26 was criticized for one predictable "underwater" style, and djay's Automatic mode randomizes types. Rotate styles within each tier.
7. **Auto plan with manual override**, as in Spotify Mix: the admin UI could preview and override the planned transition for the next song.
8. **Tempo policy:** stretch only the incoming song and only during the overlap, then glide home (Passable; Apple "remixes intros/outros"). Keep stretch small (≤3–5%). Large stretches on vocal pop are what reviewers noticed in iOS 26.

### Gaps
- Apple publishes no technical details (window lengths, stretch limits, transition taxonomy). Most "how it works" content is third-party speculation, per the search summaries.
- No primary source was found for Spotify Mix's full preset list beyond "Fade" and "Rise". Some press says "fade, rise or blend effects".
- Not researched: other 2024–2026 AI DJ apps (e.g. DJ.Studio's automix, YouTube Music features), beyond these listed vendors.

## Q5. Reference repos cloned for the builder, and the overall recommendation (fork vs. borrow vs. build)

### Takeaway
**Build from scratch** a small, purpose-built engine for the bingo use case: offline analysis, a bar-quantized transition planner, and a renderer that pre-renders or pulls from a plan, controlled over the network. **Borrow pieces and design patterns** rather than forking. Don't fork AI-DJ-Mixing-System or its forks. The most valuable references are Passable (design and native macOS runtime), pyCrossfade (minimal bar-wise beatmatch algorithm), automix-engine (Apple-AutoMix-style pipeline with verification), and building blocks such as beat_this (MIT) plus a quality time-stretcher.

### Cited findings
- **Cloned for reference** (shallow, not installed or run):
  - `reference/passable`: MIT, Swift/Core ML, closest to our runtime. It shows offline stems and Beat This! on Core ML, a transition taxonomy with build-up gestures, tempo policy by distance, a sample-exact stretcher, and an `AVAudioSourceNode` pull-renderer — [repo](https://github.com/nikolaus018/passable); `TransitionPreset.swift` L7, L148-188; `TimeStretcher.swift` L1-18; `PlaybackEngine.swift` L3-14.
  - `reference/pyCrossfade`: MIT, about 1.2 MB. A readable Python implementation of a downbeat-based gradual tempo ramp plus bar-by-bar warped crossfade — [repo](https://github.com/oguzhan-yilmaz/pyCrossfade); `pycrossfade/transition.py` L81-145.
  - `reference/automix-engine`: LGPL-2.1, about 500 KB. CUE-DETR cue candidates, Demucs stems, Rubber Band time-map stretching, vocal-gap-aware handoff, and post-render drift checks — [repo](https://github.com/VertexSelection/automix-engine).
- **Not cloned:**
  - Mixxx: huge, and its AutoDJ does no beatmatching ([manual](https://manual.mixxx.org/2.5/en/chapters/djing_with_mixxx.html)).
  - lenvdv/auto-dj: no license, Python 2, 2017 ([repo](https://github.com/lenvdv/auto-dj)).
  - allin1: an analysis library to `pip install`, not a reference design; stale since 2024-05 ([repo](https://github.com/mir-aidj/all-in-one)).
- Pieces worth borrowing, with sources:
  - **Beat and downbeat:** beat_this (MIT including weights) — [repo](https://github.com/CPJKU/beat_this). Passable exports it to Core ML — [passable README](https://github.com/nikolaus018/passable).
  - **Segments:** allin1 labels (intro/verse/chorus…) — [repo](https://github.com/mir-aidj/all-in-one).
  - **Stretching:** Rubber Band (GPL) for offline quality, or Signalsmith Stretch (MIT) / Bungee (MPL-2.0) for real-time — [rubberband](https://github.com/breakfastquay/rubberband), [signalsmith](https://github.com/Signalsmith-Audio/signalsmith-stretch), [bungee](https://github.com/bungee-audio-stretch/bungee).
  - **Bar-wise warp:** pyCrossfade algorithm — [transition.py](https://github.com/oguzhan-yilmaz/pyCrossfade/blob/main/pycrossfade/transition.py).
  - **Bass swap / tempo-synced delay DSP:** KaiwalPanchal `dsp_rack.py` — [file](https://github.com/KaiwalPanchal/AI-DJ-Mixing-System/blob/main/app/music_brain/dsp_rack.py).
  - **Camelot table and snap helpers:** kckDeepak — [generate_mixing_plan.py#L54-L107](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/generate_mixing_plan.py#L54-L107).
  - **Transition taxonomy and cut-vs-beatmatch rule:** VirtualDJ POIs — [manual](https://virtualdj.com/manuals/virtualdj/editors/poieditor.html); djay — [help](https://help.algoriddim.com/user-manual/djay-pro-windows/mixing-basics/using-automix).

### Inferences
- **Why not fork kckDeepak?**
  - Its active path is an un-synced echo then hard start.
  - The "pro" path is dead code with naive grids, a mono-collapsing DSP path, and cloud-LLM dependencies.
  - It has no real-time engine, no tests, a single inactive author, and 270 MB of committed audio.
  - What is worth keeping (Camelot table, snap helpers, plan-JSON idea) is under 200 lines and easy to rewrite.
- **Why not fork Passable?** It is the best match technically, but it is a large, fast-moving, single-author app: about 270 KB in `SetPlanner.swift` alone, stem-heavy (~400 MB cache per song), and built around continuous DJ sets rather than short bingo clips with a variable spin window. It is best mined for design (tempo policy, cut/echo rules, loop bridging, AUTimePitch warning, pull-renderer) and possibly its Core ML Beat This! conversion approach.
- **Suggested shape** (a design inference for the builder):
  1. **Offline per-song analysis**, cached as JSON: beat_this beats and downbeats; optional allin1 segments; a hook timestamp kept from our hand-tagging; candidate mix-in downbeats before the hook; loudness; key (chroma/K-S).
  2. **Per-pair planner.** It runs when the queue advances, because the next song is known. It picks a transition class by tempo/key distance and round phase (early: 2–4 bar cut/echo/filter; late: 8–16 bar riser/loop/drop-swap), and outputs a bar-indexed plan plus the exact spin duration for the UI.
  3. **Renderer.** Either pre-render the transition audio ahead of time (simplest and robust; Rubber Band offline quality) or pull-render live from the plan (Passable-style `AVAudioSourceNode`, or a Rust/C++ engine with Signalsmith/Bungee).
  4. **Network control** (WebSocket) from the web admin, so "next" triggers a plan that is already rendered.
- Pre-rendering several variants per pair (e.g. 3 spin lengths × 2 FX tiers) is feasible because the queue is pre-shuffled and known. It removes real-time DSP risk on show night.

### Gaps
- No benchmark was found of beat_this / allin1 accuracy specifically on Spanish/Catalan pop, reggaeton or Christmas ballads (rubato intros such as Mariah Carey's). Downbeat tracking on ballad intros is a known weak spot and should be tested on our own 77 songs.
- Not verified: Passable's or automix-engine's actual output quality, or that their code builds (per instructions, nothing was run).
