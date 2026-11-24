# Mixer POC: land every hook as the drum stops

A proof of concept of the bingo "DJ" built from `reports/Bingo DJ mixer research.md` and, where they differ, the design decisions in [`docs/mixer-design-decisions.md`](../../docs/mixer-design-decisions.md), [`GLOSSARY.md`](../../GLOSSARY.md) and [`docs/adr/`](../../docs/adr/). Built so far:
- the analysis (M0);
- the show engine with the full effects layer (M1 + M2);
- the show state machine: Pace and auto-advance, Hold and Hold music, Back as undo, and the Phase from the cards in play;
- the tablet remote. When Next is pressed, the planner picks a landing time **T** 5–11 s ahead on one of the outgoing song's downbeats. It schedules A's exit and B's start so that B's hook downbeat sounds exactly at T, and it solves the drum's physics so the wheel locks on B's card at that same instant.

## Run it

```sh
cd experiments/mixer-poc
npm install                       # Node ≥ 23.6 (type stripping): Vite, Svelte, TypeScript, ws
npm run prep                      # prepare the default pool: covers, decode, analysis, Check snippets, report, keys, stems, Signatures
npm run dev                       # relay + Vite on http://localhost:5174, this laptop only (a manual reload picks up edits)
```

For a show, run the built pages instead: `npm run build && npm start` (the relay serves `dist/`). Add `-- --lan` so the hotspot's tablets and phones can connect. They pair with the relay token in the LAN URL the relay prints (`?t=…`, see docs/protocol.md › Relay).

The Python venvs (never `/usr/bin/python3`, it is 3.9):
- `uv venv --python /opt/homebrew/bin/python3.13 analysis/.venv && uv pip install --python analysis/.venv/bin/python -r analysis/requirements-layering.txt -r analysis/requirements-test.txt` (the analysis, keys and tests);
- `analysis/.venv-stems` for Demucs, set up as `analysis/requirements-stems.txt` says.

**Pools.** A Pool (GLOSSARY) is the song list the cards are printed from. Ids restart at 1 in every pool, so each pool keeps its own outputs. `analysis/pools/<name>.json` describes one. `default` is last year's 77 songs: test material, whose outputs stay where they always were (`data/`, `cache/`, `analysis/overrides/`). Every pool-specific script, `prepare.py` and the relay take `--pool <name|path>`; without it, `$QUINA_POOL`, then `default`. Hold music (`data/hold/`, `cache/hold/`) belongs to no pool. The manifest format, read by `analysis/pool.py` and its twin `relay/pool.ts`:

| Field | Default | What |
|---|---|---|
| `name` | required | lowercase letters, digits, `-` and `_`; the same as the file name |
| `songsJson` | required | `[{id, title, artist, cover?, timestamps?: [{time, tag}], ...}]`, as the playlist-fetcher and `server/db/default/songs.json` write it |
| `audioDir` | required | `<id>.mp3`, or spotDL's `<id> <title> - <artist>.mp3` (`.m4a`, `.opus`, `.ogg`, `.flac` and `.wav` too) |
| `coversDir` | `<cacheDir>/covers` | `<id>.jpg`, served at `/covers/<id>.jpg`; the covers step fetches them from the `cover` URLs |
| `cardsJson` | none | card-generator's `cards.json`, served at `/cards/cards.json` (its folder at `/cards/`). Without it the Phase uses its placeholder |
| `spotifyFeatures` | `<dataDir>/spotify_features.json` | optional (the Spotify API is deprecated): without the file there is no tempo or key cross-check |
| `dataDir` | `data/pools/<name>` | `analysis/`, `snippets/`, `report.md`, `keys/`, `stems/`, `signatures/` |
| `cacheDir` | `cache/pools/<name>` | `<id>/mix.flac`, `<id>/raw.json`, `<id>/snippet.flac`, `<id>/stems/`, `<id>/signatures/`, `keys/`, `stretch/` (gitignored) |
| `overridesDir` | `analysis/overrides/<name>` | the audition page's hand fixes, `<id>.json` |
| `description` | | free text |

Relative paths are relative to `experiments/mixer-poc`; absolute ones work too.

