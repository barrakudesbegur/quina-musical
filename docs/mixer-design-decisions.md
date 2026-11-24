# Mixer design decisions (2026-11-23)

These were agreed with the user in a design interview. They override the build brief in `docs/research/reports/Bingo DJ mixer research.md` wherever the two conflict. The terms follow [GLOSSARY.md](../GLOSSARY.md), and the lasting decisions are in [docs/adr](./adr).

> **A dated record.** For how the Quina works today, read [how-the-quina-works.md](how-the-quina-works.md). It applies every later decision, and it wins where this record differs. Parts below are superseded: Signatures, Decoys, Suspense, the possible-winners list (now the console's Futur tab), the Interval showing next prizes (prizes now wait for the round's intro), the proof-of-concept scope, and cards in play without a card type per round.

> **Updated 2026-11-24.** [show-ui-and-platform-decisions.md](show-ui-and-platform-decisions.md) covers the screens, the player app and hosting, and overrides this document where they differ. In particular: there is one shared tablet, no router at the venue, hosting follows ADR 0003, and the "later" items below are now in the UI/UX session's scope.

## Changes after the first listen (2026-11-24)

The user's first listen to the transitions. These override the sections below, together with the "Changes" section of [show-ui-and-platform-decisions.md](show-ui-and-platform-decisions.md) (intensity range, Signatures, Suspense).
- **On the phrase.** "They feel like they end at any moment and start at any moment." The playing song leaves at the end of a 4- or 8-bar phrase, and the next one lands on its downbeat. A presenter's Next starts the Spin at once, and the landing waits up to about 11 s for a phrase boundary. A test keeps over 90% of landings on a phrase.
- **The orchestra hit is rare.** Impacts are rare early and absent from many landings. The orchestra hit only comes late or in the final Phase, with a cooldown.
- **Sudden vocals.** A song whose vocals start suddenly gets a quick, clean transition straight into the voice, optionally with its Signature teased just before.
- **Vocals across songs.** When both songs have vocals, they can feel continuous: a line of the outgoing song answered by a line of the incoming one on the downbeat (call and response).

## The goal is a great night, not only great mixing

- The music must serve the two presenters, who have different styles, improvise and interact with the crowd.
- Every automatic behaviour can be overridden live from the tablet. When the presenters do nothing, the system keeps the show going on its own.
- Last year the presenter used the manual Next to get the crowd shouting "eh eh eh" before a song. With auto-advance, the system must create moments like that instead; Suspense below is the first.

## Transitions: real DJ layering

This replaces the brief's "effect bridge, no stretching" approach.

- Do what a real DJ would, using each song's character:
  - overlapping layers, such as the next song looped under the current one;
  - stems (drums, vocals, bass, other);
  - **Signatures**: iconic, isolated pieces of a song, such as an opening riff;
  - outside sounds: drum loops, risers, impacts, and sounds made with MIDI or AI;
  - mashups.
- **Tempo:** match tempos with pitch-preserving stretch up to about ±8%. Beyond that, use half or double time, stems-only overlaps, or effect-led cuts. Check key compatibility whenever melodic parts overlap.
- **Offline preparation:** prepare stems, stretched sections and Signature candidates offline, since the queue is known. The user approves Signature candidates in the audition page.
- **Effects:** every transition is an audible, produced effect from the very first song. Phases make the effects bigger; early transitions are never plain.
- **Teases** (parts of the next song heard before it lands) are welcome, with whatever filtering suits the pair. Players recognising a song early is fine.
- **Decoys** (teasing a song that is not next) are a separate experiment after the proof of concept.
- **Hooks:** songs always land on a **Hook**. The hand tags are approximate starting points, so adjust them; how much of the song plays before the hook depends on the transition.
- **Tools:** the user can install preparation software, for example MIDI tools or ArtCraft through its MCP server or CLI. Evaluate these in a later milestone of the proof of concept.

## Order and drum (ADR 0001)

- Each round's queue is shuffled once, publicly, and never changed afterwards. Manual reordering and song picking are removed.
- A **Shuffle** animation will later show the songs moving from a grid into the drum.
- The drum stages the reveal of the next song in the queue.

## Pace, auto-advance and schedule

- **Pace:** songs auto-advance by default at a **Pace**, the target time from one landing to the next. The presenters set it with presets and fine steps, and can change it live. Defaults come from last year's medians: about 22 s in the first round and about 14 s after that (the fastest rounds ran at about 11 s).
- **Spin:** the Spin takes about half the Pace, between 3 and 11 s. The song that just landed keeps playing during the next Spin. Late, fancy transitions may stretch a song's slot by up to about 50%.
- **Schedule and Drift:**
  - The tablet shows when the round and the whole game are expected to end, and how many minutes ahead or behind they are running.
  - The estimates include claims and intervals. Last year a Line check took 70–134 s, a Bingo check plus finish took 85–220 s, and intervals averaged about 2.5 min.
  - The system nudges the Pace by up to ±20% to recover Drift, only in the early and mid phases. Presenters can lock the Pace.
