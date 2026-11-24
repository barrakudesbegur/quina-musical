> **Superseded where they conflict:** the design decisions agreed with the user on 2026-11-23 override this report's build brief. See [docs/mixer-design-decisions.md](../../../docs/mixer-design-decisions.md), plus [GLOSSARY.md](../../../GLOSSARY.md) and [docs/adr/](../../../docs/adr/).

# Land every hook as the drum stops

Build a small mixer made for this one job and fork nothing. An offline Python pass computes a beat and downbeat grid for each of the 77 songs with Beat This! (MIT code and weights) and snaps the existing hand-tagged hooks to downbeats. A Chrome page then plays the music through Web Audio and draws the 3D drum from the same audio clock. When "next" is pressed, a planner picks a landing time T on a bar or phrase boundary 5–11 s ahead. It schedules the outgoing song's exit effects, a build-up and the incoming song so that the incoming hook's downbeat sounds exactly at T, and it solves the drum's physics so the wheel comes to rest on the incoming song's card at the same instant. **kckDeepak's AI-DJ-Mixing-System is not a usable base.** It is an offline batch renderer. At HEAD its only active transition is an echo that isn't synced to the beat, after which the next song starts from 0:00, and its advertised beat-matching is dead code. Our problem is narrower and easier than a club automix. A 5–11 s spin holds only **2–6 bars**. Bingo hosts warn against blending two songs. Most random pairs from a pool of pop, reggaeton and Christmas songs are too far apart in tempo to beat-match. So the core of the proof of concept is an "FX bridge": the outgoing song leaves on its own phrase boundary, and an echo, a riser or a snare roll at exactly the incoming song's tempo carries the room onto the incoming hook. This needs **no time-stretching at all**. The research points to two things that decide quality. The first is an accurate downbeat grid: in Spotify's study, misaligned beats were the top complaint and key clashes were never cited. The second is good cue points: swapping only the cues dropped DJustify's listener score from 5.6 to 4.8. This project already has the second: 386 hand-tagged hooks, one marked "best" per song. **Every transition is an audible DJ effect, from the first song of the round.** Game phase changes the size of the effects, not whether there are any. Early in a round, transitions are compact 5–6 s builds with clips of about 12 s: a 1–2 bar riser or loop roll, a brake or spinback, a filter sweep, and an impact on the landing. The last songs before a winner get 8–11 s builds with long snare rolls, a beat of silence and a layered impact. The first milestone (analysis v0, plus one page with the solved drum *and* the effects layer) must already sound like a DJ set. The user rejected a first build that used only plain cuts and echo-outs, saying it "just lowers and increases the volume" (2026-11-23).

## Project context and assets: 77 tagged songs, a working drum, and a player to replace

The POC lives in `experiments/mixer-poc/` inside this repo. Four reference clones sit next to it in `experiments/mixer-poc/reference/`: AI-DJ-Mixing-System, passable, pyCrossfade and automix-engine. They are read-only and gitignored. Almost everything the engine needs to know about the music already exists in the repo, and the build brief relies on this inventory.

| Asset | Location | What matters for the mixer |
|---|---|---|
| Songs | `client/public/audios/song/<id>.mp3`, ids 1–77 (gitignored) | Full-length tracks at 128 kbps, **48 kHz stereo**, about 262–298 MB in total. The cover art is embedded as an mjpeg video stream, so every ffmpeg call needs `-map 0:a`. They were downloaded with spotdl 4.6.0 from YouTube Music, so versions and lengths can differ from Spotify's |
| Metadata | `server/db/default/songs.json` | Array of `{id, title, artist, cover (Spotify URL), spotifyId, timestamps[], volume, duration}` |
| Hooks | `timestamps[]` in songs.json | **386 hand-tagged hooks.** Every song has exactly one `best` hook; there are also 237 `main` and 72 `secondary`, with 1–10 per song. Each has `time` in seconds from the start of the file, plus a legacy `playEffect`: `none`, `crossfade{durationSeconds}` or `fade-out-in{fadeOutSeconds, fadeInOffset, fadeInSeconds}` |
| Covers | `client/public/images/covers/<id>.jpg` | 640×640, all 77 present. These become the drum's cards |
| Sound effects | `client/public/audios/fx/*.mp3` | among-us, anime-wow, boom, bum-bum-buaaa, buzzer, correct, duck-quack, fear-melody, heaven, horn, horn-original, metal-gear-alert, orchestra-hit, sad-trombone, spongebob-boowomp, spongebob-fail, tada |
| Drum | `experiments/shuffle-test/` (spec in `PROMPT.md`; `physics.js`, `sound.js`, `cards.js`, `main.js`, `styles.css`, `tests/physics.test.js`) | A 3D drum in plain HTML/CSS/JS with real physics, detents, a flapper, synthesized clicks, motion blur and a reduced-motion mode |
| Current player (to be thrown away) | `client/src/hooks/useSongPlayer.ts` in the React + tRPC app | Summarized below |
| Game state | `server/src/api/game.ts`, `server/db`, the GameInsightsSection component | The server keeps a pre-shuffled queue (`positionInQueue`), so the next song is always known. Cards and rounds live in `server/db`. GameInsightsSection charts cards-per-song progress, which is the basis for "songs until a winner" |

**The current player** has two HTMLAudioElement "slots". Each runs through a MediaElementAudioSourceNode into a GainNode and then a master gain. Transitions are linear-ramp crossfades or fade-out-in moves, starting at a random timestamp with the requested tag. It preloads upcoming songs with fetch and supports Media Session, keyboard and WiiMote for next and previous. It has **no notion of beat, tempo, key or phrase**.

One detail of its code tells us what the hand tags mean. A crossfade starts the incoming song at `time − durationSeconds`, and a fade-out-in starts it at `time − fadeInSeconds`, so both reach full volume exactly at `time` (useSongPlayer.ts, around lines 306–341). **`time` is therefore the hook moment.** The legacy fade length hints at how much audio before the hook the tagger wanted to hear.

Two data problems must be handled before those hooks can be trusted. The known one is song 70, "Una Vaina Loca": its file is 187 s long but its only timestamp is at 204 s. A wider check with ffprobe on 2026-11-23, run for this report, found that **17 of the 77 files differ by more than 1 s from the `duration` stored in songs.json**: ids 4, 12, 13, 26, 42, 48, 53, 54, 57, 58, 62, 63, 70, 71, 73, 75 and 77. The gap is about 9–14 s for songs 13, 42, 53, 58, 63 and 73, and 94 s for song 70 (MP3 minus songs.json, in seconds: 4 +4.3, 12 +5.7, 13 −9.2, 26 −2.1, 42 +12.0, 48 −1.2, 53 −10.9, 54 −1.7, 57 +1.3, 58 −10.4, 62 +2.6, 63 −9.8, 70 −94.0, 71 −1.3, 73 −13.6, 75 +7.5, 77 +8.0). If a song's tags were made against a different version of the recording, all of its hooks may be shifted. The analysis must flag these 17 songs, and someone must check their hooks by ear before a show.

