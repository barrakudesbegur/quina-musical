# Show protocol (v1)

The show engine (the show page) owns all game state. Remotes (the presenters' tablet, the admin phone, and later a split-mode drum or audio device) send **commands** and render the engine's **events**. Messages travel as JSON over the relay's WebSocket (`/ws`). The engine checks every command on arrival, and a command that fails the check is rejected, never thrown.

The package `@quina/protocol` (`packages/protocol/`) is the source of truth, and this page explains it. It imports no engine code, so any remote, the player app or a Worker can import it:
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
| `{ v, type: 'relay.plan', plan, savedAtMs }` | relay → paired clients (the show page too, for its stage); cloud → its consoles | The edition's Game plan, on hello and whenever it changes, so a screen that never regains focus (the projector) follows Admin's edits. The relay sends the laptop's newest copy: the cloud's, or one saved on the laptop's network with no cloud (newest `savedAtMs` wins). `plan` is null when there is none. Public, like the plan |
| `{ v, type: 'remote.status', connected, battery, sinceMs, drops?, lastDropMs?, clientId? }` (`drops`: disconnections in the host's last 10 minutes; `lastDropMs`: the latest, or null) | the console hosting the Wii Remote → relay → the other paired consoles (tablet, admin) | The remote's status (`readRemoteStatus`, `remoteStatusMessage`). The relay adds the host's `clientId`, replays the last one per host on every console hello, and sends `{ connected: false, battery: null }` when the host's socket closes. PRIVATE: never the show page, the drum, the cloud link or phones |

**Who may say what.**
- **Binding:** the relay listens on this laptop only unless it is started with `--lan`.
- **Laptop-only roles:** `show` and `cloud` are accepted only from this laptop.
- **Pairing:** a device on the hotspot (`tablet`, `admin`, `drum`) pairs with the relay token. The token is printed at start as part of the LAN URL (`?t=…`), kept in `data/cache/relay-token`, and can be overridden with `--token` or `QUINA_RELAY_TOKEN`.
- **Unpaired sockets:** a socket without a valid hello hears nothing.
- **Events:** they come only from the show socket. The Game journal (`journal.entry`, `journal.entries`: Queue, seeds, names) goes only to `cloud`. Every other event goes to the paired remotes and the link, and a newly paired one gets the last `state`.
- **Commands:** they come only from `tablet`, `admin` and `cloud`, and go to the show. `getJournal` comes only from `cloud`.
- **This laptop only:** `/api/*` (hook overrides, stretch renders) and `/cloud/` (except `plan.json`) answer only to this laptop.
- **The Game plan (relay/plan.ts):** `/cloud/plan.json` is public: the newest of the cloud link's `cloud-plan.json` and a plan saved on the laptop's network (`local-plan.json`), both `{ savedAtMs, plan }` in the link folder; it is pushed as `relay.plan`. `GET`/`PUT /api/plan` answer this laptop and devices paired with the token (`authorization: Bearer <token>`); PUT is plan B's save with no cloud: checked with `checkGamePlan` (and the cloud copy's edition), at most 512 KB, answered like the cloud's `/api/plan` plus `savedAtMs`. When the cloud is back, the link sends a newer local save up (`link.plan`); the cloud keeps the newest, and the local file goes.
- **Admin's images:** the link copies the plan's `/media/<key>.png|.jpg` (and each one's JPEG XL, when uploaded) into `data/link/media/`, and the relay serves them publicly at `/media/`, immutable. Like the cloud, a `.jxl` with no JPEG XL answers with the fallback's bytes.

## Commands

`{ v: 1, type: 'cmd', cmd, reqId, ...fields }`. `reqId` is any unique string; a rejection quotes it back.

| `cmd` | Fields | What it does |
|---|---|---|
| `unlock` | | The show page's first click (browsers need a gesture to start audio) |
| `next` | | Start the next song's transition. Rejected as `busy` while one is running, so a double press does nothing, and as `nextBlocked` while Aguanta or a Suspense is on (D133: nothing lands while B is held). It ends Parlem and the other Holds first (D142). During Pausa it ends Pausa with that song's transition (D128) |
| `back` | | Undo the last landing: the song stops counting and becomes next again, the drum turns back one card, Hold and Hold music start. During a Spin it cancels that Spin instead. Repeatable |
| `hold` | `on?: boolean`, `duck?: boolean` | Enter (`true`), leave (`false`) or toggle the Hold. During a Spin, entering cancels it. Leaving with only Hold music playing moves on to the next song. `duck` (default true) is Parlem: the song ducks and Hold music may take over after `holdMusicAfterSec`; Next ends it (D142). `duck: false` is Aguanta (Stay): the song keeps playing at full volume, nothing lands or advances (Next is refused, D133), and near its end it loops its last phrase. Sent while holding, `duck` switches between the two in place. In any Celebration, Parlem ducks the Celebration's music (D117) |
| `holdMusic` | | Switch to Hold music now (enters the Hold if needed) |
| `suspense` | `on?: boolean`, `cancel?: boolean` | Suspense: start the next song's transition and hold it open (`true`, or no `on` when none is open). The playing song repeats its phrase while the build grows over it, and the drum hovers over a few pending songs as each is teased (Decoys). Release it with `on: false` (or no `on`) and the song lands on the outgoing song's next phrase boundary; it releases by itself after about 30 s. Never started automatically. Next doesn't release it: it's refused as `nextBlocked` (D133). `on: false, cancel: true` lands nothing: the build backs out and fades, and the show is back where the Suspense started, in Aguanta (D144: A let go with B held) or playing (D145: manual advance, B let go before the third vibration) |
| `setPace` | `pace?: number`, `delta?: number`, `locked?: boolean` | Set the Pace in seconds (clamped to `PACE_LIMITS_SEC`, 8–60), nudge it, and/or lock it against Drift catch-up |
| `setGame` | `autoAdvance?`, `autoAdvanceFinal?`, `finalLapStinger?`, `phaseOverride?: phase\|null`, `songsUntilWinner?`, `roundsTotal?`, `holdMusicAfterSec?`, `holdMusicOn?: boolean` | Settings. `songsUntilWinner` only matters without cards in play. `holdMusicOn: false`: a Hold keeps the song ducked instead of switching to Hold music (it still covers silence). The Interval's level is now the `breaks` volume (`setVolume`) |
| `setVolume` | `key` (one of `VOLUME_KEYS`), `percent: number 0–100` | One volume slider (D139), applied at once; the state's `game.volumes` has every key. 100% is the level the engine is tuned to for that sound (`songsParlem`: the song under Parlem as a share of its full level, default 45% = today's −14 dB duck); `volumeDb(percent)` is the audio taper, gain = (percent/100)². Journaled in `settings.changed` once the sliders have been still for 1 s, so a drag is one entry. A Game that has set no volume yet takes the plan's `volumes` when the plan arrives. Any scene, also during Pausa |
| `setCardsInPlay` | `ranges: string` | Cards in play for the whole game, for example `1-180, 200-215, 400-460` (`parseCardRanges` reads them, the same for the engine and the screens). An empty string clears them |
| `confirmLine` | | The Phase starts climbing towards the Bingo. A manual override for when no Check was run: a valid Line's cue does it by itself. Play and Celebration only; `invalid` in the Desgraciat round (it has no Line) |
| `newRound` | `number?`, `kind?: 'normal'\|'special'\|'desgraciat'`, `cardType?` | Run the round's public, tie-free Shuffle (below). Scene `roundStart` with `shuffle.scheduled`; it becomes `play` when the Shuffle ends, and a Next pressed meanwhile waits for it. Without `number`/`kind`: the introduced round's, else (in `before`) round 1 again, else the next one. `cardType` is the printed card type the round plays (the plan round's `cardType`, a card-types.json id such as `'especial'`); without it, the introduced round's, else `defaultCardType(kind)` (`'normal'`, or `'especial'` for the special round). The Interval music goes on under the Shuffle; from anywhere else everything stops first. Anywhere but in a Check |
| `roundIntro` | `number?`, `kind?`, `cardType?` | Introduce a round (scene `roundStart`): its name and prizes on screen, its intro music on (D129: for now one track for every round, "Parasail Minigame", looping low as if in Parlem, from the intro through the Shuffle until the first Spin, U99). No Queue yet. `cardType` as in `newRound` (default `defaultCardType(kind)`); the console sends the plan's. It also reveals the round's prizes (journal `prizes.revealed`, `by: 'intro'`) |
| `revealPrizes` | `round` | The presenters reveal a round's prizes: phones may show its bundles from now on (journal `prizes.revealed`, `by: 'presenters'`). Any scene |
| `claim` | `cardId: integer 1–9999` or `cardIds: integer 1–9999 list` (1–10, no repeats; exactly one of the two), `kind?: 'line'\|'bingo'\|'standing'` | A Claim per card, queued in that order (`cardIds`: the claim pad's several numbers, D110). `kind` defaults to what the Phase is climbing towards; one the round can't be won by is `invalid`. A number that isn't a printed card refuses the whole claim as `unknownCard` (D126), privately: nothing is journaled, and the presenter retypes it. The round enters the Hold (a Spin is cancelled like Hold does), the scene becomes `check`, and the first queued Claim's Check comes on screen with nothing revealed: its first reveal waits for a press. In a Celebration a late Claim is checked the same way (the Celebration comes back if none is valid) |
| `checkStart` | `claimId` | (Re)start a queued Claim's Check from the start, nothing revealed (a re-check after Back, or another order). A Check on screen that it replaces goes back to the queue. A Claim under review goes on with `reviewEnd { outcome: 'continue' }` instead |
| `checkNext` | `claimId`, `step: integer 0–20` | The presenter-paced Check (D107): the tap or the Wii's A. `step` is the index the press expects, so simultaneous presses reveal once. `step` = the revealed count reveals the next song (in the card's grid order; a Line's row; its snippet or the broken record). Once the reveals stop (the last song, or the first ✗; `cueNext`), `step` = the revealed count is the cue: a pass makes the Claim valid (a card that isn't the batch's last gets the plaque without a fanfare, D110; the last gets the fanfare and the Celebration), a fail invalid (the fail moment). After a cue the next queued Claim's Check comes on screen by itself, its first reveal waiting for a press. With `celebrationNext`, `step` = that count + 1 starts the shared Celebration. Any other press is ignored, silently |
| `checkBack` | `claimId`, `step: integer 0–20` | "Enrere" inside a Check (D127, D134): a single press (no hold) steps back one revealed song. `step` is the index of the last revealed song, the mark it removes; any other value is ignored, silently. The previous song's snippet replays (at none, the music from before the Check comes back up), and that Check's automatic reveal turns off, for that Check only (`check.auto` false). Only while revealing: not under review, not after the cue. It never closes the Check (`check.unrevealed`). Undoing a landing from inside a Check is U104: not built |
| `checkAuto` | `on: boolean` | Reveal in a row while on (the Wii's A held, or the tablet's toggle), one song after another's snippet, through the cue (its fanfare or fail moment) and no further (D117). It never makes the first reveal of a card that came on screen by itself after an earlier card's cue: that one waits for a press, and auto goes on from it. A step back turns it off for that Check only |
| `checkReview` | `claimId` | "Revisió manual": put a queued or running Check under review (the Review) before its cue. No fanfare or effect, and whatever was playing goes on at the Check's level (D118–D120; U78). The Claim is `reviewing` (journal `claim.reviewing`), the projector shows "Revisió manual" (`check.reviewing`, D123), and the round waits in its Check until `reviewEnd`: no other Check starts. A Pausa only by hand, as usual. `check` |
| `reviewEnd` | `claimId`, `outcome: 'continue'\|'win'\|'lose'\|'discard'` | End a Review (D121). `continue`: its Check goes on from where it was (journal `claim.continued`), the next reveal waiting for a press. `win` / `lose`: skip the reveals left, straight to that cue (the fanfare and Celebration, or the fail moment), even against the card: the Claim gets the PRIVATE warning `notPassing` / `wouldPass` when it does, and `claim.decided` is marked `manual` (the one exception to "the Check decides", only from a Review). `discard`: no fanfare and no failure music (journal `claim.discarded`, D124); the next queued Claim's Check, else the music from before the Check comes back under plain Parlem (Hold reason `discarded`, D142): like every Hold it suspends auto-advance without touching its setting, and Next ends it. `check` |
| `winnerInfo` | `claimId`, `name?: string ≤ 80`, `notes?: string ≤ 500`, `slip?: string ≤ 16` | Set or edit a Winner's name, notes and the number of the slip handed to them, at any time (an empty string clears one). PRIVATE |
| `celebrationMusic` | `choice: 'winningSong'\|'victory'\|'holdMusic'` | Change the Celebration's music. During a Check it picks the music the Celebration will start with (`state.celebrationChoice`); a failed Check drops the pick. Never blocks anything |
| `interval` | | After a Bingo's Celebration: the Interval. It also comes by itself after `FLOW.celebration.toIntervalSec` (60 s) |
| `intervalSkip` | | The playing music set (the breaks', Pausa's or the end's: the state's `intervalMusic.set`) moves on to its next track, with its usual transition, on the playing track's next downbeat (at least 0.6 s ahead). Only while one plays; a skip while a track is still coming in is ignored |
| `throw` | `restart?: boolean` | "Llançament", the throw song (D138: for now "Flying Free", Pont Aeri and Marian Dacal, from its throw hook a bit before the drop), at full volume while the break music fades out. A tap (no `restart`) starts it, stops it while it plays, and resumes it where it stopped; `restart: true` (a long press) plays it again from the hook. The break music fades back when it ends or stops. The state's `throwSong`. Not journaled. `before`, `interval`, `after` |
| `endGame` | | The end of the Game (scene `after`), from anywhere: the end music plays until the laptop is disconnected (D137). Within 0.15 s of a landing: `busy`. Refused as `claimOpen` while a Claim is under review |
| `pause` | `on?: boolean` | Pausa, on, off or toggled, at any time (D128). It saves the playback in progress (a song with its Hold, Hold music, the Celebration's music, a music set, the throw song) and plays the Pausa set (`intervalMusic.set` `pausa`); a Spin or Suspense in flight is cancelled (U105). "Tornem de seguida" shows on the projector and phones only during a round, a Check or a Celebration (`pause.overlay`, D135). Off: the saved playback resumes exactly where it was, fading in (D135), under Parlem where the scene has Parlem (Hold reason `pause`). Timers exclude the paused time (Parlem's switch to Hold music, the Celebration's 60 s to the Interval). Panic clears the saved playback. During Pausa only the commands allowed everywhere go through, plus `next` (it ends Pausa with that song's transition) and `intervalSkip`. Not journaled (U111): a restart comes back unpaused |
| `sfx` | `name` | Play a sound effect or a stinger: one of `SOUND_NAMES` (`STINGER_NAMES` and `SFX_NAMES`); any other name is rejected as `invalid` |
| `overrideNextRecipe` | `recipe: string\|null` | Force the next transition's recipe (for testing) |
| `panic` | | Silence everything at once. Position is kept and the state becomes `idle` |
| `getState` | | Ask for a fresh `state` event |
| `resumeAt` | `round, kind, shuffleSeed, position, lineConfirmedFrom?, lastSongId?, shuffleAttempts?, cardType?` | Plan B: resume a round by hand on a show page with no journal, such as a replacement laptop offline (see "Resuming by hand" below). Allowed in `before`, `interval` and `after`, and while locked. Refused as `cannotResume` when the rebuilt Queue doesn't match the token |
| `getJournal` | `fromSeq?: integer ≥ 1` | Ask for the current Game's journal from entry `fromSeq` on (all of it without `fromSeq`). Answered by `journal.entries`. Allowed while locked. The cloud link uses it to fill in entries it missed |

Rejection reasons (`command.rejected.reason`): `invalid`, `locked`, `busy`, `endOfQueue`, `nothingToUndo`, `notHolding`, `notReady`, `decodeFailed`, `planFailed`, `unknownSfx`, `unknownCommand`, `noSuspense`, `wrongScene` (the command isn't accepted in this scene, or during the pause; `detail` names the scene), `unknownClaim` (no such Claim in this round, or it is already decided; for `winnerInfo`, no Winner with that `claimId`), `cannotResume` (`resumeAt`'s Queue doesn't match: `detail` says what), `claimOpen` (the round can't move on while a Claim is under review: `endGame`), `unknownCard` (a claim naming a number that isn't a printed card, D126), `nextBlocked` (Next while Aguanta or a Suspense is on, D133).

## Scenes

The scene is where the show is in the Game; `status` stays the audio state underneath. A Hold while the presenters talk is `play` with `status: 'hold'`, so the projector shows no change. `packages/protocol/scenes.ts` holds the rules (`SCENE_RULES`, `sceneAllows`), shared with the remotes; the engine rejects any other command as `wrongScene`.

| Scene | Accepts, besides the commands allowed everywhere* | Leaves by |
|---|---|---|
| `before` | everything `play` accepts except `claim`, plus `roundIntro` and `throw` | the first Spin → `play`; `roundIntro` → `roundStart`; `newRound` → `roundStart` |
| `roundStart` | `newRound`; once the Shuffle is drawn, `next` (it waits for the animation) | the Shuffle's end → `play` |
| `play` | `next`, `back`, `hold`, `holdMusic`, `suspense`, `confirmLine`, `newRound`, `claim` | `claim` → `check`; `newRound` → `roundStart` |
| `check` | `claim`, `checkStart`, `checkNext`, `checkBack`, `checkAuto`, `checkReview`, `reviewEnd`, `back`, `holdMusic` | the last cue → `celebration` (or `celebrationNext` and one more press), `play` (`checkFailed`, or `discarded`) or the interrupted Celebration |
| `celebration` | `claim`, `celebrationMusic`, `confirmLine`, `newRound`, `hold` (Parlem ducks its music, D117); a Line's: `next`; a Bingo's (or the last card standing's): `interval`, `roundIntro` | Line: `next` / `hold {on: false}` → `play`. Bingo or last card standing: `interval` (or by itself after 60 s), `roundIntro` |
| `interval` | `roundIntro`, `newRound`, `intervalSkip`, `throw` | rounds always start by hand |
| `after` | `roundIntro`, `newRound` (so an `endGame` by mistake can be undone), `intervalSkip`, `throw` | |

\* Allowed everywhere: `unlock`, `getState`, `getJournal`, `setPace`, `setGame`, `setVolume`, `setCardsInPlay`, `sfx`, `overrideNextRecipe`, `panic`, `pause`, `endGame`, `winnerInfo`, `revealPrizes`. During Pausa only these go through, plus `next` and `intervalSkip` where their own rules allow them.

`intervalSkip` follows the music rather than the scene: `SceneContext.intervalMusic` (the state's `intervalMusic` is not null) allows it, also in `play` after the Shuffle until the first Spin builds out of the music, and during Pausa (the Pausa set). Without it the rules assume a set plays in `interval`, `after` and during Pausa.

- **A fresh Game starts in `before`**, and `before` accepts every command `play` accepts today, so nothing that worked before the show flow is rejected. Round 1's Queue is drawn when the show page starts (no public Shuffle); the first Spin moves the scene to `play`. To run the public Shuffle instead, the presenters send `roundIntro` (optional) and `newRound`.
- **Shuffle.** `newRound` draws a secret seed from the secure generator and reshuffles deterministically (draw 0, 1, 2… of the seed, `engine/src/game/shuffle.ts`) until neither the first Line nor the first Bingo is a Tie among the cards in play valid for the round (those of its card type). With no cards in play the first draw is kept. After `FLOW.shuffleMaxAttempts` (500) draws it keeps the last and logs a warning. The seed and the number of reshuffles are journaled (`round.started`). The projector gets only `shuffle.scheduled` (never the Queue), and no song lands before its `endAtMs` (`FLOW.shuffleSec`, 8 s). A fixed Queue (tests, `?queue=`) bypasses the tie check: seed 0, attempts 0.
- **The Desgraciat round** (`kind: 'desgraciat'`, one per night): played in reverse. A card falls as soon as any of its songs lands, and the last card standing wins (a `standing` Claim, celebrated like a Bingo: the victory track, then the Interval). Its Shuffle is redrawn until exactly one card is the last standing (the last two never fall on the same song: rule `lastStanding`, about 11% of draws). Its Phase follows the count of valid cards still standing, which the room sees anyway: `mid` from 15, `late` from 6, `final` from 3 (`STANDING_MODEL_DEFAULTS`, tuned with `tests/support/desgraciat.ts`), the Heat rising within each band as the count falls. Auto-advance never takes out the last card: it stops once one stands. The console gets the standing cards (`standing`, PRIVATE) and the Futur's `lastStandingAt` / `standingCurve`; `possibleWinners` stays empty, and `confirmLine` is `invalid`.
- **Check.** The engine computes it from the card (any generated card), the kind claimed and the counted landings now: `unknownCard` (a number outside the generated cards) and `wrongType` (a card of another type than the round's `cardType`) have no steps and show at once; `notSold` is only a warning. A Line plays its completed row (the first to complete, top on a tie; the others are in `otherRows`), else the row with most landed songs (top on a tie); a Bingo plays all 12. A `standing` claim (the Desgraciat round) plays the card's 12 songs in card order and stops at the first one that landed (`fallen`, that song its last step with `landed: true`); a card still standing plays all 12 (`complete`, `completeSince` the landing after which every other valid card in play had fallen). A card whose first landed song is the latest landing sat down with it: `fellLast`, which passes, so when the last players standing all sit on the same song the presenters can accept each of them and they share the win (one Celebration); a card that fell earlier is `fallen` and can never be accepted. Each ✓ reveal plays the song's 3 s hook snippet (`tools/prep/snippets.py`, `/snippets/<id>.flac`) for 2.5 s; each ✗ reveal plays a short synthesized "broken record" (1.2 s). In a standing Check each song not heard yet (its ✓) is a short wood-block knock (`FLOW.check.stillSec`, 0.55 s), and the landed song that sank the card plays its snippet as the proof.
  - **Paced by the presenters (D107):** nothing is revealed until a press (`checkNext`); each press reveals the next song in the card's grid order, a press during a snippet cutting it short. Auto (`checkAuto`) reveals the next one as each snippet ends, through the cue. The reveals stop at the last song or the first ✗ (`revealUntil`); the next press is the cue (`cueNext`).
  - **The music under it:** from the first reveal the song or Hold music is ducked far down (−32 dB, U85 (a) for now) until the cue; back at none (`checkBack`), and between two cards, the music from before the Check comes back up to the Claim's level.
  - **Several cards (D110):** checked in turn. A pass that isn't the batch's last is valid with the plaque and no fanfare; the last cue starts the shared Celebration if any card passed (after a failed last card, one more press: `celebrationNext`), else the fail moment and the round back in its Hold (`checkFailed`).
  - **Back** (`back`, the long press) during a Check undoes the landing; undecided Claims survive (a Claim under review stays under review) and wait for `checkStart`.
- **Celebration.** The Clear fanfare and an impact, then its music: the Winning song's hook (the one it landed on) looped in whole bars for a Line, the victory track (the `celebration` mood of Hold music) for a Bingo. Every valid Claim of that kind in the round shares it (`cardIds`: claims on the same landing share the prize).
- **Interval** (the user's "Break", D136). `interval.guideEndMs` is only a guide. Its music is the **breaks set** (D129: the pop playlist `0fvoRGCC8zXqDyj5uLhJVg`), one of three **music sets** (`MUSIC_SETS`), each a folder `data/media/interval/<set>/` analysed by `tools/prep/interval.py` into `data/out/interval/<set>/`: `breaks` in `interval` and until a round's first Spin, `pausa` (`0XTlZPUpt7xPoPxk4AUU3O`) during Pausa, `end` in `after` (for now the breaks' tracks in their playlist order, U97). A round's intro plays its intro track instead (`roundIntro`), and a set's music builds out of it the same way.
  - **Order:** shuffled per Game and set (seeded from the Game id, so a reload keeps it; how far it got is kept in the page's storage), every track once before any repeats, and a recording only once; the `end` set plays in the playlist's order.
  - **No silence:** the music playing when it starts (the victory track, Hold music after a pause, the Winning song's loop) goes on until the first track is decoded, then echoes out on its own downbeat while the first track comes in on that downbeat. From silence (a fresh page's first `roundIntro`) the first track fades in.
  - **Between tracks:** the outgoing track's last beat goes into an echo synced to its beat on a downbeat 8–12 s before its sound ends (a phrase start when there is one, never more than a second into a closing fade), its dry signal stops on that one, and the echo thins out over 4 s. The next track's downbeat lands on the same one. With tempos within 4% (after ×2 and ÷2), two bars of it rise under the outgoing track first, by a swell (gain and high-pass) or a filter opening (low-pass), the two alternating, while the outgoing track thins out. With tempos apart, only its pickup plays before the one and its low-pass keeps opening for two of its bars, so the two grids never clash. No drum, nothing else: it is the break, under the presenters' talk.
  - **Skip** (`intervalSkip`): the same transition on the playing track's next downbeat. **Volume:** each set's slider (`setVolume`: `breaks`, `pausa`, `end`).
  - It plays on its own bus under the songs (the Hold duck, a Check's duck and a build's high-pass treat it like them), and gives way like Hold music: it fades out from the first Spin's start (+0.2 s, over 1.6 s) while the build comes out of it, or cross-fades to Hold music (the pause, `holdMusic`).
- **Pausa** (D128, D135). Nothing lands (a Spin or Suspense in flight is cancelled, U105; a Check on screen goes back to the queue, U107), the playback in progress is saved and fades out, and the Pausa set plays. "Tornem de seguida" shows only during a round, a Check or a Celebration (`pause.overlay`). Ending it (`pause {on: false}`, the Wii's A) resumes the saved playback exactly where it was, fading in: a song (its loop and timeline shifted by the paused time) under Parlem (Hold reason `pause`), Hold music, the Celebration's music, a set, the throw song. Every timer excludes the paused time. Next ends Pausa with that song's transition out of the Pausa music. Panic clears the saved playback.
- **The throw song** (D138, `throw`). Its own track (`data/media/throw/`, decoded by `tools/prep/hold.py`) from its throw hook (`THROW.hookSec` in `engine/src/config.ts`), at full volume (the `throws` slider) over the break music, which fades out under it and back after.

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
| `check.started` | `check` | A Claim's Check on screen, nothing revealed (D107): `total`, `revealed: []`, `auto`, `cue: null`, `reviewing: false`. Nothing public says ahead of the cue whether the card passes: `check.outcome` and the Claim's `markedCard`, `revealUntil` and `cueNext` are PRIVATE |
| `check.revealed` | `claimId, index, step` | A press revealed the song at `index` |
| `check.unrevealed` | `claimId, index, atMs` | A step back (`checkBack`) removed the mark at `index`, the last revealed; that cell is next again (D134) |
| `check.cue` | `claimId, cue: 'pass'\|'fail', manual?, atMs` | The cue: valid, or the fail moment; `manual` when a Review won or lost it by hand |
| `check.reviewing` | `claimId, atMs` | Put under review before its cue: the Claim `reviewing`, whatever was playing goes on (D118–D120) |
| `claim.decided` | `claimId, cardId, verdict: 'valid'\|'invalid', atMs` | A Claim's cue (or a Review won or lost by hand) decided it |
| `celebration.started` | `celebration` (a `CelebrationInfo`) | A Celebration starts (or another Winner joins it) |

### `state`

`ShowState` in `events.ts` types every field.

```text
status        'locked' | 'idle' | 'playing' | 'transition' | 'hold'
pending       'next' while the next song is still decoding
hold          { sinceMs, reason: 'hold'|'back'|'cancel'|'end'|'music'|'claim'|'checkFailed'|'discarded'|'pause', holdMusic, holdMusicAtMs, ducked } | null   ducked PRIVATE: false in Aguanta
holdMusic     boolean
current       { songId, title, artist, hookId, posSec, endsAtMs } | null
next          { songId, title, artist } | null
queue         { position, length }   position = Queue index of the last counted landing (−1 before the first)
round         { number, kind, cardType, startedAtMs, targetEndMs, lineConfirmed }   cardType: the printed card type it plays; only those cards count, any other fails its Check as wrongType
game          { pace, paceLocked, autoAdvance, autoAdvanceFinal, finalLapStinger, songsUntilWinner, phaseOverride, roundsTotal, holdMusicAfterSec, holdMusicOn, volumes, nextRecipe }
                holdMusicOn and volumes are optional in the type only: the engine always sends them, volumes with every VOLUME_KEYS key (percent)
phase         'early' | 'mid' | 'late' | 'final'   (the coming transition's)
heat          0..1 placeholder, or null without cards in play
cards         { inPlay, inPlayCount, validCount, phaseSource: 'cards'|'placeholder'|'override', climbingTo: 'line'|'bingo' }
possibleWinners { line: [{ cardId, lines, completedBy }], bingo: [...] }   PRIVATE: tablet only, never the projector
future        { lineAt, bingoAt, toLine: [cards by songs missing], toBingo, markCounts: [cards by songs marked], lastStandingAt, standingCurve } | null   PRIVATE: the console's Futur tab. Desgraciat round: lastStandingAt is the Queue index whose landing leaves one card standing, standingCurve the count after each next landing up to that one; lineAt/bingoAt null, toLine/toBingo []
standing      { count, cardIds: number[] | null, fellLast: number[] | null } | null   PRIVATE: console only. fellLast: the valid cards whose first landed song is the latest landing (they sat down with it: their Check is `fellLast` and may share the win), sorted, null above 60. Desgraciat round: the valid cards in play (its card type within the ranges, sold or not) none of whose songs counted yet; cardIds sorted, null above STANDING_LIST_MAX (60). null in other rounds
prizes        { revealed: [{ round, by: 'presenters' | 'intro' }] }   the plan's revealedRounds() turns it into what phones see
pace          { sec, defaultSec, locked, nudge, slotSec, spinSec }   defaultSec: the round's starting Pace (PACE_DEFAULT_SEC), which the console recommends; HEAT_BANDS gives each Phase's Heat band
schedule      { roundEndMs, gameEndMs, roundDriftSec, gameDriftSec }   Drift > 0 = running late; with the plan (relay.plan), gameEndMs allows for each remaining round's kind, the planned Interval and Throws
autoAtMs      when auto-advance will press Next, or null
transition    { id, recipe, phase, to, landAtMs } | null
suspense      { id, sinceMs, autoReleaseAtMs } | null   (status is 'transition' while it is open)
landings      last 10: [{ songId, title, artist, position, atMs, undone }]
history       last 8 transitions: [{ recipe, family, exit, songId, hookId, phase }]
scene         'before' | 'roundStart' | 'play' | 'check' | 'celebration' | 'interval' | 'after'
pause         { sinceMs, overlay } | null   Pausa, over the scene; overlay: "Tornem de seguida" shows (a round, a Check or a Celebration, D135)
shuffle       { round, startAtMs, endAtMs } | null   while the Shuffle animates
intro         { round, kind, cardType, sinceMs } | null   in roundStart, the round being introduced (before its Shuffle)
claims        this round's, oldest first: [{ claimId, round, cardId, kind, atMs, position, status, outcome, completeSince, warnings, markedCard, revealUntil, cueNext }]
                status 'queued'|'checking'|'reviewing'|'valid'|'invalid'|'discarded'; outcome 'complete'|'incomplete'|'fellLast'|'fallen'|'unknownCard'|'wrongType'|null (CHECK_OUTCOMES)
                PRIVATE: completeSince (Queue index; the console shows "complete since song N" = index + 1), warnings (['notSold', 'notPassing', 'wouldPass']), markedCard (the whole card in grid order, each song landed or not), revealUntil (the last index its Check reveals: the last, or the first ✗), cueNext (the next press is the cue)
check         { claimId, cardId, kind, outcome, row, otherRows, cardType, startAtMs, total, revealed: [{ songId, landed, atMs, durationMs }], auto, cue: 'pass'|'fail'|null, reviewing } | null   outcome PRIVATE until the cue; cardType: the printed type, the projector's first step (wrongType fails on it, total 0)
                the Check on screen: revealing, under review ("Revisió manual"), or showing its cue
celebration   { kind, round, cardIds, winningSongId, sinceMs, music: 'winningSong'|'victory'|'holdMusic' } | null
celebrationChoice  the music picked during a Check for the coming Celebration, or null (the default)
celebrationNext    true when every card of the claim had its cue, the last failed and an earlier one passed: the next press (checkNext on the last Claim, step = its revealed count + 1) starts the shared Celebration
interval      { sinceMs, nextRound, guideEndMs } | null   guideEndMs: the plan's intervalMinutes plus any Throw planned after this round (else 2.5 min)
intervalMusic { set: 'breaks'|'pausa'|'end', track: { title, artist, index, count, sinceMs } | null } | null
                while a music set plays (breaks: interval, and play until the first Spin; pausa: Pausa; end: after); track is null
                until the first one takes over; index is its 1-based place in the Game's order (it wraps after count).
                Optional in the type only; the engine always sends it
winners       the whole Game's: [{ round, kind, cardId, claimId, winningSongId, position, atMs, name, notes, slip }]   PRIVATE: name, notes, slip
resume        { round, kind, shuffleSeed, shuffleAttempts, position, lastSongId, lineConfirmedFrom, text } | null   PRIVATE (plan B, see "Resuming by hand")
throwSong     { title, artist, playing, sinceMs } | null   the throw song from "Llançament" until it ends or the scene changes (D138)
```

`hold.reason` adds `claim` (a Check, through the Celebration), `checkFailed` (every Claim of the last Check was invalid), `discarded` (a Review discarded: the music from before the Check under Parlem) and `pause` (Pausa ended: what it saved plays again under Parlem). In `celebration`, `interval` and `after` the status is `hold` too: no song lands, the scene's music plays.

## Game plan (`plan.ts`)

The setup that Admin edits and the cloud stores. The laptop, the projector, the console and the phones read it. Admin's bulk JSON import and export use exactly this shape, so an AI agent can fill it from the organizers' spreadsheet.

| Field | Meaning |
|---|---|
| `v` | `3`. Older plans are still read as version 3: version 2's `cardTypes` list only says which type each round kind took (each round gets the first type that listed its kind, else `defaultCardType(kind)`) and is dropped; version 1's prizes each become a bundle of one headline prize, with `perRound` |
| `edition` | The year tag, for example `"26"`. It's in the cards' QR links (`/26/123`) and names the cloud room. Phones keep their cards per edition and wipe them only when it changes. It isn't the journal's `gameId`, which changes with every run and rehearsal |
| `title` | The edition's name, on every screen: `"Quina Quina 3"` |
| `prizeReveal` | `'perRound'` (round 1 from the start, each round as it is introduced or revealed by the presenters) or `'allSecret'` (only what the presenters reveal) |
| `rounds[]` | `{ number, kind: 'normal'\|'special'\|'desgraciat', cardType, line: Prize[], bingo: Prize[] }`, numbered 1, 2, 3… in play order. At most one Desgraciat round (played in reverse: the last card standing wins); its `line` must be empty and its `bingo` is the last card standing's prize, and it plays `'normal'` cards unless it names another type. `cardType` is the printed card type the round plays: an id from apps/cards' `card-types.json` (lowercase letters and digits, `CARD_TYPE_ID_RE`); the plan checks only its format, screens check it against `card-types.json`. A plan file may leave it out: `checkGamePlan` fills in `defaultCardType(kind)`. Card type names, colours and prices are not in the plan: screens read `card-types.json` (served at `/cards/card-types.json`, next to `cards.json`). Each bundle has at most 40 prizes, headline ones first (`[]` until set). At most one special round |
| `Prize` | `{ title, detail\|null, sponsorId\|null, image\|null, headline }`. `sponsorId` must name a sponsor; screens show `image` for headline prizes |
| `sponsors[]` | `{ id, name, logo }`. `id` is lowercase with dashes; `logo` is `/media/<key>.png` or `.jpg` (a `.jxl` beside it) or null |
| `schedule` | `{ startAtMs\|null, roundMinutes, intervalMinutes, throws: [{ afterRound, minutes }] }`. `throws` are the planned Throws ("parón"; the code's word for the time between rounds stays `interval`, D136) after a round that isn't the last, once each, 1–60 minutes on top of that Interval (absent when none). The show page reads the plan from `relay.plan`: the Interval's countdown guide and the expected end allow for them |
| `volumes` | Optional: the volume sliders a fresh Game starts with (D139), `{ [VOLUME_KEYS key]: percent 0–100 }`. The engine applies them only while its Game has set no volume (none journaled), and journals them then. The cloud folds a Game's slider moves back in, so a rehearsal's tuning carries to the night. Laptop only: `publicPlan` leaves it out |
| `cheatSheet` | `{ claimRules: string[], specialRoundRules: string[] }` (presenters only) |

`checkGamePlan(json)` never throws. It returns `{ ok: true, plan }` (trimmed and typed, always version 3) or `{ ok: false, errors }`, with every problem and its JSON path (`plan.rounds[1].line[0].sponsorId: no sponsor with id "x"`). Unknown keys are errors, so a typo can't silently drop a prize. `sponsorOf(plan, prize)`, `roundPlan(plan, n)` and `headlinePrizes(bundle)` are lookups. **What phones see:** `publicPlan(plan, revealedRounds(plan, record.prizesRevealed))`: every round's `{ number, kind, cardType, revealed }` (the card type is printed, never secret), a revealed round's `line` and `bingo`, never a locked round's prizes nor how many, and no cheat sheet.

## Game journal

The Game is what must survive a restart: the round and its Queue, the landings and undos, the confirmed Line, the cards in play and the settings. The engine writes each fact as a numbered journal entry, keeps it in the show page's storage, and emits it as `journal.entry` for anyone keeping a copy. Live playback (the decks, the Spin in flight, the effects) is left out on purpose: after a restart it starts fresh.

| `kind` | Fields | Written when |
|---|---|---|
| `round.resumed` | the same as `round.started`, plus `position, lineConfirmedFrom` | A round resumed by hand (`resumeAt`). The songs up to `position` count from this entry's `atMs`, because their real times are unknown. The Game is in `play`, and the round's Claims and intro are reset |
| `round.started` | `round, roundKind, cardType?, queue, phaseSeed, startedAtMs, targetEndMs, settings, shuffleSeed, shuffleAttempts` | A round starts: its tie-free Shuffle (the Queue is draw number `shuffleAttempts` of `shuffleSeed`; 0 and 0 for a fixed Queue) and the secret seed that blurs its Phase. A journal from before the tie-free Shuffle replays both as 0, and one from before card types per round replays `cardType` as `defaultCardType(roundKind)` |
| `song.landed` | `round, position, songId` | A song lands (`atMs` is the Landing) |
| `landing.undone` | `round, position, songId` | Back undoes a landing |
| `line.confirmed` | `round, fromPosition` | A Line passes its Check |
| `cards.set` | `ranges` | The cards in play change |
| `settings.changed` | `settings` (all of them, as they are now) | `setPace` or `setGame` |
| `scene.changed` | `scene, round, roundKind, cardType?` | The scene changes. `round`/`roundKind`/`cardType`: the round it is about (in `roundStart`, the one introduced, whose card type a restart keeps for its Shuffle) |
| `claim.opened` | `round, claimId, cardId, winKind, position` | A Claim (`winKind`, because `kind` names the entry) |
| `claim.decided` | `round, claimId, verdict, winningSongId, position, outcome?` (the Check's result then; a valid verdict always passes unless `manual`), `manual?` (won or lost by hand from a Review, D121) | A verdict. Valid: the Winning song and its Queue index (the card's completion, else the landing it was claimed on); invalid: null and the claim's position. It ends a Review |
| `claim.reviewing` | `round, claimId` | Put under review (D118–D120): the record's claim gets `reviewing: true` until the Review ends |
| `claim.continued` | `round, claimId` | The Review ended with `continue`: the Check goes on |
| `claim.discarded` | `round, claimId` | The Review ended with `discard` (D121, D124): the record's `verdict` is `discarded`. A `claim.continued` or `claim.discarded` on a Claim not under review, or a `claim.reviewing` on a decided or discarded one, throws a `JournalError` |
| `winner.noted` | `claimId, name, notes, slip?` | A Winner's name, notes and slip number, as they are now |
| `prizes.revealed` | `round, by: 'presenters' \| 'intro'` | A round's prizes revealed: by `revealPrizes`, or as the round was introduced. The record keeps them in `prizesRevealed`; `revealedRounds(plan, …)` applies the plan's `prizeReveal` (`perRound`: round 1 from the start plus every reveal; `allSecret`: the presenters' only) and `publicPlan(plan, rounds)` is what phones get: every round's skeleton, only revealed rounds' bundles, no cheat sheet |

Every entry also carries `gameId`, `seq` (1, 2, 3… with no gaps within a Game) and `atMs`. `replayJournal(entries)` turns a journal into a `GameRecord`, and every side uses that one reducer, so they all agree. `extendJournal(record, entries)` applies more entries to a record without replaying the history, and gives the same result as replaying the whole journal; the cloud uses it on every upload. Besides the round and its landings, the record keeps the show flow: `scene` and `sceneSinceMs`, `intro` (in `roundStart`, the round introduced), the round's `claims` (`{ claimId, round, cardId, kind, position, atMs, verdict }`, `verdict` null while undecided), `claimCount` (claim ids go on from it: `cl-<n>`) and the Game's `winners` (PRIVATE: `name`, `notes`). A verdict on an unknown Claim, a Claim decided twice or a Winner's note without a Winner throws a `JournalError` too. A gap, a repeat, another Game's entry or a song that isn't at its Queue index throws a `JournalError`, and nothing is resumed from a wrong state.

**Resuming.** A show page boots into one of these, in this order (`chooseResume` in `engine/src/journal-store.ts`):
1. **Admin's manual resume.** The cloud link's `/cloud/resume.json` is used when it is newer than this page's last local entry. It resumes that Game up to its entry `seq`, from `/cloud/journal/<gameId>.jsonl`.
2. **This page's own journal,** if its last entry is under 12 hours old (`ENGINE.resumeWithinMs`).
3. **The cloud copy's current Game** (`/cloud/current`), if it is recent: a new laptop.

A cloud journal becomes the page's own: new entries continue its numbering, and whatever was stored for that Game moves to an archive key and is never deleted. A broken journal is never resumed from: the console says why, and the next source is tried. Resumed means the same round, Queue, position, landings, Line and settings, with the drum showing the last landing. The status line says "Represa des del núvol" or "Represa des d'aquest portàtil". Nothing plays until Next. `?fresh=1` starts a new Game. A test show with `?queue=` or `?journal=0` keeps its journal in memory only. With no journal anywhere, see "Resuming by hand".

## Resuming by hand (plan B)

On a show page with no journal (a replacement laptop, offline), the presenters resume the round with `resumeAt`.
- **How it works:** the Shuffle is seeded. Its seed, the Pool and the cards in play give back the exact Queue, and the engine checks that against the token. A token is `{round, kind, cardType, shuffleSeed, shuffleAttempts, position, lastSongId, lineConfirmedFrom}` (the card type picks the cards the Shuffle checked, so the Queue depends on it); `text` is the same as a short code (`packages/protocol/resume.ts`).
- **The code:** for example `Q3N-4K7XM2P-17-S41-L12` is round 3 (normal; `E` the special round, `D` the Desgraciat round), the seed in 7 Crockford base32 characters, the last counted position, the song there, and where the Bingo climb started. A round whose card type isn't its kind's default adds it last: `…-TESPECIAL`. `formatResumeToken` and `parseResumeToken` read and write it.
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
  - `scene`, `intro` (the round being introduced, `{ round, kind, cardType }`) and `shuffle` (its timing).
  - `rounds[]` for the whole Game: `{ number, kind, cardType, startedAtMs, lineConfirmed, ended, landings: [{ position, songId, atMs }] }`, counted landings only. A card counts in a round when `card.type === cardType`; from an older cloud without `cardType`, use `defaultCardType(kind)`.
  - `spin` (`startAtMs`, `landAtMs`; null `landAtMs` during a Suspense; never the song).
  - `heat`: display samples `{ value, fromMs, toMs }`, null until the engine emits them.
  - `check` (`{ round, cardId, kind, result: 'pending' | 'valid' | 'invalid' }`, never its steps).
  - `winners[]`: one entry per prize, `cardIds` shared.
  - `interval`, `pause` and `gameEndMs` (rounded to `PUBLIC_FEED.gameEndRoundingMs`).
  - `link` (the laptop's connection: show "Connexió perduda" after `PUBLIC_FEED.offlineNoticeAfterMs` offline).
  - `plan` (`GamePlan`, logos as asset paths).
  - `notice` (Admin's banner) and `soundsDefault`.
- **Never in it.** The Queue, `next`, `transition.to`/`drum.targetId` before the landing, `possibleWinners`, `future`, `hold.ducked`, `phase`, the real `heat`, `schedule.roundEndMs`, a Check's steps before its verdict, claims' `completeSince` and `warnings`, winners' names and notes, the journal.

## Analysis files

The Check plays `/snippets/<id>.flac` (`<cacheDir>/<id>/snippet.flac`, 3 s from the song's best hook's pickup) at the trim in `/data/snippets/index.json` (`tools/prep/snippets.py`, the prepare step `snippets`).

The Interval playlist is global, like Hold music: `/data/interval/index.json` (the tracks in playlist order, the duplicates dropped and the entries without a file) and `/data/interval/<slug>.json` (title and artist from `playlist.spotdl`, beats, regularized downbeats, tempo, loudness, and the edges: where the sound starts and ends, where the closing fade starts, the first downbeat; schema v1, checked by `engine/src/interval/tracks.ts`), with the audio at `/intervalaudio/<slug>.flac` (`data/cache/interval/`, 48 kHz). The relay serves them whatever the pool.

The engine also checks the analysis JSON it loads (`data/out/analysis/<id>.json`, written by `tools/prep/analyze.py`, `schemaVersion: 1`) against `engine/src/analysis.ts`. A song whose file fails the check is left out of the round, or its decode is rejected and Hold music covers.
