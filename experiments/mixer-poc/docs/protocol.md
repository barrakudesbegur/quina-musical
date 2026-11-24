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
| `{ v, type: 'hello', role, clientId }` | client → relay | First message after connecting. `role` is `show`, `admin`, `tablet`, `drum` or `cloud` (the laptop's cloud link, which keeps a copy of the journal and uploads it) |
| `{ v, type: 'relay.clients', clients: [{ role, clientId }] }` | relay → all | Who is connected (for example, whether the show page is open) |

The relay forwards commands only to the `show` role, and events only from it. A new client immediately gets the last `state` event.

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
| `setGame` | `autoAdvance?`, `autoAdvanceFinal?`, `finalLapStinger?`, `phaseOverride?: phase\|null`, `songsUntilWinner?`, `roundsTotal?`, `holdMusicAfterSec?` | Settings. `songsUntilWinner` only drives the Phase when no cards are in play |
| `setCardsInPlay` | `ranges: string` | Cards in play for the whole game, for example `1-180, 200-215, 400-460`. An empty string clears them |
| `confirmLine` | | The Phase starts climbing towards the Bingo. A manual override for when no Check was run: a valid `decide` on a Line does it by itself. Play and Celebration only |
| `newRound` | `number?`, `kind?: 'normal'\|'special'` | Run the round's public, tie-free Shuffle (below). Scene `roundStart` with `shuffle.scheduled`; it becomes `play` when the Shuffle ends, and a Next pressed meanwhile waits for it. Without `number`/`kind`: the introduced round's, else (in `before`) round 1 again, else the next one. The Interval music goes on under the Shuffle; from anywhere else everything stops first. Anywhere but in a Check |
| `roundIntro` | `number?`, `kind?` | Introduce a round (scene `roundStart`): its name and prizes on screen, Interval music on. No Queue yet. From `before`, `interval`, `after` or a Bingo's Celebration |
| `claim` | `cardId: integer 1–9999`, `kind?: 'line'\|'bingo'` | A Claim (`kind` defaults to what the Phase climbs towards: the Line until one is confirmed, then the Bingo). Enters the Hold (reason `claim`), cancelling a Spin like `hold` does (`transition.cancelled`, reason `hold`; within 0.15 s of its landing the Hold comes right after it). Scene `check`; the Claim queues, and its Check starts when none is on screen. From `play`, `check` or `celebration` |
| `checkStart` | `claimId` | (Re)start an undecided Claim's Check from the counted landings now (a re-check, or another order). A running Check it replaces goes back to the queue |
| `decide` | `claimId`, `valid: boolean` | The presenters' verdict (both are journaled). Invalid: the Failure fanfare. The next queued Claim's Check starts by itself. Once every Claim is decided: any valid one → `celebration` (a Line confirms the Line; a Bingo ends the round); none → back to `play` in a Hold (reason `checkFailed`) with the error Hold music until Resume (`next` or `hold {on: false}`), or back to the Celebration a late Claim interrupted |
| `winnerInfo` | `claimId`, `name?: string ≤ 80`, `notes?: string ≤ 500` | Set or edit a Winner's name and notes, at any time (an empty string clears one). PRIVATE |
| `celebrationMusic` | `choice: 'winningSong'\|'victory'\|'holdMusic'` | Change the Celebration's music. Never blocks anything |
| `interval` | | After a Bingo's Celebration: the Interval. It also comes by itself after `FLOW.celebration.toIntervalSec` (60 s) |
| `endGame` | | The end of the Game (scene `after`), from anywhere; closing music until Panic. Within 0.15 s of a landing: `busy` |
| `pause` | `on?: boolean` | The technical pause ("Tornem de seguida"), on, off or toggled, over any scene |
| `sfx` | `name` | Play a sound effect or a stinger: one of `SOUND_NAMES` (`STINGER_NAMES` and `SFX_NAMES`); any other name is rejected as `invalid` |
| `overrideNextRecipe` | `recipe: string\|null` | Force the next transition's recipe (for testing) |
| `panic` | | Silence everything at once. Position is kept and the state becomes `idle` |
| `getState` | | Ask for a fresh `state` event |
| `getJournal` | `fromSeq?: integer ≥ 1` | Ask for the current Game's journal from entry `fromSeq` on (all of it without `fromSeq`). Answered by `journal.entries`. Allowed while locked. The cloud link uses it to fill in entries it missed |

Rejection reasons (`command.rejected.reason`): `invalid`, `locked`, `busy`, `endOfQueue`, `nothingToUndo`, `notHolding`, `notReady`, `decodeFailed`, `planFailed`, `unknownSfx`, `unknownCommand`, `noSuspense`, `wrongScene` (the command isn't accepted in this scene, or during the pause; `detail` names the scene), `unknownClaim` (no such Claim in this round, or it is already decided; for `winnerInfo`, no Winner with that `claimId`).

## Scenes

The scene is where the show is in the Game; `status` stays the audio state underneath. A Hold while the presenters talk is `play` with `status: 'hold'`, so the projector shows no change. `protocol/scenes.ts` holds the rules (`SCENE_RULES`, `sceneAllows`), shared with the remotes; the engine rejects any other command as `wrongScene`.

| Scene | Accepts, besides the commands allowed everywhere* | Leaves by |
|---|---|---|
| `before` | everything `play` accepts except `claim`, plus `roundIntro` | the first Spin → `play`; `roundIntro` → `roundStart`; `newRound` → `roundStart` |
| `roundStart` | `newRound`; once the Shuffle is drawn, `next` (it waits for the animation) | the Shuffle's end → `play` |
| `play` | `next`, `back`, `hold`, `holdMusic`, `suspense`, `confirmLine`, `newRound`, `claim` | `claim` → `check`; `newRound` → `roundStart` |
| `check` | `claim`, `checkStart`, `decide`, `back`, `holdMusic` | the last verdict → `celebration`, `play` (`checkFailed`) or the interrupted Celebration |
| `celebration` | `claim`, `celebrationMusic`, `confirmLine`, `newRound`; a Line's: `next`, `hold`; a Bingo's: `interval`, `roundIntro` | Line: `next` / `hold {on: false}` → `play`. Bingo: `interval` (or by itself after 60 s) → `interval`; `roundIntro` → `roundStart` |
| `interval` | `roundIntro`, `newRound` | rounds always start by hand |
| `after` | `roundIntro`, `newRound` (so an `endGame` by mistake can be undone) | |

\* Allowed everywhere: `unlock`, `getState`, `getJournal`, `setPace`, `setGame`, `setCardsInPlay`, `sfx`, `overrideNextRecipe`, `panic`, `pause`, `endGame`, `winnerInfo`. During the technical pause only these go through.

- **A fresh Game starts in `before`**, and `before` accepts every command `play` accepts today, so nothing that worked before the show flow is rejected. Round 1's Queue is drawn when the show page starts (no public Shuffle); the first Spin moves the scene to `play`. To run the public Shuffle instead, the presenters send `roundIntro` (optional) and `newRound`.
- **Shuffle.** `newRound` draws a secret seed from the secure generator and reshuffles deterministically (draw 0, 1, 2… of the seed, `engine/src/game/shuffle.ts`) until neither the first Line nor the first Bingo is a Tie among the cards in play valid for the round. With no cards in play the first draw is kept. After `FLOW.shuffleMaxAttempts` (500) draws it keeps the last and logs a warning. The seed and the number of reshuffles are journaled (`round.started`). The projector gets only `shuffle.scheduled` (never the Queue), and no song lands before its `endAtMs` (`FLOW.shuffleSec`, 8 s). A fixed Queue (tests, `?queue=`) bypasses the tie check: seed 0, attempts 0.
- **Check.** The engine computes it from the card (any generated card), the kind claimed and the counted landings now: `unknownCard` (a number outside the generated cards) and `wrongType` (a special card in a regular round, or the other way round) have no steps and show at once; `notSold` is only a warning. A Line plays its completed row (the first to complete, top on a tie; the others are in `otherRows`), else the row with most landed songs (top on a tie); a Bingo plays all 12. Each ✓ step plays the song's 3 s hook snippet (`analysis/snippets.py`, `/snippets/<id>.flac`) for 2.5 s; each ✗ step plays a short synthesized "broken record" (1.2 s). The steps are timed in advance (`FLOW.check`), and the song or Hold music is ducked far down (−32 dB) under them. Back during a Check undoes the landing; undecided Claims survive and wait for `checkStart`.
- **Celebration.** The Clear fanfare and an impact, then its music: the Winning song's hook (the one it landed on) looped in whole bars for a Line, the victory track (the `celebration` mood of Hold music) for a Bingo. Every valid Claim of that kind in the round shares it (`cardIds`: claims on the same landing share the prize).
- **Interval.** Its music is the `celebration` Hold music mood until an Interval playlist exists; a victory track playing flows on into it. `interval.guideEndMs` is only a guide.
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
game          { pace, paceLocked, autoAdvance, autoAdvanceFinal, finalLapStinger, songsUntilWinner, phaseOverride, roundsTotal, holdMusicAfterSec, nextRecipe }
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
interval      { sinceMs, nextRound, guideEndMs } | null
winners       the whole Game's: [{ round, kind, cardId, claimId, winningSongId, position, atMs, name, notes }]   PRIVATE: name, notes
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

**Resuming.** A reloaded show page resumes the current Game from its journal if the last entry is under 12 hours old (`ENGINE.resumeWithinMs`). Resumed means the same round, Queue, position, landings, Line and settings, with the drum showing the last landing, in the same scene with the round's Claims and the Game's Winners. A Check that was running is queued again; the Celebration and the Interval come back from the scene and the Claims. Once unlocked, a Celebration, Interval or introduced round gets its music back and a Check starts again; a song only plays with Next. `?fresh=1` starts a new Game, and the old journal stays stored. A test show with `?queue=`, or with `?journal=0`, keeps its journal in memory only.

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

The engine also checks the analysis JSON it loads (`data/analysis/<id>.json`, written by `analysis/analyze.py`, `schemaVersion: 1`) against `engine/js/analysis.js`. A song whose file fails the check is left out of the round, or its decode is rejected and Hold music covers.
