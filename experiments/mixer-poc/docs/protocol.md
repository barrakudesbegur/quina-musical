# Show protocol (v1)

The show engine (the show page) owns all game state. Remotes (the presenters' tablet, the admin phone, and later a split-mode drum or audio device) send **commands** and render the engine's **events**. Messages travel as JSON over the relay's WebSocket (`/ws`). The engine checks every command on arrival, and a command that fails the check is rejected, never thrown.

The package `@quina/protocol` (`protocol/`) is the source of truth, and this page explains it. It imports no engine code, so any remote, the player app or a Worker can import it:
- `vocabulary.ts`: the shared words and constants. `PROTOCOL_VERSION`, `PhaseName`, `ShowStatus`, `ShowScene`, `WinKind`, the Claim and Check words, the recipe names, the Pace limits and presets, the sound names, the reject reasons and the relay roles.
- `commands.ts`: `COMMANDS`, the field spec every arriving command is checked against, plus `checkCommand` and `makeCommand`. The `Command` type is derived from the spec, as a discriminated union on `cmd`, so the documented fields and the checked fields cannot drift apart.
- `events.ts`: every event as a discriminated union on `type` (`ShowEvent`, `IncomingEvent` with the relay's client list), `ShowState`, `makeEvent` and `isEvent`.
- `journal.ts`: the Game journal (below), its entries, `GameRecord`, `replayJournal` and `extendJournal`.
- `plan.ts`: the Game plan (below), the setup Admin edits, and `checkGamePlan`.
- `public.ts`: the public feed for players' phones (below): `PublicState`, its changes, the `applyPublic` reducer and `followFeed`, and the phones' reconnect rules.

- **Versioning.** Every message carries `v: 1`. The relay drops messages with a different version, and so does the engine. New commands and events are additive and stay v1: the engine rejects a command it doesn't know as `unknownCommand`, and remotes ignore event types they don't handle. Only a breaking change bumps `v`, because the relay would then make every device reload together.
- **Time.** Every time is in **epoch milliseconds** (`…AtMs`). Devices share timestamps, never an audio clock (ADR 0002), so a remote computes countdowns locally from `landAtMs`, `autoAtMs` and the like.
- **Terms.** Messages use the words from `GLOSSARY.md`: Hook, Landing, Spin, Pace, Hold, Hold music, Back, Phase, Heat, Queue, Cards in play, Shuffle, Tie, Claim, Check, Winner, Celebration, Interval.

## Relay

| Message | Direction | Meaning |
|---|---|---|
| `{ v, type: 'hello', role, clientId, token? }` | client → relay | First message after connecting. `role` is `show`, `admin`, `tablet`, `drum` or `cloud` (the laptop's cloud link, which keeps a copy of the journal and uploads it). `token` pairs a device on the hotspot (see below) |
| `{ v, type: 'relay.clients', clients: [{ role, clientId }] }` | relay → paired clients | Who is connected (for example, whether the show page is open) |

**Who may say what.**
- **Binding:** the relay listens on this laptop only unless it is started with `--lan`.
- **Laptop-only roles:** `show` and `cloud` are accepted only from this laptop.
- **Pairing:** a device on the hotspot (`tablet`, `admin`, `drum`) pairs with the relay token. The token is printed at start as part of the LAN URL (`?t=…`), kept in `cache/relay-token`, and can be overridden with `--token` or `QUINA_RELAY_TOKEN`.
- **Unpaired sockets:** a socket without a valid hello hears nothing.
- **Events:** they come only from the show socket. The Game journal (`journal.entry`, `journal.entries`: Queue, seeds, names) goes only to `cloud`. Every other event goes to the paired remotes and the link, and a newly paired one gets the last `state`.
- **Commands:** they come only from `tablet`, `admin` and `cloud`, and go to the show. `getJournal` comes only from `cloud`.
- **This laptop only:** `/api/*` (hook overrides, stretch renders) and `/cloud/` (except `plan.json`) answer only to this laptop.

## Commands

`{ v: 1, type: 'cmd', cmd, reqId, ...fields }`. `reqId` is any unique string; a rejection quotes it back.

| `cmd` | Fields | What it does |
|---|---|---|
| `unlock` | | The show page's first click (browsers need a gesture to start audio) |
| `next` | | Start the next song's transition. Rejected as `busy` while one is running, so a double press does nothing. In a Hold it releases the Hold first. During a Suspense it releases the Suspense |
| `back` | | Undo the last landing: the song stops counting and becomes next again, the drum turns back one card, Hold and Hold music start. During a Spin it cancels that Spin instead. Repeatable |
| `hold` | `on?: boolean` | Enter (`true`), leave (`false`) or toggle the Hold. During a Spin, entering cancels it. Leaving with only Hold music playing moves on to the next song |
| `holdMusic` | | Switch to Hold music now (enters the Hold if needed) |
| `suspense` | `on?: boolean` | Suspense: start the next song's transition and hold it open (`true`, or no `on` when none is open). The build loops and grows, and the drum crawls. Releasing it (`false`, no `on`, or `next`) lands the song on the next free bar line; after 30 s it releases by itself. `back` or `hold` cancel it like a Spin. It is never started automatically. `false` without an open Suspense is rejected as `noSuspense` |
| `setPace` | `pace?: number`, `delta?: number`, `locked?: boolean` | Set the Pace in seconds (clamped to `PACE_LIMITS_SEC`, 8–60), nudge it, and/or lock it against Drift catch-up |
| `setGame` | `autoAdvance?`, `autoAdvanceFinal?`, `finalLapStinger?`, `phaseOverride?: phase\|null`, `songsUntilWinner?`, `roundsTotal?`, `holdMusicAfterSec?`, `holdMusicOn?: boolean`, `intervalVolumeDb?: number −30..0` | Settings. `songsUntilWinner` only drives the Phase when no cards are in play. `holdMusicOn: false` ("Hold music off"): a Hold keeps the song ducked instead of switching to Hold music after `holdMusicAfterSec`; Hold music still covers what would otherwise be silence (after Back, a cancelled Spin, a song that runs out in a Hold). `intervalVolumeDb` (default −6) sets the Interval playlist's level at once (a 0.3 s glide) |
| `setCardsInPlay` | `ranges: string` | Cards in play for the whole game, for example `1-180, 200-215, 400-460`. An empty string clears them |
| `confirmLine` | | The Phase starts climbing towards the Bingo. A manual override for when no Check was run: a valid `decide` on a Line does it by itself. Play and Celebration only |
| `newRound` | `number?`, `kind?: 'normal'\|'special'` | Run the round's public, tie-free Shuffle (below). Scene `roundStart` with `shuffle.scheduled`; it becomes `play` when the Shuffle ends, and a Next pressed meanwhile waits for it. Without `number`/`kind`: the introduced round's, else (in `before`) round 1 again, else the next one. The Interval music goes on under the Shuffle; from anywhere else everything stops first. Anywhere but in a Check |
| `roundIntro` | `number?`, `kind?` | Introduce a round (scene `roundStart`): its name and prizes on screen, Interval music on. No Queue yet. From `before`, `interval`, `after` or a Bingo's Celebration |
| `claim` | `cardId: integer 1–9999`, `kind?: 'line'\|'bingo'` | A Claim (`kind` defaults to what the Phase climbs towards: the Line until one is confirmed, then the Bingo). Enters the Hold (reason `claim`), cancelling a Spin like `hold` does (`transition.cancelled`, reason `hold`; within 0.15 s of its landing the Hold comes right after it). Scene `check`; the Claim queues, and its Check starts when none is on screen. From `play`, `check` or `celebration` |
| `checkStart` | `claimId` | (Re)start an undecided Claim's Check from the counted landings now (a re-check, or another order). A running Check it replaces goes back to the queue |
| `decide` | `claimId`, `valid: boolean` | The presenters' verdict (both are journaled). Invalid: the Failure fanfare. The next queued Claim's Check starts by itself. Once every Claim is decided: any valid one → `celebration` (a Line confirms the Line; a Bingo ends the round); none → back to `play` in a Hold (reason `checkFailed`) with the error Hold music until Resume (`next` or `hold {on: false}`), or back to the Celebration a late Claim interrupted |
| `winnerInfo` | `claimId`, `name?: string ≤ 80`, `notes?: string ≤ 500` | Set or edit a Winner's name and notes, at any time (an empty string clears one). PRIVATE |
| `celebrationMusic` | `choice: 'winningSong'\|'victory'\|'holdMusic'` | Change the Celebration's music. During a Check it picks the music the Celebration will start with (`state.celebrationChoice`); a failed Check drops the pick. Never blocks anything |
| `interval` | | After a Bingo's Celebration: the Interval. It also comes by itself after `FLOW.celebration.toIntervalSec` (60 s) |
| `intervalSkip` | | The Interval playlist moves on to its next track, with its usual transition, on the playing track's next downbeat (at least 0.6 s ahead). Only while the Interval music plays (the state's `intervalMusic`); a skip while a track is still coming in, or before the first one has, does nothing. The state shows the new track once it has taken over |
| `endGame` | | The end of the Game (scene `after`), from anywhere; closing music until Panic. Within 0.15 s of a landing: `busy` |
| `pause` | `on?: boolean` | The technical pause ("Tornem de seguida"), on, off or toggled, over any scene |
| `sfx` | `name` | Play a sound effect or a stinger: one of `SOUND_NAMES` (`STINGER_NAMES` and `SFX_NAMES`); any other name is rejected as `invalid` |
| `overrideNextRecipe` | `recipe: string\|null` | Force the next transition's recipe (for testing) |
| `panic` | | Silence everything at once. Position is kept and the state becomes `idle` |
| `getState` | | Ask for a fresh `state` event |
| `resumeAt` | `round, kind, shuffleSeed, position, lineConfirmedFrom?, lastSongId?, shuffleAttempts?` | Plan B: resume a round by hand on a show page with no journal, such as a replacement laptop offline (see "Resuming by hand" below). Allowed in `before`, `interval` and `after`, and while locked. Refused as `cannotResume` when the rebuilt Queue doesn't match the token |
| `getJournal` | `fromSeq?: integer ≥ 1` | Ask for the current Game's journal from entry `fromSeq` on (all of it without `fromSeq`). Answered by `journal.entries`. Allowed while locked. The cloud link uses it to fill in entries it missed |

Rejection reasons (`command.rejected.reason`): `invalid`, `locked`, `busy`, `endOfQueue`, `nothingToUndo`, `notHolding`, `notReady`, `decodeFailed`, `planFailed`, `unknownSfx`, `unknownCommand`, `noSuspense`, `wrongScene` (the command isn't accepted in this scene, or during the pause; `detail` names the scene), `unknownClaim` (no such Claim in this round, or it is already decided; for `winnerInfo`, no Winner with that `claimId`), `cannotResume` (`resumeAt`'s Queue doesn't match: `detail` says what).

## Scenes

The scene is where the show is in the Game; `status` stays the audio state underneath. A Hold while the presenters talk is `play` with `status: 'hold'`, so the projector shows no change. `protocol/scenes.ts` holds the rules (`SCENE_RULES`, `sceneAllows`), shared with the remotes; the engine rejects any other command as `wrongScene`.

| Scene | Accepts, besides the commands allowed everywhere* | Leaves by |
|---|---|---|
| `before` | everything `play` accepts except `claim`, plus `roundIntro` | the first Spin → `play`; `roundIntro` → `roundStart`; `newRound` → `roundStart` |
| `roundStart` | `newRound`; once the Shuffle is drawn, `next` (it waits for the animation); `intervalSkip` while the Interval music plays | the Shuffle's end → `play` |
| `play` | `next`, `back`, `hold`, `holdMusic`, `suspense`, `confirmLine`, `newRound`, `claim` | `claim` → `check`; `newRound` → `roundStart` |
| `check` | `claim`, `checkStart`, `decide`, `back`, `holdMusic` | the last verdict → `celebration`, `play` (`checkFailed`) or the interrupted Celebration |
| `celebration` | `claim`, `celebrationMusic`, `confirmLine`, `newRound`; a Line's: `next`, `hold`; a Bingo's: `interval`, `roundIntro` | Line: `next` / `hold {on: false}` → `play`. Bingo: `interval` (or by itself after 60 s) → `interval`; `roundIntro` → `roundStart` |
| `interval` | `roundIntro`, `newRound`, `intervalSkip` | rounds always start by hand |
| `after` | `roundIntro`, `newRound` (so an `endGame` by mistake can be undone), `intervalSkip` | |

\* Allowed everywhere: `unlock`, `getState`, `getJournal`, `setPace`, `setGame`, `setCardsInPlay`, `sfx`, `overrideNextRecipe`, `panic`, `pause`, `endGame`, `winnerInfo`. During the technical pause only these go through.

`intervalSkip` follows the Interval music rather than the scene: `SceneContext.intervalMusic` (the state's `intervalMusic` is not null) allows it, also in `play` after the Shuffle until the first Spin builds out of the music, and refuses it in a `roundStart` whose `newRound` came from the round in play (that stops everything). A remote that leaves the flag out gets the scenes that start the music: `interval`, `roundStart` and `after`.

- **A fresh Game starts in `before`**, and `before` accepts every command `play` accepts today, so nothing that worked before the show flow is rejected. Round 1's Queue is drawn when the show page starts (no public Shuffle); the first Spin moves the scene to `play`. To run the public Shuffle instead, the presenters send `roundIntro` (optional) and `newRound`.
- **Shuffle.** `newRound` draws a secret seed from the secure generator and reshuffles deterministically (draw 0, 1, 2… of the seed, `engine/src/game/shuffle.ts`) until neither the first Line nor the first Bingo is a Tie among the cards in play valid for the round. With no cards in play the first draw is kept. After `FLOW.shuffleMaxAttempts` (500) draws it keeps the last and logs a warning. The seed and the number of reshuffles are journaled (`round.started`). The projector gets only `shuffle.scheduled` (never the Queue), and no song lands before its `endAtMs` (`FLOW.shuffleSec`, 8 s). A fixed Queue (tests, `?queue=`) bypasses the tie check: seed 0, attempts 0.
- **Check.** The engine computes it from the card (any generated card), the kind claimed and the counted landings now: `unknownCard` (a number outside the generated cards) and `wrongType` (a special card in a regular round, or the other way round) have no steps and show at once; `notSold` is only a warning. A Line plays its completed row (the first to complete, top on a tie; the others are in `otherRows`), else the row with most landed songs (top on a tie); a Bingo plays all 12. Each ✓ step plays the song's 3 s hook snippet (`analysis/snippets.py`, `/snippets/<id>.flac`) for 2.5 s; each ✗ step plays a short synthesized "broken record" (1.2 s). The steps are timed in advance (`FLOW.check`), and the song or Hold music is ducked far down (−32 dB) under them. Back during a Check undoes the landing; undecided Claims survive and wait for `checkStart`.
- **Celebration.** The Clear fanfare and an impact, then its music: the Winning song's hook (the one it landed on) looped in whole bars for a Line, the victory track (the `celebration` mood of Hold music) for a Bingo. Every valid Claim of that kind in the round shares it (`cardIds`: claims on the same landing share the prize).
- **Interval.** `interval.guideEndMs` is only a guide. Its music is the **Interval playlist** (`client/public/audios/interval/`, analysed by `analysis/interval.py` into `data/interval/`), which also plays while a round is introduced, under its Shuffle until the first Spin builds out of it, and in `after`.
  - **Order:** shuffled per Game (seeded from the Game id, so a reload keeps it; how far it got is kept in the page's storage), every track once before any repeats, and a recording only once (#04 and #16 of the playlist are one).
  - **No silence:** the music playing when it starts (the victory track, Hold music after a pause, the Winning song's loop) goes on until the first track is decoded, then echoes out on its own downbeat while the first track comes in on that downbeat. From silence (a fresh page's first `roundIntro`) the first track fades in.
  - **Between tracks:** the outgoing track's last beat goes into an echo synced to its beat on a downbeat 8–12 s before its sound ends (a phrase start when there is one, never more than a second into a closing fade), its dry signal stops on that one, and the echo thins out over 4 s. The next track's downbeat lands on the same one. With tempos within 4% (after ×2 and ÷2), two bars of it rise under the outgoing track first, by a swell (gain and high-pass) or a filter opening (low-pass), the two alternating, while the outgoing track thins out. With tempos apart, only its pickup plays before the one and its low-pass keeps opening for two of its bars, so the two grids never clash. No drum, nothing else: it is the break, under the presenters' talk.
  - **Skip** (`intervalSkip`): the same transition on the playing track's next downbeat. **Volume:** `setGame {intervalVolumeDb}`.
  - It plays on its own bus under the songs (the Hold duck, a Check's duck and a build's high-pass treat it like them), and gives way like Hold music: it fades out from the first Spin's start (+0.2 s, over 1.6 s) while the build comes out of it, or cross-fades to Hold music (the pause, `holdMusic`).
- **Technical pause.** Nothing lands (a Spin in flight is cancelled; a running Check stops and its Claim queues again), Hold music plays, and the show page shows "Tornem de seguida". Ending it brings the scene's own music back; in `play` the Hold stays until Resume.

## Events

| `type` | Fields | When |
|---|---|---|
| `state` | see below | After every change; also answers `getState` |
| `transition.scheduled` | `id, reqId, from, to, position, phase, recipe, recipeName, exit, shape, spinStartAtMs, exitAtMs, landAtMs, durationMs, hookId, bpm, drum: { removeId, targetId, minLaps }` | A Spin starts. A split-mode drum needs only `drum`, `spinStartAtMs` and `landAtMs` to solve its own Spin |
| `suspense.started` | `id, reqId, from, to, position, phase, spinStartAtMs, exitAtMs, autoReleaseAtMs, drum: { removeId, targetId }` | A Suspense opens. Its release sends `transition.scheduled` with the same `id` and the landing time (recipe `SUSPENSE`). PRIVATE until it lands: `to`, `drum.targetId` |
| `transition.landed` | `id, songId, position, atMs` | The Landing: the song counts from now |
| `transition.cancelled` | `id, reason: 'back'\|'hold', keptOutgoing, atMs` | A Spin was cancelled and nothing landed |
| `landing.undone` | `songId, position, atMs` | Back undid a landing |
| `command.rejected` | `reqId, cmd, reason, detail?` | A command was refused |
| `engine.health` | `atMs, outputLatencyMs, baseLatencyMs, contextState, decodedMB, jsHeapMB, longTasks, holdMusic` | Every 5 s |
| `journal.entry` | `entry` | A new Game journal entry (below). PRIVATE: `round.started` carries the whole Queue |
| `journal.entries` | `reqId, gameId, entries` | The answer to `getJournal`: the entries in `seq` order (`gameId` null before the first entry). PRIVATE |
| `heat.sample` | `value, fromMs, toMs` | The phones' public Heat: ease towards `value` (0..1, the `heat` the state carried right after the landing) between `fromMs` and `toMs`. Sent at `fromMs`, a random 4–15 s after a landing and never at it (`FLOW.heatSample`, drawn from the round's secret seed, so a seed always gives the same samples); a newer landing or Back drops a sample not sent yet. `toMs` is when the next sample is due (the Spin in flight's), else `fromMs` + 15 s. Only with cards in play. Public |
| `scene.changed` | `scene, previous, atMs` | The scene changed: a trigger for the projector's scene animations |
| `shuffle.scheduled` | `round, kind, startAtMs, endAtMs, songCount` | A round's Shuffle: the projector animates it between these times. Never the Queue |
| `claim.opened` | `claim` (a `ClaimInfo`) | A Claim was made. PRIVATE: `claim.completeSince`, `claim.warnings` |
| `check.scheduled` | `check` (a `CheckInfo`) | A Check starts; each step is revealed at its `atMs` |
| `claim.decided` | `claimId, cardId, verdict: 'valid'\|'invalid', atMs` | The presenters decided a Claim |
| `celebration.started` | `celebration` (a `CelebrationInfo`) | A Celebration starts (or another Winner joins it) |

### `state`

`ShowState` in `events.ts` types every field.

```text
status        'locked' | 'idle' | 'playing' | 'transition' | 'hold'
pending       'next' while the next song is still decoding
hold          { sinceMs, reason: 'hold'|'back'|'cancel'|'end'|'music', holdMusic, holdMusicAtMs } | null
holdMusic     boolean
current       { songId, title, artist, hookId, posSec, endsAtMs } | null
next          { songId, title, artist } | null
queue         { position, length }   position = Queue index of the last counted landing (−1 before the first)
round         { number, kind, startedAtMs, targetEndMs, lineConfirmed }
game          { pace, paceLocked, autoAdvance, autoAdvanceFinal, finalLapStinger, songsUntilWinner, phaseOverride, roundsTotal, holdMusicAfterSec, holdMusicOn, intervalVolumeDb, nextRecipe }
                holdMusicOn and intervalVolumeDb are optional in the type only (added later in v1): the engine always sends them
phase         'early' | 'mid' | 'late' | 'final'   (the coming transition's)
heat          0..1 placeholder, or null without cards in play
cards         { inPlay, inPlayCount, validCount, phaseSource: 'cards'|'placeholder'|'override', climbingTo: 'line'|'bingo' }
possibleWinners { line: [{ cardId, lines, completedBy }], bingo: [...] }   PRIVATE: tablet only, never the projector
pace          { sec, locked, nudge, slotSec, spinSec }
schedule      { roundEndMs, gameEndMs, roundDriftSec, gameDriftSec }   Drift > 0 = running late
autoAtMs      when auto-advance will press Next, or null
transition    { id, recipe, phase, to, landAtMs } | null
suspense      { id, sinceMs, autoReleaseAtMs } | null   (status is 'transition' while it is open)
landings      last 10: [{ songId, title, artist, position, atMs, undone }]
history       last 8 transitions: [{ recipe, family, exit, songId, hookId, phase }]
scene         'before' | 'roundStart' | 'play' | 'check' | 'celebration' | 'interval' | 'after'
pause         { sinceMs } | null   the technical pause, over the scene
shuffle       { round, startAtMs, endAtMs } | null   while the Shuffle animates
intro         { round, kind, sinceMs } | null   in roundStart, the round being introduced (before its Shuffle)
claims        this round's, oldest first: [{ claimId, round, cardId, kind, atMs, position, status, outcome, completeSince, warnings }]
                status 'queued'|'checking'|'checked'|'valid'|'invalid'; outcome 'complete'|'incomplete'|'unknownCard'|'wrongType'|null
                PRIVATE: completeSince (Queue index; the console shows "complete since song N" = index + 1), warnings (['notSold'])
check         { claimId, cardId, kind, outcome, row, otherRows, steps: [{ songId, landed, atMs, durationMs }], startAtMs, endAtMs } | null
                the Check on screen, running or showing its result until it is decided
celebration   { kind, round, cardIds, winningSongId, sinceMs, music: 'winningSong'|'victory'|'holdMusic' } | null
celebrationChoice  the music picked during a Check for the coming Celebration, or null (the default)
interval      { sinceMs, nextRound, guideEndMs } | null
intervalMusic { track: { title, artist, index, count, sinceMs } | null } | null
                while the Interval playlist plays (interval, roundStart, after, and play until the first Spin); track is null
                until the first one takes over; index is its 1-based place in the Game's order (it wraps after count).
                Optional in the type only; the engine always sends it
winners       the whole Game's: [{ round, kind, cardId, claimId, winningSongId, position, atMs, name, notes }]   PRIVATE: name, notes
resume        { round, kind, shuffleSeed, shuffleAttempts, position, lastSongId, lineConfirmedFrom, text } | null   PRIVATE (plan B, see "Resuming by hand")
```

`hold.reason` adds `claim` (a Check, through the Celebration) and `checkFailed` (every Claim of the last Check was invalid). In `celebration`, `interval` and `after` the status is `hold` too: no song lands, the scene's music plays.

## Game plan (`plan.ts`)

The setup that Admin edits and the cloud stores. The laptop, the projector, the console and the phones read it. Admin's bulk JSON import and export use exactly this shape, so an AI agent can fill it from the organizers' spreadsheet.

| Field | Meaning |
|---|---|
| `v` | `1` |
| `edition` | The year tag, for example `"26"`. It's in the cards' QR links (`/26/123`) and names the cloud room. Phones keep their cards per edition and wipe them only when it changes. It isn't the journal's `gameId`, which changes with every run and rehearsal |
| `title` | The night's name on screen: `"Quina Musical"` |
| `rounds[]` | `{ number, kind: 'normal'\|'special', line: Prize\|null, bingo: Prize\|null }`, numbered 1, 2, 3… in play order. At most one special round |
| `sponsors[]` | `{ id, name, logo }`. `id` is lowercase with dashes; `logo` is the cleaned-up WebP's asset path or null |
| `Prize` | `{ title, detail\|null, sponsorId\|null, image\|null }`. `sponsorId` must name a sponsor |
| `schedule` | `{ startAtMs\|null, roundMinutes, intervalMinutes }`. The Interval countdown guide is `intervalMinutes` |
| `cheatSheet` | `{ claimRules: string[], specialRoundRules: string[] }` |

`checkGamePlan(json)` never throws. It returns `{ ok: true, plan }` (trimmed and typed) or `{ ok: false, errors }`, with every problem and its JSON path (`plan.rounds[1].line.sponsorId: no sponsor with id "x"`). Unknown keys are errors, so a typo can't silently drop a prize. `sponsorOf(plan, prize)` and `roundPlan(plan, n)` are lookups.

## Game journal

The Game is what must survive a restart: the round and its Queue, the landings and undos, the confirmed Line, the cards in play and the settings. The engine writes each fact as a numbered journal entry, keeps it in the show page's storage, and emits it as `journal.entry` for anyone keeping a copy. Live playback (the decks, the Spin in flight, the effects) is left out on purpose: after a restart it starts fresh.

| `kind` | Fields | Written when |
|---|---|---|
| `round.resumed` | the same as `round.started`, plus `position, lineConfirmedFrom` | A round resumed by hand (`resumeAt`). The songs up to `position` count from this entry's `atMs`, because their real times are unknown. The Game is in `play`, and the round's Claims and intro are reset |
| `round.started` | `round, roundKind, queue, phaseSeed, startedAtMs, targetEndMs, settings, shuffleSeed, shuffleAttempts` | A round starts: its tie-free Shuffle (the Queue is draw number `shuffleAttempts` of `shuffleSeed`; 0 and 0 for a fixed Queue) and the secret seed that blurs its Phase. A journal from before the tie-free Shuffle replays both as 0 |
| `song.landed` | `round, position, songId` | A song lands (`atMs` is the Landing) |
| `landing.undone` | `round, position, songId` | Back undoes a landing |
| `line.confirmed` | `round, fromPosition` | A Line passes its Check |
| `cards.set` | `ranges` | The cards in play change |
| `settings.changed` | `settings` (all of them, as they are now) | `setPace` or `setGame` |
| `scene.changed` | `scene, round, roundKind` | The scene changes. `round`/`roundKind`: the round it is about (in `roundStart`, the one introduced) |
| `claim.opened` | `round, claimId, cardId, winKind, position` | A Claim (`winKind`, because `kind` names the entry) |
| `claim.decided` | `round, claimId, verdict, winningSongId, position` | A verdict. Valid: the Winning song and its Queue index (the card's completion, else the landing it was claimed on); invalid: null and the claim's position |
| `winner.noted` | `claimId, name, notes` | A Winner's name and notes, as they are now |

Every entry also carries `gameId`, `seq` (1, 2, 3… with no gaps within a Game) and `atMs`. `replayJournal(entries)` turns a journal into a `GameRecord`, and every side uses that one reducer, so they all agree. `extendJournal(record, entries)` applies more entries to a record without replaying the history, and gives the same result as replaying the whole journal; the cloud uses it on every upload. Besides the round and its landings, the record keeps the show flow: `scene` and `sceneSinceMs`, `intro` (in `roundStart`, the round introduced), the round's `claims` (`{ claimId, round, cardId, kind, position, atMs, verdict }`, `verdict` null while undecided), `claimCount` (claim ids go on from it: `cl-<n>`) and the Game's `winners` (PRIVATE: `name`, `notes`). A verdict on an unknown Claim, a Claim decided twice or a Winner's note without a Winner throws a `JournalError` too. A gap, a repeat, another Game's entry or a song that isn't at its Queue index throws a `JournalError`, and nothing is resumed from a wrong state.

**Resuming.** A show page boots into one of these, in this order (`chooseResume` in `engine/src/journal-store.ts`):
1. **Admin's manual resume.** The cloud link's `/cloud/resume.json` is used when it is newer than this page's last local entry. It resumes that Game up to its entry `seq`, from `/cloud/journal/<gameId>.jsonl`.
2. **This page's own journal,** if its last entry is under 12 hours old (`ENGINE.resumeWithinMs`).
3. **The cloud copy's current Game** (`/cloud/current`), if it is recent: a new laptop.

A cloud journal becomes the page's own: new entries continue its numbering, and whatever was stored for that Game moves to an archive key and is never deleted. A broken journal is never resumed from: the console says why, and the next source is tried. Resumed means the same round, Queue, position, landings, Line and settings, with the drum showing the last landing. The status line says "Represa des del núvol" or "Represa des d'aquest portàtil". Nothing plays until Next. `?fresh=1` starts a new Game. A test show with `?queue=` or `?journal=0` keeps its journal in memory only. With no journal anywhere, see "Resuming by hand".

## Resuming by hand (plan B)

On a show page with no journal (a replacement laptop, offline), the presenters resume the round with `resumeAt`.
- **How it works:** the Shuffle is seeded. Its seed, the Pool and the cards in play give back the exact Queue, and the engine checks that against the token. A token is `{round, kind, shuffleSeed, shuffleAttempts, position, lastSongId, lineConfirmedFrom}`; `text` is the same as a short code (`protocol/resume.ts`).
- **The code:** for example `Q3N-4K7XM2P-17-S41-L12` is round 3 (normal), the seed in 7 Crockford base32 characters, the last counted position, the song there, and where the Bingo climb started. `formatResumeToken` and `parseResumeToken` read and write it.
- **State:** the state's `resume` holds the current token. It is PRIVATE: tablets only, never a public screen or a phone.
- **Where the seed comes from, in this order:**
  1. the laptop's local journal (localStorage, or the cloud link's disk copy);
  2. the cloud, if the round started before the connection dropped;
  3. the code an admin noted at the Shuffle. The console shows it on its tucked-away panel. Keep it like the box of cards: with the cards in play it gives the whole Queue.
- **Refusals:** a Queue that doesn't match is refused (`cannotResume`), never resumed. That covers other cards in play, a mistyped seed, position or song, and a different draw number. Without the round's seed, no Queue can match the cards, so there is no resume.
- **What doesn't come back:** a resumed round starts a new Game id, because its earlier journal isn't on this laptop. Its earlier landings count, but their times and the round's Claims don't come back.

## Public feed (phones)

Players' phones get the Game from the cloud, never from the relay. The cloud builds a whitelisted projection of what it keeps (cloud/src/domain/projection.ts); `public.ts` types it, and phones and the cloud apply it with the same reducer. Defined by Platform and UI together.

- **Connecting.** `wss://<cloud>/feed?cards=12,123`: the phone's card numbers (`cardsParam`; at most `PUBLIC_FEED.maxCardsPerPhone`), which feed Admin's anonymous "cards opened on phones". Phones send nothing: no hello, no heartbeat, no polling.
- **Messages.** One `{ v, type: 'public.state', seq, nowMs, state }` on connect (and when the Game changes), then `{ v, type: 'public.delta', seq, nowMs, changes }`, each `seq` one more than the last. `followFeed(view, message)` applies them with `applyPublic`. A gap, or a delta before any snapshot, answers `resync`: reconnect for a fresh snapshot, so a lost message never leaves a wrong card on screen.
- **Reconnecting.** When the socket closes: `reconnectDelayMs(attempt)` (full jitter, a ceiling of 1 s doubling to 30 s), so a crowd never comes back at once. Back in the foreground, only if the socket closed meanwhile, after up to `PUBLIC_FEED.resumeJitterMs`. Every connection is a billed request.
- **Time.** Every time is on the cloud's clock; `nowMs` lets a phone estimate its offset.
- **What `PublicState` holds.**
  - `edition` ('26'): phones keep their cards per edition.
  - `gameId`: a rehearsal and the night are different Games; a change resets the rounds shown, never the cards.
  - `scene`, `intro` (the round being introduced) and `shuffle` (its timing).
  - `rounds[]` for the whole Game: `{ number, kind, startedAtMs, lineConfirmed, ended, landings: [{ position, songId, atMs }] }`, counted landings only.
  - `spin` (`startAtMs`, `landAtMs`; null `landAtMs` during a Suspense; never the song).
  - `heat`: display samples `{ value, fromMs, toMs }`, null until the engine emits them.
  - `check` (`{ round, cardId, kind, result: 'pending' | 'valid' | 'invalid' }`, never its steps).
  - `winners[]`: one entry per prize, `cardIds` shared.
  - `interval`, `pause` and `gameEndMs` (rounded to `PUBLIC_FEED.gameEndRoundingMs`).
  - `link` (the laptop's connection: show "Connexió perduda" after `PUBLIC_FEED.offlineNoticeAfterMs` offline).
  - `plan` (`GamePlan`, logos as asset paths).
  - `notice` (Admin's banner) and `soundsDefault`.
- **Never in it.** The Queue, `next`, `transition.to`/`drum.targetId` before the landing, `possibleWinners`, `phase`, the real `heat`, `schedule.roundEndMs`, a Check's steps before its verdict, claims' `completeSince` and `warnings`, winners' names and notes, the journal.

## Analysis files

The Check plays `/snippets/<id>.flac` (`<cacheDir>/<id>/snippet.flac`, 3 s from the song's best hook's pickup) at the trim in `/data/snippets/index.json` (`analysis/snippets.py`, the prepare step `snippets`).

The Interval playlist is global, like Hold music: `/data/interval/index.json` (the tracks in playlist order, the duplicates dropped and the entries without a file) and `/data/interval/<slug>.json` (title and artist from `playlist.spotdl`, beats, regularized downbeats, tempo, loudness, and the edges: where the sound starts and ends, where the closing fade starts, the first downbeat; schema v1, checked by `engine/src/interval/tracks.ts`), with the audio at `/intervalaudio/<slug>.flac` (`cache/interval/`, 48 kHz). The relay serves them whatever the pool.

The engine also checks the analysis JSON it loads (`data/analysis/<id>.json`, written by `analysis/analyze.py`, `schemaVersion: 1`) against `engine/js/analysis.js`. A song whose file fails the check is left out of the round, or its decode is rejected and Hold music covers.