**Preparing this year's pool** once the playlist is final:
1. `cd playlist-fetcher && ./main.sh <playlist URL>` writes `output/songs.json` and `output/songs/<n> <title> - <artist>.mp3`.
2. Tag the hooks in that songs.json (`"timestamps": [{"time": 53.2, "tag": "best"}, ...]`). Ids are playlist positions, so reordering the playlist after tagging moves the tags onto other songs. An untagged song is analysed but not playable, and the report lists it (there is no automatic hook detection yet).
3. Write `analysis/pools/2026.json`: `{"name": "2026", "songsJson": "../../playlist-fetcher/output/songs.json", "audioDir": "../../playlist-fetcher/output/songs"}`, plus `cardsJson` once the cards are printed.
4. `npm run prep -- --pool 2026`. Run it again after any change: finished work is skipped, and a changed MP3 is decoded and analysed again. Options: `--steps decode,analyze,...` (covers, decode, analyze, snippets, validate, keys, stems, signatures; always run in that order), `--song N` (repeatable; validate and keys always cover the pool), `--keep-going`. It stops at the first failing step; validate fails on hard errors, and the stems disk guard (10 GB free, 4 GB of stems per pool) stops it with exit status 3.
5. `npm run dev -- --pool 2026` (or `npm start -- --pool 2026`) serves it. The pages' URLs are the same for every pool.

| Page | URL | What |
|---|---|---|
| Show | http://localhost:5174/show/ | Engine and drum in one page. Click **Start show**, then → Next |
| Audition | http://localhost:5174/show/audition.html?song=N | Beat-grid clicks, hook preview, save overrides |
| Tests | http://localhost:5174/show/test.html?run=1 | Offline landing renders, flash-and-click calibration |
| Remote | http://localhost:5174/admin/ (or `http://<LAN IP>:5174/admin/` on a tablet or phone) | Next, Back, Hold, Hold music, Pace, sound effects, Schedule, cards in play, possible winners |
| Report | http://localhost:5174/data/report.md | Analysis flags and audition queue |

For a projector without the click: `open -na "Google Chrome" --args --user-data-dir=/tmp/quina-show --autoplay-policy=no-user-gesture-required --kiosk "http://localhost:5174/show/?autostart=1"`.

**Show keys:**
- → / Enter: Next (it also releases a Suspense). ←: Back. Space: Hold / release. S: Suspense. M: Hold music. Esc: Panic.
- `+` / `−`: Pace ±1 s. L: lock the Pace. A: auto-advance on or off. 0–4: Phase (auto, early, mid, late, final).
- D: debug HUD. H: hide the controls (projector). `[` `]`: display offset ±5 ms.

**Show URL params:**
- `pace=14`: Pace in seconds.
- `cards=1-200,400-450`: cards in play. Once entered, they are kept in the page's local storage.
- `phase=late`: fixed Phase. `suw=20`: songs until a winner, used only when no cards are in play.
- `auto=0`: auto-advance off. `queue=3,17,45`: a fixed Queue. `autostart=1`.
- `fresh=1`: start a new Game instead of resuming the current one. `journal=0`: keep the Game journal in memory only (as `queue=` does).