**The machine** is an Apple M1 Pro with 16 GB of RAM, running macOS. Homebrew `python3.13`, `uv`, `ffmpeg`/`ffprobe`, Node 26, Deno and Swift are installed. Rust/cargo, the `rubberband` CLI and `sox` are not, but all of them install from Homebrew. The system `python3` is 3.9.6 and must not be used: librosa 1.0.1 requires Python 3.12 or later ([PyPI](https://pypi.org/project/librosa/)), and torch 2.15 ships arm64 wheels for Python 3.11–3.13 ([PyPI](https://pypi.org/project/torch/)).

## A 5–11 second spin holds only two to six bars

Quina musical is a live music bingo. A presenter runs rounds in a venue, the next song comes from a pre-shuffled queue, a projector shows the drum, and players mark the song on their cards. The drum spec asks for a 3D reel of covers that spins with "real physics, not a canned easing curve". It wants a detent at every card, a flapper, clicks whose gaps grow as the wheel slows, and spins lasting "roughly 5 to 11 seconds" (`experiments/shuffle-test/PROMPT.md`).

The new requirement ties that animation to the music. The spin starts when "next" is pressed and stops at the instant the new song starts, so **the spin is the transition window**. At pop tempos that window is tiny in musical terms:

| BPM | Beat | Bar (4/4) | 8 bars | Bars in 5 s | Bars in 11 s |
|---|---|---|---|---|---|
| 70 | 857 ms | 3.43 s | 27.4 s | 1.5 | 3.2 |
| 100 | 600 ms | 2.40 s | 19.2 s | 2.1 | 4.6 |
| 120 | 500 ms | 2.00 s | 16.0 s | 2.5 | 5.5 |
| 128 | 469 ms | 1.875 s | 15.0 s | 2.7 | 5.9 |
| 140 | 429 ms | 1.71 s | 13.7 s | 2.9 | 6.4 |

Club practice cannot be copied. Analysis of 1,557 real DJ mixes found that transition lengths peak at multiples of 32 beats ([Kim et al. 2020](https://arxiv.org/pdf/2008.10267)). DJ guides start blends 16 or 32 bars before the outgoing track runs out of energy ([Setflow](https://www.setflow.app/blog/dj-transitions-how-to-mix-between-songs)), and the phrase that "changes naturally" is 32 beats ([djkit "Rule of 32"](https://www.djkit.com/blogs/news/djing-rule-of-32)). **Every technique has to be compressed into 1–6 bars.** A "long, hyped" transition has to mean a denser build-up, not more bars.

There is a little slack in where to land. A window 6 s wide always contains at least two bar boundaries at 80 BPM or faster. At 128 BPM it contains a 4-bar boundary about 80% of the time and an 8-bar boundary only about 40% of the time (simple arithmetic). Because we choose where the incoming song starts, though, any phrase of the incoming song can land on any bar of the outgoing one.

**Bingo practice favors short, hook-first clips and is wary of crossfades.** Hosts call 15–30 s "the sweet spot", because once a song is recognized "the rest of the clip is dead air" ([101planners](https://www.101planners.com/music-bingo/)). Bingofy suggests 30–45 s, queuing tracks "near the hook", turning off crossfade, and using about 15 s clips in "shotgun" rounds ([Bingofy](https://www.bingofy.co/blog/music-bingo-host-guide)). Clips of 3–5 s turn the game into "a reflex test", 15–20 s make it "social", and a round runs about 20–30 minutes ([BingoCardOnline](https://www.bingocardonline.com/mixtape-bingo/)). Wasingo recommends "a few seconds of silence between clips" so players can find and mark the square, and says to avoid crossfading ([Wasingo](https://www.wasingo.com/how-to-play-music-bingo)). Long pauses, on the other hand, "make the night feel disorganised" ([Boogie Bingo](https://www.boogiebingo.live/guides/how-to-run-a-music-bingo-night)).

Our design resolves that tension by treating the spin as the gap. The outgoing song leaves early, the gap is filled with drum ticks and effects rather than two overlapping vocals, and the window then resolves on the new hook. Recognition is not the bottleneck. Listeners named familiar recordings well above chance from **200 ms** excerpts, and still above chance from 100 ms. High-pass-filtered excerpts stayed recognizable, while low-passed or reversed ones did not ([Schellenberg et al. 1999](https://www.researchgate.net/publication/12633703_Name_that_tune_Identifying_popular_recordings_from_brief_excerpts)). Two consequences follow. A low-pass "tease" of the incoming song during the spin should hide its identity, while opening the filter on the landing reveals it. And the minimum clip length is set by enjoyment and by the time players need to mark their cards, not by perception.

**Escalation has an empirical basis.** In a motion-capture study of dancers, the breakdown, build-up and drop routine changed how much people moved, and participants rated the build-up and drop as "particularly pleasurable and motivational" ([Solberg & Jensenius](https://www.researchgate.net/publication/316469270_Pleasurable_and_Intersubjectively_Embodied_Experiences_of_Electronic_Dance_Music)). Break routines also raised skin conductance ([Solberg & Dibben 2019](https://eprints.whiterose.ac.uk/id/eprint/145911/1/Solberg&Dibben2019.pdf)). Huron's ITPRA model explains why: tension produces "pre-outcome optimum arousal and attention", and a confirmed prediction is rewarding ([Huron, *Sweet Anticipation*](https://direct.mit.edu/books/monograph/1961/bookpreview-pdf/2429413)). Game shows use the same lever. *Who Wants to Be a Millionaire* raises its question cue by **one semitone per question** in the later stages ([Wikipedia](https://en.wikipedia.org/wiki/Who_Wants_to_Be_a_Millionaire%3F_(British_game_show))). Radio imaging "should resolve into the song, not stop dead in front of it", ending on an impact or filter release "on the song's first downbeat", and rotates elements so they don't repeat ([Nobex](https://www.nobexradio.com/blog/radio-imaging-and-jingles)). Sources disagree on sweeper length: 4–10 s per Nobex versus 12–15 s per [LFM Audio](https://www.lfmaudio.co.nz/wfp_faq/what-are-stingers-sweepers-and-cold-mixouts/). Our 5–11 s window sits inside either convention.

Those facts turn the user's request into concrete requirements:

| Requirement | Source | Design consequence |
|---|---|---|
| Back, play/pause and next buttons | User | Intent commands in the protocol. Pause freezes music and drum together |
| The wheel spins on "next" and stops when the new song starts | User | The planner fixes T before the spin starts, and the drum is solved to stop at T |
| 5–11 s spins that feel physical, travel more than one lap and land centered | `PROMPT.md` | A physics solver that hits a chosen card at a chosen time without visible cheating |
| At least 2 transition speeds that escalate toward the winner | User | Four phases (early, mid, late, final) driven by "songs until winner" |
| Land on the right beat, with build-up effects | User | T is quantized to bars or phrases, the incoming hook's downbeat is exactly at T, and builds are generated at that song's tempo |
| The engine may be separate from the admin; native code is allowed | User | WebSocket protocol. A browser engine is chosen because nothing requires native code (see the engine section) |
| Recognizable hooks and no vocal pile-ups | Bingo practice, Schellenberg | FX-bridge transitions with at most 1 beat of vocal overlap |
| Avoid machine sameness | [TIME 2025 survey](https://drops.dagstuhl.de/storage/00lipics/lipics-vol355-time2025/LIPIcs.TIME.2025.20/LIPIcs.TIME.2025.20.pdf); iOS 26 critique ([9to5Mac](https://9to5mac.com/2026/07/16/ios-27-makes-one-of-my-favorite-apple-music-features-even-better/)) | Recipe rotation and a "novelty budget" |

## Fork nothing: kckDeepak's AI-DJ-Mixing-System renders an unsynced echo, then restarts

The user asked us to evaluate [kckDeepak/AI-DJ-Mixing-System](https://github.com/kckDeepak/AI-DJ-Mixing-System). It is an **offline Python batch pipeline** built on pydub, librosa, scipy and the OpenAI APIs, and it writes one MP3 with no playback engine. It runs five stages that pass JSON files on disk to each other: song selection, BPM/genre/key, chorus detection, mixing plan, and render ([run_pipeline.py](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/run_pipeline.py#L60-L113)). `generate_mix` loads whole tracks, slices and concatenates them in memory, and exports a single 320 kbps file ([mixing_engine.py](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/mixing_engine.py#L1372-L1527)).

At HEAD, **every transition is an "echo-transition"** at the outgoing track's first chorus end. It copies the last 1.5 s four times at a fixed 600 ms spacing that is not synced to the tempo, low-passes the tail, and then starts the next song **from the beginning, with no overlap** ([mixing_engine.py#L1206-L1278](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/mixing_engine.py#L1206-L1278)).

The README advertises "Perfect Beat-Grid Alignment", "Gradual Tempo Sync (32 micro-steps)" and "Phrase-Based Transitions" ([README](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/README.md#L11-L20)). All of that is dead code. It was only wired in at commit `cfabb40` and was replaced on 2026-02-03 ([commit d56bd28](https://github.com/kckDeepak/AI-DJ-Mixing-System/commit/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4)).

The processing has further problems:

- It collapses every processed segment to **mono** ([L119-128](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/mixing_engine.py#L119-L128)).
- It stretches with librosa's phase vocoder.
- Its "phrases" are every 32 beats from the first detected beat.
- It asks GPT-4o-mini for the key by title, using a regex that cannot match sharp keys ([bpm_lookup.py](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/bpm_lookup.py#L196-L241)).
- It uploads whole songs to Whisper to find choruses ([structure_detector.py](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/structure_detector.py#L83-L93)).

The repo is MIT-licensed, with one author, 66 stars and no tests. It has about 271 MB of committed audio, and it has been inactive since February ([GitHub API](https://api.github.com/repos/kckDeepak/AI-DJ-Mixing-System)).

Its history carries one useful hint. The author spent two months on a beat-matched path and then replaced it with a simple echo-out. That is consistent with beat-matched overlaps proving unreliable on mixed pop and afrobeats, and it supports making echo/cut transitions a primary mode rather than a fallback.

**The forks don't change the verdict.** Seven of the ten forks are untouched mirrors ([forks API](https://api.github.com/repos/kckDeepak/AI-DJ-Mixing-System/forks)). [matracey](https://github.com/kckDeepak/AI-DJ-Mixing-System/compare/main...matracey:main) fixes dependencies, adds a local Whisper backend, and adds a long blend with a bass swap. [KaiwalPanchal](https://github.com/KaiwalPanchal/AI-DJ-Mixing-System) rewrote it with a scipy DSP rack: a Linkwitz-Riley bass swap, a tempo-synced delay and a limiter in [dsp_rack.py](https://github.com/KaiwalPanchal/AI-DJ-Mixing-System/blob/main/app/music_brain/dsp_rack.py). It still assumes that beat 0 is bar 1. [jakah2551](https://github.com/kckDeepak/AI-DJ-Mixing-System/compare/main...jakah2551:main) adds a Flask UI.

Only three things are worth borrowing, and together they are under 200 lines:

- the 24-key Camelot table ([generate_mixing_plan.py#L54-L107](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/generate_mixing_plan.py#L54-L107));
- the snap-to-beat/bar/phrase helpers ([structure_detector.py#L190-L280](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/structure_detector.py#L190-L280));
- the idea of a declarative per-transition plan in JSON ([generate_mixing_plan.py#L456-L474](https://github.com/kckDeepak/AI-DJ-Mixing-System/blob/d56bd28c772f713ae39fc9ac33d0b555b98e1ce4/generate_mixing_plan.py#L456-L474)). Our version indexes the plan by bars and beats instead of seconds.

**Better reference designs exist, though none fits off the shelf.**

- **[Passable](https://github.com/nikolaus018/passable)** (MIT, Swift, native macOS, cloned in `reference/passable`) is the closest prior art. It runs Beat This! exported to Core ML. Its transition presets include `stemSwap`, `dropSwap`, `longBlend`, `mashup` and `echoOut`, and it has build-up gestures such as `snareRoll`, `loopHalve`, `riser`, `fakeoutDrop` and `spinbackDrop` (`Passable/Model/TransitionPreset.swift`). Its tempo policy matches only the incoming song when the difference is up to 3%, splits the shift between both songs above that (neither more than 5% off), and uses a cut with an echo when the difference exceeds 10%. It plays through an `AVAudioSourceNode` pull renderer, and a code comment warns that Apple's AUTimePitch "let the beat wander tens of milliseconds" (`Passable/Audio/TimeStretcher.swift`).
- **[pyCrossfade](https://github.com/oguzhan-yilmaz/pyCrossfade)** (MIT, `reference/pyCrossfade`) is the most readable bar-by-bar beat-matched crossfade: madmom downbeats, pyrubberband stretching, and a tempo ramp over 8 downbeats ([transition.py](https://github.com/oguzhan-yilmaz/pyCrossfade/blob/main/pycrossfade/transition.py)).
- **[automix-engine](https://github.com/VertexSelection/automix-engine)** (LGPL-2.1, `reference/automix-engine`) is worth reading for its post-render checks, which reject renders whose drums drift. It handles only one hard-coded pair.
- **[null-set-ai-dj](https://github.com/sanchitd5/null-set-ai-dj)** (MIT) has the same shape as our recommended stack: a vanilla-JS Web Audio console driven by Python analysis.
- **Mixxx**, the only large maintained engine, has an AutoDJ that "does not take into account the volume of each track, nor the frequency content, nor the rhythms" ([manual](https://manual.mixxx.org/2.5/en/chapters/djing_with_mixxx.html)).

**Commercial products confirm the design pattern** more than any repo does. VirtualDJ precomputes up to 8 automix points per track and uses "Mix Cut" when "the BPM of the outgoing and incoming tracks are too far apart to beat match" ([VirtualDJ POI editor](https://virtualdj.com/manuals/virtualdj/editors/poieditor.html)). djay's Automix offers Fade, Filter, EQ, Echo, Dissolve, Riser, Tremolo and Neural Mix, and sets durations in **bars** ([djay help](https://help.algoriddim.com/user-manual/djay-pro-windows/mixing-basics/using-automix)); since 5.3.2 it uses "a 4-beat sync interval" ([release notes](https://www.algoriddim.com/djay-pro-mac/releasenotes)). Apple's iOS 27 AutoMix repeats parts of intros and outros "to bridge the transition", and "may just crossfade" when a complex transition wouldn't suit ([MacRumors](https://www.macrumors.com/2026/06/09/apple-music-gains-automix-upgrades-and-more-in-ios-27/)). Its iOS 26 version was criticized for "a very similar and predictable style for most transitions" ([9to5Mac](https://9to5mac.com/2026/07/16/ios-27-makes-one-of-my-favorite-apple-music-features-even-better/)). Spotify Mix ships editable "Fade" and "Rise" presets ([Spotify](https://newsroom.spotify.com/2025-08-19/mix-your-favorite-playlists-seamlessly-by-adding-your-own-transitions/)). rekordbox's phrase analysis mislabels a whole track when it classifies pop as dance ([Pioneer forum](https://forums.pioneerdj.com/hc/en-us/community/posts/360000117466-Phrase-Analysis-Limits-Edit-Options)). Serato has no automix ([Serato](https://support.serato.com/hc/en-us/articles/202304934-Can-Serato-DJ-auto-mix-my-songs)).

The lessons that carry over to a bingo show are these:

- precompute cue points per song;
- pick the transition style from the tempo distance;
- quantize everything to bars;
- fill variable gaps with loops or effects;
- escalate the effects palette as the round progresses;
- rotate styles to avoid sameness.

## Grid accuracy and cue choice decide quality, not clever blending

The academic auto-DJ literature mostly targets EDM. Its findings still transfer, and they point in one direction.

**Bittner et al. (Spotify, ISMIR 2017)** give the most reusable formalization ([paper](https://archives.ismir.net/ismir2017/paper/000086.pdf)). Candidate transition starts are restricted to downbeats. Each candidate pair is scored by standardized costs for timbre, chroma, loudness, vocal overlap and alignment with structure, and the lowest score wins. The tempo ramp interpolates beat durations linearly across the overlap. Curators rated 64.1% of 48 dance transitions "Good". The reasons given for bad ones were "beats do not align" (15.2%), a mid-vocal transition (6.5%) and not starting on a downbeat (2.2%). Key clashes accounted for **0%**. The authors conclude that beat and downbeat tracking is the bottleneck.

**Ishizaki et al. (ISMIR 2009)** measured discomfort with tempo changes on 96 listeners ([paper](https://archives.ismir.net/ismir2009/paper/000043.pdf)). On average, discomfort set in at a speed-up of 1.227× or a slow-down of 0.852×, giving a stricter comfort band of 0.90–1.10. Listeners were more sensitive to slowing down. The paper also introduced octave folding, so a 60 BPM and a 120 BPM song mix without any stretching, and splitting the stretch between both songs. Real DJs stretch gently: **86.1% of played tracks are adjusted by less than 5%**, and only 2.5% are transposed, almost always by one semitone ([Kim et al. 2020](https://arxiv.org/pdf/2008.10267)).

The most relevant recent paper is **DJustify** (Oct 2026), the first auto-DJ built explicitly for vocal-heavy pop ([arXiv](https://arxiv.org/pdf/2610.33434)). In a blind test with 103 listeners, a human DJ scored 6.7/10, DJustify 5.6, a Spotify-style beat-matched crossfade 4.7 and Mosaikbox 4.0. Feeding DJustify's own pipeline with Bittner-style cue points dropped it to 4.8, which led the authors to conclude that "transition quality depends on the cue candidates the planner starts from". Its deterministic checker inspects the rendered audio and repairs four kinds of fault: a vocal cut mid-phrase, colliding vocals, a silent gap or energy hole, and an entry stuck in the incoming song's intro. That checker needs no LLM and can be reused directly.

The 2025 TIME survey adds a warning that applies directly to a long show. Repeating the same few techniques makes machine transitions recognisable and disliked, and "no automatic DJ transition generation system has matched the performance of human DJs" ([TIME 2025](https://drops.dagstuhl.de/storage/00lipics/lipics-vol355-time2025/LIPIcs.TIME.2025.20/LIPIcs.TIME.2025.20.pdf)).

**Cue detectors and learned mixers are not worth importing.** Zehren's rules say that a switch point:

- lies on a downbeat at the start of a 4/8/16-bar period;
- marks a moment of high novelty;
- precedes a section that "stands on its own".

The rules reach 86% precision, but only on EDM ([Zehren 2020](https://arxiv.org/pdf/2007.08411)). The drum-and-bass auto-DJ "does not transfer" to other genres ([Zehren et al. 2022](https://www.diva-portal.org/smash/get/diva2:1811100/FULLTEXT02.pdf)). CUE-DETR's best F1 is 0.46, again on EDM ([arXiv 2407.06823](https://arxiv.org/pdf/2407.06823)). DJtransGAN's learned fader and EQ curves showed "no significant difference" from a linear crossfade or a rule-based mixer ([arXiv 2110.06525](https://arxiv.org/pdf/2110.06525)).

Hook finding has known baselines. A plain spectral-energy (loudness) window reaches F ≈ 0.76 for choruses on RWC-Pop, against 0.80 for an attention model and 0.48 for repetition, because "chorus sections tend to be louder" ([Huang et al. 2018](https://arxiv.org/pdf/1802.10495)). Goto's RefraiD finds the chorus in 80 of 100 RWC songs ([Goto 2006](https://staff.aist.go.jp/m.goto/PAPER/IEEETASLP200609goto.pdf)). The nearest conceptual prior art to a "hook-clip medley" is Kim et al.'s 2017 highlight-based mix generator ([ResearchGate](https://www.researchgate.net/publication/322007163_Automatic_DJ_Mix_Generation_Using_Highlight_Detection)).

The implication is that **our hand-tagged hooks are better ground truth than any detector** for these 77 songs. The software's job is to snap them to downbeats, check them, and land them precisely. Mosaikbox's stem rules (separate 4 stems and never overlap two lead vocals) are the pattern to follow once stems exist ([Mosaikbox](https://repositum.tuwien.at/bitstream/20.500.12708/212628/1/Sowula-2024-Mosaikbox%20Improving%20Fully%20Automatic%20DJ%20Mixing%20Through%20Rule-ba...-vor.pdf)).

## DJ craft compresses into ten parameterized moves

**The grammar is bars and phrases.** Most popular music is in 4/4 with 16-bar phrases, so it is "often enough" to start the incoming track on a phrase boundary, and crash cymbals almost always mark a phrase start ([Wikipedia: Phrasing](https://en.wikipedia.org/wiki/Phrasing_(DJ))). Working DJs keep a hot cue on the chorus or drop so they can "jump directly to the peak moment for a quick mix-in" ([DJ Record Pool](https://djrecordpool.com/how-to-use-hot-cues/)). "A Hot Cue is only as tight as the beatgrid underneath it" ([Digital DJ Pool](https://digitaldjpool.com/blog/hot-cues-for-djs/)).

**Tempo changes cost pitch unless they are time-stretched.** A 6% speed change is about one semitone (semitones = 12·log2(ratio)). Changes up to about ±3% are "barely noticeable", and beyond ±6% vocals sound "chipmunked or dragged" ([bpmtech](https://bpmtech.no/tools/pitch-range)). With keylock, ±4–6% sounds natural, and artifacts appear beyond ±8–10% on exposed vocals and cymbals ([SirenMix](https://sirenmix.com/blog/bpm-guide)). Above about 4% difference, practitioners prefer an echo-out, a cut on the one or a spinback to riding the pitch fader ([vibesdj](https://vibesdj.io/dj-tools/dj-transitions)). Open-format, wedding and party DJs move between genres with "quick cuts, echo outs, spinbacks, drops, and wordplay" ([djsondemand](https://www.djsondemand.co.uk/open-format-djing-explained-for-beginners/)). They exploit halftime and doubletime, and fire the incoming drop as the outgoing build ends even when tempos are unrelated ([DJ.Studio](https://dj.studio/blog/dj-tempo-change-techniques)). "The quicker the mixing, the higher the energy" is the quick-mix principle behind an early-round cadence ([djtechreviews](https://djtechreviews.com/guides/tutorials/how-long-should-a-dj-play-a-song-for)).

**Key matters only when melodies overlap.** The Camelot rules are:

- safe: the same code, ±1 number, or the same number with the other letter;
- energy boost: +2 numbers ([Mixed In Key](https://mixedinkey.com/harmonic-mixing-guide/energy-boost-dj-mixing-tutorial/); [wheel](https://mixedinkey.com/camelot-wheel/)).

Long melodic overlaps of more than 8 beats need matching keys, "vocal outro into vocal intro" is "usually a bad idea", and key "matters less for a clean hard cut" ([The Ghost Production](https://theghostproduction.com/dj-transitions-clean-two-weeks/)). Combined with Bittner's 0% key-clash finding, **key is a secondary feature for this POC**. It only gates the rare blend.

**The transition catalogue.** Practitioner sources give enough parameters to code each move. The build brief turns them into a table.

- **Echo-out:** use a 1/2- or 3/4-beat echo with feedback around 35–50% (kept under 50%) and wet below 40%, close the fader "once the echo has caught", and keep the tail under a bar before a busy drop ([The Ghost Production](https://theghostproduction.com/dj-transitions-clean-two-weeks/); [Digital DJ Pool](https://digitaldjpool.com/blog/dj-transitions-for-beginners/)).
- **Filter fade:** bring B in quietly with its bass reduced and sweep A toward high-pass over 8 bars. "High-pass keeps energy up. Low-pass makes the track feel like it's moving away" (Digital DJ Pool).
- **Reverb wash:** wet at 50–70%, keeping the highs ([djatodocolor](https://www.djatodocolor.com/blog/en-fx-transitions-pro)). Washes are "ideal for transitions between tracks with different BPMs" ([Thomann](https://www.thomann.de/blog/en/gear/the-5-most-important-dj-transitions/)) and use a 1–2 s decay ([DJ Record Pool](https://djrecordpool.com/dj-transition-techniques/)).
- **Loop roll:** loops a shrinking slice, halving 1/2 → 1/4 → 1/8 → 1/16 before a drop ([Soundstock](https://www.soundstock.com/glossary/what-is-a-loop-roll-dj); [djlearn.de](https://djlearn.de/en/hot-cues-and-loops)).
- **Brake:** "most good decks stop in about a second", and overuse makes guests think "you simply can't mix" ([DJingTips](https://www.djingtips.com/how-to-dj/backspins-stops-and-power-offs/)).
- **Cut on the one:** fits pop and large BPM changes, and a drop mix tolerates up to ±8 BPM when nothing overlaps (Digital DJ Pool; The Ghost Production).

**A build-up is fully specified by production guides** ([Plugg Supply](https://plugg-supply.net/articles/snare-rolls-and-build-ups)):

- an 8-bar snare roll whose stages each take a quarter of the build: 1/4, then 1/8, then 1/16, then 1/32 notes;
- velocity rising from 50–60 to 110–127;
- snare pitch rising from 0 to +7–12 semitones;
- a snare high-pass rising from about 150 Hz to 1–2 kHz;
- a music-bus high-pass up to 200–400 Hz in the last bar, "off instantly at the drop".

Plugg Supply names 1/2 beat, 1 beat and 1/2–1 bar of silence before the drop as subtle, default and dramatic. Point Blank's advice is "try muting everything for one beat before the drop" ([Point Blank](https://www.pointblankmusicschool.com/blog/how-to-make-your-drops-hit-harder-tips-for-edm-producers/)). The impact sits **20–40 ms early**, with a 40–60 Hz sub and a reverse crash peaking on beat 1 ([Myloops](https://www.myloops.net/building-tension-before-a-trance-drop)). A noise riser sweeps its filter from about 1 kHz to 10 kHz with rising volume ([MusicRadar via search](https://www.musicradar.com/how-to/build-up-break-down)). One source says to pitch the snare *down* across the roll ([beatmakingtools](https://beatmakingtools.com/how-to/how-to-create-buildups)), which contradicts Plugg Supply. We follow Plugg Supply's rising pitch because it escalates naturally from phase to phase.

**Novelty and theatrics need a budget.** Loop rolls belong "once or twice an hour" (vibesdj). Energy-boost key changes should come "every 20-30 minutes, but not ALL the time" (Mixed In Key). Radio rotates its sweepers so none repeats within an hour (Nobex). Scaled to a bingo's pace of one song every 20–40 s, that means a brake, spinback, loop roll or fake drop **at most once in 6–10 transitions, never twice in a row**.

The most important synthesis is that the build should be generated at the **incoming** song's tempo and phase, while the outgoing song leaves early by echo, brake or wash. The two songs then never have to be beat-matched, and a 70→128 BPM jump sounds intentional.

## The analysis toolchain: Beat This! first, everything else optional

**Beats and downbeats come from Beat This!** It is the official code for the ISMIR 2024 paper. Both code and weights are MIT, it is on PyPI as `beat-this` 1.1.0 (released 2026-04-14, needs torch ≥2), and it makes no assumption of constant tempo ([GitHub](https://github.com/CPJKU/beat_this); [PyPI](https://pypi.org/project/beat-this/)). On GTZAN it reaches a downbeat F1 of 78.3, against 75.6 for the previous best system. In 8-fold cross-validation it scores 96.1/93.7 (beat/downbeat) on RWC Pop and 95.8/90.7 on Harmonix, and it is weak on classical music ([paper](https://arxiv.org/html/2407.21658)). Its optional DBN post-processing slightly lowers F1 but improves continuity.

One unreviewed third-party test measured 2.8 s of CPU per audio minute for Beat This! against 10.5 s for madmom. On full mixes, madmom's downbeat F was only 0.75 against 0.95 for Beat This!, with 8 bar-offset errors ([drumtx PR #7](https://github.com/tylermac92/drumtx/pull/7)). That points to **about 15 minutes for all 77 songs**.

madmom is not worth the trouble. Its PyPI release is from 2018 and breaks on NumPy ≥1.24 ([Discussion #536](https://github.com/CPJKU/madmom/discussions/536)), and its model files are **CC BY-NC-SA 4.0** ([madmom](https://github.com/CPJKU/madmom)).

The same rule applies here as in the academic findings: verify the grid by ear. Beat errors, not key, ruin automatic transitions (Bittner). Decode each MP3 once and analyze and play the same PCM, because different MP3 decoders "can shift audio by 20–40 ms" ([all-in-one-infer](https://github.com/openmirlab/all-in-one-infer)). That is a sixth to a twelfth of a beat at 120 BPM.

**Structure detection is optional because the hooks are hand-tagged.** All-In-One gives the most practical section labels, with a downbeat F1 of .915 and a boundary hit rate of .660 on Harmonix ([arXiv 2307.16425](https://arxiv.org/html/2307.16425v1)). The original package is stale, though: its last push was May 2024, and NATTEN install issues on macOS remain open ([issues](https://github.com/mir-aidj/all-in-one/issues)). The `all-in-one-infer` fork runs in pure PyTorch but rejects MPS on Mac, and its checkpoints are CC-BY-NC-SA ([README](https://github.com/openmirlab/all-in-one-infer)). SongFormer is more accurate but targets CUDA ([GitHub](https://github.com/ASLP-lab/SongFormer)). For the POC, phrase boundaries can instead be counted in 4- and 8-bar steps from each song's own hook downbeat, which is a chorus start by construction.

**Key, loudness and energy are cheap.** Essentia's KeyExtractor offers `edma` and `bgate` profiles ([docs](https://essentia.upf.edu/reference/std_KeyExtractor.html)). Its arm64 macOS wheels exist for cp39–cp313 at 2.1b6.dev1389 ([PyPI](https://pypi.org/project/essentia/#files)). The library is AGPL and the MTG models are CC BY-NC-SA ([models](https://essentia.upf.edu/models.html)). keyfinder-cli outputs Camelot codes but must be built with CMake ([GitHub](https://github.com/evanpurkhiser/keyfinder-cli)). Accuracy on real tracks is modest in vendor tests: KeyFinder scored 65–76% and Mixed In Key 86–89% ([Immerground](https://immerground.com/blog/mixed-in-key-alternatives)), and relative major/minor confusion is the common failure.

pyloudnorm (MIT, 0.2.0) implements BS.1770-4 integrated loudness ([GitHub](https://github.com/csteinmetz1/pyloudnorm)). A static gain to a common target avoids the silent fallbacks of ffmpeg's one-pass loudnorm ([DEV analysis](https://dev.to/lpgit/why-is-my-tiny-desk-ai-clip-quieter-than-other-videos-two-pass-ffmpeg-loudnorm-to-14-lufs-and-3ne9)). librosa 1.0.1 supplies RMS, onset strength and chroma per bar.

**Spotify's own tempo and key exist for 68 of 77 songs, as a cross-check only.** Spotify's Audio Features and Audio Analysis endpoints have been closed to new apps since 27 Nov 2024 ([Spotify](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)). Anna's Archive's Dec 2025 Spotify backup released its metadata as SQLite torrents, including `spotify_clean_audio_features.sqlite3`, with tempo, key, mode, time_signature, loudness, energy and valence per track ([Anna's Archive](https://annas-archive.gl/blog/backing-up-spotify.html)). The Audio Analysis data (beats, bars, sections), scraped for about 40M tracks, was never released, so **no beat grid or section data is available from any Spotify source**. The labels and Spotify won a default judgment of about $322M in April 2026 over the audio and the DRM circumvention, not the metadata. Taking 77 rows of facts is an insubstantial part under the EU database right (Directive 96/9/EC art. 7).

Per-track values were fetched by Spotify ID into **`experiments/mixer-poc/data/spotify_features.json`**, shaped `{_meta, songs: {<id>: {spotifyId, found, sources: {...}, features: {...}, flags}}}`. The sources are [ReccoBeats](https://reccobeats.com/docs/apis/get-audio-features) (free, no key, 53 songs; its values match Spotify's to every decimal) and Hugging Face mirrors of the features table (GildasLeDrogoff 66, plus older Kaggle copies). Coverage is 68 of 77. Songs 12, 18, 21, 22, 24, 32, 51, 55 and 70 are missing, probably because their `spotifyId` points to a compilation version; Dancing Queen, Boom Boom Boom Boom, Elefants, Fiebre and Shin Chan Dance also look like non-canonical IDs.

Spotify's values contain the usual metre errors. Baby is at 65 BPM (likely about 130), Waka Waka at 190.7 BPM in 3/4 (likely about 127 in 4/4), and Aserejé and Llença't are possibly double-time. Use the data only to flag our own analysis, with these rules:
- Fold our BPM ÷ Spotify's into [0.5, 2]. Within 2% of 1 is agreement, labelled half/double if folding was needed. Within 2% of 3/2 or 2/3 is a metre ambiguity, so audition that song. Anything else gets flagged.
- Relative, fifth-related or parallel keys count as a soft key disagreement.
- Ignore Spotify's time_signature and compute our own LUFS.
- Keep the Hugging Face-derived values internal, since some mirrors are CC-BY-NC, and don't redistribute them.

Full notes are in `research_notes/Bingo DJ mixer research/spotify_datasets.md`.

**Stems and stretching come later.** facebookresearch/demucs is archived. Défossez's fork released **Demucs 4.1.0** on 2026-07-11 with weights on Hugging Face, although he is "not actively working on Demucs anymore" ([GitHub](https://github.com/adefossez/demucs)). It runs at about 1.5× the track's duration on CPU. On MPS it has dtype problems that need `PYTORCH_ENABLE_MPS_FALLBACK=1` ([issue #432](https://github.com/facebookresearch/demucs/issues/432)), and an M1 Max did a 133 s track in about 10 s ([report](https://github.com/0xShug0/audio.cpp/issues/785)). demucs-mlx is faster still ([PyPI](https://pypi.org/project/demucs-mlx/1.4.11/)). For exposed vocals, RoFormer models in audio-separator reach 12.9 dB vocal SDR against 10.8 for htdemucs_ft ([README](https://github.com/nomadkaraoke/python-audio-separator)).

**Rubber Band 4.0's R3 engine** (`-3`/`--fine`, a Homebrew arm64 bottle, GPL) gives "substantially higher-quality output", especially for vocals and bass-heavy mixes, but costs more CPU ([class reference](https://breakfastquay.com/rubberband/code-doc/classRubberBand_1_1RubberBandStretcher.html); [Homebrew](https://formulae.brew.sh/formula/rubberband)). One trap: unknown options are silently ignored, so an old library quietly falls back to R2. pyrubberband 0.4.0 wraps the CLI through files and offers `timemap_stretch` ([GitHub](https://github.com/bmcfee/pyrubberband)). Signalsmith Stretch (MIT) "sounds best for more modest changes (between 0.75x and 1.5x)" ([GitHub](https://github.com/Signalsmith-Audio/signalsmith-stretch)). pedalboard (GPL-3) covers offline filters, delay, reverb and Rubber Band in Python ([GitHub](https://github.com/spotify/pedalboard)).

None of these is needed for the first milestones, because FX-bridge transitions don't stretch anything.

## Chrome's Web Audio is enough because the queue is known

**Browser Web Audio covers everything except high-quality live time-stretching**, and the known queue makes live stretching unnecessary. The core facts about scheduling:

- `AudioBufferSourceNode.start(when, offset, duration)` schedules sample-timed playback on the audio clock, with the offset measured in the buffer's natural sample rate ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start)).
- Audio events "will still happen at exactly the times they were told to happen" even when the main thread stalls. The recommended pattern is a lookahead scheduler: a timer of about 25 ms scheduling about 100 ms ahead, with visuals driven from the audio clock rather than rAF timestamps ([web.dev](https://web.dev/articles/audio-scheduling)).
- `playbackRate` is a k-rate varispeed, so tempo and pitch change together ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/playbackRate)). That is fine for nudges of ±3% (about half a semitone) and for brakes.
- Gain, filter and delay automation all run on the audio clock, so a whole transition can be scheduled seconds ahead and immune to UI jank.

**The browser's limits have known workarounds:**

| Limit | What happens | Workaround |
|---|---|---|
| Memory | Decoded audio is float32: 48 kHz stereo costs 384 kB/s, about 92 MB for a 4-minute song and over 6 GB for all 77. Developers report float32 storage "maxing out" memory ([WebAudio v2 #11](https://github.com/WebAudio/web-audio-api-v2/issues/11)) | Keep a sliding window: previous, current, next and next+1 (about 370 MB) |
| Autoplay | The context needs a user gesture ([TelemetryTV](https://docs.telemetrytv.com/docs/googles-autoplay-policy)) | A "Start show" click, or Chrome's `--autoplay-policy=no-user-gesture-required` flag ([chrome-autoplay](https://github.com/Hugo22O/chrome-autoplay)) |
| Timer throttling | Background tabs are throttled, but audible tabs are exempt ([Chrome](https://developer.chrome.com/blog/background_tabs)) | Keep the engine page audible |
| Visual latency | Output latency is not compensated for visuals. Built-in Mac output measures 15–25 ms, AirPods about 178 ms ([jamieonkeys](https://www.jamieonkeys.dev/posts/web-audio-api-output-latency/)) | `getOutputTimestamp()` and `outputLatency`, available in Chrome, Firefox and Safari 18.4+ ([caniuse](https://caniuse.com/mdn-api_audiocontext_outputlatency)). Chrome's timestamps were once reported "bouncing around", so smooth them ([issue #2461](https://github.com/WebAudio/web-audio-api/issues/2461)) |
| Live stretch quality | Native nodes only offer varispeed | Signalsmith's official MIT WASM/AudioWorklet build if ever needed ([npm](https://www.npmjs.com/package/signalsmith-stretch)) |

Tone.js is optional. Its single global Transport fits two decks at different tempos poorly, and its main draw is `Draw.schedule` for audio-timed visuals ([wiki](https://github.com/Tonejs/Tone.js/wiki/Performance)).

**Native engines buy isolation, not capability.**

- **Swift with AVAudioEngine** gives sample-accurate starts across players via `play(at:)` with `sampleTime` ([Apple forums](https://developer.apple.com/forums/thread/14138)). Its TimePitch unit, however, shows artifacts at 1.1–1.15× ([Apple forums](https://developer.apple.com/forums/thread/769240)).
- **Rust** offers cpal 0.18, which now folds device latency into its CoreAudio timestamps ([docs.rs](https://docs.rs/crate/cpal/latest)), plus kira 0.12's clocks and tweens ([docs.rs](https://docs.rs/kira/latest/kira/)). Rust isn't installed on this Mac.
- **[node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api)** runs the same Web Audio code natively in Node, which makes it the cheapest fallback. It has an open AudioWorklet CPU bug ([#202](https://github.com/ircam-ismm/node-web-audio-api/issues/202)).
- **Tauri** uses WebKit on macOS, with reported Web Audio problems ([stemdeck #38](https://github.com/stemdeckapp/stemdeck/issues/38); [bandmate #1218](https://github.com/xKirtle/bandmate/issues/1218)). Electron or plain Chrome is safer, and Electron needs `appendSwitch('autoplay-policy', …)` ([electron #14323](https://github.com/electron/electron/issues/14323)).
- **Existing DJ software makes a poor engine.** AbletonOSC exposes launch quantization and a beat listener, but it needs Live 11+ and gives no timestamped landing feedback ([AbletonOSC](https://github.com/ideoforms/AbletonOSC)). Mixxx stable has no official OSC ([Mixxx forum](https://mixxx.discourse.group/t/osc-control-of-mixxx/32106)). VirtualDJ's OSC needs a PRO license ([options](https://virtualdj.com/manuals/virtualdj/appendix/optionslist.html)).

**Pre-render versus live.** One note proposes pre-rendering all 76 transitions offline with pedalboard. That sounds safe, but "Next" at an arbitrary moment, Back, and phase changes all invalidate the renders. The better hybrid keeps every effect live and sample-scheduled on cheap native nodes, and uses offline Rubber Band R3 only for the optional stretched "heads" of incoming songs in tempo-matched pairs ([Rubber Band](https://breakfastquay.com/rubberband/)). The same split of real-time Signalsmith plus offline R3 appears in a browser DAW ([ACE-Step-DAW #1667](https://github.com/ace-step/ACE-Step-DAW/issues/1667)).

**Sync the drum to sound, not to frames.** If the engine and the drum share one page, they share one clock. The drum computes its trajectory backward from the known landing time and renders it at the audible context time. Network latency stops mattering for remote screens, because events are announced 5–11 s ahead; only the clock offset does, and a ping-pong estimate such as the one in `timesync` handles it ([npm](https://www.npmjs.com/package/timesync)). The PA feed must be wired. AirPlay buffers about 2 s ([Rogue Amoeba](https://rogueamoeba.com/support/knowledgebase/?showArticle=Airfoil-AudioLatency)) and Bluetooth AAC adds 120–200 ms ([tonal.fm](https://www.tonal.fm/bluetooth-latency-test)), and either would visibly separate the wheel from the beat. Between the admin UI and the engine, WebSocket with JSON is the natural transport. An https page cannot open `ws://` to a LAN device, so serve the POC over plain http on the LAN ([ricochet PR #3](https://github.com/MohamedFekryyy/ricochet/pull/3)).

## Procedural effects first, AI assets optional, rights checked

**Synthesize the tempo-exact layers, then use samples for sweetening.** A riser is white noise through a band-pass whose cutoff and gain ramp exponentially; guides give 200 Hz→8–12 kHz and −24→−3 dB ([BeatmakingTools](https://beatmakingtools.com/how-to/how-to-create-buildups); [Tunary](https://tunaryinstruments.com/guides/how-to-make-a-riser/)). A snare is a 200 Hz triangle body with a 50 ms decay plus band-passed noise at 1.5 kHz with a 180 ms decay ([DEV](https://dev.to/sendotltd/sample-free-drum-synthesis-in-web-audio-building-kick-snare-and-hi-hat-from-oscillators-in-60-2c0k)). `OfflineAudioContext` and `Tone.Offline` render faster than real time ([Tone.js](https://tonejs.github.io/docs/15.0.4/functions/Offline.html); [MDN](https://developer.mozilla.org/docs/Web/API/OfflineAudioContext)). That means every riser and roll can be generated at the exact bar count and BPM of each landing, and the same graph code can render whole transitions for automated tests.

The repo's own sound effects cover impacts and stingers: boom and orchestra-hit at the landing, horn for late hype, metal-gear-alert as a "one away" alarm, and fear-melody under a final spin. Free libraries add more. [Freesound](https://freesound.org/help/faq/) has CC0 sounds (filter by license). The [Pixabay license](https://pixabay.com/service/license-summary/) allows free commercial use without attribution. The [Sonniss GDC bundles](https://gdc.sonniss.com/) are royalty-free and need no attribution.

**Generative AI is optional polish, not engine material.**

- **Suno** has no public self-serve API. It only opened an early-access form for "a curated group of partners" ([MBW](https://www.musicbusinessworldwide.com/suno-explores-developer-api-seeking-apps-that-unlock-experiences-generative-music-makes-possible-for-the-first-time/)), and unofficial wrappers such as [gcui-art/suno-api](https://github.com/gcui-art/suno-api) drive your own account with a cookie. Pro costs $10/month and includes **20 commercial downloads a month** ([pricing](https://suno.com/pricing)). The "Sounds" mode makes loops at a chosen key and BPM ([release notes](https://suno.com/release-notes)). UMG and Sony are still suing ([AI Lawsuit Tracker](https://ailawsuittracker.com/cases/umg-v-suno/)). Suno is at most a hand-made jingle tool.
- **ElevenLabs** is the most practical API. Its sound-effects endpoint makes 0.5–30 s clips with exact `duration_seconds` and seamless loops on v2 ([API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert); [SFX v3](https://elevenlabs.io/blog/sfx-v3-for-developers)) for $0.12 per minute ([pricing](https://elevenlabs.io/pricing/api)). Eleven Music takes composition plans with enforced section durations ([Compose](https://elevenlabs.io/docs/api-reference/music/compose)). The v3 and v4 TTS models support **Catalan** ([models](https://elevenlabs.io/docs/overview/models)), which suits an announcer voice for drops such as "Següent cançó!" or "Últimes cançons!".
- **Stable Audio 3.0** Small SFX has open weights, is trained on licensed data, and comes with "you own your outputs" under the Community License ([Stability](https://stability.ai/news-updates/meet-stable-audio-3-the-model-family-built-for-artistic-experimentation-with-open-weight-models)).
- **Live AI bridges** such as Lyria RealTime ([docs](https://aistudio.google.com/docs/realtime-music-generation)) or Magenta RealTime 2 ([HF](https://huggingface.co/google/magenta-realtime-2)) are experimental. MusicGen's weights are non-commercial ([README](https://github.com/aime-labs/MusicGen)). True A→B generative bridges such as JenBridge are research only ([arXiv](https://arxiv.org/html/2606.01703)), and they would mean feeding copyrighted songs to a generator.

**Licensing flags, briefly:**

- **Model weights.** madmom's models ([license](https://github.com/CPJKU/madmom/blob/main/LICENSE)), the all-in-one-infer checkpoints and the essentia models are **CC BY-NC-SA**. That matters only if the bingo is a commercial event. Beat This! (MIT weights) avoids the issue.
- **GPL tools.** Rubber Band (GPL-2+) and pedalboard (GPL-3) are fine for a private tool that is never distributed.
- **Spanish performance rights.** Public performance of recorded songs in Spain needs both an **SGAE** license (authors) and **AGEDI/AIE** ("Somos Música", producers and performers), and paying one does not exempt the other ([SGAE tariffs 2026](https://documentos-sgae.s3.eu-west-1.amazonaws.com/2026+SGAE+Libro+de+Tarifas+V1.pdf); [Somos Música](https://somos-musica.es/); [FuturaTickets](https://futuratickets.com/en/blog/sgae-agedi-aie-eventos-musicales)).
- **Remix rights.** Making and exploiting a remix or mashup touches the separate transformation right in **LPI art. 21** ([Iberley](https://www.iberley.es/legislacion/articulo-21-ley-propiedad-intelectual); [Confilegal](https://confilegal.com/20250811-opinion-remix-mashup-y-derecho-de-autor-el-uso-transformador-en-la-jurisprudencia/)). Live effects layered over the original recordings are commonly treated as performance, while recording or distributing a mix, or generating AI bridges from the songs, carries more risk.

This is not legal advice. Confirm whether the venue already holds both licenses.

## Build brief for the POC

This section is the builder's checklist. Times are in AudioContext seconds unless marked `Ms` (epoch milliseconds). A is the outgoing (current) song, B the incoming (next) one, and T the moment B's hook downbeat sounds, which is also when the drum locks.

### B1. Architecture: one show page owns audio and drum, and the admin talks over WebSocket

```
┌──────────────────────────── show Mac (M1 Pro) ─────────────────────────────┐
│ Chrome window on the projector: /show  (engine + drum in ONE page)         │
│   AudioContext 48 kHz → decks A/B + FX + synth + drum ticks → wired out → PA │
│   planner.js (pure) → plan{events[], wheel{}} → scheduler.js (start/ramps)   │
│   drum: solver.js → trajectory replayed on the audible audio clock          │
│        ▲ WebSocket /ws                                                    │
│ relay/server.mjs (Node 26 + ws): static files + WS hub, no game logic       │
│        ▼ WebSocket /ws                                                    │
│ /admin page: another window, a tablet or a phone on the LAN (plain http)    │
└───────────────────────────────────────────────────────────────────────────┘
Offline, before the show: analysis/ (uv, Python 3.13) → data/analysis/<id>.json + cache/<id>/mix.flac
```

**Primary architecture.**

- **Show page.** Chrome runs the engine and the drum in a single page, launched as `open -na "Google Chrome" --args --user-data-dir=/tmp/quina-show --autoplay-policy=no-user-gesture-required --kiosk http://localhost:5174/show/`, or with a "Start show" click instead of the flag. Sharing one page gives exact audio–visual sync with no clock protocol. Reloading the admin page never stops the music.
- **Engine.** It owns the playback state: queue, position, phase and current transition. The relay stays dumb.
- **Relay.** It serves `engine/`, `admin/`, the FLAC files, the covers, the effects and the analysis JSON, and it broadcasts WebSocket messages between roles. Deno with `Deno.upgradeWebSocket` is a zero-dependency alternative, but Node matches the main app.

**Fallback A (reliability or isolation).** Move `audio/` and `plan/` into a native process and keep the same protocol and planner. The cheapest port is Node with node-web-audio-api, reusing the engine modules almost verbatim. Validate MP3/FLAC decoding and issue #202 first. The most robust option on a Mac is Swift with AVAudioEngine, scheduling `AVAudioPlayerNode` by `sampleTime`. In both cases the show page becomes a pure drum client: it receives `spinStartAtMs`, `landAtMs` and the target card, runs the same solver, and converts times with a ping-pong clock offset.

Switch to Fallback A only if the soak test (M6) shows glitches or the show page proves fragile. Ableton Live with AbletonOSC is a last-resort fallback for effects, not recommended, because it cannot report exact landing times.

### B2. Folder layout under `experiments/mixer-poc/`

```
experiments/mixer-poc/
├── .gitignore              # already ignores reference/; add cache/, node_modules/, analysis/.venv/
├── package.json            # {"type":"module"}; dependency: ws; scripts: start (relay), test (node --test tests/)
├── analysis/               # Python 3.13 venv via uv; requirements.txt pinned
│   ├── analyze.py          # CLI: all songs or --song N; idempotent, cached by sha256 of the MP3
│   ├── steps/              # decode.py beats.py tempo.py hooks.py loudness.py energy.py key.py stems.py stretch.py
│   ├── validate.py         # writes data/report.md, prints flags, exits non-zero on hard errors
│   └── overrides/<id>.json # hand fixes merged last (bpm, downbeat shift, hook nudges, disable hook)
├── data/
│   ├── analysis/<id>.json  # committed (small)
│   ├── analysis/index.json # per-song summary the engine loads at boot
│   ├── spotify_features.json # ALREADY PRESENT: Spotify tempo/key/energy for 68/77 songs (cross-check only)
│   └── report.md           # validation report
├── cache/                  # gitignored: <id>/mix.flac, <id>/stems/*.flac, renders/
├── engine/                 # show page: plain ES modules, no build step
│   ├── show.html  audition.html  test.html
│   ├── css/drum.css        # drum and card parts of shuffle-test/styles.css
│   └── js/
│       ├── main.js         # boot, unlock, command handling, state machine, auto-next
│       ├── clock.js        # audible context time, ctx↔epoch conversion, displayOffsetMs
│       ├── audio/          # graph.js deck.js scheduler.js loader.js (sliding-window decode)
│       ├── audio/fx/       # echo.js reverb.js filters.js loopRoll.js brake.js
│       ├── audio/synth/    # noise.js riser.js snare.js impact.js drone.js
│       ├── plan/           # planner.js recipes.js phases.js compat.js hooks.js (pure, no Web Audio)
│       ├── wheel/          # physics.js (from shuffle-test) solver.js replay.js drum.js cards.js tickSound.js
│       └── net/bus.js      # same message shapes in-page (M1) and over WebSocket (M3)
├── admin/                  # index.html admin.js admin.css
├── relay/server.mjs
└── tests/                  # planner.test.js solver.test.js recipes.test.js (node --test)
```

Static routes for the relay:

| Route | Serves |
|---|---|
| `/show/` | `engine/` |
| `/admin/` | `admin/` |
| `/audio/<id>.flac` | `cache/<id>/mix.flac` |
| `/covers/<id>.jpg` | `client/public/images/covers/` |
| `/fx/<name>.mp3` | `client/public/audios/fx/` |
| `/analysis/*` | `data/analysis/` |

Add a WebSocket on `/ws`.

### B3. Offline analysis: install order on this Mac and the pipeline

Verify the installs in this order; each step de-risks the next. The command lines follow each tool's docs as reported in the notes, so check the flags against `--help` before relying on them.

```sh
# 0. Already installed: confirm versions
ffmpeg -version | head -1; ffprobe -version | head -1
/opt/homebrew/bin/python3.13 --version; uv --version; node --version

# 1. Venv on Homebrew Python 3.13 (never /usr/bin/python3, which is 3.9.6)
cd experiments/mixer-poc/analysis
uv venv --python /opt/homebrew/bin/python3.13 .venv
uv pip install --python .venv/bin/python numpy scipy soundfile "librosa==1.0.1" pyloudnorm

# 2. Decode one song: keep 48 kHz, drop the cover-art video stream
mkdir -p ../cache/1
ffmpeg -v error -i ../../../client/public/audios/song/1.mp3 -map 0:a -c:a flac -sample_fmt s16 ../cache/1/mix.flac

# 3. torch + Beat This! (biggest risk: large wheels, checkpoint download on first use)
uv pip install --python .venv/bin/python beat-this
.venv/bin/python -c "import torch; print(torch.__version__, torch.backends.mps.is_available())"
.venv/bin/python - <<'PY'
from beat_this.inference import File2Beats          # API as shown in the beat_this README
f2b = File2Beats(checkpoint_path="final0", device="cpu", dbn=False)   # then try device="mps"
beats, downbeats = f2b("../cache/1/mix.flac")
print(len(beats), len(downbeats), beats[:4], downbeats[:2])
PY

# 4. Key (milestone M4): arm64 cp313 wheel exists for this build (macOS 15+)
uv pip install --python .venv/bin/python "essentia==2.1b6.dev1389"
.venv/bin/python -c "import essentia.standard as es; print(es.KeyExtractor)"

# 5. Stretch (M4, optional): R3 engine is -3 / --fine
brew install rubberband && rubberband --help | head -5

# 6. Stems (M5): try MPS, then CPU, then demucs-mlx
uv pip install --python .venv/bin/python "demucs==4.1.0"
PYTORCH_ENABLE_MPS_FALLBACK=1 .venv/bin/demucs -n htdemucs -d mps -o ../cache/stems ../cache/1/mix.flac
```

| Step | Tool | Output | Notes |
|---|---|---|---|
| 1. Decode | ffmpeg `-map 0:a`, FLAC 16-bit, 48 kHz kept | `cache/<id>/mix.flac` | Both analysis and playback use this file, which removes the 20–40 ms decoder offsets. About 25 MB per song, about 2 GB in total |
| 2. Beats and downbeats | beat-this 1.1.0 `final0`, no DBN | `beats[]`, `downbeats[]`, `beatsPerBar` | About 15 min CPU for all 77 songs (third-party speed figure). Compute `beatsPerBar` from beats per downbeat and don't assume 4/4, since a Christmas waltz must land on its own bar |
| 3. Tempo | Median inter-beat interval; librosa cross-check; Spotify's tempo from `data/spotify_features.json` (`songs[id].features.tempo`) | `tempo{}` with `estimates.spotify`, plus flags | Flag half/double disagreements and bar-length spread above 3% (unstable tempo, live drums). Apply the folding rule from the analysis-toolchain section: a 3/2 ratio is a metre ambiguity and goes first in the audition queue |
| 4. Hooks | songs.json `timestamps[]` | `hooks[]` | Snap each `time` to the nearest downbeat, record `snapDeltaSec`, and set `pickupSec = max(0, downbeat − time)` when the tag sits before the downbeat. Flag a snap over half a beat, a hook later than duration − 8 s, and a duration mismatch over 1 s against songs.json (the 17 songs above). Disable song 70's 204 s hook |
| 5. Loudness | pyloudnorm integrated LUFS; ffmpeg `ebur128=peak=true` for true peak | `gainToTargetDb` | Target −14 LUFS is a choice, not a standard. Run on `fx/*.mp3` too |
| 6. Energy | librosa RMS and onset strength per bar | `energy{}` | Used for "into a ballad" detection and exit costs |
| 7. Key (M4) | essentia KeyExtractor `edma` and `bgate`; librosa chroma Krumhansl-Schmuckler fallback | `key{}` with an agreement flag | Only gates blends (R3) |
| 8. Stems (M5) | Demucs 4.1.0 htdemucs | stems as FLAC, `vocals.barActivity[]` | Enables R8 and vocal-aware exits |
| 9. Validate | validate.py | `data/report.md` | Lists every flag, then use the audition page |

The **audition page** (`engine/audition.html?song=N`) is the most valuable tool in milestone M0. It plays the FLAC with synthesized clicks on beats, accents downbeats, and rings a bell every 4 bars counted from the selected hook. It has buttons to jump to 4 bars before each hook. Listening for 30 s per song is how grid errors get caught, and Bittner found them to be the top cause of bad transitions. Use it first on the 17 songs whose durations don't match and on every flagged song.

### B4. Per-song analysis JSON (schema v1)

All times are seconds on the `mix.flac` timeline, which is identical to the MP3 timeline only if the decoders agree. That is why playback uses the FLAC.

```json
{
  "schemaVersion": 1,
  "songId": 1,
  "title": "All I Want for Christmas Is You",
  "artist": "Mariah Carey",
  "source": { "mp3": "client/public/audios/song/1.mp3", "pcm": "cache/1/mix.flac",
              "sampleRate": 48000, "durationSec": 241.2, "sha256": "…",
              "metadataDurationSec": 241.0, "decoder": "ffmpeg 9.0.2" },
  "tempo": { "bpm": 150.1, "beatsPerBar": 4, "barSecMedian": 1.599, "barSecIqrPct": 0.8,
             "isStable": true, "estimates": { "beatThisIbiMedian": 150.1, "librosa": 150.0 } },
  "beats": [0.512, 0.912],
  "downbeats": [0.512, 2.111],
  "hooks": [
    { "id": "1-best-0", "tag": "best", "tagTimeSec": 53.24, "downbeatSec": 53.30, "downbeatIndex": 33,
      "snapDeltaSec": 0.06, "pickupSec": 0.0, "barSecLocal": 1.598, "legacyLeadSec": 3.5,
      "energyDb": -11.2, "valid": true, "issues": [] }
  ],
  "loudness": { "integratedLufs": -9.1, "truePeakDbtp": 0.4, "targetLufs": -14, "gainToTargetDb": -4.9 },
  "energy": { "barRmsDb": [-24.1, -18.3], "barOnset": [0.21, 0.44] },
  "key": null,
  "vocals": null,
  "stems": null,
  "flags": ["duration_mismatch"],
  "analysis": { "createdAt": "2026-11-24T10:00:00Z",
                "toolVersions": { "beat_this": "1.1.0", "librosa": "1.0.1", "pyloudnorm": "0.2.0" } }
}
```

- **`barSecLocal`** is the median downbeat interval over the 8 bars before the hook. Bridges use it.
- **`legacyLeadSec`** is the old `durationSeconds` or `fadeInSeconds`. It hints at the longest pre-roll the tagger was happy with.
- **`key`**, **`vocals`** and **`stems`** fill in at milestones M4 and M5. For example, key becomes `{"camelot":"8A","tonic":"A","mode":"minor","confidence":0.7,"agreement":"exact","estimates":{…}}` and vocals becomes `{"barActivity":[0,0.8,…]}`.
- **`index.json`** holds one row per song: id, title, artist, bpm, beatsPerBar, key, gainToTargetDb, flags, and hooks as id, tag and downbeatSec. The planner can then judge compatibility without loading every file.
- **Overrides** in `analysis/overrides/<id>.json` are merged last, so re-running the analysis never wipes hand fixes. This follows the analysis notes' advice to keep tool estimates and manual overrides separate.

### B5. The transition planner: from a "next" press to T

The planner is a **pure function**. It takes analysis data, deck state, the phase and recent history, and returns a plan: a list of timed events plus the drum target. Only `scheduler.js` touches Web Audio. Pure planning makes the timing testable in Node and renderable in an `OfflineAudioContext`.

**Two conductors.** Before A exits, A's real downbeats are the clock. After A exits, **B's timeline is the clock**, positioned so that B's hook downbeat equals T even while B is still silent. Any bridge event at time t maps to B position `hook.downbeatSec − (T − t)` and can sit on B's real beats, or on B's extrapolated grid if that position falls before B's first beat. A riser, snare roll or LPF pre-roll is therefore always phase-locked to the hook without stretching anything.

**Two shapes.**

- **S1, "ride A, then land":** T is an A downbeat. A's last 1–2 bars get an exit effect, and B lands on T. Tempo may jump at T, which is a cut on the one. Recipes R1–R6 use S1, plus R3 for tempo-matched pairs.
- **S2, "exit, bridge, land":** A exits on its downbeat e, and a bridge of N bars on B's grid fills [e, T], so T = e + N·barB. Recipes R7, R8 and R10 use S2, as does the round opener, where A is null and e = spinStart.

**Phrases** are counted from the hook where A landed, which is a chorus start. A downbeat i is an 8-bar boundary when `(i − A.landedHookIndex) % 8 == 0`, and a 4-bar boundary when the remainder mod 4 is 0. If section labels are added later, use them instead.

```js
// plan/planner.js (sketch)
export function planTransition({ now, A, B, phase, history, rng, override }) {
  const spinStart = now + 0.08;                          // lookahead; the drum starts moving here
  const recipe = chooseRecipe({ A, B, phase, history, rng, override });  // B7 tables
  const hook = pickHook(B, phase, history);              // early: 'best'; later: best/main, avoid repeats
  const barB = hook.barSecLocal;
  const cands = [];

  if (recipe.shape === 'S1') {
    for (const d of A.downbeatsBetween(spinStart + phase.dMin, spinStart + phase.dMax)) {
      const T = d.ctxTime;
      if (T - recipe.aLeadSec(A, d) < spinStart + 0.02) continue;    // the exit effect must start after the press
      if (A.posAt(T) > A.durationSec - 0.25) continue;
      cands.push({ T, exit: T, d, cost: cost({ T, spinStart, phase, phraseOf: A.phraseClass(d) }) });
    }
  } else {                                               // S2
    const exits = A ? A.downbeatsBetween(spinStart + recipe.aLeadSecMax, spinStart + phase.dMax)
                    : [{ ctxTime: spinStart, index: null }];
    for (const e of exits) for (const n of recipe.bridgeBars(phase)) {
      const T = e.ctxTime + n * barB;
      if (T - spinStart < phase.dMin || T - spinStart > phase.dMax) continue;
      cands.push({ T, exit: e.ctxTime, e, n, cost: cost({ T, spinStart, phase, phraseOf: A?.phraseClass(e) }) });
    }
  }
  if (!cands.length) return planFallback(...);           // relax to beat boundaries, then use R2 with the nearest bar
  const best = argmin(cands, c => c.cost);
  return recipe.build({ A, B, hook, ...best, spinStart, phase, rng });   // → { events[], b:{startCtx, offset}, wheel{} }
}

// Cost in "seconds of drift": wD=1.0/s, phrase8=0, phrase4=1.0, plain bar=2.5;
// add wVocal=2.0 × A vocal activity at the exit (M5) and wHook=1.5 if the hook is not phrase-aligned.
```

**How B lands exactly at T.** Let `lead = clamp(max(hook.pickupSec, recipe.bPreRollBars × barB), 0, hook.downbeatSec)`. The scheduler calls `srcB.start(T − lead, hook.downbeatSec − lead)`, and `start(when, offset)` is sample-timed ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start)).

In the tempo-matched blend R3, B plays the lead-in at rate r = bpmA/bpmB. It then starts at `T − lead / r` with the same offset, and `playbackRate.setValueAtTime(1, T)`. By the time the rate snaps back, A has been cut, and the jump of at most 0.5 semitone coincides with the section change.

Two cases need special handling:

- **Pickup vocals.** If the hook has a pickup, every "silence before the hit" gap is placed before the pickup starts. If the pickup is longer than 1 beat, the gap is skipped, so the first syllable is never clipped.
- **Loudness.** A per-deck trim gain applies `gainToTargetDb`, which replaces the old `volume` field. Keep `volume` as a manual trim only if the user wants it.

**Deriving the drum's spin from T.**

- `D = T − spinStart`, with D in [5, 11] s, or as configured for the final phase.
- At `spinStart`, A's card is removed from the drum, as the shuffle-test does with drawn cards.
- `targetIndex = cards.indexOf(B.songId)` in the remaining list.
- `fromIndex` is the drum's current position.
- The solver (B9) returns a trajectory that locks on `targetIndex` at exactly D.
- The engine emits `transition.scheduled` with `spinStartAtMs` and `landAtMs`.

**Edge cases.**

- **No A** (first song, or A has ended): S2 from silence, which makes a good round opener (R10 or R7).
- **B not decoded yet:** reject with `notReady`. Prefetch keeps the next song and the one after it decoded.
- **"Next" during a transition:** reject with `busy`.
- **End of queue:** reject.
- **Hook within `lead` of the song start:** clamp `lead`.
- **Slow A (70 BPM) with long effect lead-ins:** feasibility filtering forces a later T or a shorter recipe.

### B6. Recipe catalogue with parameters

`barA`/`beatA` and `barB`/`beatB` come from the local downbeat intervals. The parameters are compressed from the cited practitioner values and are starting points to tune by ear.

| ID | Recipe | Shape, gate | A (outgoing) | Bridge [e, T] | B at T | Notes |
|---|---|---|---|---|---|---|
| R1 | Cut on the one | S1, any tempo or key | Plays to T. Mid and later phases: HPF 20→300 Hz (exponential) over the last bar. Dry gain → 0 in 10 ms at `min(T, T − pickup)` | — | Hook downbeat at T, 0 dB | Optional 1/4-beat gap before the pickup in mid phase |
| R2 | Echo-out | S1, any; default workhorse | From T − 1 barA (or T − 2 beatsA when barA > 2.5 s): echo send 0→0.35 over 1/2 beat; delay 1/2 beatA (alternative 3/4); feedback 0.40; return HPF 200 Hz→1 kHz (exponential); dry → 0 over the last beat | Echo tail only | B at T; echo return → 0 over 1 beatB | With a key clash, return HPF ≥ 1 kHz. Tail under 1 bar |
| R3 | Filter blend + bass swap | S1. Only if \|bpmB/bpmA − 1\| ≤ 3% (unfolded) and key compatible, or boost with L ≤ 1 bar | HPF 20→400 Hz (exponential) over L bars; gain → 0 over 1 beat at T | — | B from T − L bars at rate r, LPF 400 Hz, gain −12→−4 dB; at T the LPF opens instantly, rate → 1, 0 dB | L = 2 (mid) or 4 (late) bars. The LPF hides B's identity until the drum stops |
| R4 | Loop-roll exit | S1, any tempo; not on unstable grids; theatrical | Replace the last 1 bar (mid) or 2 bars (late) with slices of A's downbeat at the roll start: [1-beat slices for 4 beats (2-bar version only)], [1/2 ×2], [1/4 ×4], [1/8 ×8], [1/16 for 1/2 beat], [gap 1/2 beat]; HPF 20→600 Hz; gain 0→−3 dB; 3 ms fades per slice | — | B at T | One `AudioBufferSourceNode.start(when, offset, dur)` per slice. Changing loop points live is not time-stamped |
| R5 | Brake (spinback variant) | S1, any; theatrical, ≤1 in 10 | playbackRate linear 1→0 over 0.75 s, ending 1/4–1/2 beatB before T; LPF 20 kHz→1 kHz; gain → 0 in the last 0.1 s | Short gap | B at T | Spinback: a reversed copy of A's last 1.5 s with rate 3→0 over 1 s |
| R6 | Reverb wash | S1, any; preferred into ballads | From T − 1 barA: reverb send 0→0.6; dry → 0 by T − 1 beatA; return HPF 400 Hz | Reverb tail | B at T; tail → 0 over 2 beatsB | Impulse response: stereo noise with an exponential decay of RT60 2 s (4 s for a "freeze") |
| R7 | Riser + snare-roll build | S2, any tempo or key | Exit at e via a compressed R2 (echo from e − 1 beatA, dry out at e) or R5 | N bars on B's grid: noise riser band-pass 1→10 kHz (exponential), −24→−6 dB; snare roll in 4 stages of N/4 bars at 1/4, 1/8, 1/16, 1/32 notes; velocity 55→120; snare pitch 0→+3/+7/+12 st (mid/late/final); snare HPF 150 Hz→1.5 kHz; optional B pre-roll through LPF 400 Hz at −12 dB; bus HPF →300 Hz in the last bar | Phase gap, impact at T − 30 ms, every filter reset, B at 0 dB | N = 2 (mid), 4 (late), 4–8 (final). The drum's ticks become part of the build |
| R8 | Stem tease | S2, needs stems (M5) | As R7 | B's drums (or drums and bass) stem for the last 2–4 bars, LPF opening | Full B mix at T | Mosaikbox-style: never two lead vocals |
| R9 | A cappella bridge | Deferred | — | — | — | Needs stems, matched key and matched tempo |
| R10 | Power-down suspense | S2, final phase and round opener, once per round | Tape-stop brake over 1.5 s at e | 1/2–1 barB of near-silence carried by drum ticks and a soft heartbeat (sub kick on B's beats at −18 dB), then the last 1–2 bars of R7 | Layered impact (boom + orchestra-hit) at T − 30 ms, B at T | Idea: time a "fake drop" to a drum teeter (the physics sometimes nearly stops on the neighboring card) |

**Web Audio graph per deck:** source → trim gain → HPF → LPF → deck gain → master, with post-fader sends to echo (DelayNode in a feedback loop through GainNode and BiquadFilter) and reverb (ConvolverNode). The master runs a DynamicsCompressorNode as a safety limiter; start around threshold −6 dB, ratio 20, attack 3 ms, release 200 ms, and tune by ear.

Standard AudioParam rules apply:

- Anchor every ramp with `setValueAtTime` at its start.
- `exponentialRampToValueAtTime` cannot reach 0, so ramp to 0.0001.
- Use `cancelScheduledValues` when a plan is cancelled.

### B7. Game-phase rules and compatibility gates

`songsUntilWinner` is the number of queue positions until the first card completes the winning pattern. The server can compute it exactly from the cards and the pre-shuffled queue (GameInsightsSection already charts this progress). In the POC, the admin enters the number at round start and the engine decrements it on each landing. The thresholds are configuration values.

| Phase | songsUntilWinner | D window (target) | Recipe weights | S2 bridge bars | Silence before the hit | Sound-effects layer | Clip, landing to landing |
|---|---|---|---|---|---|---|---|
| early | > 8 | 5–7 s (5.5 s) | R7(1–2, compact) .30, R4 .20, R5/spinback .15, R2 + HPF sweep + riser .20, R6 .15 (preferred into ballads). Never a bare R1/R2 | 1–2 | 1/4 beat | Riser or reverse cymbal into every landing; impact at T − 30 ms; whoosh at spin start | ≈12 s, rounded to a 4-bar phrase of B |
| mid | 4–8 | 6–9 s (7 s) | R7(2) .35, R4→R7 .20, R5/spinback .15, R3 .15 if matched, R6 .15 | 2 | 1/4–1/2 beat | As early, plus a layered impact (boom + hit) | ≈20 s |
| late | 2–3 | 8–11 s (9.5 s) | R7(4) with B LPF pre-roll .45, R4→R7 .20, R8 .20 if stems, R3 .15 if matched | 4 | 1/2–1 beat | Riser, roll, orchestra-hit; horn on 1 in 3; drone rising 1 semitone per song (Millionaire style) | ≈30 s |
| final | 1 (the winning song) | 10–11 s (11 s; longer only if the user allows) | R10 → R7 | 4–8, as fits | 1/2–1 bar, ticks only | Full stack, optional announcer drop, metal-gear-alert when someone is one away | Hold: no auto-next |

**Auto-next** (if the user wants it) fires an internal `next` at `T_land + clipSec − dTarget`, so the next landing comes about `clipSec` after this one and the planner snaps it to a phrase. The presenter can always press next earlier or pause.

**Novelty budget:**

- Club-DJ sources ration theatrics ("once or twice an hour"). **The user overrides that**: this is a show, so effects are on every transition. The budget only fights sameness.
- Never repeat the previous recipe exactly, and never use the same effect family (brake/spinback, loop roll, riser build, wash) three times in a row.
- R10 power-down stays reserved for the final phase and the round opener.
- Don't reuse the same impact sample within 3 transitions or the same stinger within 10 songs.
- Use a seeded RNG per transition so plans are reproducible in tests.

| Gate | Rule | Effect |
|---|---|---|
| Tempo tier | Fold ρ = bpmB/bpmA by ×2 or ÷2 into [0.75, 1.5). Matched if \|ρ−1\| ≤ 3% (and unfolded for R3), near if ≤ 8%, otherwise far | R3 only when matched. Near and far use S1 cuts, echoes and washes, or S2 bridges |
| Key class (M4) | Camelot: compatible (0, ±1, relative), boost (+2, +7), clash, unknown | Clash or unknown: no tonal overlap longer than 1 beat, echo return HPF ≥ 1 kHz. Boost: R3 with L ≤ 1 bar |
| Into a ballad | B's hook energy at least 4 dB below A's exit energy (after normalization) | Prefer R6 or R2; no riser or impact |
| Unstable grid | `tempo.isStable == false` or downbeat irregularities near the exit | No R3 or R4; prefer R1, R2, R6, R7 |
| Vocal exit (M5) | A's vocal activity at the exit is above 0.5 | Cost +2.0. DJustify's "cut mid-line" rule |

### B8. Engine ↔ UI message protocol (JSON over WebSocket)

The rules:

- Commands express intent; the engine decides timing.
- Every scheduled event carries absolute epoch milliseconds, computed as `performance.timeOrigin + performance.now()` at the moment the sound is audible.
- Commands carry a `reqId` so they are idempotent.
- On connect or reconnect, the engine sends a full `state` snapshot.
- Clients compute countdowns locally, so the engine doesn't stream beats.

```jsonc
// client → relay on connect
{ "type": "hello", "role": "admin" | "show" | "screen", "clientId": "a1" }

// admin → engine (intent only)
{ "type": "cmd", "cmd": "next",        "reqId": "r17" }
{ "type": "cmd", "cmd": "back",        "reqId": "r18" }
{ "type": "cmd", "cmd": "togglePause", "reqId": "r19" }   // also "play" / "pause"
{ "type": "cmd", "cmd": "panic",       "reqId": "r20" }   // 0.3 s master fade, stop all, drum freezes
{ "type": "cmd", "cmd": "newRound",    "reqId": "r21", "songsUntilWinner": 23 }
{ "type": "cmd", "cmd": "setGame",     "reqId": "r22", "songsUntilWinner": 3, "phaseOverride": null, "autoNext": true }
{ "type": "cmd", "cmd": "overrideNextRecipe", "reqId": "r23", "recipe": "R7" }

// engine → all
{ "type": "state", "seq": 42, "atMs": 1763900000123, "status": "playing" | "paused" | "transition" | "idle",
  "current": { "songId": 12, "hookId": "12-best-0", "posSec": 71.2, "rate": 1 },
  "next":    { "songId": 45, "decoded": true },
  "queue":   { "position": 9, "length": 77 },
  "game":    { "songsUntilWinner": 3, "phase": "late", "autoNext": true },
  "transition": null }
{ "type": "transition.scheduled", "id": "tr-9", "reqId": "r17", "from": 12, "to": 45,
  "phase": "late", "recipe": "R7", "shape": "S2",
  "pressAtMs": 1763900000150, "spinStartAtMs": 1763900000230, "exitAtMs": 1763900003410,
  "landAtMs": 1763900009730, "durationMs": 9500,
  "landing": { "hookId": "45-best-0", "bpm": 96.2, "bridgeBars": 4 },
  "wheel": { "targetSongId": 45, "cardIds": [3, 7, 45] } }
{ "type": "transition.cue",      "id": "tr-9", "atMs": 1763900009700, "what": "impact" }   // optional, for lights
{ "type": "transition.landed",   "id": "tr-9", "atMs": 1763900009730 }
{ "type": "transition.rejected", "reqId": "r24", "reason": "busy" | "notReady" | "endOfQueue" }
{ "type": "engine.health", "atMs": 1763900010000, "outputLatencyMs": 21, "baseLatencyMs": 5,
  "decodedMB": 368, "longTasks": 0 }
// remote screens on other devices only:
{ "type": "clock.ping", "t0": 1763900000000 }  →  { "type": "clock.pong", "t0": …, "t1": …, "t2": … }
```

**Pause and Back semantics.**

- **Pause** fades the master over 50 ms and then calls `ctx.suspend()`. Resume calls `ctx.resume()` and fades back in. Because the drum is driven by the audio clock, a pause during a spin freezes music, effects and wheel together, and they stay in sync. This is a design inference; verify it in M3.
- **Back** (default until the user decides) treats the previous song as B. It runs an early-phase S1 R2 transition, re-inserts that song's card, and spins the drum in reverse, with no one-lap minimum.
- **Commands during a transition** are rejected (`busy`), except `panic` and `pause`.

### B9. Reusing the shuffle-test drum: solve the physics, then replay it on the audio clock

Keep `WheelPhysics` and `Flapper` from `experiments/shuffle-test/physics.js` unchanged. Its dynamics are the right look:

- a push with a sin² envelope;
- drag with roughness wobble;
- Coulomb friction;
- a detent force `−detent·sin(2π·position)`;
- damping that only acts at low speed;
- a teeter nudge when the wheel comes to rest on a border.

What changes is that the outcome becomes a **target**, not a random result. The spec says "the winner comes from the simulation". Under the new design, the winner is decided earlier, by the server's crypto-shuffled queue, and the drum *presents* it. Two properties make solving cheap:

- The detent force has a period of exactly one card, so the motion is unchanged under whole-card shifts.
- Playing a simulated trajectory back with time scaled by s is itself a valid physical motion. It equals the same system with forces scaled by 1/s² and drag by 1/s, so a moderate s stays plausible.

```js
// wheel/solver.js (sketch); runs in well under 50 ms; can move to a Worker if needed
export function solveSpin({ cardCount, fromIndex, targetIndex, durationSec, isCalm, random = secureRandom }) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const seed = Math.floor(random() * 2 ** 32);
    const spin = drawSpin(seededRandom(seed), cardCount, isCalm);   // same ranges as WheelPhysics.launch()
    const base = mod(spin.direction * (targetIndex - fromIndex), cardCount);
    for (const laps of [1, 2, 3]) {                                    // always > 1 lap (PROMPT.md)
      const wantCards = base + laps * cardCount;
      const fit = fitTopSpeed(spin, seed, wantCards);   // bisection on topSpeed; take the middle of the
                                                        // plateau that rests on wantCards; record samples+ticks
      if (!fit) continue;
      const scale = durationSec / fit.lockTime;         // lockTime: first sample after the last border
                                                        // crossing with |x−x_final|<0.03 and |v|<0.3 cards/s
      if (scale >= 0.85 && scale <= 1.2) return { ...fit, scale, direction: spin.direction, seed };
    }
  }
  return analyticSpin({ cardCount, fromIndex, targetIndex, durationSec });  // fallback, see below
}
// replay.js: positionAt(t) = dir * interp(fit.samples, t / scale);  velocityAt(t) = v(t / scale) / scale
// tick times:  spinStartCtx + scale * tick.t   (velocity / scale feeds the click timbre)
```

The **fallback** solves the trajectory backward. With total angle Θ and duration T, constant deceleration gives ω0 = 2Θ/T and θ(t) = ω0·t − ½(ω0/T)·t². Add cosmetic detent wobble and a tiny overshoot after T. It should rarely be needed.

**Driving the drum from sound:**

- `clock.js` computes the audible context time on each animation frame: `ts = ctx.getOutputTimestamp(); audible = ts.contextTime + (performance.now() − ts.performanceTime)/1000`. Smooth it with a short linear fit. If the timestamp is missing, fall back to `ctx.currentTime − ctx.outputLatency`.
- Subtract a manually calibrated `displayOffsetMs` for projector lag.
- `drum.js` renders `positionAt(audible − spinStartCtx)` using the existing `rotateY` transform, and derives motion blur from `velocityAt`.
- The flapper is kicked as the replay passes tick times, then stepped by its spring as before.
- **Tick sounds** move from rAF timing to the audio clock. Port `sound.js`'s `playTick` into the engine's AudioContext and schedule ticks with a lookahead loop (25 ms timer, 150 ms ahead). Keep the 22 ms minimum spacing.
- At T: lock the reticle, apply the existing `.has-selection` / `.is-selected` zoom, and let the recipe's impact replace the old thunk and chime. A quiet thunk can stay in the early phase.
- Reduced motion uses the calm speed ranges.

**Cards and layout.** Cards use `/covers/<id>.jpg`, the title and the artist through the existing `createAlbumCard`. With 77 cards, `layoutDrum()`'s radius grows to about 13 card widths, so the drum reads as a long, gently curved reel. Check the look, and see the open question on how many cards to show.

**Tests.** Extend the style of `tests/physics.test.js` (seeded PRNG, `node:test`). Over 2,000 random cases (cardCount 10–77, D 5–11 s), every spin must land on the target, `scale × lockTime` must equal D to within 1 µs, scale must stay within [0.85, 1.2], travel must exceed one lap, and landing counts must be uniform across target positions. The 95th-percentile solve time in Node should be under 30 ms.

### B10. Milestones, ordered so the concept is audible and visible early

| # | Scope | Done when |
|---|---|---|
| M0 | Install checks (B3 steps 0–3). Decode all 77 songs to FLAC. Run Beat This! on all. Write JSON v1 (tempo, beats, downbeats, hooks, loudness, energy, flags), validate.py and the audition page. Relay serves static files only | `data/report.md` lists the 17 mismatched songs and song 70. Every flagged song has been auditioned, and overrides are written where needed |
| M1 | Show page: engine core (decks, master, scheduler, sliding-window loader), S1 and S2 planner, **the procedural effects layer from the start** (riser, snare roll, reverse cymbal, impact; R2 with sweep, R4, R5/spinback, R6, R7), **two speeds** (early 5.5 s target vs late 9.5 s target), the drum with solver, replay and audio-scheduled ticks, on-page Back, Play/Pause and Next with keyboard shortcuts, and an in-page bus using the protocol shapes | 20 "next" presses in a row land hooks on the drum stop with no clicks. A flash-and-click test shows the drum within one frame (≤17 ms) of the impact after `displayOffsetMs` |
| M2 | Bigger late-phase builds: drone, R10, longer R7 variants, stem-free teases. The repo's sound effects, normalized. Four phases with the `songsUntilWinner` control, novelty budget and auto-next | An `OfflineAudioContext` render test passes for every recipe. A listening session of 10 random pairs per phase is judged "OK or better" by the organizers |
| M3 | Relay WebSocket hub, admin page, full protocol, pause/back/panic semantics, reconnect snapshot | Reloading the admin page mid-song never interrupts audio. Pause during a spin resumes in sync. Back works twice in a row |
| M4 | Tempo-matched blends (R3, playbackRate) and key (essentia) with Camelot gates. Optional offline Rubber Band R3 heads for 3–8% pairs, B's first bars rendered at A's tempo with a glide back to native | No R3 is chosen outside its gates. A/B listening of R3 against R2 on the matched pairs |
| M5 | Demucs stems: R8 tease, vocal-activity exit costs, DJustify-style gates on an offline render (vocal collision, cut mid-line, energy hole > 1 beat, clipping) | Gates run on every plan in tests, with no failures on the 77×76 sample set |
| M6 | 2-hour soak on the show machine with a second display, admin reloads and background CPU load. Venue checklist. Optional ElevenLabs announcer drops and sweeteners. Notes on integrating with the React/tRPC app | Zero audible dropouts, stable memory (< 1 GB for the tab), and the drum sync re-verified on the projector |

### B11. Verification checklist

| Area | Check | Pass criterion |
|---|---|---|
| Grids | Audition clicks on downbeats for every song with a flag, and spot-check 20 others | Downbeat phase correct. Half/double tempo resolved. Overrides written |
| Hooks | Every hook lies within the file and snaps within 1/2 beat; the 17 mismatched songs are checked by ear | Song 70's hook disabled or re-tagged. No hook lands in an intro or a silent region |
| Decoder | Compare a browser-decoded MP3 against the FLAC by cross-correlating the first 30 s | Documents whether the MP3s could be served directly. The FLAC remains the default |
| Landing | In an OfflineAudioContext render of each recipe, measure B's onset at T | B's first sample is at `round((T − lead)·sr)` exactly, and the hook transient is within ±5 ms of T |
| Drum | Solver tests (B9). Flash-and-click filmed in phone slow motion | Lands on target 100% of the time; ≤ 1 frame offset on the actual projector |
| Planner | Property tests over all 77×76 pairs × random press times × 4 phases | D within the phase window; S1 T on an A downbeat; S2 `T − e = N·barB`; no event before spinStart; gates and novelty budget respected |
| Levels | Master peak and loudness per landing | Peak < −1 dBFS; hook loudness within ±1.5 LU between songs; effects never louder than the hook |
| Behavior | Spamming next; next while B is not decoded; pause, back and panic mid-spin | Correct rejections; no stuck states; panic silent within 0.3 s |
| Output | Wired output, no AirPlay or Bluetooth; `engine.health.outputLatencyMs` logged | Latency stable across the session |
| Memory | Sliding window holds 4 songs | Chrome task manager stays under about 1 GB |

### B12. Decisions where the notes disagree

| Topic | Positions in the notes | Decision |
|---|---|---|
| Tempo thresholds | Blend at ≤3% (DJ notes, Passable), ≤4% (vibesdj), ≤6% (academic tiering), comfort band 0.90–1.10 (Ishizaki) | Blend only at ≤3% unfolded (about 0.5 semitone without keylock); 3–8% no overlap; >8% cut or bridge. Vocal pop shows stretch first, and B must sound natural at the hook |
| Which song gets stretched | Split between both (Ishizaki); B only, then glide home (Passable); keep B native (academic note) | B is never altered at or after T. Only B's filtered lead-in may run at A's tempo, in R3 |
| Pre-render vs live | Pre-render all transitions (analysis note); variants per pair (projects note); live hybrid (engine note) | Live scheduling of all effects. Offline only for analysis and the optional stretched heads in M4. Next timing, Back and phase invalidate pre-renders |
| Analysis sample rate | Decode to 44.1 kHz (analysis note) | Keep the native 48 kHz. The files are 48 kHz, and Beat This! resamples internally |
| Engine | Browser primary (engine note) vs Passable-style Swift (projects note) | Browser primary; Node/node-web-audio-api or Swift as Fallback A behind the same protocol |
| Structure analysis | Use all-in-one-infer on CPU (analysis note) vs `pip install allin1` (academic note) | Skip for the POC, since hooks are hand-tagged and phrases are counted from the hook. Revisit only if exits sound wrong. allin1's NATTEN is broken on macOS |
| Key tools | keyfinder-cli plus essentia vs Krumhansl-Schmuckler chroma | essentia (wheel available) with a K-S fallback; deferred to M4 because key only gates R3 |
| Snare pitch in builds | Up +7–12 st (Plugg Supply) vs down 1–2 st (beatmakingtools) | Up, scaled by phase: +3, then +7, then +12 |
| Silence vs flow | "Avoid crossfading, leave silence" (Wasingo) vs "long pauses feel disorganised" (Boogie Bingo) | The spin is the gap: an effects bridge with ticks, never two vocals overlapping |
| Sweeper length | 4–10 s (Nobex) vs 12–15 s (LFM Audio) | Irrelevant: the drum window of 5–11 s rules |
| Effects early vs late | Bingo hosts and DJ guides favor quick, clean cuts and rationed theatrics; the user wants fancy transitions from the first song | **The user wins** (feedback 2026-11-23, after rejecting a cuts-and-echoes build). Every transition carries an effect; phases scale length, density and impact size |

### B13. Open questions for the user

| Question | Why it matters | Default if unanswered |
|---|---|---|
| What should **Back** do: replay the previous song's hook (drum spins back to it), or restart the current clip? | Changes queue state and drum content | Replay the previous song with a fast R2 and a reverse spin |
| Should the engine **auto-advance** after a phase-dependent clip length, or only on the presenter's "next"? | "Songs play fewer seconds early" implies auto-advance | Auto-advance on (≈12/20/30 s), off in the final phase; the presenter can always press next |
| Which **win pattern** defines "songs until winner" (line, two lines, full card), and should the POC compute it from the real cards or take a manual number? | Drives the phases | Manual number in the POC; the server computes it later |
| Should the drum show **all remaining songs** (up to 77), a subset of about 36, or covers only without titles? Is it fine that the result is staged (decided by the shuffled queue)? | Look of a 77-card reel; perceived honesty | All remaining songs, covers plus title and artist; staged result with a crypto-shuffled queue |
| May the **final** spin run longer than 11 s (for example 15 s)? | More bars for the biggest build | No, capped at 11 s |
| Is the event **ticketed or commercial**, and does the venue hold SGAE and AGEDI/AIE licenses? | CC BY-NC-SA weights (madmom, all-in-one, essentia models); performance rights | Use only MIT-weight analysis tools (Beat This!) and avoid NC models |
| Do you want an **announcer voice or jingle** (ElevenLabs, Catalan) or Suno-made loops? | Optional cost ($6–25) and an asset pipeline | None in the POC; leave a hook for it in M6 |
| Which hook tags should each phase use: always `best` early, and `main`/`secondary` later for variety? | Recognition vs repetition across rounds | Early `best`; later `best` or `main`, avoiding the last-used hook |
| Keep the `volume` and `playEffect` fields? | The new engine replaces both | Ignore `playEffect`; use `volume` only as a manual trim on top of LUFS gain |
| Venue setup: wired PA? A presenter screen separate from the projector? | Latency and where the admin page runs | Wired output; admin on a tablet or a second window |

## Conclusion

The part that looks hardest, making two arbitrary songs sound good together, mostly disappears once the drum is understood as a radio sweeper rather than a crossfade. The spin is a 5–11 s bridge that must resolve on a downbeat. Building it at the incoming song's tempo and phase removes beat-matching, key matching and time-stretching from the critical path, so the first milestones need nothing beyond Beat This!, ffmpeg and native Web Audio nodes. The real engineering risk sits elsewhere, in data quality and timing. Seventeen songs have lengths that disagree with their metadata, beat grids need a listen, and the drum has to stop on a chosen card at an exact audio-clock instant while still behaving like the physics the shuffle-test already gets right. Solving and replaying that physics, rather than easing it, keeps the mechanical feel the original spec cared about.

The unusual advantages of this setup go further than an auto-DJ normally can. A known queue, known cards and hand-tagged hooks mean the system can know exactly how many songs remain until a winner and stage the round accordingly. It can be terse and quick early on, then climb a semitone at a time toward the winning card with longer builds, silence before the hit and a layered impact as the drum locks. The research suggests audiences reward exactly that tension-and-release arc. It also suggests the biggest threat to the show is not one weak transition but sameness, so the novelty budget and recipe rotation deserve as much care as the DSP.
