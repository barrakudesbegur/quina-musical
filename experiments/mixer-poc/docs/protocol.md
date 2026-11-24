# Show protocol (v1)

The show engine (the show page) owns all game state. Remotes (the presenters' tablet, the admin phone, and later a split-mode drum or audio device) send **commands** and render the engine's **events**. Messages travel as JSON over the relay's WebSocket (`/ws`). The engine checks every command on arrival, and a command that fails the check is rejected, never thrown.

The package `@quina/protocol` (`protocol/`) is the source of truth, and this page explains it. It imports no engine code, so any remote, the player app or a Worker can import it:
- `vocabulary.ts`: the shared words and constants. `PROTOCOL_VERSION`, `PhaseName`, `ShowStatus`, the recipe names, the Pace limits and presets, the sound names, the reject reasons and the relay roles.
- `commands.ts`: `COMMANDS`, the field spec every arriving command is checked against, plus `checkCommand` and `makeCommand`. The `Command` type is derived from the spec, as a discriminated union on `cmd`, so the documented fields and the checked fields cannot drift apart.
- `events.ts`: every event as a discriminated union on `type` (`ShowEvent`, `IncomingEvent` with the relay's client list), `ShowState`, `makeEvent` and `isEvent`.
- `journal.ts`: the Game journal (below), its entries, `GameRecord`, and `replayJournal`.

- **Versioning.** Every message carries `v: 1`. The relay drops messages with a different version, and so does the engine. New commands and events are additive and stay v1: the engine rejects a command it doesn't know as `unknownCommand`, and remotes ignore event types they don't handle. Only a breaking change bumps `v`, because the relay would then make every device reload together.
- **Time.** Every time is in **epoch milliseconds** (`…AtMs`). Devices share timestamps, never an audio clock (ADR 0002), so a remote computes countdowns locally from `landAtMs`, `autoAtMs` and the like.
- **Terms.** Messages use the words from `GLOSSARY.md`: Hook, Landing, Spin, Pace, Hold, Hold music, Back, Phase, Heat, Queue, Cards in play.

## Relay

| Message | Direction | Meaning |
|---|---|---|
| `{ v, type: 'hello', role, clientId }` | client → relay | First message after connecting. `role` is `show`, `admin`, `tablet` or `drum` |
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
| `confirmLine` | | A claimed Line passed its Check, so the Phase starts climbing towards the Bingo |
| `newRound` | `number?`, `kind?: 'normal'\|'special'` | Stop, then run a new secure Shuffle of the Pool for the round |
| `sfx` | `name` | Play a sound effect or a stinger: one of `SOUND_NAMES` (`STINGER_NAMES` and `SFX_NAMES`); any other name is rejected as `invalid` |
| `overrideNextRecipe` | `recipe: string\|null` | Force the next transition's recipe (for testing) |
| `panic` | | Silence everything at once. Position is kept and the state becomes `idle` |
| `getState` | | Ask for a fresh `state` event |

Rejection reasons (`command.rejected.reason`): `invalid`, `locked`, `busy`, `endOfQueue`, `nothingToUndo`, `notHolding`, `notReady`, `decodeFailed`, `planFailed`, `unknownSfx`, `unknownCommand`, `noSuspense`.

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
```

## Game journal

The Game is what must survive a restart: the round and its Queue, the landings and undos, the confirmed Line, the cards in play and the settings. The engine writes each fact as a numbered journal entry, keeps it in the show page's storage, and emits it as `journal.entry` for anyone keeping a copy. Live playback (the decks, the Spin in flight, the effects) is left out on purpose: after a restart it starts fresh.

| `kind` | Fields | Written when |
|---|---|---|
| `round.started` | `round, roundKind, queue, phaseSeed, startedAtMs, targetEndMs, settings` | A round starts (its secure Shuffle and the secret seed that blurs its Phase) |
| `song.landed` | `round, position, songId` | A song lands (`atMs` is the Landing) |
| `landing.undone` | `round, position, songId` | Back undoes a landing |
| `line.confirmed` | `round, fromPosition` | A Line passes its Check |
| `cards.set` | `ranges` | The cards in play change |
| `settings.changed` | `settings` (all of them, as they are now) | `setPace` or `setGame` |

Every entry also carries `gameId`, `seq` (1, 2, 3… with no gaps within a Game) and `atMs`. `replayJournal(entries)` turns a journal into a `GameRecord`, and every side uses that one reducer, so they all agree. A gap, a repeat, another Game's entry or a song that isn't at its Queue index throws a `JournalError`, and nothing is resumed from a wrong state.

**Resuming.** A reloaded show page resumes the current Game from its journal if the last entry is under 12 hours old (`ENGINE.resumeWithinMs`). Resumed means the same round, Queue, position, landings, Line and settings, with the drum showing the last landing. Nothing plays until Next. `?fresh=1` starts a new Game, and the old journal stays stored. A test show with `?queue=`, or with `?journal=0`, keeps its journal in memory only.

## Analysis files

The engine also checks the analysis JSON it loads (`data/analysis/<id>.json`, written by `analysis/analyze.py`, `schemaVersion: 1`) against `engine/js/analysis.js`. A song whose file fails the check is left out of the round, or its decode is rejected and Hold music covers.