**Resume after a reload or a crash:** the show page keeps a numbered Game journal (rounds, Queues, landings, undos, the confirmed Line, cards in play, settings) in its storage. A reload resumes the current Game where it was, and the presenters press Next. The journal is in the protocol package (`protocol/journal.ts`, explained in [`docs/protocol.md`](docs/protocol.md#game-journal)), so a cloud store or another device can replay the same journal later.

**Code:** TypeScript everywhere (strict, erasable syntax only, so Node 26 runs the relay and the tests directly), served and built by Vite; Svelte 5 for the remotes' forms (the coming `console/`). The protocol is the linked package `@quina/protocol` (`protocol/`), which imports no engine code, so remotes, the player app and a Worker can share it; [`docs/protocol.md`](docs/protocol.md) explains it. Every tunable number lives in `engine/src/config.ts`.

**Tests:** `npm test` runs the type check (`tsc` on the browser and Node code, `svelte-check`) and the Node tests: planner, solver, Pace, Phase, cards, the show state machine (Back, Hold, cancelled Spins, Pace timing, and a fuzz test that the music never stops by accident), the Check, the tie-free Shuffle on the real cards, the show flow (scene rules, a whole round from Claim to Interval, invalid Claims, Claims during a Spin, the pause, and a fuzz test of every flow command), and the journal (replay, `extendJournal` at every split, resuming into each scene). `npm run test:pipeline` (pytest, about 30 s) checks pool resolution in Python and in `relay/pool.ts`, then prepares a two-song synthetic pool in a temp dir (one song without hook tags, no Spotify features), re-runs it to check that nothing changes, and has a relay serve it.

## What is built

**M0: offline analysis** (`analysis/`, Python 3.13 + uv, Beat This! 1.1.0 `final0` on CPU, about 3 s per song)
- Every step works on one pool (see Pools above), and `prepare.py` runs them in order. The paths below are the default pool's; a new pool's are under `data/pools/<name>/`, `cache/pools/<name>/` and `analysis/overrides/<name>/`.
- `covers.py` fetches missing covers from the songs.json `cover` URLs. `decode.py` decodes each song to `cache/<id>/mix.flac` (48 kHz 16-bit FLAC, audio stream only) and records its source in `mix.json`, so a changed MP3 is decoded again.
- `snippets.py` cuts 3 s from each song's best hook (its pickup) to `cache/<id>/snippet.flac`, with a loudness trim in `data/snippets/index.json`: what a Check plays for each landed song. A few seconds for the whole pool, no stems needed.
- `analyze.py` writes `data/analysis/<id>.json` (schema v1, B4) and `index.json`. Model output is cached per MP3 sha256 in `cache/<id>/raw.json`, so `--derive-only` re-applies hook and override logic in seconds. A file whose content would not change (apart from its `createdAt`) is not rewritten.
- Beat grid: Beat This! beats get a sub-frame refinement (a local linear fit removes its 20 ms frame quantization in steady regions). Downbeats are **regularized** into consistent bars: spurious half-bar downbeats are dropped, missing ones are filled, and real phase changes are followed only when later bars support them.
- Tempo is checked against librosa and Spotify (`data/spotify_features.json`). If both put Beat This! at double time, the tempo is halved automatically (song 6, Besos: 209 → 105 BPM). A pool without Spotify features is checked against librosa only, with no automatic halving, and `keys.py` then uses the method that scored best on the default pool (`essentia-temperley`), unscored.
- Hooks: the hand tags scatter about ±2 beats around downbeats, and bar RMS can't tell neighbouring bars apart. So snapping is positional and biased toward landing early. A tag within 1.5 beats before a downbeat lands that downbeat, and B starts at the tag rounded up to a half beat (a *pickup*, so the first syllable is never clipped). Any other tag lands the downbeat before it. Mid-bar tags are flagged `snap_ambiguous`.
- Loudness: integrated LUFS and 4× true peak per song, plus LUFS over 8 s from each hook. The engine trims each landing to −14 LUFS (hook-based).
- A song without hook tags gets no hooks and the flag `no_hook_tags`, so the engine leaves it out (`playableSongs` needs a valid hook). It is not a hard error.
- `validate.py` writes `data/report.md`: the playable count, the songs without hook tags, whether Spotify features exist, the flags, an audition queue ordered by severity, and per-song levels.
- `analysis/overrides/<id>.json` holds hand fixes, merged last: `downbeatShiftBeats`, `tempoFactor`, `beatsPerBar`, `hookDownbeats`, `hookPickupBeats`, `hookNudgesSec`, `disableHooks`, `hookTimes`, `exclude`, `note`. The audition page writes these through the relay and re-derives on Save.

**M1: show engine** (`engine/src/`, TypeScript)
- `plan/planner.ts` is a pure function, tested in Node, with two shapes. **S1, "ride A, then land":** T is one of A's downbeats and A's exit move ends there. **S2, "exit, bridge, land":** A exits on its downbeat e, and a build of N bars *on B's grid* fills [e, T], so B's riser, snare roll and low-passed Tease are phase-locked to its hook without time-stretching. The Spin window comes from the Pace. Candidates are costed by distance from the target Spin length plus phrase class (8-bar = 0, 4-bar = 1, bar = 2.5, counted from the hook where A landed).
- **Every transition is a DJ move with effects**, and every landing gets a reverse-cymbal swell and an impact (a synth sub drop, plus `boom`/`orchestra-hit` from later phases on):

  | Recipe | What you hear |
  |---|---|
  | R1 Slam cut | A's high-pass and a riser climb over its last bar, a swell, then a hard cut on the one |
  | R2 Echo-out | Tempo-synced echo (½ or ¾ beat, feedback 0.5) while A's high-pass and the echo return sweep up, a riser, then the hook |
  | R4 Loop roll | A's bar stutters in shrinking slices (1 → ½ → ¼ → ⅛ → 1/16 beat) with the filter opening, a riser, then the landing |
  | R5 Brake / spinback | Tape-stop (rate → 0, low-pass closing, falling noise) or a reversed rewind of A, a breath of silence, then the hook |
  | R6 Reverb wash | A dissolves into a big high-passed reverb, and the hook comes out of the cloud |
  | R7 Build & land | A exits (echo, roll, brake, spinback or wash, rotated), then 1–4 bars of noise riser plus a snare roll accelerating ¼ → ⅛ → 1/16 → 1/32 with rising pitch, a Tease of B through a closed low-pass, the music-bus high-pass sweeping up, a beat of silence, and the landing |
  | R8 Blend | B's own groove, stretched to A's tempo by Rubber Band R3 and locked to A's downbeats, comes in under A for 2–8 bars: drums first, then (tempos within ±4% and compatible keys) B's bass while A's bass is cut. A echoes or washes out under a riser and swell, and B lands on its hook at its own tempo with an impact. Only for the 37% of pairs within ±8% tempo |
  | R10 Power-down | Final phase: 1.5 s tape-stop, a heartbeat on B's beats, the build, half a bar of silence, and the biggest layered impact |
  | D1 Trans gate | A chopped on its own grid by a gate ladder that speeds up to 1/32 (partial early, silent late), or pumped like a sidechain with kicks; its high-pass climbs under a riser |
  | D2 Stop-time hits | A only on chosen beats with silence between ("pam · pam · pam ·") for the crowd to shout, the last hit ringing, a gap of at least a beat, a bigger impact; at most one in six |
  | D3 Spiral echo-out | A's last beats caught in an echo whose delay shrinks, so the repeats climb in pitch into a swirl, cut dead before the hook |
  | D8 Stem peel | A's drums, bass and the rest removed one by one (stem lanes) until its singer is left, the voice thrown into the echo, then the full hook |
  | D10 Drum swap | A's drums replaced on a downbeat by B's stretched drums under A's voice (sometimes juggled), the bass swapped in the last bar when keys and tempos allow |
  | D11 Vocal-chop build | R7's build with B's first syllable chopped faster and higher on B's grid ("ca-ca-ca-CARAMEL"), then the full word on the pickup |

  The landing layer rotates (reverse cymbal, a dry landing, or D12's pre-verb swell of B's own first beat), R7's bridge pattern is drawn apart from its exit (roll, half-time, kick roll, clap-along; the gate and the spiral are exits too), R1, R2, R4 and R5 have variants, and D9's Ghost Tease (B's voice only through the reverb) decorates S1 moves. Details, Phase weights and what is not built: [docs/dj-techniques.md › Built](docs/dj-techniques.md#built).

- **Phases escalate the spectacle; they don't add or remove it.** Early: short 1–2 bar builds and quick moves. Mid: 2-bar builds, a ½-beat gap, and sometimes a Tease. Late: 2–4 bar builds with the low-pass Tease and a 1-beat gap, snare up to +7 semitones. Final: R10 power-down, D2's crawl, a long D8, the final gate or spiral. Rotation: the previous recipe is penalised, the same family is never used three times in a row, two theatrical moves never run back to back, and the build's exit move rotates.
- **Stem Teases.**
  - `analysis/stems.py` runs Demucs `htdemucs` on MPS, about 20 s per song. It writes drums, bass and vocals at half scale (no clipping), in windows around the hooks and the intro (`cache/<id>/stems/`, with metadata in `data/stems/<id>.json`), sample-aligned with `mix.flac`.
  - When the next song has stems around the chosen hook, and they are audible in the bars before it, the build Teases with **B's own drums, then its bass for the last bar**, at B's tempo and phase-locked to the hook. The full song bursts in on the pickup.
  - Without stems, the low-passed Tease remains. All 77 songs have stems.
- **Blend preparation.**
  - The next song's hook is chosen as soon as that song is decoded. When the pair's tempos are within ±8%, the relay renders B's 8 bars before that hook at A's tempo (`analysis/stretch.py`, Rubber Band R3, with stems, about 1–2 s, cached).
  - Keys come from `data/keys/` (essentia, Temperley profile; `analysis/keys.py`); B's bass layers only if the keys are compatible with a confidence of at least 0.7.
  - If no landing fits the blend, the planner falls back through other real moves (R7, R2, R1), never the bare fade.
- **Signatures** (GLOSSARY): short, iconic, isolated pieces of a song, layered into transitions once the user approves them.
  - `analysis/signatures.py` proposes candidates from the stems (`analysis/steps/signatures.py`) and cuts each to its own file (`cache/<id>/signatures/`, with metadata in `data/signatures/<id>.json`). There are three kinds:
    - a **call** is the vocal line that opens a hook, from its pickup to the end of its first bar;
    - a **riff** is two bars of an instrumental intro while the vocals are silent;
    - a **shout** is a short vocal burst between silences, measured against the song's own singing level.
  - The audition page lists them, with Play, In song, Approve and Reject. Decisions go into `analysis/overrides/<id>.json` (`signatures`), and only approved ones play. Last year's songs are test material, so ten songs have candidates (37 in all).
  - Placement: at most one Signature per transition, with a chance that grows with the Phase.
    - **B's call before it lands:** on B's own grid over an S2 bridge or an opener build. Over A's grid (S1, S3), only when it needs at most a 4% resample, or when it is a short shout. Its anchor sits on a downbeat after the spin-start duck, and it is faded out at B's pickup.
    - **A's own Signature thrown into the echo** as it leaves on an echo or wash exit.
- `audio/`: `AudioBufferSourceNode.start(T − lead, hook − lead)`, sample-timed. Decks run trim → HPF → LPF → fader with a post-fader echo send, into a master limiter. Songs come from FLAC (the same PCM as the analysis) with a sliding decode window (previous, current, next, next+1).
- `wheel/`: shuffle-test's `physics.js` is copied with its logic **unchanged**, only typed (`shuffle-physics.ts`). `solver.ts` draws a random spin, steers its drag toward the wanted duration, bisects the top speed until it rests on the target card, and time-scales the replay (0.85–1.2×) so it locks at exactly D. It always travels more than a lap (except Back). The drum is drawn from `AudioContext.getOutputTimestamp()`, and its ticks are scheduled on the audio clock.
- **Suspense** (`plan/suspense.ts`, GLOSSARY): the presenters hold the next transition open, and it is never started automatically.
  - A exits on its first downbeat after the duck. From there a loop runs on B's grid, at its hook's bar, without B itself. Each bar is a riser, a snare roll and heartbeat kicks, and gets more intense over about 24 s. Every bar is self-contained and scheduled 0.35 s ahead.
  - Next, or a second Suspense press, releases it: the final bar takes the next free bar line, with its build and its silence, and B's hook lands after it. It releases by itself after 30 s.
  - The drum spins, at least a lap, to a random card unrelated to the target, then wanders back and forth around it. Where it waits gives nothing away. On release it brakes onto the target exactly at the landing, turning round once if it was caught moving backwards.
  - Back or Hold cancel it like a Spin.
- **The show state machine** (`show/show.ts`) is pure: no Web Audio, no DOM. It takes commands, clock ticks and decode results, and returns effects that `main.ts` carries out on the audio graph, the drum and the network. States are `locked`, `idle`, `playing`, `transition` and `hold`.
  - **Pace:** auto-advance keeps landing to landing at the Pace (22 s in round 1, 14 s after; presets 11–30 s, ±1 s). The Spin takes about half the Pace (3–11 s), and the landed song keeps playing under it. Late phases stretch the slot by 25%, and a landing that probably completes a card stretches it by 50%. In the final phase, auto-advance is off unless the presenters keep it on.
  - **Schedule and Drift:** the round's and the game's end are estimated from the Queue position, the expected Line and Bingo songs, Check times and intervals. In early and mid, the Pace is nudged by up to ±20% to recover Drift, unless it is locked.
  - **Hold:** the songs duck by 14 dB under the presenters' voices. After 40 s, or when the song runs out, Hold music takes over. Releasing un-ducks the song, or, on Hold music, builds into the next song. Hold during a Spin cancels it.
  - **Hold music:**
    - The user's tracks go in `client/public/audios/hold/` (gitignored). `analysis/hold.py` decodes each one to `cache/hold/` and picks seamless whole-bar loops into `data/hold/<name>.json`, which the engine plays with native `loopStart`/`loopEnd`.
    - It finds the composer's loop body by self-similarity, sample-exact (both Mario Kart tracks), and keeps bar loops as fallbacks. A body loop plays the track's intro once, then loops the body, like the game; it never restarts from the top.
    - Folders set the mood. Everything in `hold/` is fail music: it plays after Back, and later after a failed Check. `celebration/` is victory music.
    - Tracks of a mood take turns. A synthesized chiptune placeholder covers ordinary Holds until there's a track for them.
  - **Stingers** (`client/public/audios/stingers/`) are on the tablet's sound pad. "Final lap" plays automatically once per climb, as the Phase first turns late; `config.ts` `ENGINE.finalLapStingerPhase` sets which phase triggers it.
  - **Back** undoes the last landing: the song rewinds out (a spinback), stops counting and becomes next again. The drum turns back one card onto the previous song, and Hold music starts. It is repeatable, and the Queue's order never changes. Back during a Spin cancels it: the drum brakes back onto the current card, and the outgoing song stays (restored) if its exit move hadn't started; otherwise Hold music covers. Within 0.15 s of the landing it acts right after the landing instead.
  - **Phase:** from the cards in play valid for the round (normal cards, or special ones in the special round) and the known Queue, blurred by `game/phase.ts`: late starts 3–8 songs before the expected win, with occasional false alarms, and final covers the last 1–3 songs. It resets towards the Bingo when a Line is confirmed. Without cards in play it falls back to a "songs until a winner" placeholder.
  - **Possible winners:** after each landing, the tablet privately lists the cards that now have a Line or a Bingo.
  - **Panic** fades everything out in 0.3 s. A runtime watchdog starts Hold music whenever the state says music should be playing and nothing is.
  - **The show flow** (`show/flow.ts` and the scene rules in [`docs/protocol.md`](docs/protocol.md#scenes)): scenes from `before` to `after`; the public **tie-free Shuffle** (`game/shuffle.ts`: deterministic reshuffles of a secret seed until neither the first Line nor the first Bingo is a Tie among the cards in play; 8 s of animation before anything lands); **Claims** and their **Check** (`game/check.ts`: the completed row or all 12 songs, 2.5 s hook snippets for ✓ and a synthesized "broken record" for ✗, timed in advance, everything else ducked far down); the presenters' verdict (the Failure fanfare and the error Hold music, or the **Celebration**: the Clear fanfare, then the Winning song's hook looped in whole bars, or the victory track); the **Interval** (by hand, or 60 s after a Bingo's Celebration); **Winners** with private names and notes; the technical **pause**. All of it is journaled, so a resumed laptop comes back in the same scene. Every number is in `config.ts` `FLOW`.

**Relay and remote:** `relay/server.ts` serves the pages (Vite in development, `dist/` with `--dist`) and the audio, and runs a WebSocket hub on `/ws`. `--pool` picks the pool whose files the song routes serve (`/audio`, `/stems`, `/signatures`, `/snippets`, `/stretch`, `/analysis`, `/data`, `/covers`, `/cards`, `/api/override`); the URLs never change, so the pool's media is revalidated by ETag instead of cached for a day. It forwards commands to the show page and the show page's events to everyone else, and caches the last state for new clients. `admin/` is the tablet and phone remote: Next, Back, Hold, Hold music, Pace presets, ±1 s and lock, auto-advance, the Schedule and Drift, a sound-effects pad, cards in play, possible winners, the Phase override, Line confirmed, New round and Panic (these two need a second tap).

## Verification so far

- `npm test`: the solver test (2,000 random spins, 10–77 cards, D 5–11 s: every spin lands on its target and locks at D within 1 µs, with the scale inside 0.85–1.2) and planner property tests (3,000 random pairs × press times × phases: D in the window, T on an A downbeat, the hook at T exactly, no event before the spin starts).
- `test.html?run=1`: OfflineAudioContext renders of all seven recipes through the real graph (42 landing cases plus a full-mix pass per recipe). B's hook transient is at T exactly, plus the master compressor's fixed 6 ms pre-delay, which the visual clock compensates. A is silent after its exit, and full mixes with every effect on peak between −0.7 and −1.8 dBFS with no NaNs.

## Not done yet

- **Listening.** Last year's songs are only test material, so they get listened to only as far as testing the effects and transitions needs. `data/report.md` lists what the audition pass would cover. This year's pool gets the full pass once its playlist is final.
- **The flash-and-click check on the real projector.** Film `test.html` with a phone and set the display offset.
- **Tuning by ear:** effect levels, riser and roll lengths, impact choice and Signature levels are first guesses.
- **Next:** the next song looped under the current one, split-device mode (ADR 0002), and a 2-hour soak test. Suspense needs an ear check: its loop levels are first guesses. This year's pool still has to be prepared once its playlist is final.