- **Final phase:** auto-advance is off by default and the presenters advance by hand, with a switch to keep it on. If it stays on, a landing that probably completes a card stretches that song's slot by about 50%.
- **Next** is ignored while a transition is running, so a double press does nothing.

## Presenter-controlled moments

- **Hold:**
  - No new song lands, and the music keeps playing, ducked under the presenters' voices. This replaces the old lower-volume button.
  - A long hold switches to **Hold music**: looping tracks in the style of a video-game waiting screen, which the user will provide.
  - The music never stops unless silence is intended.
- **Suspense:**
  - The presenters hold a transition open. The build-up loops and intensifies, and the drum coasts with slow ticks and near-stops.
  - **Release** lands the song on the next bar. It releases by itself after about 30 s. It is never triggered automatically.
  - This is experimental; the user may drop it.
- **Back:**
  - Back undoes the last landing: that song stops counting and becomes the next song again. The queue order is untouched; only the current position moves back.
  - The drum turns back one card, and the show goes into Hold and Hold music.
  - It can be pressed several times, and Back during a Spin cancels that Spin.
  - Typical use: a Bingo claim noticed only after the next song had already landed.

## Phase and Heat

- **Phase (early, mid, late, final):**
  - It comes from the *probability* of a win within the next few songs. That is computed from the cards valid for the round and the known queue, then blurred.
  - The thresholds scale with the number of cards in play.
  - **late** is the "pre-final". It starts a random 3–8 songs before the expected win, and sometimes as a false alarm. **final** covers about the last 1–3 songs.
  - The Phase climbs towards the Line (it may reach final), resets once a Line is confirmed valid, then climbs towards the Bingo. Presenters can override it.
- **Heat** on the projector follows the Phase with some randomness and never reveals how many songs are left. Its visual design will be iterated separately later.
- **Simulation** with random cards: 77 songs and about 200 cards in play put the first Line around song 16 (80% of rounds between songs 11 and 21) and the Bingo around song 50 (45–55). That matches last year.

## Claims, Check and Celebration

The engine must support these now; the full flow is built later.

- **Check:**
  1. After a Claim, the presenters go into Hold and enter the card number on the tablet.
  2. The projector shows the card as a grid.
  3. The songs play in order as 2–3 s hook snippets. A song that has landed gets ✓. One that hasn't plays "broken" (a short warble or bitcrush, never annoying) and gets ✗.
  4. A Line check plays only the 4 songs of the completed row. A Bingo check plays all 12. Throughout, the Hold music stays ducked far down.
- **Celebration:**
  - After a successful check: an impact and a victory lap of the drum.
  - The presenters choose between keeping the **Winning song** (looping its chorus) and a victory track. The defaults are the Winning song for a Line, and a victory track flowing into the Interval for a Bingo.
  - There is no prize ceremony. Winners' names are noted, and they collect their prizes later.
- **Possible winners:** after each landing, the tablet privately lists the cards that now have a Line or a Bingo. They're marked "possible", because unsold cards count too. This never appears on the projector.

## Cards in play

- Cards in play are entered once for the whole game, normal and special ranges together.
- Each round counts only the cards valid for it:
  - normal cards in regular rounds;
  - special cards only in the special round. These are `type: "especial"` in `apps/cards/dist/cards.json`, ids 400–699.
- The current app keeps a single game-wide list, which is a bug for this.

## Devices (ADR 0002)

- **Default:** the projector laptop plays both the audio and the drum, sharing one clock. A long cable runs through a USB audio interface or DI box to the mixer on stage. The laptop sits in the first row or at the side of the stage.
- **Split mode:** the system must also support the audio playing on a separate device near the mixer, with the drum kept in sync through landing times announced in advance.
- **Network and hosting:** no router (the venue has none). See ADR 0003 and show-ui-and-platform-decisions.md.
- **Controls:**
  - One shared tablet (model still to be decided) and the admin phone run the console.
  - The console can do everything the Wii remote can.
  - The Wii remote is optional and pairs to the laptop through WebHID, which needs desktop Chrome.

## Interval

Interval music is a local playlist, downloaded the same way as the bingo songs and played by the same engine with simple transitions and no drum. Prizes and sponsors for the next round will show on the projector later.

## Proof-of-concept scope

- **In:**
  - real DJ transitions (layers, stems, stretch, Signatures, outside sounds) and hook adjustment;
  - landings synced with the drum;
  - Phase, with a placeholder Heat;
  - Pace with auto-advance, catch-up, and a basic end-time estimate and Drift;
  - Hold and Hold music;
  - Suspense, as an experiment;
  - Back as undo;
  - the possible-winners list;
  - a tablet remote: Next, Back, Hold, Pace, Suspense, sound effects;
  - a protocol ready for split devices;
  - MIDI and ArtCraft tooling, in a later milestone of the proof of concept.
- **Later:**
  - the Shuffle animation;
  - Prizes and sponsors on screen, and the tablet cheat sheet;
  - the Check flow and Celebration polish;
  - Decoys, as a separate experiment;
  - Interval music;
  - the Wii remote;
  - the Heat visual design;
  - a pool-size report in card generation: expected songs to the Line and the Bingo, and round length, for a given pool size and number of cards sold.
