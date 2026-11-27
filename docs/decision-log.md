# Decision log

Every decision about the Quina Musical, with an ID, a date, a status, what it replaced, and where the rule lives now. The log keeps the history and the reasons; the current rules are in [requirements/](requirements), and [event.md](event.md) is the root they come from.

- **The two interviews are frozen records.** [mixer-design-decisions.md](mixer-design-decisions.md) (23 Nov) and [show-ui-and-platform-decisions.md](show-ui-and-platform-decisions.md) (24 Nov, with its "Changes" section) stay as written. This log is the index over them and over everything decided since.
- **The big architectural decisions** are the [ADRs](adr). Each has an entry here that links to it.
- Terms follow [GLOSSARY.md](../GLOSSARY.md).

## IDs

- **R1-Q1 … R1-Q38:** the first interview (23 Nov, the mixer).
- **R2-Q1 … R2-Q38 and P1 … P15:** the second interview (23–24 Nov, the screens, the player app and hosting). It restarted the Q numbering, so every Q number exists in both interviews. P numbers exist only in the second, so they need no prefix.
- **Sub-IDs** are kept as asked: R2-Q1a–f, R2-Q2b, R2-Q3b, R2-Q5b, P3b. A question asked again in a revised version keeps its plain ID, and its entry records the final answer (the user asked never to mark revisions with ′ or ″).
- **D1, D2 …:** decisions made after or outside the interviews, in date order.
- **ADR-0001 … ADR-0003:** the ADRs.
- **U1, U2 …** are the open questions in [open-questions.md](open-questions.md), not decisions. When one is answered, its answer gets a D number here.
- **Bare numbers elsewhere:** "Q12" and "Q26" in other docs mean R2-Q12 and R2-Q26. "Q34" for the Wii remote mapping means its final version, R2-Q38.
- **The interviews' own "Round 1", "Round 2" headings** are batches of questions inside one interview. They are not the R in these IDs.

## Statuses

- **Active:** in force as recorded.
- **Amended by X:** in force, with X changing part of it. Read both.
- **Superseded by X:** replaced. Read X instead.
- **Pending (Un):** waiting on the user; the default in force is stated.
- **Retired:** dropped, or a one-off action that is done.

## Adding an entry

1. Take the next free D number. IDs are never reused or renumbered.
2. Write the heading as `ID · title · date · status`, then one to three sentences, then the trailer line: who decided, the source, what it supersedes, and where it lives in the requirements.
3. **By** is "the user", "the user via canvas", "the orchestrator", or "the sessions, agreed". Only log real decisions: the user's, or a role's within its remit. An unconfirmed proposal is Pending, or left out.
4. Update the status of every entry it amends or supersedes.
5. When a decision answers an open question, name the U number and move the question to "Answered" in open-questions.md.
6. Dates are the venue's local date; transcript times are UTC (Z). The repo is public: no people's or businesses' names, no emails, no secrets.

---

## The first interview (23 Nov): the mixer

Recorded in [mixer-design-decisions.md](mixer-design-decisions.md). The user answered in four batches: 19:11Z (Q1–Q7), 20:33Z (Q8–Q16), 21:02Z (Q17–Q27), 21:24Z (Q28–Q32) and 21:44Z (Q33–Q38).

### R1-Q1 · The Queue decides, the drum reveals · 2026-11-23 · Active
A shuffle fixes each round's order at its start; the drum only stages the reveal of the next song in the Queue.
By: the user. Source: mixer-design-decisions.md › Order and drum; transcript 2026-11-23T19:11Z. ADR: [ADR-0001](#adr-0001--the-queue-decides-the-drum-reveals--2026-11-23--active). Lives in: requirements/show-and-music.md › The Shuffle and the Queue.

### R1-Q2 · Auto-advance · 2026-11-23 · Superseded by R1-Q8
The user leaned towards songs advancing by themselves, with the presenters setting how fast and holding when they need to talk. It became the Pace model of R1-Q8.
By: the user. Source: transcript 2026-11-23T19:11Z. Lives in: requirements/show-and-music.md › Auto-advance, Pace and Drift.

### R1-Q3 · Where the music plays · 2026-11-23 · Superseded by R1-Q14
Not answered directly: the user described the venue (speakers on stage, projector far away, the Wii remote's range at its limit) to inform R1-Q14.
By: the user. Source: transcript 2026-11-23T19:11Z. Lives in: requirements/operations.md › Where things run.

### R1-Q4 · Teases of the next song · 2026-11-23 · Active
Rejected the "low-pass only, last 1–2 bars" rule. Teases are welcome with whatever filtering suits the pair, like a real DJ layering tracks. Recognising a song early is fine. Bluffs come later and must resolve clearly, so nobody thinks a tease counted.
By: the user. Source: mixer-design-decisions.md › Transitions; transcript 2026-11-23T19:11Z. Lives in: requirements/show-and-music.md › Teases, Signatures and Decoys.

### R1-Q5 · Songs land on a Hook · 2026-11-23 · Amended by R2-Q33
Every song lands on a Hook, never at a random point, and "Hook" is the term. Last year's hand tags are approximate starting points that need adjusting.
By: the user. Source: mixer-design-decisions.md › Transitions; transcript 2026-11-23T19:11Z. Lives in: requirements/songs-and-cards.md › Hooks.

### R1-Q6 · Transition, Spin, Landing · 2026-11-23 · Active
The three terms for the moving parts.
By: the user. Source: transcript 2026-11-23T19:11Z. Lives in: GLOSSARY.md.

### R1-Q7 · Lines matter too · 2026-11-23 · Active
The proposal to build only towards the full card was turned down: the show builds towards the Line as well, even though Line predictions are less exact. On a claim the songs pause, but the music never stops.
By: the user. Source: transcript 2026-11-23T19:11Z. Lives in: requirements/show-and-music.md › Phase, Heat and the Final Lap.

### R1-Q8 · Pace and Hold · 2026-11-23 · Active
Songs auto-advance at a Pace set from the tablet with presets and fine steps; Next skips at once; Hold stops landings and ducks the music. The console also shows when the round and the night will end and the Drift, counting claims and Intervals. Defaults from last year: about 22 s in the first round, about 14 s after.
By: the user. Source: mixer-design-decisions.md › Pace, auto-advance and schedule; transcript 2026-11-23T20:33Z. Supersedes: R1-Q2. Lives in: requirements/show-and-music.md › Auto-advance, Pace and Drift.

### R1-Q9 · The Spin overlaps the playing song · 2026-11-23 · Active
The Spin takes about half the Pace (3–11 s) while the landed song keeps playing, and late fancy transitions may stretch a slot by about 50%. The user added the goal: the night, not only the mixing. The presenters must keep control and get moments like last year's "eh eh eh".
By: the user. Source: mixer-design-decisions.md › The goal is a great night; transcript 2026-11-23T20:33Z. Lives in: requirements/show-and-music.md › The drum and the Landing.

### R1-Q10 · Round, Line, Bingo · 2026-11-23 · Active
The internal terms. The user asked for more terms (the set of rounds, the in-between time, a fake tease), answered in R1-Q17.
By: the user. Source: transcript 2026-11-23T20:33Z. Lives in: GLOSSARY.md.

### R1-Q11 · A claim puts the show in Hold · 2026-11-23 · Active
On a claim no song lands, the music keeps playing underneath, and the round resumes whatever the result. The user also asked for a public Check, built later as R1-Q24.
By: the user. Source: transcript 2026-11-23T20:33Z. Lives in: requirements/game-rules.md › Claims.

### R1-Q12 · Phase from the next win · 2026-11-23 · Amended by R1-Q20
The Phase is computed from the cards in play and the Queue, climbs to the Line, resets once a Line is confirmed valid, then climbs to the Bingo. The Line may reach final too. The user asked for Heat and a "pre-final".
By: the user. Source: mixer-design-decisions.md › Phase and Heat; transcript 2026-11-23T20:33Z. Lives in: requirements/show-and-music.md › Phase, Heat and the Final Lap.

### R1-Q13 · Real DJ layering · 2026-11-23 · Amended by D7, D13
Overlaps, stems, tempo matching up to about ±8%, key checks, offline preparation, plus outside sounds, iconic isolated parts and mashups. This replaced the research's "effect bridge, no stretching".
By: the user. Source: mixer-design-decisions.md › Transitions; transcript 2026-11-23T20:33Z. Lives in: requirements/show-and-music.md › Transitions.

### R1-Q14 · Audio and drum on the laptop, split mode supported · 2026-11-23 · Amended by R2-Q1d
The laptop plays both by default, and the system must also support audio on a separate device. The "own router" part is gone: there is no router (R2-Q1d).
By: the user. Source: mixer-design-decisions.md › Devices; transcript 2026-11-23T20:33Z. Supersedes: R1-Q3. ADR: [ADR-0002](#adr-0002--audio-and-drum-may-run-on-different-devices--2026-11-23--active). Lives in: requirements/operations.md › Where things run.

### R1-Q15 · The presenters' tablet · 2026-11-23 · Amended by R1-Q25, D27
The tablet shows the playing and next songs, Pace, Next, Hold, Claims, round start and end, and effects. The user added a prize cheat sheet with each prize's sponsor, and kept the Wii remote. Prizes in the Interval were later replaced by prize secrecy (D27).
By: the user. Source: transcript 2026-11-23T20:33Z. Lives in: requirements/screens.md › Console, Cheat sheet.

### R1-Q16 · Record R1-Q1 as an ADR; the order is immutable · 2026-11-23 · Active
Yes to the ADR. Nobody, not even an admin, may move songs once the order is decided, and a Shuffle animation shows the grid going into the drum.
By: the user. Source: mixer-design-decisions.md › Order and drum; transcript 2026-11-23T20:33Z. Lives in: requirements/show-and-music.md › The Shuffle and the Queue.

### R1-Q17 · Game, Interval, Decoy · 2026-11-23 · Amended by D42
Three more terms. A Decoy is now only what a Suspense teases (D42).
By: the user. Source: transcript 2026-11-23T21:02Z. Lives in: GLOSSARY.md.

### R1-Q18 · Suspense · 2026-11-23 · Amended by D10, R2-Q38
The presenters hold a transition open while it builds; Release lands on the phrase; it releases by itself after about 30 s and never starts by itself. The user flagged it as experimental.
By: the user. Source: mixer-design-decisions.md › Presenter-controlled moments; transcript 2026-11-23T21:02Z. Lives in: requirements/show-and-music.md › The presenters' actions.

### R1-Q19 · Schedule and Drift · 2026-11-23 · Amended by R1-Q30
The Schedule and the Drift, with claim and Interval times from last year. The user wanted the system to catch up gently by itself, not only suggest a Pace.
By: the user. Source: transcript 2026-11-23T21:02Z. Lives in: requirements/show-and-music.md › Auto-advance, Pace and Drift.

### R1-Q20 · Phase from the chance of a win · 2026-11-23 · Active
The Phase comes from a blurred probability, its thresholds scale with the cards in play, late starts 3–8 songs early and sometimes falsely, final covers the last 1–3 songs. This year's pool size may differ; the user is open to the system suggesting it.
By: the user. Source: mixer-design-decisions.md › Phase and Heat; transcript 2026-11-23T21:02Z. Lives in: requirements/show-and-music.md › Phase, Heat and the Final Lap.

### R1-Q21 · Heat on the projector · 2026-11-23 · Active
Heat follows the Phase with some randomness and never shows how many songs are left. Its design is iterated with the user later.
By: the user. Source: transcript 2026-11-23T21:02Z. Lives in: requirements/show-and-music.md › Phase, Heat and the Final Lap.

### R1-Q22 · Signatures and outside sounds · 2026-11-23 · Amended by R2-Q27, D9
Signatures, stems and outside sounds can be layered. The user can install tools such as MIDI software or ArtCraft.
By: the user. Source: mixer-design-decisions.md › Transitions; transcript 2026-11-23T21:02Z. Lives in: requirements/show-and-music.md › Teases, Signatures and Decoys.

### R1-Q23 · Prizes · 2026-11-23 · Amended by D27, D31
Each round has Line and Bingo prizes, each item with a Sponsor, reassignable until the round is played, with generated images. Not part of the first build.
By: the user. Source: transcript 2026-11-23T21:02Z. Lives in: requirements/game-rules.md › Prizes and bundles.

### R1-Q24 · The public Check · 2026-11-23 · Amended by R2-Q11, D49
The card shows as a grid, its songs play as hook snippets with ✓, or "broken" with ✗. The user adds looping video-game Hold music while the round waits to resume.
By: the user. Source: mixer-design-decisions.md › Claims, Check and Celebration; transcript 2026-11-23T21:02Z. Lives in: requirements/game-rules.md › The Check; requirements/show-and-music.md › Hold music and the Check's sound.

### R1-Q25 · The Wii remote stays, optional · 2026-11-23 · Amended by R2-Q1f, R2-Q38
The remote stays, but it is optional: the tablet must do everything it can. The spare stage laptop as a bridge was not needed once the laptop sits near the stage (R2-Q1f).
By: the user. Source: mixer-design-decisions.md › Devices; transcript 2026-11-23T21:02Z. Lives in: requirements/screens.md › Wii remote.

### R1-Q26 · Interval music is local · 2026-11-23 · Active
The Interval playlist is downloaded like the songs and played by the same engine.
By: the user. Source: mixer-design-decisions.md › Interval; transcript 2026-11-23T21:02Z. Lives in: requirements/show-and-music.md › The Interval and the throw breaks.

### R1-Q27 · The presenters have the final word · 2026-11-23 · Active
Every automatic behaviour can be overridden live; when the presenters do nothing, the show goes on by itself.
By: the user. Source: mixer-design-decisions.md › The goal is a great night; transcript 2026-11-23T21:02Z. Lives in: requirements/show-and-music.md › The presenters' actions.

### R1-Q28 · No double presses · 2026-11-23 · Active
Next is ignored while a transition runs. The proposed "Back as Replay" was turned down: Back undoes a landing (R1-Q33). The user also asked that auto-advance stop near a probable win (R1-Q34).
By: the user. Source: transcript 2026-11-23T21:24Z. Lives in: requirements/show-and-music.md › The presenters' actions.

### R1-Q29 · When Hold music plays; the Pool · 2026-11-23 · Active
Hold music after a Check and on a long Hold; "Pool" names the songs the cards are printed from. The user added the Celebration music choice (R1-Q36) and "the music never stops, unless silence is intended".
By: the user. Source: transcript 2026-11-23T21:24Z. Lives in: requirements/show-and-music.md › Hold music and the Check's sound.

### R1-Q30 · Catch-up up to ±20% · 2026-11-23 · Active
The Pace is nudged by up to ±20% to recover Drift, only in the early and mid Phases; the presenters can lock it.
By: the user. Source: transcript 2026-11-23T21:24Z. Lives in: requirements/show-and-music.md › Auto-advance, Pace and Drift.

### R1-Q31 · A pool-size report · 2026-11-23 · Active
Card generation reports the expected songs to the first Line and Bingo, and the round length, for a pool size and a number of cards sold.
By: the user. Source: mixer-design-decisions.md › Proof-of-concept scope (Later); transcript 2026-11-23T21:24Z. Lives in: requirements/songs-and-cards.md › The pool's size.

### R1-Q32 · The first build's scope · 2026-11-23 · Superseded by R2-Q29, D42
MIDI and ArtCraft in a later milestone; Decoys as a separate experiment after the main build. Since R2-Q29 nothing is a proof of concept, and D42 retired the Decoys experiment.
By: the user. Source: mixer-design-decisions.md › Proof-of-concept scope; transcript 2026-11-23T21:24Z. Lives in: (none; history only).

### R1-Q33 · Back undoes a landing · 2026-11-23 · Active
The last song stops counting and becomes the next song again; the drum turns back one card; the show goes into Hold. It can be pressed several times, and during a Spin it cancels the Spin.
By: the user. Source: mixer-design-decisions.md › Presenter-controlled moments; transcript 2026-11-23T21:44Z. Lives in: requirements/show-and-music.md › The presenters' actions; requirements/game-rules.md › Ties, late claims and going back.

### R1-Q34 · Manual control at the end · 2026-11-23 · Active
In the final Phase auto-advance is off by default, with a switch to keep it on; if on, a probable winning landing gets a slot about 50% longer.
By: the user. Source: mixer-design-decisions.md › Pace, auto-advance and schedule; transcript 2026-11-23T21:44Z. Lives in: requirements/show-and-music.md › Auto-advance, Pace and Drift.

### R1-Q35 · Possible winners, privately · 2026-11-23 · Superseded by D15
The tablet privately lists cards that now have a Line or a Bingo, marked "possible". It became the Futur tab.
By: the user. Source: mixer-design-decisions.md › Claims, Check and Celebration; transcript 2026-11-23T21:44Z. Lives in: requirements/screens.md › Console.

### R1-Q36 · The Celebration · 2026-11-23 · Active
An impact and a victory lap; the Winning song for a Line and a victory track into the Interval for a Bingo by default. There is no prize ceremony: winners are noted and collect their prizes later.
By: the user. Source: mixer-design-decisions.md › Claims, Check and Celebration; transcript 2026-11-23T21:44Z. Lives in: requirements/show-and-music.md › The Celebration's music; requirements/game-rules.md › Winners.

### R1-Q37 · Cards in play count per round · 2026-11-23 · Amended by R2-Q36
The cards in play are entered once, together, and each round counts only the cards valid for it. The single game-wide list was a bug.
By: the user. Source: mixer-design-decisions.md › Cards in play; transcript 2026-11-23T21:44Z. Lives in: requirements/game-rules.md › Cards in play.

### R1-Q38 · Commit the glossary and ADRs, brief the builder · 2026-11-23 · Retired
A one-off action, done.
By: the user. Source: transcript 2026-11-23T21:44Z.

### ADR-0001 · The Queue decides, the drum reveals · 2026-11-23 · Active
[adr/0001-queue-decides-drum-reveals.md](adr/0001-queue-decides-drum-reveals.md). From R1-Q1 and R1-Q16.
By: the user. Lives in: requirements/show-and-music.md › The Shuffle and the Queue, The drum and the Landing.

### ADR-0002 · Audio and drum may run on different devices · 2026-11-23 · Active
[adr/0002-audio-and-drum-may-run-on-different-devices.md](adr/0002-audio-and-drum-may-run-on-different-devices.md). From R1-Q14.
By: the user. Lives in: requirements/operations.md › Where things run.

---

## The second interview (23–24 Nov): screens, the player app and hosting

Recorded in [show-ui-and-platform-decisions.md](show-ui-and-platform-decisions.md). The questions were asked from 2026-11-23T22:39Z; the answers came from 23:25Z on 23 Nov to 17:35Z on 24 Nov, all on 24 Nov local time.

### R2-Q1 · A local game store · 2026-11-24 · Superseded by R2-Q1e
A store on the laptop owning the Game was proposed; the user asked to reconsider it with Cloudflare hosting.
By: the user. Source: transcript 2026-11-23T23:25Z.

### R2-Q1a · Local first, the laptop as authority · 2026-11-24 · Superseded by R2-Q1e
Rejected: the user felt too exposed with everything on one laptop, wanted an online server with a laptop Plan B, and ruled out a router.
By: the user. Source: transcript 2026-11-24T00:47Z.

### R2-Q1b · Cloudflare, free tier first · 2026-11-24 · Active
Cloudflare for the cloud. Try the free tier and upgrade on the spot only if a limit is hit; a load test of 400 phones before the night, usage checked at the rehearsal, no heavy testing on the day. (Asked twice; the second version was accepted.)
By: the user. Source: show-ui-and-platform-decisions.md › Hosting and architecture; transcript 2026-11-24T00:47Z, 01:35Z. Lives in: requirements/operations.md › The free tier.

### R2-Q1c · Game data in SQLite on the laptop · 2026-11-24 · Superseded by R2-Q1e
The cloud became the source of truth instead, and the laptop keeps a local copy for offline running.
By: the user. Source: transcript 2026-11-24T00:47Z.

### R2-Q1d · Connectivity in the tent · 2026-11-24 · Active
No router. The laptop is tethered by USB to a phone, with a second phone on another carrier as a backup hotspot; the tablet uses that hotspot. (Asked twice; the second version was accepted.)
By: the user. Source: show-ui-and-platform-decisions.md › Hosting and architecture; transcript 2026-11-24T00:47Z, 01:35Z. Supersedes: R1-Q14's router. Lives in: requirements/operations.md › Where things run.

### R2-Q1e · The cloud owns the Game, the laptop owns playback · 2026-11-24 · Active
The cloud is the single source of truth; the laptop plays, journals every landing and carries on alone offline; any prepared device resumes from the cloud.
By: the user. Source: show-ui-and-platform-decisions.md › Hosting and architecture; transcript 2026-11-24T01:35Z. Supersedes: R2-Q1, R2-Q1a, R2-Q1c. ADR: [ADR-0003](#adr-0003--the-cloud-owns-the-game-the-laptop-owns-playback--2026-11-24--active). Lives in: requirements/operations.md › Where things run.

### R2-Q1f · A simple Plan B when 5G drops · 2026-11-24 · Active
The laptop sits in the front row or at the side of the stage, so its keys and the Wii remote are in reach, and a console on the laptop's hotspot loads from the laptop and talks to it directly. The user asked to keep it simple. (Asked in three versions; this is the final one.)
By: the user. Source: show-ui-and-platform-decisions.md › Hosting and architecture (Plan B); transcript 2026-11-24T01:35Z. Lives in: requirements/operations.md › Plan B and resume codes, Fallbacks.

### R2-Q2 · What the screens are built with · 2026-11-24 · Superseded by R2-Q2b
The user wanted typed code (never untyped JS), no React, and to confirm the framework.
By: the user. Source: transcript 2026-11-23T23:25Z.

### R2-Q2b · TypeScript, Vite and Svelte 5 · 2026-11-24 · Active
TypeScript everywhere with Vite, Svelte 5 for the console, Admin and player app, plain TypeScript for the projector scenes. The engine was converted to `.ts` too. Never React.
By: the user. Source: show-ui-and-platform-decisions.md › Stack; transcript 2026-11-24T00:24Z. Supersedes: R2-Q2. Lives in: docs/team.md.

### R2-Q3 · "Ronda" and "Partida" on screen · 2026-11-24 · Superseded by R2-Q3b
Rejected: in the town "quina" means both the round and the game, so new words would confuse people.
By: the user. Source: transcript 2026-11-23T23:41Z.

### R2-Q3b · The words on screen · 2026-11-24 · Amended by D24
Rounds are "Quina 3", a Line is "Línia", the full-card win is "Quina!" ("premi de quina"), and the night is just "Quina Musical". The user's "q3d yes" was read as Q3b.
By: the user. Source: show-ui-and-platform-decisions.md › Rules of the game; transcript 2026-11-24T01:05Z. Supersedes: R2-Q3. Lives in: requirements/screens.md › Every screen.

### R2-Q4 · One shared tablet · 2026-11-24 · Active
Not two tablets: the presenters share one.
By: the user. Source: transcript 2026-11-23T23:41Z. Lives in: requirements/screens.md › Console.

### R2-Q5 · Several winners · 2026-11-24 · Amended by D48
Winners on the same landing agree on the split; an unclaimed win is lost. "Not registered as sold" is a warning, not a rejection; a card of the wrong type is invalid. The user proposed the tie-free Shuffle (R2-Q5b).
By: the user. Source: show-ui-and-platform-decisions.md › Rules of the game; transcript 2026-11-23T23:41Z. Lives in: requirements/game-rules.md › Ties, late claims and going back, The Check.

### R2-Q5b · The tie-free Shuffle · 2026-11-24 · Active
The Shuffle reshuffles deterministically from the same seed until neither the first Line nor the first Quina is shared by two cards in play. The rule is public.
By: the user. Source: show-ui-and-platform-decisions.md › Rules of the game (Shuffle); transcript 2026-11-24T01:05Z. Lives in: requirements/game-rules.md › Ties, late claims and going back.

### R2-Q6 · A 4:3 projector, far away · 2026-11-24 · Active
Only big elements; ready for 16:9 too.
By: the user. Source: show-ui-and-platform-decisions.md › Projector; transcript 2026-11-23T23:41Z. Lives in: requirements/screens.md › Projector.

### R2-Q7 · Design before code · 2026-11-24 · Active
Every screen and animation starts as a mockup artifact for the user's feedback.
By: the user. Source: show-ui-and-platform-decisions.md › Who builds what; transcript 2026-11-23T23:41Z. Lives in: docs/team.md; requirements/screens.md › Every screen.

### R2-Q8 · The console opens on the tech's phone too · 2026-11-24 · Active
The same console page opens on the admin phone, and several consoles at once must work. No separate admin version of the controls.
By: the user. Source: show-ui-and-platform-decisions.md › Console; transcript 2026-11-23T23:41Z. Lives in: requirements/screens.md › Console.

### R2-Q9 · A new player app · 2026-11-24 · Active
The phone app is built completely new.
By: the user. Source: transcript 2026-11-23T23:45Z. Lives in: requirements/screens.md › Player app.

### R2-Q10 · Juicy for players, simpler inside · 2026-11-24 · Amended by P8
The projector and player app get a juicy video-game style; the console and Admin can be simpler, but the console's layout must be planned in advance.
By: the user. Source: show-ui-and-platform-decisions.md › Style and assets; transcript 2026-11-23T23:45Z. Lives in: requirements/screens.md › Every screen.

### R2-Q11 · Who decides a Check · 2026-11-24 · Amended by D33, D49
A number outside the printed cards is invalid. "Not sold" is only a private warning. A presenter confirms or invalidates every card, and both are recorded. Forgeries are assumed not to happen.
By: the user. Source: show-ui-and-platform-decisions.md › Rules of the game (Validity); transcript 2026-11-24T00:10Z. Lives in: requirements/game-rules.md › The Check.

### R2-Q12 · Late claims · 2026-11-24 · Amended by D50
The first to claim wins; claims on the same landing share. A late claimer wins if nobody else claimed. The user's own view on the other late cases (the late claimer shouldn't take the prize alone) needed the team's confirmation.
By: the user. Source: show-ui-and-platform-decisions.md › Rules of the game (Claims); transcript 2026-11-24T00:10Z. Lives in: requirements/game-rules.md › Ties, late claims and going back.

### R2-Q13 · Several claims at once · 2026-11-24 · Active
Every claimed card is checked before the round moves on.
By: the user. Source: transcript 2026-11-24T00:10Z. Lives in: requirements/game-rules.md › Claims.

### R2-Q14 · The Shuffle, with no fairness proof · 2026-11-24 · Active
The presenters start the round and the Shuffle runs, with an item-box style sound; the covers fly in an order unrelated to the Queue. No fairness code on screen: a code the organizers show proves nothing. Trust comes from familiar animations, and anyone curious can have an AI read the public code. The seeds are kept for debugging. (A revised fairness-code proposal was rejected.)
By: the user. Source: show-ui-and-platform-decisions.md › Rules of the game (Shuffle); transcript 2026-11-24T00:10Z, 00:35Z. Lives in: requirements/show-and-music.md › The Shuffle and the Queue.

### R2-Q15 · What the Interval shows · 2026-11-24 · Superseded by D27, D32
Next prizes in rotation and last round's winning card numbers were dropped by prize secrecy and by "no winning card numbers". The countdown, progress and sponsor thanks stay.
By: the user. Source: transcript 2026-11-24T00:10Z. Lives in: requirements/screens.md › Projector.

### R2-Q16 · Prize and sponsor data · 2026-11-24 · Amended by D31, R2-Q28
Entered in bulk by an AI agent, and logos need cleaning (many are JPEGs with white backgrounds or padding).
By: the user. Source: show-ui-and-platform-decisions.md › Admin; transcript 2026-11-24T00:10Z. Lives in: requirements/screens.md › Admin; requirements/game-rules.md › Sponsors.

### R2-Q17 · The cheat sheet, printed too · 2026-11-24 · Active
The cheat sheet is on the tablet and as a basic printable PDF, loaded from the organizers' spreadsheet by an agent. Little effort on the paper version.
By: the user. Source: show-ui-and-platform-decisions.md › Who builds what; transcript 2026-11-24T00:10Z. Lives in: requirements/screens.md › Cheat sheet.

### R2-Q18 · "Final Lap!" at late · 2026-11-24 · Active
The fanfare plays when the Phase first reaches late, once per climb, and is also on the pad, with a console switch to turn it off. Playing it at final would give the ending away.
By: the user. Source: show-ui-and-platform-decisions.md › Style and assets (Audio); transcript 2026-11-24T00:12Z. Lives in: requirements/show-and-music.md › Phase, Heat and the Final Lap.

### R2-Q19 · Names for the screens · 2026-11-24 · Amended by D14
Projector, Console, Admin, Player app.
By: the user. Source: transcript 2026-11-24T01:05Z. Lives in: GLOSSARY.md.

### R2-Q20 · What the console contains · 2026-11-24 · Amended by D15, D34
The content list by moment, with the user's changes: risky buttons need a long press with an animation, and a tap shows a "hold to confirm" popover; possible winners hidden until asked for; the Celebration music is only a suggested default; a winner-name field plus notes; the Interval countdown is only a guide, because a round never starts by itself.
By: the user. Source: show-ui-and-platform-decisions.md › Console; transcript 2026-11-24T01:05Z. Lives in: requirements/screens.md › Console.

### R2-Q21 · The console's shape · 2026-11-24 · Active
Landscape on the tablet, portrait on a phone, with Next, Hold and Claim in the same places in both.
By: the user. Source: show-ui-and-platform-decisions.md › Console; transcript 2026-11-24T01:05Z. Lives in: requirements/screens.md › Console.

### R2-Q22 · One owner for the whole console · 2026-11-24 · Active
The UI/UX role builds the whole console, show controls included; the engine role owns the engine and the protocol.
By: the user. Source: show-ui-and-platform-decisions.md › Who builds what; transcript 2026-11-24T01:14Z. Lives in: docs/team.md.

### R2-Q23 · What Admin contains · 2026-11-24 · Amended by R2-Q36, D22
Setup (cards in play as ranges, the rounds plan, prizes and sponsors with bulk JSON import and export, the Schedule), the night (start and end, Plan B resume, winners, cards opened on phones), player-app settings and tools.
By: the user. Source: show-ui-and-platform-decisions.md › Admin; transcript 2026-11-24T01:35Z. Lives in: requirements/screens.md › Admin.

### R2-Q24 · The projector during a round · 2026-11-24 · Amended by D2, D32
The drum, the current song big, only the last 3 songs, the round name and the Heat; no QR or URL during play. The user asked for the other states too (R2-Q25).
By: the user. Source: show-ui-and-platform-decisions.md › Projector; transcript 2026-11-24T01:35Z. Lives in: requirements/screens.md › Projector.

### R2-Q25 · The show's states · 2026-11-24 · Amended by D21, D26, D27, D32, D34
The states table for the projector and phones: before the Game, round start, in play, Hold, Claim and Check, Celebration, Interval, after the Game, technical pause.
By: the user. Source: show-ui-and-platform-decisions.md › Projector, Player app; transcript 2026-11-24T01:53Z. Lives in: requirements/screens.md › Projector, Player app.

### R2-Q26 · Where the show runs: A+ · 2026-11-24 · Active
An installed show laptop (repo, Node, the local relay, the cloud link) with its media pulled from the cloud, so any laptop is show-ready with one setup command. The offline hotspot console and the best-quality blends stay. "Nothing installed" is deferred until after this year's event.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T17:35Z. Lives in: requirements/operations.md › Where things run, The spare laptop.

### R2-Q27 · Signatures picked automatically · 2026-11-24 · Amended by D9
The best candidate above a quality score is used, with a veto per song; no approval of every candidate by hand.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T08:53Z. Lives in: requirements/show-and-music.md › Teases, Signatures and Decoys.

### R2-Q28 · A private logo library, in JPEG XL · 2026-11-24 · Active
Logos are other businesses' artwork: kept privately in the cloud, cleaned in bulk keeping the originals, picked from Admin. Images are JPEG XL with a PNG or JPEG fallback, never WebP.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T08:53Z. Lives in: requirements/screens.md › Every screen, Admin.

### R2-Q29 · The repo layout; not a proof of concept · 2026-11-24 · Active
apps/, packages/, tools/prep, data/ and legacy/2025. The user: the new code is this year's app, not a POC.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T08:49Z, 08:53Z. Supersedes: R1-Q32. Lives in: docs/team.md.

### R2-Q30 · The Desgraciat round · 2026-11-24 · Amended by D43, D44, D57, D62
The round the user introduced at 09:25Z: a card is out as soon as any of its songs lands; the last standing wins; the console privately shows the cards still standing and the presenters call the winner; the Shuffle avoids a tie at the end; the Check shows none of its songs landed; Phase and Heat climb as fewer cards stand; phones show "Dempeus" or "Assegut"; one per night, movable. Which card type it uses was left open here.
By: the user. Source: show-ui-and-platform-decisions.md › Changes (The Desgraciat round); transcript 2026-11-24T09:25Z, 17:15Z. Lives in: requirements/game-rules.md › The Quina del Desgraciat.

### R2-Q31 · The presenters' eight actions · 2026-11-24 · Amended by D34
Següent, Parlem (Hold, ducked), Aguanta (new: no landing, full volume, from the user's request), Suspens, Enrere (long press), Comprovar cartró, Efectes, Ritme. The user asked to define the Wii mapping (R2-Q38).
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T11:59Z, 12:06Z. Lives in: requirements/show-and-music.md › The presenters' actions.

### R2-Q32 · A subtle near-win cue · 2026-11-24 · Active
The missing song is gently highlighted on that card's grid. No banner, and no win is ever announced.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T12:06Z. Supersedes: P3, P14. Lives in: requirements/screens.md › Player app.

### R2-Q33 · This year's hooks are detected automatically · 2026-11-24 · Amended by D47
Detected from the song's structure, an energy jump and the vocals coming in, snapped to phrases; the user approves, rejects or nudges each one on the audition page.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T12:06Z. Lives in: requirements/songs-and-cards.md › Hooks.

### R2-Q34 · The Wii mapping, first version · 2026-11-24 · Superseded by R2-Q37
The user asked to iterate: A only as a hold button, HOME for auto-advance, Claim off the remote.
By: the user. Source: transcript 2026-11-24T17:15Z.

### R2-Q35 · A round's prizes unlock at its intro · 2026-11-24 · Active
Not in the Interval, as proposed: a round's bundle appears on the projector and phones at the round's intro, when the presenters present it.
By: the user. Source: show-ui-and-platform-decisions.md › Changes (Prize secrecy); transcript 2026-11-24T17:15Z. Lives in: requirements/game-rules.md › Prize secrecy.

### R2-Q36 · Card types come from the card generation · 2026-11-24 · Active
Type, colour, title and price come from the generated cards' files, not from Admin. Admin only chooses which type each round uses.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T17:15Z. Lives in: requirements/songs-and-cards.md › Card types; requirements/game-rules.md › The night's rounds.

### R2-Q37 · The Wii mapping, second version · 2026-11-24 · Superseded by R2-Q38
The user changed it again: − and + both Parlem, 1 and 2 held for Enrere, B held for Aguanta with a shake into Suspens, A for Següent, and a dialog showing the mapping.
By: the user. Source: transcript 2026-11-24T17:33Z.

### R2-Q38 · The Wii mapping · 2026-11-24 · Amended by D34, D36
A Següent; B held Aguanta; B held plus 3 strong shakes becomes Suspens, letting go lands; − or + Parlem; 1 or 2 held 1.5 s Enrere; HOME auto-advance on/off with different rumbles; D-pad 4 effects; Claim on the console only. Every action rumbles. An accidental A is safe, since Parlem and Aguanta cancel a running transition. A "Comandament" dialog shows the mapping.
By: the user. Source: show-ui-and-platform-decisions.md › Changes (Wii remote mapping); transcript 2026-11-24T17:33Z. Supersedes: R2-Q34, R2-Q37. Lives in: requirements/show-and-music.md › The presenters' actions; requirements/screens.md › Wii remote.

### P1 · Adding cards on the phone · 2026-11-24 · Active
Scan more QRs or type on a big "Afegir cartró" pad; each card has a colour and an optional name; removing asks first; cards stay on the phone, with no account; special cards show only in the special round.
By: the user. Source: show-ui-and-platform-decisions.md › Player app; transcript 2026-11-24T00:24Z. Lives in: requirements/screens.md › Player app.

### P2 · The latest song is never flagged · 2026-11-24 · Superseded by D17
Option (a): the phone never marked or flagged the latest song. Gone with the grace rule.
By: the user. Source: transcript 2026-11-24T00:24Z.

### P3 · The "1 song away" banner · 2026-11-24 · Superseded by R2-Q32
The user changed the marking rule here: the latest song is marked for a Line, never for a Bingo, and the app never says a Line is complete.
By: the user. Source: transcript 2026-11-24T00:24Z.

### P3b · The quiet grace rule · 2026-11-24 · Superseded by D17
The latest song stays unmarked only when it would complete a card, as an unexplained pleasant surprise; the app never says it gets marked later.
By: the user. Source: transcript 2026-11-24T01:14Z.

### P4 · The phone's five tabs · 2026-11-24 · Superseded by D19
Accepted for now, to be revisited after seeing the design. The reel stays generic until the landing, because a phone may only learn a song at its landing.
By: the user. Source: transcript 2026-11-24T00:24Z.

### P5 · Interface sounds, on by default · 2026-11-24 · Active
Interface sounds only, on by default. Admins can change the default for everyone remotely, but a player's own choice wins.
By: the user. Source: show-ui-and-platform-decisions.md › Player app; transcript 2026-11-24T00:24Z. Lives in: requirements/screens.md › Player app, Admin.

### P6 · Catalan only · 2026-11-24 · Active
No Spanish option.
By: the user. Source: transcript 2026-11-24T00:24Z. Lives in: requirements/screens.md › Every screen.

### P7 · Grandmother-proof · 2026-11-24 · Active
No install or account, big targets, high contrast, large text, one thumb, at most 2 taps away, plain words.
By: the user. Source: show-ui-and-platform-decisions.md › Player app; transcript 2026-11-24T00:24Z. Lives in: requirements/screens.md › The grandmother test.

### P8 · One game style everywhere · 2026-11-24 · Active
One mobile-game, Christmas design system for every screen. Barrakudes colours and the ninos are a starting point the user may drop.
By: the user. Source: show-ui-and-platform-decisions.md › Style and assets; transcript 2026-11-24T00:24Z. Lives in: requirements/screens.md › Every screen.

### P9 · The ninos in the repo · 2026-11-24 · Active
They may be committed, organised in a better place (now `brand/ninos/`). Only family-friendly ones are used.
By: the user. Source: show-ui-and-platform-decisions.md › Style and assets; transcript 2026-11-24T00:24Z. Lives in: requirements/screens.md › Every screen.

### P10 · A year-tagged QR · 2026-11-24 · Active
This year's cards are new, with a new paper colour and title, and their QR uses a link with the year (`/26/123`). Last year's `?c=` links show "Aquest cartró és de l'any passat". (First answered "same format"; the revised question was accepted.)
By: the user. Source: show-ui-and-platform-decisions.md › Player app; transcript 2026-11-24T00:35Z, 01:35Z. Lives in: requirements/songs-and-cards.md › The printed QR.

### P11 · Cards opened on phones · 2026-11-24 · Active
Admin sees which card numbers have been opened on phones, anonymously.
By: the user. Source: transcript 2026-11-24T00:35Z. Lives in: requirements/screens.md › Admin.

### P12 · Clearing last year's data on phones · 2026-11-24 · Amended by D4
The new app clears last year's service worker, caches and storage, and has an "Esborrar dades" button. Cards are kept per edition, so a rehearsal or a new Game never wipes them (D4).
By: the user, who asked that old phone data be cleaned up. Source: show-ui-and-platform-decisions.md › Player app; transcript 2026-11-24T00:35Z, 01:14Z. Lives in: requirements/game-rules.md › The Game and its edition; requirements/screens.md › Player app.

### P13 · Don't prepare the draft playlist yet · 2026-11-24 · Active
Work with last year's songs, enough to test everything and especially the effects; prepare the cards and songs once the playlist is final.
By: the user. Source: transcript 2026-11-24T01:14Z. Lives in: requirements/songs-and-cards.md › The pool.

### P14 · The banner names the missing song · 2026-11-24 · Superseded by R2-Q32
Option (a), until the banner was dropped.
By: the user. Source: transcript 2026-11-24T01:35Z.

### P15 · No hints from the screen · 2026-11-24 · Amended by D17, R2-Q32
A completed Line shows plain marks, with no glow or row highlight. The banner and end-of-round reveal parts no longer apply.
By: the user. Source: show-ui-and-platform-decisions.md › Player app; transcript 2026-11-24T01:35Z. Lives in: requirements/screens.md › Player app.

### ADR-0003 · The cloud owns the Game, the laptop owns playback · 2026-11-24 · Active
[adr/0003-cloud-owns-the-game-laptop-owns-playback.md](adr/0003-cloud-owns-the-game-laptop-owns-playback.md). From R2-Q1e, with the free tier of R2-Q1b. Its offline resume uses the round's resume code (D4); R2-Q26 keeps the laptop installed.
By: the user. Lives in: requirements/operations.md › Where things run, Plan B and resume codes, The free tier.

---

## Later decisions

### D1 · Animations are features · 2026-11-24 · Active
Every animation is planned and described (trigger, timing, sound, fallback) before it's coded, because animations are features.
By: the user. Source: transcript 2026-11-24T02:35Z; packages/ui/ANIMATIONS.md. Lives in: requirements/screens.md › Every screen.

### D2 · The first look at the mockups · 2026-11-24 · Active
The style is approved. The projector's drum goes big from side to side, outside any box, with the last 3 songs in a row under it; the Check uses less padding for a bigger card; the console gets icons on its buttons, the next song's cover, and a light theme (keeping both themes for the console only).
By: the user. Source: transcript 2026-11-24T02:35Z. Lives in: requirements/screens.md › Projector, Console.

### D3 · Generated song data stays out of git · 2026-11-24 · Active
What can't go in git goes to the private bucket and the database, so any laptop can run the Quina without files from one person's laptop.
By: the user. Source: show-ui-and-platform-decisions.md › Changes (Resolved); transcript 2026-11-24T08:49Z. Lives in: requirements/songs-and-cards.md › Song preparation; requirements/operations.md › Privacy.

### D4 · The overnight defaults accepted · 2026-11-24 · Active
The user approved the rest of the overnight defaults: the visual direction, the default console words (except Hold, see D6), the QR library, the admin login helper, phones keeping cards per edition, rehearsals on another day than the show (they share the free quota), Plan B resume codes, and the overnight screen behaviours.
By: the user. Source: show-ui-and-platform-decisions.md › Changes (Resolved from the open questions); transcript 2026-11-24T08:49Z. Lives in: requirements/operations.md › Plan B and resume codes, Rehearsals; requirements/game-rules.md › The Game and its edition.

### D5 · An icon per card · 2026-11-24 · Active
Each followed card gets its own icon and colour, always corn first, and marks its songs with its own icon. Ten in all: corn (yellow), then cyan, red, green, pink (a heart), orange, purple (grapes), white, black (a top hat) and brown (the Tió).
By: the user, then via canvas. Source: transcript 2026-11-24T08:49Z; canvas 2026-11-24T11:58Z, 13:22Z, 15:30Z. Lives in: requirements/screens.md › Player app.

### D6 · The Hold button reads "Parlem" · 2026-11-24 · Active
Not "Espera": "Parlem", with a microphone icon.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T08:49Z, 09:36Z. Lives in: requirements/show-and-music.md › The presenters' actions.

### D7 · Lighter early, impacts rare · 2026-11-24 · Active
Not every transition should be intense: light, quick, well-made ones at the start of a round, growing with the Phase, always produced DJ moves and never bare fades. The orchestra hit played too often: impacts are rare early, and the orchestra hit only comes late or in final, with a cooldown.
By: the user. Source: mixer-design-decisions.md › Changes after the first listen; transcript 2026-11-24T09:15Z. Lives in: requirements/show-and-music.md › Transitions.

### D8 · Vocal entries and call and response · 2026-11-24 · Active
A song whose lyrics start suddenly gets a quick, clean move into the voice. When both songs have vocals, they can feel continuous: a line of one answered by a line of the other.
By: the user. Source: mixer-design-decisions.md › Changes after the first listen; transcript 2026-11-24T09:15Z. Lives in: requirements/show-and-music.md › Transitions.

### D9 · Signatures are instrumental teases before the landing · 2026-11-24 · Active
Signatures were often lyrics played after the landing, which felt repetitive. They are instrumental pieces (an intro riff, the part before the chorus) teased before the next song lands.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T09:15Z. Amends: R1-Q22, R2-Q27. Lives in: requirements/show-and-music.md › Teases, Signatures and Decoys.

### D10 · Suspense keeps the current song · 2026-11-24 · Active
The playing song keeps going during a Suspense. The drum hovers over about 3 pending songs while their Decoys tease, then resolves to the real next song.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T09:25Z. Amends: R1-Q18. Lives in: requirements/show-and-music.md › The presenters' actions.

### D11 · The drum holds only pending songs · 2026-11-24 · Active
Landed songs leave the drum; Back puts one back.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T09:25Z. Lives in: requirements/show-and-music.md › The drum and the Landing.

### D12 · The round order can change live · 2026-11-24 · Active
Admin edits upcoming rounds during the event, for example to move the Desgraciat, and the laptop picks the changes up.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T09:25Z. Lives in: requirements/game-rules.md › The night's rounds.

### D13 · Landings on the phrase · 2026-11-24 · Active
Songs "end at any moment and start at any moment". The playing song leaves at the end of a 4- or 8-bar phrase and the next lands on its downbeat; a presenter's Next waits up to about 11 s for a boundary; over 90% of landings on a phrase.
By: the user. Source: mixer-design-decisions.md › Changes after the first listen; transcript 2026-11-24T09:29Z. Lives in: requirements/show-and-music.md › Transitions.

### D14 · No device label in the console header · 2026-11-24 · Active
"Tauleta" in the header adds nothing; the device's name is in the menu.
By: the user via canvas. Source: canvas 2026-11-24T11:28Z; show-ui-and-platform-decisions.md › Changes. Amends: R2-Q19, R2-Q20. Lives in: requirements/screens.md › Console.

### D15 · The console's crystal ball, "Futur" · 2026-11-24 · Active
A tab hidden until a presenter taps "Mirar el futur": a chart of how many cards have each number of marked songs, the songs left to the first possible Line and Quina, and the possible winners. Private: never on phones or the projector.
By: the user via canvas. Source: canvas 2026-11-24T11:37Z; show-ui-and-platform-decisions.md › Changes. Supersedes: R1-Q35. Lives in: requirements/screens.md › Console.

### D16 · Times in am/pm · 2026-11-24 · Active
One setting, easy to change back. Where it would wrap, the am/pm can go, since the night is all pm.
By: the user via canvas. Source: canvas 2026-11-24T11:40Z, 14:06Z. Lives in: requirements/screens.md › Every screen.

### D17 · No grace rule · 2026-11-24 · Active
The rule not to mark the last song overcomplicated the design. Phones mark every landed song, the latest included, but never announce or celebrate a Line or a Quina: players must claim.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T11:59Z. Supersedes: P2, P3b; amends P15. Lives in: requirements/screens.md › Player app.

### D18 · Only the current round's history · 2026-11-24 · Active
Players don't see earlier rounds' songs.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T11:59Z. Lives in: requirements/screens.md › Player app.

### D19 · The player app's three tabs · 2026-11-24 · Active (U10 may replace it)
Ara (the drum on top, then a Historial | Cartrons switch, remembered per device), Premis and Horari, plus a menu screen with the player's cards, sounds, last year's card and "Esborrar dades". The 4-tab alternative was dropped.
By: the user, then via canvas. Source: transcript 2026-11-24T11:59Z; canvas 2026-11-24T13:28Z; show-ui-and-platform-decisions.md › Changes. Supersedes: P4. Lives in: requirements/screens.md › Player app.

### D20 · Phones offline keep their screens · 2026-11-24 · Active
Offline, the phone shows its normal screens, visibly marked as offline, rather than a full-screen notice.
By: the user via canvas. Source: canvas 2026-11-24T13:31Z. Lives in: requirements/screens.md › Player app.

### D21 · The night's preview before the Game · 2026-11-24 · Amended by D61
Before the Game, the projector and phones show the night's rounds (regular, Desgraciat, Especial) and each card type with its colour, making clear which card is only for the Especial.
By: the user via canvas. Source: canvas 2026-11-24T13:59Z, 16:12Z. Amends: R2-Q25. Lives in: requirements/screens.md › Projector, Player app.

### D22 · The edition's name is set in Admin · 2026-11-24 · Active
This year "Quina Quina 3".
By: the user via canvas. Source: canvas 2026-11-24T14:00Z. Lives in: requirements/game-rules.md › The Game and its edition.

### D23 · Round icons · 2026-11-24 · Active
The Quina Especial uses a star and the Desgraciat a sad face (eyes and mouth, no circle).
By: the user via canvas. Source: canvas 2026-11-24T14:05Z. Lives in: requirements/screens.md › Projector.

### D24 · Names on screen · 2026-11-24 · Active
The special round is "Quina Especial", with no number; numbering appears only as "Quina X de Y". The schedule is "Horari" ("Programa" sounds like software). Card numbers are written "#123".
By: the user via canvas. Source: canvas 2026-11-24T14:11Z, 14:15Z, 14:23Z. Amends: R2-Q3b, P4. Lives in: requirements/screens.md › Every screen; requirements/game-rules.md › The night's rounds.

### D25 · Horari off schedule · 2026-11-24 · Active
Real times for what has happened, and "~" predictions for what's next.
By: the sessions, agreed, answering the user's canvas question. Source: canvas 2026-11-24T14:13Z; show-ui-and-platform-decisions.md › Changes. Lives in: requirements/screens.md › Player app.

### D26 · No how-to-play text · 2026-11-24 · Active
Not on the projector or phones: the presenters explain the game.
By: the user via canvas. Source: canvas 2026-11-24T14:33Z, 15:08Z. Amends: R2-Q25. Lives in: requirements/screens.md › Projector, Player app.

### D27 · Prize secrecy · 2026-11-24 · Active
Prizes stay secret until the presenters disclose them: future rounds show locked, game-style. Round 1's are visible before the night, so a new player sees what the page holds, and an "everything secret" option exists. The cloud enforces it, so locked prizes never reach the public feed. The moment of the reveal is R2-Q35.
By: the user via canvas. Source: canvas 2026-11-24T14:48Z, 16:06Z; show-ui-and-platform-decisions.md › Changes. Supersedes: R2-Q15's prizes; amends R1-Q15, R1-Q23. Lives in: requirements/game-rules.md › Prize secrecy.

### D28 · Adding a card asks before leaving · 2026-11-24 · Active
Leaving the add-card pad with a number typed asks first.
By: the user via canvas. Source: canvas 2026-11-24T14:56Z. Lives in: requirements/screens.md › Player app.

### D29 · The card-stacking scroll · 2026-11-24 · Pending (U11)
Cards stack on each other as you scroll (the user: "I will need to confirm this"). Default: specced in ANIMATIONS.md, not built.
By: the user via canvas (proposal). Source: canvas 2026-11-24T15:28Z. Lives in: requirements/screens.md › Player app.

### D30 · The player drawers · 2026-11-24 · Pending (U10)
The user's proposal: one "now" home screen, two corner buttons (Premis, Horari) opening stacked drawers with native-quality gestures; the user also suggested calling "Ara" "songs". Default: the three tabs (D19).
By: the user via canvas (proposal). Source: canvas 2026-11-24T13:31Z, 15:48Z, 15:50Z. Lives in: requirements/screens.md › Player app.

### D31 · Prizes come in bundles · 2026-11-24 · Active
Each Line and Quina has many prizes, usually with one or two headline ones. Screens show the bundle, headline prizes first, never a single prize.
By: the user via canvas. Source: canvas 2026-11-24T16:40Z; show-ui-and-platform-decisions.md › Changes. Amends: R1-Q23, R2-Q16. Lives in: requirements/game-rules.md › Prizes and bundles.

### D32 · No winning card numbers; no QR in the Interval · 2026-11-24 · Active
"People don't care who won unless it's them": no winning card numbers on the projector or phones. They aren't secret (the Check shows the card), so the feed keeps them, and a phone celebrates when a confirmed winner is one of its own cards. No QR in the Interval: by then everyone has the app open.
By: the user via canvas. Source: canvas 2026-11-24T16:42Z, 16:53Z. Amends: R2-Q15, R2-Q24, R2-Q25. Lives in: requirements/screens.md › Projector, Player app; requirements/game-rules.md › Winners.

### D33 · A wrong card type fails the Check · 2026-11-24 · Active
The Check first checks the card's type for the round, and a wrong type fails as its own reason.
By: the user via canvas. Source: canvas 2026-11-24T16:52Z. Amends: R2-Q11. Lives in: requirements/game-rules.md › The Check; requirements/screens.md › Projector.

### D34 · "Pausa", and two levels per button · 2026-11-24 · Active
For a very long break mid-round: no song lands, the Interval music plays, and the projector and phones show a pause screen. Holding Parlem on the console enters it, and holding − or + on the Wii. Each button has two levels: Parlem → Pausa, Aguanta → Suspens, shown visually. On the console's bottom row, Enrere takes a quarter to a third, with a very short "hold it" hint inside, and Comprovar cartró the rest.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T17:47Z. Amends: R2-Q31, R2-Q38. Lives in: requirements/show-and-music.md › The presenters' actions; requirements/screens.md › Console.

### D35 · The Efectes pads are icons · 2026-11-24 · Active
Icons, not words. The word version is kept as a separate board.
By: the user via canvas. Source: canvas 2026-11-24T17:58Z. Lives in: requirements/screens.md › Console.

### D36 · Wii A follows the default action · 2026-11-24 · Active
A always means "go ahead with the default action": during a Check, approve when it passed and reject when it failed; elsewhere, the console's primary button. Every console control a Wii button triggers shows a badge for it, and holds are shown as holds.
By: the user. Source: show-ui-and-platform-decisions.md › Changes; transcript 2026-11-24T18:08Z. Amends: R2-Q38. Lives in: requirements/show-and-music.md › The presenters' actions; requirements/screens.md › Console.

### D37 · Pause reuses the pause state · 2026-11-24 · Active
Pausa reuses the existing pause command and state; during a pause the engine plays the Interval music instead of Hold music, and the round resumes with a normal transition.
By: the orchestrator. Source: apps/show/docs/HANDOFF.md › Decided since the pause; commit a11a224. Lives in: requirements/show-and-music.md › The presenters' actions.

### D38 · The Suspense release lands on the phrase · 2026-11-24 · Pending (U13)
The release lands on the outgoing song's phrase boundary, up to about 9 s later. The alternative is a 2-bar boundary, about twice as fast. Default: the phrase.
By: the Sound engine session (default). Source: open-questions.md › U13. Lives in: requirements/show-and-music.md › The presenters' actions.

### D39 · Signatures stay rare · 2026-11-24 · Pending (U13)
Instrumental-only Signatures play in about 5% of transitions. Default: keep it, and pick more by hand while reviewing this year's songs.
By: the Sound engine session (default). Source: open-questions.md › U13. Lives in: requirements/show-and-music.md › Teases, Signatures and Decoys.

### D40 · Cards drawn as the printed grid · 2026-11-24 · Pending (U21)
Each card is the 3×4 printed grid, with titles of about 12–13 px. Default: the grid stays; a "Lletra gran" list view is possible.
By: the Frontend session (default). Source: open-questions.md › U21. Lives in: requirements/screens.md › Player app.

### D41 · The printed cards' songs are public · 2026-11-24 · Pending (U22)
Phones need every card's songs, so the cards file is public. A per-card secret in the QR would make adding a card by number much harder. Default: public; the orchestrator agrees.
By: the Backend session and the orchestrator (default). Source: open-questions.md › U22. Lives in: requirements/operations.md › Privacy.

### D42 · The old Decoys experiment is retired · 2026-11-25 · Active
The separate Decoys experiment is gone. A Decoy is now only what a Suspense teases.
By: the orchestrator. Source: apps/show/docs/HANDOFF.md; commit fd07f2e. Supersedes: R1-Q32's Decoys experiment; amends R1-Q17. Lives in: requirements/show-and-music.md › Teases, Signatures and Decoys.

### D43 · The Desgraciat's standing set is the cards in play · 2026-11-25 · Active
The standing cards are the round's cards in play of its card type, since the ranges can't tell sold from unsold. Its thresholds come from the count alone.
By: the orchestrator. Source: apps/show/docs/HANDOFF.md › Decided since the pause. Amends: R2-Q30. Lives in: requirements/game-rules.md › The Quina del Desgraciat.

### D44 · The Desgraciat's details · 2026-11-25 · Amended by D62
Auto-advance stops at one card standing. There's no Line: the only prize is the last standing card's bundle. A standing Check stops at the first landed song (the card has fallen). The Celebration title "DEMPEUS!" was proposed here.
By: the sessions, agreed. Source: show-ui-and-platform-decisions.md › Changes (The Desgraciat round); packages/ui/HANDOFF.md. Amends: R2-Q30. Lives in: requirements/game-rules.md › The Quina del Desgraciat; requirements/show-and-music.md › Auto-advance, Pace and Drift.

### D45 · Two Desgraciat board points · 2026-11-25 · Pending (U7)
Defaults: the projector shows no standing count (console only, since it includes unsold cards), and a fallen card shows the sitting nino.
By: the Frontend session (default). Source: open-questions.md › U7. Lives in: requirements/screens.md › Projector.

### D46 · Today's storage format stays · 2026-11-25 · Active
About 68 MB a song: the draft's 86 songs fit R2's free 10 GB once last year's pool is pruned. A lighter format (about 20 MB a song) is measured and kept as a contingency if the playlist grows past about 100 songs.
By: the orchestrator, with the Sound engine session. Source: apps/cloud/docs/HANDOFF.md, apps/show/docs/HANDOFF.md; docs/timeline.md › Risks. Lives in: requirements/operations.md › Storage.

### D47 · Provisional bulk hook approval, for tests only · 2026-11-25 · Active
Each song's top automatic hook can be approved in bulk, marked provisional everywhere with a preflight warning, so a new pool can be rehearsed before the user's approval pass ends. It never replaces that pass.
By: the orchestrator. Source: apps/show/docs/HANDOFF.md › The next queue. Amends: R2-Q33. Lives in: requirements/songs-and-cards.md › Hooks.

### D48 · Only one Line per round · 2026-11-25 · Active
By: the user. Source: event.md › One round; transcript 2026-11-25T00:41Z. Amends: R2-Q5. Lives in: requirements/game-rules.md › A regular round.

### D49 · The Check's result decides · 2026-11-25 · Amended by D109, D121
In a strange case the presenters can still reject a card that passed, but they can never accept a card that failed. The console never offers to accept a failed card.
By: the user (event.md). Source: event.md › Claims and checks; commits ff13a81, 233e3a3. Amends: R2-Q11, R1-Q24. Lives in: requirements/game-rules.md › The Check; requirements/screens.md › Console.

### D50 · Other late claims are decided on the spot · 2026-11-25 · Active
A late claimer still wins if nobody else claimed. Any other late case is decided by the team on the spot, helped by the console's "complete since song N". No further rule to settle.
By: the user (event.md). Source: event.md › Claims and checks; show-ui-and-platform-decisions.md › Changes. Amends: R2-Q12. Lives in: requirements/game-rules.md › Ties, late claims and going back.

### D51 · Winners by name or by slip · 2026-11-25 · Active
A winner is noted by their name, or by a numbered slip handed to them, and collects the prize later with their card or slip.
By: the user (event.md). Source: event.md › Claims and checks. Lives in: requirements/game-rules.md › Winners.

### D52 · An optional slip number on the winner form · 2026-11-25 · Active
The console's winner form gets an optional numbered-slip field, next to the name and notes.
By: the orchestrator. Source: packages/ui/HANDOFF.md › The next queue. Lives in: requirements/game-rules.md › Winners; requirements/screens.md › Console.

### D53 · Throw breaks ("parón") · 2026-11-25 · Active
Between some rounds, a break of about 5 minutes for throws to the crowd. The Schedule plans them, and the expected ends include them.
By: the user (event.md). Source: event.md › The night, step by step. Lives in: requirements/show-and-music.md › The Interval and the throw breaks.

### D54 · Fallbacks are requirements · 2026-11-25 · Active
If the presenters reject the tablet, the tech drives the whole show from the laptop and they advance by hand. The Wii remote is the intended controller, with the tablet as its plan B. Both iPad and Android tablets must work.
By: the user (event.md). Source: event.md › The presenters, What must never fail. Lives in: requirements/operations.md › Fallbacks.

### D55 · "The tech" · 2026-11-25 · Active
"El tècnic" is the organizer who runs the laptop; "Admin" names only the page.
By: the user. Source: event.md › Barrakudes and the team; transcript 2026-11-25T00:43Z. Lives in: GLOSSARY.md.

### D56 · Card prices aren't printed, and they drop · 2026-11-25 · Active
A price list hangs at the bar. A normal card's price drops with each regular round played (2025: 1.50 € per regular round still to play; the Desgraciat doesn't count); a special card has a fixed price.
By: the user (event.md). Source: event.md › The cards (Prices); transcript 2026-11-25T00:32Z. Lives in: requirements/songs-and-cards.md › Prices.

### D57 · The Desgraciat: a shared win, normal cards · 2026-11-25 · Active
If the last players standing all sit on the same song, they share the win; "nobody left standing" can't happen while anyone plays. The Desgraciat uses normal cards ("as far as we remember").
By: the user (event.md). Source: event.md › The special rounds, The cards; transcript 2026-11-25T00:41Z. Amends: R2-Q30. Lives in: requirements/game-rules.md › The Quina del Desgraciat; requirements/songs-and-cards.md › Card types.

### D58 · Every sponsor is mentioned · 2026-11-25 · Active
Every prize and its sponsor is read out before each round, money donors included, and every sponsor appears somewhere on the projector during the night.
By: the user (event.md). Source: event.md › Prizes and sponsors (Mention everyone). Lives in: requirements/game-rules.md › Sponsors; requirements/screens.md › Every sponsor appears.

### D59 · The dates · 2026-11-25 · Active; the rehearsal dates Superseded by D82
The night is Sunday 27 December 2026; the playlist is final on 1 December; rehearsals happen before the night, never on the day itself. The rehearsal dates written here (13 and 19 December) were the orchestrator's defaults, which the user doesn't recognise: pending U27.
By: the user (event.md). Source: event.md › When and where, The songs, Timing. Lives in: requirements/operations.md › Rehearsals; docs/timeline.md.

### D60 · No card prices on the projector, for now · 2026-11-25 · Superseded by D61
The default while U5 was open.
By: the orchestrator. Source: commit ff13a81.

### D61 · Card prices on the projector · 2026-11-25 · Active
Only the price for the coming round, on that round's Interval screen; the before-the-start screen is round 1's. A normal card is the per-round price × the regular rounds still to play, the coming one included, not counting the Desgraciat; before the Quina Especial, the special card's fixed price. From setup data, never hard-coded. Answers U5.
By: the user. Source: open-questions.md › Answered (U5); transcript 2026-11-25T00:56Z. Supersedes: D60; amends D21. Lives in: requirements/songs-and-cards.md › Prices; requirements/screens.md › Projector.

### D62 · The Desgraciat's Celebration has no title · 2026-11-25 · Amended by D186, D190
"DEMPEUS!" is dropped, and so is the phone's "Dempeus fins al final!". The rest of the Celebration stays, and so do the per-card "Dempeus" / "Assegut" labels. Answers U6. Built in 6857f31; the console keeps a presenters-only label, "Últim cartró dempeus".
By: the user. Source: open-questions.md › Answered (U6); transcript 2026-11-25T00:56Z. Supersedes: D44's "DEMPEUS!" proposal (agreed between the sessions, not by the user). Lives in: requirements/game-rules.md › The Quina del Desgraciat; requirements/screens.md › Projector, Player app.

### D63 · Where "the Check decides" is enforced · 2026-11-25 · Amended by D121
The engine refuses to accept a failed Check (reason `failedCheck`), and the console never offers it. The cloud only flags such a decision in the journal and never refuses it, so the show never stalls on a cloud check.
By: the sessions, agreed. Source: commit 233e3a3; the orchestrator's brief of 2026-11-25. Implements: D49. Lives in: requirements/game-rules.md › The Check.

### D64 · Where the card price rule lives · 2026-11-25 · Active
Each card type in card-types.json carries a `priceRule` (a per-round price for normal cards, a fixed price for special cards), and the protocol's `roundCardPrice` helper gives the price for the coming round, so every screen computes it the same way.
By: the sessions, agreed (Sound engine and Frontend). Source: the orchestrator's brief of 2026-11-25. Implements: D61. Lives in: requirements/songs-and-cards.md › Prices.

### D65 · A new journal value reaches the deployed cloud first · 2026-11-25 · Active
A journal entry the cloud refuses stops the laptop's uploads, and with them every phone update for the rest of the night. So a new value in the journal (a round kind, a win kind, a Check outcome) lands in three steps: the protocol change, then the cloud's acceptance and a redeploy, then the engine journaling it. The cloud also accepts what the engine journals and only flags oddities.
By: the sessions, agreed (Sound engine and Backend). Source: card type per round and the Desgraciat (steps A, B, C); Backend's report of 2026-11-25. Lives in: requirements/operations.md › Where things run.

### D66 · How the songs are downloaded · 2026-11-25 · Active
The download method is the Sound engine's call: any method that passes the quality check without much work for the user. The user downloads by hand only the few songs it can't get. The bot check came from the Mac's VPN, since YouTube asks VPN addresses to sign in. With the VPN paused, last year's spotDL method works again, keeping YouTube's own Opus audio. Answers U1.
By: the user. Source: open-questions.md › Answered (U1); the user's answers of 2026-11-25. Lives in: requirements/songs-and-cards.md › Preparing the songs.

### D67 · This year's printed card, provisionally · 2026-11-25 · Active
The title is "QUINA QUINA! 3", with last year's colours. Both may still change at print time; not a blocker. Answers U2.
By: the user. Source: open-questions.md › Answered (U2). Lives in: requirements/songs-and-cards.md › The card.

### D68 · Card types and amounts, provisionally · 2026-11-25 · Active
As in 2025: normal and especial, 399 and 300. May change at print time. Answers U3.
By: the user. Source: open-questions.md › Answered (U3). Lives in: requirements/songs-and-cards.md › Card types, Numbers and amounts.

### D69 · This year's card prices · 2026-11-25 · Active
The same as 2025: a normal card is 1.50 € for each regular round still to play (15 € before round 1), a special card 5 €. Answers U25.
By: the user. Source: open-questions.md › Answered (U25); the 2025 price sheet. Implements: D61, D64. Lives in: requirements/songs-and-cards.md › Prices.

### D70 · In 2025 the special card also played the Desgraciat · 2026-11-25 · Active
The 2025 price sheet lists the special card (5 €) for "Quina especial i quina del desgraciat". It corrects event.md's "the Desgraciat uses normal cards too, as far as we remember". Whether one special card plays both rounds in 2026 is pending U26; meanwhile the plan's Desgraciat plays special cards.
By: the user (a 2025 fact). Source: the 2025 price sheet (organizers' files); the user's answers of 2026-11-25. Lives in: event.md › The cards; requirements/songs-and-cards.md › Card types; requirements/game-rules.md › The Quina del Desgraciat.

### D71 · Cards are sold on the night · 2026-11-25 · Active
Cards are sold only on the night: at the start, and during it. Printing takes a few hours at a local print shop. The timeline's "sold from about 12 December, printed in about a week" was the orchestrator's assumption, never the user's. Answers U4; the print date is pending U28.
By: the user. Source: open-questions.md › Answered (U4). Supersedes: the timeline's default for U4. Lives in: event.md › The cards; requirements/songs-and-cards.md › Generating and printing; docs/timeline.md.

### D72 · The Desgraciat's board points · 2026-11-25 · Active
The projector doesn't show how many cards still stand (the count includes unsold cards); the console does. A fallen card shows the sitting nino; the squashed nino stays for a failed Check. Answers U7.
By: the user. Source: open-questions.md › Answered (U7). Lives in: requirements/screens.md › Projector, Player app.

### D73 · The player app is one home screen with two corner buttons and drawers · 2026-11-25 · Active
The tabs go away, and no fallback layout stays in the code. The drawers' current content breaks the visual hierarchy and the prizes drawer isn't liked: the designer (Frontend) makes several proposals for the drawers' content, the prizes drawer and the corner buttons' style, and the user picks. The corner icons must share one style: the best so far is the sky-blue box with a pink ribbon (option C) with a taller lid skirt, and the Horari button needs a better icon. Answers U10 and U8; the pick is U30.
By: the user. Source: open-questions.md › Answered (U8, U10). Lives in: requirements/screens.md › Player app.

### D74 · The effect when the landed song is yours · 2026-11-25 · Active
The stage spotlights with the flashes, without the lightning-bolt drawing. Inside the flash the background turns from dark blue to gold, the spotlights loop on the gold, and the particles are option A's: the shooting-star streak and rising corn and hearts. Two of your songs in a row play it again. The whole effect fades out smoothly when the drum starts spinning, and it never plays in the Desgraciat, where the card falls instead. Answers U9.
By: the user, in chat and a canvas comment (25 Nov, 01:02Z), relayed by Frontend. Source: open-questions.md › Answered (U9). Lives in: requirements/screens.md › Player app; packages/ui/ANIMATIONS.md.

### D75 · No card-stacking scroll · 2026-11-25 · Active
Discarded for now: the cards keep the previous mockups' look. It may be tried once the UI is built. Answers U11.
By: the user. Source: open-questions.md › Answered (U11). Lives in: requirements/screens.md › Player app.

### D76 · The QR domain switches now · 2026-11-25 · Active
`quina.barrakudesbegur.org` can point at the new app now: nobody uses last year's app. Answers U15.
By: the user. Source: open-questions.md › Answered (U15). Lives in: requirements/songs-and-cards.md › The printed QR; apps/cloud/docs/deploy-plan.md (step 7).

### D77 · Card text size on phones · 2026-11-25 · Active
The card styles in the current design are fine; no "Lletra gran" switch. Answers U21.
By: the user. Source: open-questions.md › Answered (U21). Lives in: requirements/screens.md › Player app.

### D78 · Public unless there's a reason · 2026-11-25 · Amended by D98
Every card's songs stay public. Anything may be public unless there's a reason to hide it; the code stays simple. Answers U22.
By: the user. Source: open-questions.md › Answered (U22). Lives in: requirements/operations.md › Privacy.

### D79 · A song keeps its id when the playlist changes · 2026-11-25 · Amended by D103
A song's id follows its Spotify track, not its playlist position. The draft grew from 86 to 151 songs and 83 moved, so ids by position would have moved every hook approval, cache and download onto another song. Hook approvals made on the draft carry over to the final pool.
By: the sessions (Sound engine, within its remit). Source: commit fb321f4; Sound engine's report of 2026-11-25. Lives in: requirements/songs-and-cards.md › Hooks.

### D80 · No work on this year's songs until the playlist is handed over · 2026-11-25 · Amended by D99
Until the user hands over the playlist, the team works with last year's data: no downloads, prep or uploads of the draft. Files already downloaded stay. The final playlist will almost surely have fewer than 100 songs, so today's format fits R2's free storage. A study proposes the pool size, with candidate schedules to choose from. Answers U32; withdraws U33.
By: the user. Source: open-questions.md › Answered (U32); the user's answers of 2026-11-25. Amends: D66 (no downloads until then). Lives in: requirements/songs-and-cards.md › The Pool; docs/timeline.md.

### D81 · One special card plays both the Desgraciat and the Especial · 2026-11-25 · Active
A special card bought before the Desgraciat also plays the Quina Especial. The projector shows its 5 € before each of the two rounds, for players who don't have one yet. Answers U26.
By: the user. Source: open-questions.md › Answered (U26). Amends: D70. Lives in: requirements/game-rules.md › Cards in play.

### D82 · Rehearsals have no fixed dates · 2026-11-25 · Active
The user runs a tech rehearsal when everything feels ready. A presenters' rehearsal, if there is one, is a day or two before the night or on the day itself. Answers U27.
By: the user. Source: open-questions.md › Answered (U27). Supersedes: D59's rehearsal dates. Lives in: requirements/operations.md › Rehearsals; docs/timeline.md.

### D83 · The cards are made on 4–5 December · 2026-11-25 · Active
If the playlist is ready, the user makes the cards on 4–5 December. So the pool is downloaded, prepared and quality-checked between 1 and 4 December, with any swaps done before the cards are made. Answers U28.
By: the user. Source: open-questions.md › Answered (U28). Lives in: requirements/songs-and-cards.md › Generating and printing; docs/timeline.md.

### D84 · No fallback versions in the code; the operational plan Bs stay · 2026-11-25 · Active
No alternative versions of a screen or feature are kept in the code. The operational plan Bs stay, because they're the night's safety net: the tablet for the Wii remote, the laptop's own keys for the tablet, and the laptop running without the cloud. Answers U29.
By: the user. Source: open-questions.md › Answered (U29). Amends: D73, D78. Lives in: requirements/operations.md › Fallbacks.

### D85 · A new title each edition; the colour may stay · 2026-11-25 · Active
The new title, with the faint year stamp, tells this year's cards from last year's; the paper colour may stay the same. Answers U31.
By: the user. Source: open-questions.md › Answered (U31). Amends: event.md's "a new paper colour and title". Lives in: event.md › The cards; requirements/songs-and-cards.md › The card.

### D86 · Last year's API is gone · 2026-11-25 · Active
The user deleted the `quina-api` record: last year's API, a tunnel to the 2025 server that was already down, used only by last year's app.
By: the user. Source: Backend's report of 2026-11-25. Lives in: apps/cloud/docs/deploy-plan.md.

### D87 · The corner buttons' style and the drawers' hierarchy · 2026-11-25 · Active
Corner-button style B, with its matching icons, and drawer hierarchy J2. The menu drawer's title "Menu" changes to a settings word. The prizes drawer isn't chosen yet: the user needs P1–P3 drawn with real prizes and logos, and P3's dashed circle and left corners fixed (U30 stays open for it).
By: the user. Source: open-questions.md › U30; the user's answers of 2026-11-25. Implements: D73. Lives in: requirements/screens.md › Player app.

### D88 · The print shop gets the PDF as last year · 2026-11-25 · Active
They need the same as last year: just the PDF (A4, 3 cards a page, no bleed or crop marks). Answers U35.
By: the user. Source: open-questions.md › Answered (U35). Lives in: requirements/songs-and-cards.md › Generating and printing.

### D89 · The night's settings live in a file that agents edit · 2026-11-25 · Amended by D111
The organizers keep their prizes and sponsors in a spreadsheet however they like; the user hands it over, and the orchestrator parses it into the plan. The whole night's settings should live in one JSON file tracked by git, so agents can edit every setting and the laptop uses it too. Admin's UI is only for last-minute edits on a phone, and even those the user would rather make through an agent on the laptop. Answers U40.
By: the user. Source: open-questions.md › Answered (U40); the user's answers of 2026-11-25. Amends: the requirement that prizes and sponsors are entered in Admin. Lives in: requirements/game-rules.md › Sponsors; requirements/screens.md › Admin.

### D90 · Effects and Celebrations over open drawers · 2026-11-25 · Active
A Celebration closes the Premis, Horari and Ajustos drawers, but not the add-card pad while a number is being typed. The flashes and particles of the your-song effect (D74) play on top of everything, so a player inside any drawer still sees them. Answers U41.
By: the user. Source: open-questions.md › Answered (U41). Amends: D73, D74. Lives in: requirements/screens.md › Player app; packages/ui/ANIMATIONS.md.

### D91 · The console's Wii badges and holds look like the real remote · 2026-11-25 · Active
The console's Wii badges look like the remote's own buttons: A a big circle, B a rectangular trigger, HOME round with a house, and −, +, 1 and 2 each their own round key, never merged ("−/+", "1/2"). The play buttons carry no "mantén" word: a hold shows as a pressed-in key (1 2 on Enrere, B on Aguanta, − + on the Pausa strip) or a pressed-in strip (Pausa, Suspens), and tap keys stay raised. Designs only; the built console still has the old badges (boards first, D-entry for the record).
By: the user via canvas (comments of 24 Nov, sent to Claude on 25 Nov). Source: the "Quina Musical look" canvas v55, "Consola · en joc". Lives in: requirements/screens.md › Console, Wii remote.

### D92 · Every remote-triggered control shows its button · 2026-11-25 · Active
Every console control a Wii button triggers shows that button's hint whenever it's on screen: A on the Check's "Rebutjar" for a failed card, the D-pad arm on the four effects, A on Dempeus' "Comprovar #57". Suspens shows a shaking-remote icon. The menu's rare holds (Pànic, Acabar la nit, Confirmar la línia sense comprovació) keep "Mantén premut" as a tag beside the label; play buttons keep the pressed look (D91). Answers U44. Designs only.
By: the user via canvas (25 Nov). Source: the "Quina Musical look" canvas v56. Amends: D91. Lives in: requirements/screens.md › Console, Wii remote.

### D93 · The console's remote board explains each button in place · 2026-11-25 · Active
On "Consola · comandament Wii", each explanation sits beside its button with a leader line, led by the button's own key icon (raised for a tap, pressed for a hold, the cross arm for each effect). B + shake shows with the shake icon (pending U45). The remote has squarer corners and a softer cross, and B comes out of the main drawing, with no separate side view. Designs only.
By: the user via canvas (25 Nov). Source: the "Quina Musical look" canvas v57. Amends: D91, D92. Lives in: requirements/screens.md › Wii remote.

### D94 · The shake icon · 2026-11-25 · Active
Option C: a remote with a motion trail plus a smaller, medium-weight "×3" (size and weight option 2 of 1–4 on the options board, until the user says otherwise; canvas v60), with no frame and a remote with small corners. It's used on the console's Suspens strip and in the remote's legend (B + shake → Suspens). On the console's two-level buttons, the hold strips (Pausa, Suspens) keep their label centred, with the remote hint at the strip's right edge. Answers U45. Designs only.
By: the user via canvas (25 Nov). Source: the "Quina Musical look" canvas v59. Lives in: requirements/screens.md › Console, Wii remote.

### D95 · One save button when adding a card · 2026-11-25 · Active
The add-card drawer has one save button: full width, square corners, with a tick icon. "Desar i afegir-ne un altre" is removed. Designs only (canvas v61); the built pad still has the old buttons.
By: the user via canvas (comment #14 on `Mobil-B-J2`, 25 Nov). Source: the "Quina Musical look" canvas v61. Lives in: requirements/screens.md › Player app.

### D96 · Londrina is always in capitals · 2026-11-25 · Amended by D114
Every text set in Londrina is in capitals, on every screen: titles, buttons, names and numbers, as the design system says. Frontend checked all 59 boards: no place reads better in lowercase, and capitals cause no new overflow. Designs only (canvas v61).
By: the user via canvas (comment #4 on `Mobil-B-J2`, 25 Nov). Source: the "Quina Musical look" canvas v61. Lives in: requirements/screens.md › Every screen.

### D97 · The night's settings file lives in this public repo · 2026-11-25 · Superseded by D111
The settings file (D89) is tracked in this repo, every prize included. There's no private repo and no clone step on the laptops. Answers U42. Which copy wins on the night is still U43; whether sponsors' names may be in it is U48.
By: the user (to Backend, 25 Nov). Source: open-questions.md › Answered (U42). Amends: D89. Lives in: requirements/operations.md › Privacy.

### D98 · Hiding prizes is for the show's hype · 2026-11-25 · Amended by D112
Prizes are hidden for the hype, on the players' screens: the projector and phones show a round's prizes only once it's revealed. Anything only a developer reading the public repo could find, like every prize in the settings file, may be committed: nobody will look, and finding a prize early harms nothing. The user: "we just keep it secret for the show hype". What must stay private is unchanged: people's names (winners, who keeps a prize), resume codes, Shuffle seeds (they'd give away the Queue), tokens and keys, and audio.
By: the user (to Backend, 25 Nov: "it is part of the model"). Source: Backend's report of 25 Nov. Amends: D78. Lives in: requirements/operations.md › Privacy.

### D99 · The playlist is down to 80 songs · 2026-11-25 · Active
The organizers have filtered the playlist down to 80 songs. It's not the final count: about 10 are cut later that day, probably to 70, which the user is discussing with the organizers (U34). Meanwhile Sound engine may download the 80 songs and make temporary cards from them. When fetched, the playlist held 76 (the organizers may be removing songs), and the user said to go with whatever it holds.
By: the user. Source: the user's message of 25 Nov. Amends: D80. Lives in: requirements/songs-and-cards.md › The Pool; docs/timeline.md.

### D100 · 70 songs is the final count · 2026-11-25 · Active
Each pool has 70 songs. Playlist 1 is filtered to its final 70; playlist 2 is being filled and will be filtered to 70 too (D101). Answers U34.
By: the user. Source: open-questions.md › Answered (U34); the user's message of 25 Nov. Amends: D99. Lives in: requirements/songs-and-cards.md › The pool's size.

### D101 · Two pools of 70, one for each half of the regular rounds · 2026-11-25 · Amended by D105, D171
The night has two playlists of 70 songs each, with different songs: Quines 1–5 play pool 1 and Quines 6–10 play pool 2. Pool 1 is final; the organizers are adding songs to pool 2 before filtering it to 70. Which pool the Quina Especial and the Desgraciat play isn't decided; assume a third one (U49).
By: the user. Source: the user's message of 25 Nov. Amends: D99; event.md's "every round plays a shuffle of the whole pool" (now: of its own pool). Lives in: requirements/songs-and-cards.md › The pool; requirements/game-rules.md › The night's rounds.

### D102 · The normal card is printed on both sides · 2026-11-25 · Amended by D171
Side 1 plays Quines 1–5 (pool 1) and side 2 plays Quines 6–10 (pool 2), with the same card number on both sides. Side 2 has its own design, and each side carries a new mark showing the rounds it's for; the user designs both with Frontend, so nobody changes the card's design before then. The presenters explain it in rounds 1 and 6 and keep reminding people during the round.
By: the user. Source: the user's message of 25 Nov. Lives in: requirements/songs-and-cards.md › The card; event.md › The cards.

### D103 · A final Part's song ids are alphabetical · 2026-11-25 · Active; Part 2's numbering Pending (U57)
Once a Part is final, the user sorts its Spotify playlist alphabetically by hand (with an online tool), and the song ids follow that order. Leading articles count: "The …" sorts under T, unlike Spotify's own sort, which ignores "The". Sound engine checks the order before using it, and reports any song out of place to the user rather than fixing the playlist. Until a Part is final, ids follow the Spotify track (D79).
By: the user. Source: the user's message of 25 Nov. Amends: D79. Lives in: requirements/songs-and-cards.md › Hooks.

### D104 · The Interval music comes from a new playlist · 2026-11-26 · Amended by D129
The Interval's music, which Pausa plays too, now comes from the Spotify playlist 0XTlZPUpt7xPoPxk4AUU3O, which has more songs. It replaces 0SsuXelEzN8gsS7WufySOg. The old files stay (D80).
By: the user. Source: the user's message of 26 Nov. Lives in: requirements/show-and-music.md › The Interval and the throw breaks.

### D105 · The special rounds play their own playlist · 2026-11-26 · Superseded by D171 (the special card's back still Pending, U59)
The Quina Especial and the Desgraciat both play a third set of songs, the Spotify playlist 79G8VcNrkih9GGjIzb47Gt, on the special card (D81). It's empty for now, so until it's final the special card uses Part 1's songs. Once final, it's sorted and numbered like the others (D103). Answers U49's pool question.
By: the user. Source: open-questions.md › Answered (U49); the user's message of 26 Nov. Amends: D101. Lives in: requirements/songs-and-cards.md › The pool.

### D106 · An Interval track we can't get is left out · 2026-11-26 · Active
"It is fine if some songs can't be downloaded": the Interval plays the 37 tracks it has, without #15 and #22, and nobody downloads them by hand. Answers U60. Whether this also covers a Part's songs, which are printed on the cards, is U61.
By: the user (to Sound engine, 26 Nov). Source: open-questions.md › Answered (U60). Amends: D66, for the Interval. Lives in: requirements/show-and-music.md › The Interval and the throw breaks.

### D107 · The presenters pace the Check · 2026-11-26 · Active
A presenter reveals each of the card's songs with a tap, or the Wii remote's A. Holding A reveals them one after another for as long as it's held. On the tablet, a toggle does the same, like "Parlem" or the auto-advance. The songs are revealed in the card's grid order, so a mistake shows early, and the presenter can name the next song before pressing. Answers the Check's Q1 and Q4 (chat, 25–26 Nov).
By: the user. Source: the Check's redesign in chat, 26 Nov. Amends: the Check's self-running steps (show-and-music › the Check's sound). Lives in: requirements/game-rules.md › The Check; requirements/screens.md › Console.

### D108 · The presenters see the Check's result first · 2026-11-26 · Active
As soon as the number is in, the tablet shows the whole card already marked, privately, with its warnings ("not registered as sold", "complete since song 34"). The projector reveals it one song at a time. Answers the Check's Q2.
By: the user. Source: the Check's redesign in chat, 26 Nov. Lives in: requirements/screens.md › Console.

### D109 · A pass needs no confirmation; a quiet way to stop the Check · 2026-11-26 · Amended by D117
A card that passes is valid by itself: there's no "Confirmar". The fanfare and the Celebration start only on the presenters' cue, never by themselves, so they don't land over the presenters' voices. A smaller button stops the Check at any time before that cue, showing neither a pass nor a fail, for when the organizers suspect something and want to check the card by hand. Answers the Check's Q3.
What a stop does (the orchestrator, as the user asked): the claim stays undecided, kept in the console's list as stopped. The round goes back to the Hold it was in before the Check ("Parlem", the music under the voices); no fanfare or effect plays. The projector's card fades out with no mark and no text, back to the round's screen; phones show nothing about it. Afterwards the presenters either check the card again (publicly, from the start; its result decides as usual) or drop the claim, and the round goes on. This replaces rejecting a card that passed.
By: the user; the stop's details by the orchestrator at the user's request. Source: the Check's redesign in chat, 26 Nov. Amends: D49 (rejecting a passed card becomes stopping the Check). Lives in: requirements/game-rules.md › The Check; requirements/screens.md › Console, Projector.

### D110 · "Algú més?" is asked while taking the number · 2026-11-26 · Active
A presenter asks for other cards while walking to the player. The claim pad takes one number or several ("+ Un altre") before checking. The list of claimed cards only appears when there are 2 or more, and someone who shouts during a Check can still be added. Answers the Check's Q5.
By: the user. Source: the Check's redesign in chat, 26 Nov. Lives in: requirements/game-rules.md › Claims; requirements/screens.md › Console.

### D111 · The cloud is always the source of truth for the night's plan · 2026-11-26 · Amended by D116
One rule, whatever the date: the cloud's plan wins. There's no git-tracked settings file and no prizes or sponsors in git. A local copy an agent edits is only a working copy, pushed back to the cloud. Development has no cloud, so it runs on a test plan. Answers U43.
By: the user. Source: open-questions.md › Answered (U43); the user's message of 26 Nov. Supersedes: D97. Amends: D89 (the organizers' spreadsheet is parsed into the cloud's plan, not into a git file). Lives in: requirements/operations.md › Privacy; requirements/game-rules.md › Sponsors.

### D112 · No sponsors, prizes or money in git · 2026-11-26 · Amended by D116
Businesses' names and prizes change every year, so they don't belong in git. Money amounts live only in the organizers' spreadsheet. Answers U48.
By: the user. Source: open-questions.md › Answered (U48). Lives in: requirements/operations.md › Privacy.

### D113 · Songs go to R2 as soon as they're ready · 2026-11-26 · Active
R2 storage may go past the free 10 GB, at a few cents a month. Each set of songs is uploaded as soon as its files are ready, not a week before the night, and pruned after the night. Answers U53.
By: the user. Source: open-questions.md › Answered (U53). Lives in: requirements/operations.md; docs/timeline.md › Risks.

### D114 · Londrina's two lowercase exceptions · 2026-11-26 · Active
Unit symbols next to a number stay lowercase ("9 s", "25 m", "10:14 pm"), and Nunito text inside a Londrina button keeps its normal case. Answers U46.
By: the user. Source: open-questions.md › Answered (U46). Amends: D96. Lives in: requirements/screens.md › Every screen.

### D115 · The card icon picker is style A · 2026-11-26 · Superseded by D131
On "Afegir cartró", the icon picker is framed, with the icons already taken pressed in, as on `Mobil-B-J2`. The QR icon feels too sharp next to the others and gets softened on the boards. Designs only. Answers U47.
By: the user. Source: open-questions.md › Answered (U47). Lives in: requirements/screens.md › Player app.

### D116 · One JSON per edition, in git, sent to the cloud by hand · 2026-11-26 · Active; the details Pending (Backend's and Sound engine's proposal)
Each edition keeps one JSON in git with all the info it needs: the plan and its rounds, prizes and sponsors (businesses' names included), the songs and the cards. Local seeding uses it. On the day, or for a rehearsal, the user or an agent uploads it by hand to configure everything or reset all data, and an upload always saves the old settings first, so nothing is lost. Git isn't read at runtime: the cloud stays the source of truth while running (D111). Logos stay separate, in the bucket. Money amounts stay in the organizers' spreadsheet (D112). The user: "you assumed that being in git meant also being used at runtime in production, no, i (or an agent) would send it to prod manually."
By: the user. Source: the user's message of 26 Nov. Amends: D111 (it read "no git file" into the user's answer), D112 (names and prizes in git are fine). Lives in: requirements/operations.md › Privacy; requirements/game-rules.md › Sponsors.

### D117 · The Check's details · 2026-11-26 · Amended by D118
Stopping a Check puts the round into Pausa (the Interval music; the projector and phones show "Tornem de seguida"), not back into Parlem. Automatic reveal (holding A, or the toggle) runs through the cue too, the fanfare or the fail moment, and goes no further. The rest of U62 stands: the reveals stop at the first ✗; several cards are checked in turn; a stopped claim holds the round until it's checked again or dropped; the Desgraciat has the same controls; Parlem works in the Celebration. Answers U62.
By: the user. Source: open-questions.md › Answered (U62); the user's message of 26 Nov. Amends: D109 (the stop's Parlem, and the cue only by hand). Lives in: requirements/game-rules.md › The Check; requirements/screens.md › Console; requirements/show-and-music.md › the Check's sound.

### D118 · A stopped Check has its own screen and keeps the music · 2026-11-26 · Active; the screens' content Pending (U76–U79)
A stopped Check is a state of its own, with a new screen on the projector and on the tablet. Whatever was already playing keeps playing. Pausa happens only if a presenter turns it on, as usual with the remote or the tablet's buttons, which that screen also offers. The user: "during stop we should keep playing whatever was already playing, only put pause if presenter enables it, like he normally does with the remote or buttons in tablet, also in that screen." The rest of D117 stands, including that the round can't move on until the claim is checked again or dropped.
By: the user. Source: the user's message of 26 Nov. Amends: D117 (the orchestrator had read "back to the quina but in pause" as an automatic Pausa). Lives in: requirements/game-rules.md › The Check; requirements/screens.md › Console, Projector; requirements/show-and-music.md › the Check's sound.

### D119 · A stopped Check is "under review" · 2026-11-26 · Active
"Stopped" sounded like the end, and the user wants a name that feels temporary. A claim whose Check the presenters interrupt is **under review**: on the tablet "En revisió", with the button "Revisió manual". "Dropped" ("Descartat") stays. Answers U80.
By: the user. Source: open-questions.md › Answered (U80). Amends: D109, D118 (their "stop"). Lives in: GLOSSARY.md › Review; requirements/game-rules.md › The Check; requirements/screens.md › Console.

### D120 · The code calls it `reviewing` · 2026-11-26 · Active
The Claim status for "under review" is `reviewing`, like `checking`; the commands and log entries use the same word. Answers U81.
By: the user. Source: open-questions.md › Answered (U81). Lives in: packages/protocol (Sound engine).

### D121 · What the organizers decide after a review · 2026-11-26 · Active; where Discard leads: D122
While a claim is under review, the organizers pick one of four:
- **Continue the Check** from where it was interrupted.
- **Win, by hand:** the remaining songs are skipped and the fanfare and Celebration play straight away, even if the card doesn't pass. The tablet warns when it doesn't.
- **Lose, by hand:** the same, with the fail moment. The tablet warns when the card would have passed.
- **Discard:** like losing, but with no fanfare and no failure music. The round waits, ready to resume.

This replaces checking it again from the start and "drop". A win by hand on a card that doesn't pass is the one exception to "never accept a card that failed", and only a review allows it. The log marks every hand decision. Why: it's a plan B. If the system has an error, or something has to be done by hand, the night is never blocked.
By: the user. Source: the user's message of 26 Nov. Amends: D49 and D63 (a review may declare a win by hand), D109 and D118 (the review's outcomes). Lives in: event.md › Claims and checks; requirements/game-rules.md › The Check; requirements/screens.md › Console.

### D122 · After a discard, the round is back in Parlem · 2026-11-26 · Amended by D125
A discard doesn't show "Tornem de seguida", since everyone is already there and the presenters are probably explaining what happened. The music that was playing before the Check comes back, with Parlem on and the auto-advance off. As soon as a presenter presses "Següent", Parlem goes away and the auto-advance returns to whatever it was. Answers U82.
By: the user. Source: open-questions.md › Answered (U82). Amends: D121. Lives in: requirements/game-rules.md › The Check; requirements/show-and-music.md › the Check's sound.

### D123 · The projector shows "Revisió manual" during a review · 2026-11-26 · Active
While a claim is under review, the projector stays on the Check screen and shows "Revisió manual". Answers U76.
By: the user. Source: open-questions.md › Answered (U76). Lives in: requirements/screens.md › Projector.

### D124 · The code calls it `discarded` · 2026-11-26 · Active
The status for a discarded claim is `discarded`, matching the user's word and the label "Descartat". Answers U83.
By: the user. Source: open-questions.md › Answered (U83). Lives in: packages/protocol (Sound engine).

### D125 · After a discard, the "aturat" mode, not the auto-advance off · 2026-11-26 · Superseded by D142
After a discard, the round uses the console's existing "aturat" mode ("Avanç automàtic aturat: prem Següent"), the override of the auto-advance, instead of switching the auto-advance setting off and remembering it. The music from before the Check still comes back in Parlem. On "Següent", Parlem goes away and the auto-advance is back to whatever it was. The user: "you should have told me that we already have the aturat mode wich is a override of the auto-advance, and more suitable for this."
Sound engine's facts (26 Nov): in today's code "Avanç automàtic aturat" is the auto-advance setting itself switched off, and "Següent" doesn't clear it. The override is the Hold: Parlem already suspends the auto-advance, and "Següent" ends it with the auto-advance as set. Which one the user means is U84.
By: the user. Source: the user's message of 26 Nov. Amends: D122. Lives in: requirements/show-and-music.md › the Check's sound.

### D126 · An unknown card number is refused privately · 2026-11-26 · Active
The claim pad refuses a number that doesn't exist ("Aquest número no existeix"), so the presenter retypes it and nothing goes public. A real card of the wrong type still fails publicly (D33). Answers U86.
By: the user. Source: open-questions.md › Answered (U86). Lives in: requirements/game-rules.md › The Check; requirements/screens.md › Console.

### D127 · "Enrere" inside a Check · 2026-11-26 · Amended by D134
A claim is an instant, so before a Check "Enrere" is the normal Back. If a presenter undoes a song there, the Check may fail; they press "Següent" again, and no extra logic is needed. During a Check, a single press (no 1+2 hold) steps back one revealed song, down to none. At none, the song that was playing before the Check plays again, while the card stays on the Check screen; "Enrere" never closes the Check. The button hints sit on the right buttons. Answers U87.
By: the user. Source: open-questions.md › Answered (U87); the user's message of 26 Nov. Lives in: requirements/show-and-music.md › The presenters' actions.

### D128 · Pausa resumes what was playing · 2026-11-26 · Amended by D135; more details Pending (U105–U114)
Pausa is available at any time, and the playback in progress is saved when it starts. While it's on, the remote's A turns Pausa off (its hint glides to the new place), and the tablet's "Següent" still plays the transition into the next song. Parlem shows as on and can't be turned off: the Pausa music plays low, as if in Parlem. When Pausa ends, whatever was playing before resumes, with Parlem still on: a round's song, the win or fail music, or any other. Then A goes back to normal. During a Check, the −/+ hold sends the Check to review instead of pausing; the hints move, and A's action changes once the screen shows the review.
By: the user. Source: the user's message of 26 Nov. Amends: "the round resumes with a normal transition" (show-and-music › The presenters' actions). Lives in: requirements/show-and-music.md › The presenters' actions.

### D129 · Music for each moment · 2026-11-26 · Active; the details Pending (U96–U100)
- **Pausa:** the lofi and silly-core playlist (0XTlZPUpt7xPoPxk4AUU3O).
- **Breaks and after the game:** pop, from the playlist 0fvoRGCC8zXqDyj5uLhJVg.
- **Separate moods:** the beginning, each break and the end each get their own music. The end's songs play in a fixed order, so the first song after the close is planned.
- **Round intros:** the user picks each round's intro music. For now it's "5-12. Parasail Minigame" (Zelda: Breath of the Wild), looping cleanly, played low as if in Parlem.
- **Throws:** each throw gets an energetic song of the user's choosing. For now both play "Pont aeri", from a hook chosen in advance.
By: the user. Source: the user's message of 26 Nov. Amends: D104 (that playlist is now Pausa's, not the Interval's). Lives in: requirements/show-and-music.md › Music for each moment; event.md › The night, step by step.

### D130 · A volume for each kind of sound · 2026-11-26 · Active; the list and the place Pending (U101–U102)
A master volume plus one each for the win, the fail, breaks, Pausa, intros, songs, songs in Parlem and effects. All start at 100%, except songs in Parlem and effects, which may start lower.
By: the user. Source: the user's message of 26 Nov. Lives in: requirements/show-and-music.md › Volumes.

### D131 · The card icon picker mixes B and C · 2026-11-26 · Active
The picker on "Afegir cartró" takes B's labels and B's background opacity for an icon that's already taken, and C's circular shape, frame and border. The QR icon is softened (D115). Designs only until built (D132).
By: the user. Source: the user's message of 26 Nov. Supersedes: D115. Lives in: requirements/screens.md › Player app.

### D132 · Build the phone's drawers to match the design · 2026-11-26 · Active
The user's go to implement: the player app's home, corner buttons and drawers (D73, D87) are built to match the agreed canvas boards (`Mobil-B-J2` and the add-card drawer, v61 onwards), so the work isn't left half done. This lifts the UI freeze for the player app's drawers only. `71caa9c` is already pushed and stays as the starting point. The prizes drawer isn't designed yet (U30), so it's not part of this.
By: the user. Source: the user's message of 26 Nov. Lives in: requirements/screens.md › Player app.

### D133 · "Següent" doesn't end Parlem; Aguanta and Suspens block it · 2026-11-26 · Amended by D142
"Següent" no longer ends Parlem in general (today's code ends it). While Aguanta or Suspens is on, "Següent" is disabled: holding B and pressing A plays no next song. A Parlem or an Aguanta that will end at the next "Següent" (an "expirable" one, as after a discard) shows a discreet badge on its button, with no text or very short text. Every Hold mode shows that it's on (today the Parlem and Aguanta buttons show pressed, and the "Ara sona" ring shows a "Parlem" badge and a "Parlem · des de fa…" chip). Answers U84 with (b).
By: the user. Source: open-questions.md › Answered (U84); the user's message of 26 Nov. Lives in: requirements/show-and-music.md › The presenters' actions.

### D134 · "Enrere" inside a Check, the details · 2026-11-26 · Active
On the projector the last revealed mark disappears, and that cell is next again (U90). A step back replays the previous song's snippet, and it turns off that Check's automatic reveal if it was on, for that Check only (U91). It works only while songs are being revealed: not in a review, and not after the cue (U92).
By: the user. Source: open-questions.md › Answered (U90–U92). Amends: D127. Lives in: requirements/show-and-music.md › The presenters' actions.

### D135 · Pausa, the screens, the resume and a review · 2026-11-26 · Active
"Tornem de seguida" shows on the projector and phones only during a round, a Check or a Celebration; at the doors, in a break and at the end, the screens stay as they are (U93). The playback resumes exactly where it was, fading in (U94). During a review, the −/+ hold is Pausa as usual, and A does nothing: the review's four choices are tablet-only (U95).
By: the user. Source: open-questions.md › Answered (U93–U95). Amends: D128. Lives in: requirements/show-and-music.md › The presenters' actions.

### D136 · "Break" for the time between rounds; "Throw" on its own · 2026-11-26 · Active
The user prefers "break" to "Interval" for the time between two rounds; if "interval" is too embedded in the code, it can stay there. "Throw break" is a poor name, since a throw is independent of the break: it's just a **Throw**. Answers U96 (by "break" the user meant every Interval). The code keeps `interval`, per the user's condition. Sound engine counted about 700 lines in 90 files, and the word is stored in data: every night's log, the cloud's database, the plan's `schedule.intervalMinutes`, and the commands. New throw code is called `throw`.
By: the user. Source: open-questions.md › Answered (U96). Lives in: GLOSSARY.md.

### D137 · No DJ after the quina; a Spotify Jam while taking down · 2026-11-26 · Active
There's no DJ set after the quina this year. After the close the end music plays from the laptop. At some point during the take-down, the tech disconnects the laptop from the sound system, and a phone connects for a Spotify Jam, where people add songs as they like, so the laptop can be packed. Answers U98.
By: the user. Source: open-questions.md › Answered (U98). Lives in: event.md › The night, step by step.

### D138 · The throw song and its "Llançament" button · 2026-11-26 · Active; whether it can stay on the cards Pending (U103)
The throw song is "Flying Free" by Pont Aeri and Marian Dacal, the one in last year's playlist (id 24 in the default pool, Spotify 1cpIInDCM09St4ajfPvPPZ), already downloaded with hooks. It gets a hook of its own for throws, a bit before the drop, so the presenters can build the hype before the throwing starts. The "Llançament" button starts it from that hook at full volume, and the break music fades back in when it ends. A tap stops it, and a later tap resumes where it stopped; a long press plays it again from the hook. Answers U100.
By: the user. Source: open-questions.md › Answered (U100). Lives in: requirements/show-and-music.md › Music for each moment.

### D139 · Every slider, on the tablet · 2026-11-26 · Active
All the sliders Sound engine listed (U101 (a)), in the tablet's settings, saved in the cloud and the edition file (U102 (a)).
By: the user. Source: open-questions.md › Answered (U101, U102). Amends: D130. Lives in: requirements/show-and-music.md › Volumes.

### D140 · Start designing and building the new things · 2026-11-26 · Active
The user's go: "you can ask the sessions to start designing and implementing the new things, most of it is sorted out". The sessions design and build what's decided: the presenter-paced Check and its review (D107–D126), "Enrere" inside a Check (D127, D134), Pausa (D128, D135), the Hold rules (D133), the music for each moment and the throws (D129, D138), and the volumes (D139). This lifts the UI freeze for those parts of the console, the projector and the phones. It also covers the console's two labels (U67 (a)) and publishing the Check boards (U66). Parts still open with the user stay out until answered.
By: the user. Source: the user's message of 26 Nov. Lives in: docs/status.md.

### D141 · The add-card QR button scans inside the app · 2026-11-26 · Active
"Escanejar el QR del cartró" opens the camera in the drawer and reads the card's QR. The number is filled in, and the name and icon already picked are kept. It needs a board for the camera view first, a camera permission prompt, and a small QR-reading library, since iPhones' Safari can't read QR codes on its own. Answers U115.
By: the user. Source: open-questions.md › Answered (U115). Lives in: requirements/screens.md › Player app.

### D142 · What Parlem and Pausa are for; "Següent" ends Parlem · 2026-11-26 · Active
The user's reasons, recorded so they aren't lost again:
- **Parlem:** the presenters normally talk over the music at full volume. Parlem is for when something important needs saying: it gets the crowd's attention and makes the message easier to hear. It isn't meant to be switched on and off for every remark. While it's on the game doesn't move on (nothing lands by itself, even with the auto-advance on), and "Següent" ends it, because while saying something important they never want the game to carry on in the background.
- **Pausa:** the next level. The sudden change of mood gets even more attention and makes it clear the normal flow has stopped for a while. Soft music plays, because complete silence would feel like an error or a bug.

So "Següent" ends Parlem, as today (D133 reversed on this point; U116 needs no answer). There's no "expirable" Parlem or Aguanta badge: every Parlem ends at "Següent", and "Següent" is disabled during Aguanta (U117 (a)). After a discard it's just Parlem (U118 needs no answer).
By: the user. Source: the user's messages of 26 Nov. Amends: D133. Supersedes: D125. Lives in: event.md › The presenters; GLOSSARY.md › Hold, Pause.

### D143 · "Avanç manual" instead of "aturat" · 2026-11-26 · Active
When the auto-advance is switched off, the console says "Avanç manual", not "Avanç automàtic aturat". "Aturat" was confusing.
By: the user. Source: the user's message of 26 Nov. Lives in: GLOSSARY.md › Manual advance.

### D144 · Suspens with A on the remote; the shake becomes optional · 2026-11-26 · Amended by D147, D148
While B is held (Aguanta), holding A too starts Suspens. It works if A goes down slightly before B, or at any time after B is held. Letting go of A alone, with B still held, cancels the Suspens: the build backs out and fades, and the song is back in Aguanta. The engine can cancel a Suspense already: Pausa does. A toggle in the settings and in the remote's mapping turns the shake gesture on or off, and each shake gives one vibration.
By: the user. Source: the user's message of 26 Nov. Lives in: requirements/show-and-music.md › The presenters' actions.

### D145 · With manual advance, holding B starts Suspens · 2026-11-26 · Amended by D148
With the advance manual, holding B starts a Suspens straight away. Three evenly spaced vibrations follow, and letting go of B before the third cancels it. After the third it can't be undone: a gentler vibration, oscillating or below full power, lasts as long as the Suspens, and letting go of B lands it. With the auto-advance on, B stays Aguanta. Answers U119 with (b).
By: the user. Source: open-questions.md › Answered (U119). Lives in: requirements/show-and-music.md › The presenters' actions.

### D146 · No special style for the playing song · 2026-11-26 · Active
In the phone's Historial, the song playing now has no style of its own: "we dont need a special style for the playing song". Done in the code and on 22 boards (canvas v66).
By: the user via canvas (26 Nov). Source: the "Quina Musical look" canvas v66; Frontend's report. Lives in: requirements/screens.md › Player app.

### D147 · A Suspens started with B + A works like the manual one · 2026-11-26 · Active
Letting go of B lands it (U120 (a)). Entering it follows the manual advance's logic (D145): three evenly spaced vibrations follow, and letting go of A before the third cancels it back to Aguanta. After the third it can't be undone: a gentler vibration lasts while it's on, and letting go of B lands it.
By: the user. Source: open-questions.md › Answered (U120). Amends: D144 (letting go of A cancels only inside the window). Lives in: requirements/show-and-music.md › The presenters' actions.

### D148 · The shake stays on; the window is 1.5 s · 2026-11-26 · Active
The shake gesture is on by default (U121 (a)). The cancel window is about 1.5 s, a vibration every half second (U122 (a)); it may change once the user tries the remote.
By: the user. Source: open-questions.md › Answered (U121, U122). Amends: D144, D145. Lives in: requirements/show-and-music.md › The presenters' actions.

### D149 · "Descans" on every screen · 2026-11-26 · Active
The screens say "Descans" for a break, not "Mitja part". Answers U123.
By: the user. Source: open-questions.md › Answered (U123). Lives in: GLOSSARY.md › Break; requirements/screens.md.

### D150 · Horari's rows · 2026-11-26 · Amended by D192
The phone's Horari starts with the card-selling time ("the welcome is actually the ticket buying time"), then the rounds with "Primer descans" and "Segon descans" among them, then "Fi". The plan needs the doors' time. Answers U125 with (b).
By: the user. Source: open-questions.md › Answered (U125). Lives in: requirements/screens.md › Player app.

### D151 · A button for the corn-seed storm at the end · 2026-11-26 · Amended by D153, D155
After last year's last round, the crowd went wild and threw corn seeds all around, a fun, chaotic moment like the throws. If it happens again, the tech turns on a song by hand, from a hook of its own right at the drop, since nobody controls when the throwing starts.
By: the user. Source: the user's message of 26 Nov. Lives in: event.md › The night, step by step; requirements/show-and-music.md › Music for each moment.

### D152 · Horari's first row is "Venda de cartrons" · 2026-11-26 · Active
Answers U131.
By: the user. Source: open-questions.md › Answered (U131). Amends: D150. Lives in: requirements/screens.md › Player app.

### D153 · The corn-seed storm plays "Flying Free" from the drop, for now · 2026-11-26 · Active
"Flying Free" (Pont Aeri) straight from its drop; the user may pick another song closer to the date. Answers U132's song.
By: the user. Source: open-questions.md › U132. Amends: D151. Lives in: requirements/show-and-music.md › Music for each moment.

### D154 · The two chaotic moments are louder than the songs · 2026-11-26 · Amended by D157
The throws and the corn-seed storm play louder than the usual songs.
By: the user. Source: the user's message of 26 Nov. Amends: D139. Lives in: requirements/show-and-music.md › Volumes.

### D155 · Where the corn-seed storm's button appears · 2026-11-26 · Active
In more places than after the last round, but not everywhere: on the tablet's normal screen during the night's last round, inside its Check, and after it, on the end screen. Answers U132.
By: the user. Source: open-questions.md › Answered (U132). Amends: D151. Lives in: requirements/screens.md › Console.

### D156 · The orchestrator's relays are the user's decisions · 2026-11-26 · Active
When the orchestrator relays a decision from the user, the sessions take it as the user's own, a lifted freeze included. The user told Frontend so, after Frontend held back the console's labels: "He took the code freeze too seriously." A session's own permission check may still need the user's OK in that session; that's for the user, never worked around.
By: the user (to Frontend, 26 Nov). Source: Frontend's report of 26 Nov. Lives in: docs/team.md.

### D157 · Every slider goes above 100%, with hidden room · 2026-11-26 · Amended by D158
The chaotic moments get louder through their slider going above 100%, while the engine plays the whole show lower inside, so the limiter has room (U133 (a)). The user extends it: every slider runs from 0% to about 140–150%, with its default at 100%. The tech turns the sound system up once, at the sound check, by the internal trim.
By: the user. Source: open-questions.md › Answered (U133). Amends: D139, D154. Lives in: requirements/show-and-music.md › Volumes.

### D158 · Noticeably louder, set by ear · 2026-11-26 · Active
The chaotic moments must sound noticeably louder than the songs. The amount is set by ear once the user hears it, not decided in advance. Starting point: +6 dB (about 141%), with a −6 dB internal trim so it stays clean, both one-line settings, tuned at the listening pass or the sound check. Answers U134's trim and default.
By: the user (the amount by ear); the starting point by the orchestrator, as a tunable setting. Source: the user's message of 26 Nov. Amends: D157. Lives in: requirements/show-and-music.md › Volumes.

### D159 · One slider for both chaotic moments · 2026-11-26 · Active
The throws and the corn-seed storm share one volume slider. Answers U135.
By: the user. Source: open-questions.md › Answered (U135). Lives in: requirements/show-and-music.md › Volumes.

### D161 · The Desgraciat ends on stage · 2026-11-26 · Amended by D166–D169
The user, on the canvas: "In desgraciat we probably dont need to do the check show because the remaining players go up in stage and their card gets checked before going up." When about 5–10 cards still stand, their players come up on stage, and each card is checked privately on the way. The presenters enter every finalist's number. The projector shows one nino per finalist, with its card number inside or under it, in ascending order so the players can line up. As soon as a landed song is on a finalist's card, that nino is marked out, and it fades when the next Spin starts. When one is left, that's the winner, with no public Check. The tablet shows the ninos too, with a toggle that reverses their order (the tablet faces the audience), at the presenters' choice. This changes "the standing cards never reach the projector" for the finalists on stage, and it lets the system end the round, since the finalists are known.
By: the user via canvas (26 Nov, "Tell the orchestrator and i solve the unknowns with him"). Source: Frontend's report of 26 Nov. Amends: game-rules › The Quina del Desgraciat (its Check; "the presenters call the winner by looking at the room"). Lives in: requirements/game-rules.md › The Quina del Desgraciat; requirements/screens.md › Projector, Console.

### D162 · A private song lookup for the presenters · 2026-11-26 · Amended by D170
Usable at any time in a round, on the tablet only:
- the round's played songs, newest first;
- a fuzzy search by title or artist that accepts typos and highlights the matches ("tetadar" finds "Tenia Tanto Que Darte");
- a button that also shows the future: every upcoming song in order, keeping the scroll, plus a toggle for how many songs ahead each one is and what it would take to win. All hidden until a presenter presses "view future", like Futur;
- a card preview: type a card number to see which of its songs have played and which haven't, as a private quick check.

Maybe a tab at the bottom left, as a list or a grid; Frontend draws the options.
By: the user via canvas (26 Nov). Source: Frontend's report of 26 Nov. Lives in: requirements/screens.md › Console.

### D163 · The Check shows the card's type and side in one label · 2026-11-26 · Active
The Check's projector screen and the tablet show one label for the card's type and side: "Normal 1-5", "Normal 6-10" or "Especial", not two separate pills. So a player can see that the side checked is the round's side.
By: the user via canvas (26 Nov). Source: Frontend's report of 26 Nov. Lives in: requirements/screens.md › Projector, Console.

### D164 · The claim pad's close button is "Torna a la quina" · 2026-11-26 · Active
"Cancel·la" scared the presenters and sounded like it cancelled something else. The button only closes the number pad and goes back to the round's normal screen, so it's "Torna a la quina", the pad's larger button. Agreed by the orchestrator and Frontend, as the user asked ("Talk to orchestrator to agree on a term").
By: the orchestrator and Frontend, at the user's request. Source: the canvas thread on `Consola-Comprovacio-Ritme`. Lives in: requirements/screens.md › Console.

### D165 · The user's own canvas edits to the Check · 2026-11-26 · Active
The user worked with the canvas's own assistant: "Un altre" becomes "+ Candidat", buttons come in three sizes defined in the component, the next song sits inside "Destapa", and there are no "només vosaltres" tags. The canvas has two pages, "Disseny actual" and "Proves i opcions". Answers U140.
By: the user via canvas (26 Nov). Source: open-questions.md › Answered (U140). Lives in: the "Quina Musical look" canvas.

### D166 · The finale replaces the Desgraciat's public Check · 2026-11-26 · Active
Answers U142 with (a).
By: the user. Source: open-questions.md › Answered (U142). Amends: D161. Lives in: requirements/game-rules.md › The Quina del Desgraciat.

### D167 · The finale's button takes the claim button's place, and grows · 2026-11-26 · Active
The presenters start the finale by hand (U143 (a)), not from the "Dempeus" tab. In the Desgraciat, the slot of today's "Comprovar" button becomes the finale's button, with its own label and icon. It grows as fewer players stand, because the larger button is the main, recommended action.
By: the user. Source: open-questions.md › Answered (U143). Amends: D161. Lives in: requirements/screens.md › Console.

### D168 · Entering a finalist shows the card privately · 2026-11-26 · Amended by D183
Entering a finalist's number shows that card privately, like the Check screen, with each song marked ✓ or ✗. A card that has already fallen shows its ✗ and isn't added (U144 (a)). The presenters can remove a finalist, or bring one back, by hand (U145 (a)).
By: the user. Source: open-questions.md › Answered (U144, U145). Amends: D161. Lives in: requirements/game-rules.md › The Quina del Desgraciat; requirements/screens.md › Console.

### D169 · The finale is decided by the song, not the card · 2026-11-26 · Superseded by D180
The user: "if the last 2 finalist have the same song, we already know they both won. so the moment that we know who wins is dependent on the song, not the individual card. in the projector and tablet they should show together, because they win or get eliminated together." Proposed handling, by the orchestrator at the user's request:
1. At each landing, the finalists with that song on their card fall together, shown together as one group on the projector and the tablet.
2. If one finalist is left, they win.
3. If the landing would take every remaining finalist, nobody is out: they all win together (a shared win, as today's rule; U149 (a)), shown together.
4. "Enrere" on that landing brings the whole group back.
5. Removing a finalist by hand that leaves one standing makes that one the winner.
6. The fanfare waits for the presenters' cue (D109's reason: not over their voices).
By: the user (the rule); the orchestrator (the handling, to be confirmed). Source: open-questions.md › U146, U149, U151. Amends: D161.

### D170 · The lookup, the game's state and the future, as three tabs · 2026-11-26 · Active
- **The lookup** is a tab of its own, for a quick private check (U147): a song search, and a card check whose "show future" button also tells whether the card can still win.
- **Today's "Futur" becomes the game's state,** always visible with no button: how close everyone is to winning. The histogram of cards by songs missing moves to its left, since it isn't future information, and the round's song history, scrolling, goes on its right.
- **A new "Futur" tab:** the possible winners and the songs to the first possible Line and Quina on the left, and the upcoming songs on the right, each with how far ahead it is and how many more songs until any card can win (U148 (b)). It stays hidden until "Mirar el futur", so the presenters stay intrigued (event.md). So the song history needs no future button.
By: the user. Source: open-questions.md › Answered (U147, U148). Amends: D162. Lives in: requirements/screens.md › Console.

### D171 · Part 1 plays Quines 1–4 and the special rounds; Part 2 plays Quines 5–10 · 2026-11-26 · Superseded by D193 (the specials' pool still stands, pending U167)
The Especial and the Desgraciat use Part 1's playlist, so Part 1 covers Quines 1–4 and Part 2 covers Quines 5–10, and both play about the same number of rounds (six each). The normal card's side 1 is Quines 1–4 and side 2 is Quines 5–10. The presenters explain the sides in rounds 1 and 5. The special card is printed from Part 1, and no third playlist is needed. The user still has to confirm this with the other organizers and may change it.
By: the user. Source: the user's message of 26 Nov. Supersedes: D105. Amends: D101, D102. Lives in: event.md › The cards, The songs; requirements/songs-and-cards.md; requirements/game-rules.md › The night's rounds.

### D172 · The finale's groups use the group ninos · 2026-11-26 · Superseded by D180
D169's handling is confirmed. Finalists who fall or win together are shown with the ninos that already come in groups: two kissing, two dancing (one flipped horizontally), three stacked as a human castle. Answers U151.
By: the user. Source: open-questions.md › Answered (U151); the user's message of 26 Nov. Amends: D169. Lives in: requirements/screens.md › Projector, Console.

### D173 · The game's-state tab is "Estat" · 2026-11-26 · Active
"Something like 'Estat de la quina' but shorter." Answers U152.
By: the user. Source: open-questions.md › Answered (U152). Amends: D170. Lives in: requirements/screens.md › Console.

### D174 · A song plays longer the first time it's heard · 2026-11-26 · Active
The slower pace isn't about the first round: "the first time any song plays it plays for longer, no matter the round that happens. and the first time that plays must be a main hook." A song's first play of the night gets the longer slot (about 22 s today) and starts at its main hook; later plays get the usual slot (about 14 s). This covers round 1, Part 2's first rounds, and any song new to the night, and it means the special rounds, which replay Part 1, mostly run at the shorter slot. Answers U51.
By: the user. Source: open-questions.md › Answered (U51). Supersedes: the "first round of the night" rule (show-and-music › Auto-advance, Pace and Drift). Lives in: requirements/show-and-music.md › Auto-advance, Pace and Drift; requirements/songs-and-cards.md › Hooks.

### D175 · A first play keeps 22 s · 2026-11-26 · Active
The longer slot for a song's first play stays at about 22 s, accepting a night about 12 minutes longer (rounds ending about 9:46 pm, bad case 9:58 pm). Answers U154.
By: the user. Source: open-questions.md › Answered (U154). Amends: D174. Lives in: requirements/show-and-music.md › Auto-advance, Pace and Drift.

### D176 · A then B turns the starting transition into a Suspens · 2026-11-26 · Active
There's no delay on "Següent". A down starts the transition straight away, and the Spin takes a few seconds before its landing. If B goes down while A is still held, that transition becomes a Suspens, a transition held open (the glossary's own definition). If that can't be done smoothly, the transition is cancelled and a Suspens starts from the current song. A down and up, then B, is a normal Aguanta, which cancels the transition, as today. The 3-vibration window (D147) counts from the moment both are down. Answers U156, after the user's "think deeper".
By: the user. Source: open-questions.md › Answered (U156). Amends: D144. Lives in: requirements/show-and-music.md › The presenters' actions.

### D177 · How a Spin becomes a Suspens, at each moment · 2026-11-26 · Active
From Sound engine's measurements of 288 transitions, applying the user's D176 rule ("smoothly, else cancel and start a Suspens"):
- **Before A's exit move starts** (about the first 65% of the Spin): the build fades, and A's phrase loops as in any Suspens. This covers almost every A-then-B press.
- **After A's exit has started:** A's exit plays out, and the rest becomes a Suspens on B's grid without A, which is smooth at every point. Cancelling into Hold music would be audible, so it isn't used.
- **In the last 0.15 s:** nothing can stop the landing. B lands, and since B is held, the new song goes into Aguanta.
No new command: `suspense { on: true }` during a Spin converts it.
By: the orchestrator, applying the user's D176 to Sound engine's facts. Source: Sound engine's report of 26 Nov. Amends: D176. Lives in: requirements/show-and-music.md › The presenters' actions.

### D178 · Each set of 70 songs is a pool · 2026-11-26 · Active
Each set of 70 songs is its own **pool** (Pool 1, Pool 2), not a "Part". A round plays one pool, and a card's side is printed from one pool, as the glossary already says. The tools still prepare all of the night's songs together, as a **repertoire** (named by Sound engine and Backend, 26 Nov: `Repertoire`, `loadRepertoire`, `data/repertoires/`, `QUINA_REPERTOIRE`, the media sync's `--repertoire`, `repertoires/<name>/` in R2), and the per-song field becomes `pool`. Answers U54 with (b).
By: the user. Source: open-questions.md › Answered (U54). Amends: D171's wording ("Part"). Lives in: GLOSSARY.md › Pool; requirements/songs-and-cards.md › The pool.

### D179 · "+ Candidat" adds another claimed card · 2026-11-26 · Active
Answers U153.
By: the user. Source: open-questions.md › Answered (U153). Amends: D110's "+ Un altre". Lives in: requirements/screens.md › Console.

### D180 · The Desgraciat goes on until one card is left · 2026-11-26 · Active
D169's grouping was wrong, and the orchestrator should have pushed back: each card has its own 12 songs, so two finalists sharing one song don't share a fate. The rule now:
- A landing can knock out several finalists at once. Each falls on their own card, shown as individual ninos, not merged into a group.
- If a landing would knock out every finalist left, it doesn't count for them: they all stay in, and the songs go on until exactly one is left. "We're trying to find the most unlucky."
- So the Desgraciat has no shared win any more, in the finale or before it.
- No group ninos (D172).
The user: "when we only have 2 people we alway have to keep playing song until one is eliminated. in case they both have the same song, we should keep going until only one is left".
By: the user. Source: the user's message of 26 Nov. Supersedes: D169, D172, and the shared win (game-rules › The Quina del Desgraciat; event.md). Lives in: event.md › The special rounds; requirements/game-rules.md › The Quina del Desgraciat; GLOSSARY.md › Last standing.

### D181 · "Salvats!" · 2026-11-26 · Active
When a landing would knock out every finalist left, so it counts for none of them (D180), the moment is "Salvats!": they share the song, and the coincidence saves them. The user: "i prefer the concept of «Salvats!» because they got the same song and they are saved because of the coincidence. and the light effect should originate from the text". The light is larger and comes from the text, with the spotlights from the phone's "your song" effect, and confetti from the same particle library the phones use. Answers U162.
By: the user via canvas (26 Nov). Source: Frontend's report of 26 Nov. Lives in: requirements/screens.md › Projector.

### D182 · A fallen finalist keeps their own nino, faded · 2026-11-26 · Active
In the finale, a fallen finalist keeps the nino they had, with less opacity and saturation, plus the ✗, on the projector and the tablet. They don't become the sitting nino. The phones' sitting nino for a fallen card (D72) is unchanged.
By: the user via canvas (26 Nov). Source: Frontend's report of 26 Nov. Lives in: requirements/screens.md › Projector, Console.

### D183 · No bringing a finalist back; an edit mode to remove · 2026-11-26 · Active
A fallen finalist can't be brought back by hand ("No. this would break the rules"); only "Enrere" undoes a landing. Removing a finalist is done in an edit mode, off by default. "Editar" shows an × on each finalist (no confirmation) and an add button that does what "+ Finalista" does.
By: the user via canvas (26 Nov). Source: Frontend's report of 26 Nov. Amends: D168 (bringing one back by hand). Lives in: requirements/game-rules.md › The Quina del Desgraciat; requirements/screens.md › Console.

### D184 · The finale's button and stage · 2026-11-26 · Active
Two buttons (corrected the same day from Frontend's report: the first wording merged them):
- The claim slot's "Final a l'escenari" opens the finalists' pad. It grows as fewer stand, up to a limit, while "Enrere" stays small, aligned at the top. Its name stays as drawn on the boards until the user says otherwise.
- Inside the pad, "Començar final" starts the finale once there are at least 2 finalists. It was renamed from "Comença la final", on one line, with its icon on top.

On the stage, the ninos get larger as fewer remain. The outdated board Consola-Dempeus is removed; the finale board's Dempeus tab replaces it.
By: the user via canvas (26 Nov). Source: Frontend's report of 26 Nov. Lives in: requirements/screens.md › Console, Projector.

### D185 · Confetti falls very slowly · 2026-11-26 · Active
"the confeti falls too fast, should fall very slow": the phones' confetti is a slow, 6-second paper drift instead of 1.8 s (593fef2). The finale's "Salvats!" and the projector reuse the same particles.
By: the user via canvas (26 Nov). Source: Frontend's report of 26 Nov. Lives in: packages/ui/ANIMATIONS.md.

### D186 · The Desgraciat's Celebration reads "QUINA POTRA!" · 2026-11-26 · Active
On the canvas the user asked for a title after all: "it is better something related to being lucky or unlucky. in informal funny catalan". From the candidates on canvas v95 they picked "QUINA POTRA!", already drawn on the projector board. The console's presenters-only label "Últim cartró dempeus" stays. The winner's phone is left to U165. Answers U164 with (a).
By: the user. Source: open-questions.md › Answered (U164). Amends: D62. Lives in: requirements/game-rules.md › The Quina del Desgraciat; requirements/screens.md › Projector; GLOSSARY.md › Last standing.

### D187 · The finale and the new tabs, as drawn on canvas v95 · 2026-11-26 · Active
The user confirmed all five points:
- The remote's A stays "Següent", so the finale opens from the tablet only.
- Once started, the finalists' view lives in the Dempeus tab.
- The tabs go Estat, Cerca, Futur, Premis, Efectes. One "Cerca" tab has a "Cançons / Cartró" switch.
- The names "Al revés" and "+ Finalista" stay. They were placeholders.
- Frontend's own details are confirmed too:
  - "Editar" keeps its label while on, rather than "Fet";
  - "+ Afegir" sits in the panel's header;
  - the × shows only on standing finalists;
  - "Enrere" grows at most from 84 to 100 px.
Answers U155 with (a).
By: the user. Source: open-questions.md › Answered (U155). Lives in: requirements/screens.md › Console.

### D188 · The phone's add-card pad: "+ Cartró" and clearer buttons · 2026-11-26 · Active
The user's comments on the canvas board Mobil-Afegir-Estats:
- **The button:** "Simply + cartró": the home button reads "+ Cartró", not "Afegir cartró".
- **"Desar":** "this should be sticky, so if screen is small still visible".
- **Leaving with unsaved changes:** "if question is: Descartar? and answer is: Continuar. I understand that the discarding continues". Each button now says what happens, e.g. "Sortir sense desar?" with "Descarta els canvis" / "Segueix editant".
- **"Descartar"** "doesnt look like a button": it's redrawn as one.
The corner buttons on that board were outdated, so they're redrawn.
By: the user via canvas (26 Nov). Source: Frontend's report of 26 Nov. Lives in: requirements/screens.md › Player app.

### D189 · Buttons are fully round only when floating · 2026-11-26 · Active
The user: "buttons should not be fully round unless they are floating". A design-system rule for every screen: pills only for floating buttons, rounded rectangles otherwise. It was made on a phone board and stated generally, so it applies to the phones, the console, the projector and Admin. Frontend lists the boards and components that still have non-floating pills, then fixes the boards and the code after the finale and tab builds.
By: the user via canvas (26 Nov). Source: Frontend's report of 26 Nov. Lives in: requirements/screens.md › Every screen.

### D190 · The Desgraciat's winner phone says "Quina potra!" · 2026-11-26 · Active
The phone holding the last standing card says "Quina potra!" too, like the projector (D186), with the glowing card, the nino and the confetti. The user: "i dont care. a seems fine". Answers U165 with (a).
By: the user. Source: open-questions.md › Answered (U165). Amends: D62 (the phone's part). Lives in: requirements/screens.md › Player app.

### D191 · Under review, the music stays far down · 2026-11-26 · Active
While a Check is under review, the music from before the Check keeps playing (D118) at the level it had during the Check, far down. It doesn't come back to the claim's level. The engine already does this: the Check's duck stays during a review. Answers U78 with (a).
By: the user. Source: open-questions.md › Answered (U78). Lives in: requirements/show-and-music.md › The Check's sound.

### D192 · The 2026 night's order · 2026-11-26 · Active
Decided by the organizers. The Quina Especial is the last round, not the Desgraciat.
1. 🎫 Card sales, from 5 pm.
2. 🎉 The start, at 6 pm.
3. 1️⃣ Quines 1–5.
4. ✴️ The Quina del Desgraciat.
5. ☕️ One "Descans" with the throw, 10 minutes.
6. 2️⃣ Quines 6–10.
7. ✴️ The Quina Especial.
8. 🏁 The end, about 10 pm.

So the night has one Descans, not two: Horari's "Primer descans" and "Segon descans" (D150) become one "Descans". It has one planned throw, in that Descans; 2025 had three. The corn-seed storm's "last round" (D155) is now the Especial.
By: the user and the organizers. Source: the user's message of 26 Nov. Amends: D150. Lives in: event.md › When and where, The night, step by step; requirements/game-rules.md › The night's rounds; requirements/screens.md › Player app.

### D193 · Side 1 plays Quines 1–5, side 2 Quines 6–10 · 2026-11-26 · Active
The organizers settled the split: pool 1 plays Quines 1–5 and pool 2 Quines 6–10. The normal card's side 1 is for Quines 1–5 and side 2 for Quines 6–10, labelled "Normal 1-5" and "Normal 6-10" (D163). The presenters explain the sides in rounds 1 and 6. D171's split was provisional and is replaced. Its other part, the special rounds playing pool 1, stays until U167: with five normal rounds a pool, it no longer balances the pools at six rounds each, which was D171's reason.
By: the user and the organizers. Source: the user's message of 26 Nov. Supersedes: D171's split. Lives in: event.md › The cards, The songs; requirements/game-rules.md; requirements/songs-and-cards.md; requirements/screens.md › Projector.

### D194 · No "Llançament" on the end screen · 2026-11-26 · Active
The user on the canvas: "Why is llancament an option here? we dont have a llancament planned on the quina end". The end screen keeps "Tempesta" (D155) and drops "Llançament". The only planned throw is in the Descans (D192).
By: the user via canvas (26 Nov). Source: Frontend's report of 26 Nov. Amends: where the throw button shows (D138; the engine also allowed it after the Game). Lives in: requirements/screens.md › Console.

### D195 · At the doors and in a break, "Comença la quina" is the main action · 2026-11-26 · Active
"«Comença la quina» is a main action and should be on the right panel. it can be kept as a line when llançament is available. enrere and comprovar can be removed to make room, they are always disabled right?" They are: the engine accepts no claim and no Enrere in a break, and before the night has nothing to undo or claim. So, at the doors and in a break:
- "Comença la quina" takes the right column's big slot;
- "Llançament", when available, becomes a slimmer button;
- "Enrere" and "Comprovar" aren't shown.
By: the user via canvas (26 Nov). Source: Frontend's report of 26 Nov; protocol scenes.ts (claim and back). Amends: D138's layout (Llançament as the big button). Lives in: requirements/screens.md › Console.

### D196 · The console's playback is always at the top of the left column · 2026-11-26 · Active
The user on the canvas, again: "I told you a thousand times in comments! the song should be up on the left sidepanel!", and on the review board: the right side is only for action buttons. On every console screen, the playback ("Ara sona") sits at the top of the left column, and the right column holds only action buttons. Frontend checks every console board, and the code follows.
By: the user via canvas (26 Nov). Source: Frontend's reports of 26 Nov. Lives in: requirements/screens.md › Console.

### D197 · A planned throw's minutes are its break's length · 2026-11-26 · Active
The plan's throw entry (`schedule.throws: [{ afterRound, minutes }]`) means: "the break after that round lasts `minutes`, with a throw in it". It isn't time added on top of the usual break. The organizers wrote "Descans + llançament (10min)", the break's total, so Admin takes 10 for 2026. The engine's estimate and the countdown follow it, and so does Admin's label (e.g. "Descans de N min, amb llançament"). It agrees with the glossary: a Break is the time between two rounds, and a Throw usually happens inside one. With it, the night ends about 9:45 pm.
By: the orchestrator, applying the user's D192 to Sound engine's facts. Source: Sound engine's report of 26 Nov. Lives in: packages/protocol plan.ts (Sound engine); Admin (Frontend).

### D198 · Automatic cues and voice-overs · 2026-11-26 · Active; more moments Pending (U171)
New in 2026: short sound effects and voice-overs that play by themselves at chosen moments, "without being anoying". The user makes the voices with ElevenLabs. The ones the user named:
- **A short fanfare when a break ends,** "so the presenters dont start talking suddenly". A round never starts by itself, so it plays when a presenter presses "Comença la quina".
- **The doors' countdown:** a chime, then "La Quina Musical començarà en …", at 1 hour, 45, 30, 15 and 5 minutes before the start.
- **The start:** music or a fanfare to kick off the show, and maybe a voice-over with a funny story that ends with the presenters coming on stage doing something funny, then carrying on from there.
By: the user. Source: the user's message of 26 Nov. Lives in: event.md › The night, step by step; requirements/show-and-music.md › Music for each moment.

### D199 · D195 and D196 on the other screens · 2026-11-26 · Active
These follow from the user's own reasons. They can change them on the canvas.
- **The end screen:** "Enrere" and "Comprovar" go there too, since nothing can act there (the engine takes no claim and no Enrere after the night). "Tempesta" gets the room.
- **D196 is "always":** where a pad or tab covers the left column (the claim pad, the finalists' pad, an open Cerca), a compact "Ara sona" line stays at its top. In play, the presenters need the playing song to name it on the hit.
- **The Check screens** get the same compact line as the review board ("Ara sona · baixa, d'abans de la comprovació · …"), at the top of the left column, leaving room for the card's grid.
By: the orchestrator, applying the user's D195 and D196 to Frontend's questions. Source: Frontend's report of 26 Nov (canvas v99). Lives in: requirements/screens.md › Console.

### D200 · The phone asks whether to add another card · 2026-11-26 · Superseded by D241
After a player adds a card, a banner over the cards list asks whether they want to add another, with "No" and "Sí" ("Vols afegir un altre cartró?"). "Sí" opens the add-card pad. Why: "i worry users dont know they can add more than 1 card", and most people buy several cards and follow their relatives' (event.md › The cards). The pad still has one save button (D95). The choice comes after the save, on the list, instead of D95's removed "Desar i afegir-ne un altre".
By: the user. Source: the user's message of 26 Nov. Lives in: requirements/screens.md › Player app.

### D201 · The design system's points that follow from earlier decisions · 2026-11-26 · Active
From Frontend's design-system spec (26 Nov), the points that need no new choice:
- **D189 is about buttons.** Floating buttons stay round: the phone's corner discs and «+ Cartró». So do things that aren't buttons: switch tracks, status chips, the Wii remote's keys, ✓/✗ badges, the icon picker's circles (D131) and the ✕ over a finalist's nino. The non-floating pills become rounded rectangles: «Afegir cartró» in Ajustos and the empty states, «Escriure el número», «+ Afegir el d'enguany», the dialog's «Continuar», the prizes drawer's round chips and ‹ ›, and the ✕ beside typed numbers.
- **«+ Cartró» everywhere a card is added** (D188), Ajustos included.
- **The card marks' order follows D5,** corn first; today's picker shows the bauble first.
- **Labels the log already fixes:**
  - «Pausa», not «Pausa tècnica» (the glossary's Pause);
  - the review dialog's «Cancel·la» becomes «Torna a la revisió» (D164 retired «Cancel·la»);
  - the Desgraciat's chip reads «Últim cartró dempeus» (D186).
- **The side labels** are written with an en dash, «Normal 1–5» / «Normal 6–10», as in the code.
- **No «Cancel·la» / «Cancel·lar» anywhere** (D164, D188: a button says what happens). One that only closes says «Tanca». One that throws edits away says «Descarta els canvis». A confirm sheet's «no» names what it keeps, e.g. «Mantén el cartró».
The rest is U175.
By: the orchestrator, applying earlier decisions to Frontend's spec. Source: Frontend's report of 26 Nov (temp/design-canvas/ds/components.md, board-audit.md). Lives in: packages/ui (Frontend); requirements/screens.md.

### D202 · The automatic cues' moments · 2026-11-26 · Active; the 3-minute line Pending (U176)
The user's answers to U171:
1. **Each doors line carries one tip**, still at 1 hour, 45, 30, 15 and 5 minutes: the cards on sale, the phones' QR, the bar, "aneu seient!". The user also said "repeat we're selling tickets at 3min" (U176).
2. **The round fanfare says the round's name**, like a ring announcer ("Quina… tres!"), with lines of their own for the Desgraciat and the Especial.
3. **"Tornem en dos minuts" in the Descans**, 2 minutes before its planned end, calling people back from the bar, with the reminder to turn the card over for the second half (D193).
4. **A goodbye at the end** leads into the end music's first song. The user: "i may end up not doing at the end if we want to give presenters the last word".
5. **No voice lines on the presenters' pad.** Instead, a drum roll on the remote's D-pad (D203).
By: the user. Source: open-questions.md › Answered (U171). Amends: D198. Lives in: requirements/show-and-music.md › Music for each moment.

### D203 · A drum roll on the remote's D-pad · 2026-11-26 · Active; the vibration Pending (U177)
One of the D-pad's four effects becomes a drum roll with depth:
- **It plays as long as the direction is held.**
- **It follows the beat** of whatever music is playing.
- **Shaking the remote while holding** makes it a more intense roll. While a D-pad direction is held, shakes go to the effect and never count as Suspens's shake gesture.
- **Held longer than a threshold,** letting go lands it with a hit. Shorter, it stops smoothly. The threshold starts at about 2 seconds, tuned by ear (U13).
- **The remote marks the threshold,** with one vibration or the 3 vibrations of the other holds (U177).
- **The tablet stays the remote's plan B:** holding the effect's icon does the same, and sliding the finger up while holding stands in for the shake.
The user asked for more D-pad effects with this kind of depth (U178).
By: the user. Source: the user's message of 26 Nov. Lives in: requirements/show-and-music.md › The presenters' actions.

### D204 · The automatic voices' rules · 2026-11-26 · Active
U172 as proposed, with the user's correction to the first rule: "the mic is not conected to the computer, it goes directly to the mixing table, so we cannot know when they speak. what we should do is simply only play when it is unlikely they are speaking. and sentences are short, so if they have to stop for a second is fine altough not ideal". So:
- automatic voices play only when the presenters are unlikely to be talking: at the doors, in the Descans, and on a presenter's own press, before they speak;
- a chime comes first, and the music dips under the voice;
- each is one or two sentences;
- the tablet has a "Veus" slider, a switch to turn the automatic voices off for the night, and a way to skip one while it plays;
- the doors' countdown follows the plan's start time.
By: the user. Source: open-questions.md › Answered (U172). Lives in: requirements/show-and-music.md › Music for each moment.

### D205 · Design-system props describe what they produce · 2026-11-27 · Active
A component's props name the visual result (a colour, a size), not a domain concept. Today the cyan button is `tone='talk'`; it becomes a colour. Consistency between concepts and looks comes from another layer, such as a registry or preset wrappers. Frontend researches how design systems shape props and redoes them.
By: the user (to Frontend). Source: Frontend's report of 27 Nov. Lives in: packages/ui (Frontend's design-system spec).

### D206 · Interface sounds like Josh Comeau's button sounds · 2026-11-27 · Active; the details Pending (Frontend's spec)
The user wants small UI sounds on presses, in the style of Josh Comeau's `button-sounds`. Frontend specs them first and sends the open choices. Today only the phones have interface sounds, on by default (screens.md › Player app).
By: the user (to Frontend). Source: Frontend's report of 27 Nov. Lives in: requirements/screens.md (once specified).

### D207 · The interface sounds' settled parts · 2026-11-27 · Active
From Frontend's spec for D206 (temp/design-canvas/ds/ui-sounds.md), the parts that need no new choice:
- **The phones** keep their synthesised game sounds. Recorded clicks replace only the "tap blip". They stay on by default, Admin sets the default for everyone, and a player's own choice wins (screens.md › Player app).
- **The show laptop is always silent,** since its output is the PA.
- **Our own small Web Audio player** plays them, not the `button-sounds` package with howler: the package loads from a CDN at version 0.0.0 by default, uses howler's private internals, and names files inconsistently. The sounds are MIT, and the notice stays next to our trimmed copies. About 350–400 KB for the phone, served by the relay and the cloud.
- **Their level** starts at a gain of 0.3 on normalised samples, tuned by ear at the rehearsal (U13).
The rest is U182–U186.
By: the orchestrator, applying screens.md and D206 to Frontend's spec. Source: Frontend's report of 27 Nov. Lives in: packages/ui ANIMATIONS.md (once applied); requirements/screens.md › Player app.

### D208 · The interface sounds' choices · 2026-11-27 · Active
The user's answers to U182–U186:
- **The tablet:** on by default, with a switch in the settings. That's against ANIMATIONS.md's principle 4 (the tablet is near the presenters' microphones), so the sound check confirms the mics don't pick the clicks up.
- **Admin:** no sounds.
- **The phones:** one «Sons» switch for the touch sounds and the game sounds.
- **A tap on something that can't be used:** a dull thud, with a small "no" motion.
- **The sounds:** "you can pick for me, if i dont like i will ask changing. i like wobly and bouncy sounds for the app". Frontend picks them from Josh Comeau's set, leaning wobbly and bouncy for the player app.
By: the user. Source: open-questions.md › Answered (U182–U186). Amends: ANIMATIONS.md principle 4 (the tablet's silence). Lives in: requirements/screens.md › Console, Player app, Admin.

### D209 · The modern-web audit's technical calls · 2026-11-27 · Active
Frontend's calls from the audit (scratchpad/mwg/audit.md). The orchestrator had no objection:
- **Reduced motion:** the colour and opacity fades that carry meaning stay (the connection chip, the switch track, the backdrops). The looping animations move behind `prefers-reduced-motion: no-preference`, instead of every duration dropping to zero. ANIMATIONS.md's fallbacks are updated first.
- **The finale button's growing row** (D167) stays a documented exception to "never animate layout".
- **Not done for now:**
  - view transitions, which would freeze the ring's animation;
  - `oklab` colour mixing, with no visible gain;
  - `closedby="any"`, which Safari lacks;
  - dropping the page scroll lock, since iPhones would scroll behind a drawer.
- **Waiting on U187:** `@starting-style` exits and container queries.
- **Later, with design:** the phone's Celebration as a real `<dialog>`, since it affects the open pad (D90).
By: Frontend, noted by the orchestrator. Source: Frontend's report of 27 Nov. Lives in: packages/ui ANIMATIONS.md.

### D210 · The design system's props, as Frontend's v2 · 2026-11-27 · Active
The user accepted all four recommendations of the props rework (temp/design-canvas/ds/components-v2.md):
1. **The palette is named by colour:** `ice` → `cyan`, `lilac` → `purple`, and the new `pink`, `navy`, `grey` and `periwinkle`, so the prop, the token and the spoken word match.
2. **A concept's whole look lives in one plain-data registry:** colour, icon, label, note, sound and Wii key. Shared concepts go in `packages/ui/concepts.ts`, and each app's controls in `apps/<app>/actions.ts`. There are no wrapper components per concept.
3. **Each kind of control has a default UI sound,** which a preset can override or silence. Admin silences them all (D208).
4. **The concept colour tokens** (`--action-talk`, `--color-calm`…) are deleted, so the registry is the only place that says the Hold is cyan.
Generic components take only what they draw (`color`, `variant`, `size`, `floating`, `ring`, the slots, `sound`), never a game concept. One `ring` prop means two rings can't stack.
By: the user. Source: open-questions.md › Answered (U190). Amends: D205. Lives in: packages/ui (Frontend).

### D211 · The design system is approved, and goes into code now · 2026-11-27 · Active
The user finished commenting on the canvas's Design system page and part of the Player app page. They said the design system "is correct" and told Frontend to put the components and the design system into code now. That lifts D210's step 3, where the code waited until they'd seen the regenerated boards. U175 is answered through those comments. Frontend applies them in creation order and reports any of U175's items they changed. The user comments on the screen pages today and tomorrow, and comments that arrive later wait for their next "read the comments". To Frontend: "Work autonomously and use agents."
By: the user (to Frontend). Source: Frontend's report of 27 Nov. Amends: D210 (the order). Lives in: packages/ui (Frontend).

### D212 · The player app on desktops and tablets · 2026-11-27 · Active
The player app must look decent on a desktop or a tablet. It's not a responsive redesign, just a maximum width, so the screen doesn't stretch.
By: the user (to Frontend). Source: Frontend's report of 27 Nov. Lives in: requirements/screens.md › Player app.

### D213 · U175's items the canvas comments changed · 2026-11-27 · Active
From the user's comments on the Design system page (read by Frontend, 27 Nov). Everything else in U175 stands as recommended.
- **Item 5:** "recommended" and "suggested" are design resources, not a component. RecommendedMark is dropped, and components take `ring`, `ribbon` and `dashed` props. The dashed "suggested" look gets a dashed 3D edge too (it had a solid bottom).
- **Item 14:** use many more ninos from brand/ninos/figures (49), preferring the newer set. Never nino-sexe, and think twice about the drinking ones.
By: the user via canvas. Source: Frontend's report of 27 Nov (temp/design-canvas/ds/comments-27nov.md). Amends: D211 (U175). Lives in: packages/ui.

### D214 · Design-system details the user left to Frontend · 2026-11-27 · Active
The user said "take a decision" on these, and Frontend decided:
- FloatingButton becomes a `floating` prop on Button.
- No `hidden` prop: parents use `{#if}`, and the native attribute passes through.
- Inputs have no `state` prop; they derive their look from value, validity and disabled. IconPicker options are generic `{icon, disabled, tag}`, so "owned" is the player app's preset.
- Chip: a `color`, plus a separate `glow` prop.
- Text inside an input is never highlighted; match highlighting is only for result rows.
- Tabs: when narrow, inactive tabs collapse to icons, and the active one shows its icon, label and extra control (the user's own pick of two options).
- A compact `xs` size for small buttons.
- Alternatives on the remote are joined by «/» (shake ×3 / B+A).
- SoundPad becomes a grid component.
- The Slider gets −/+ buttons (1 % steps), full keyboard control, and «80%» with no space.
- Sheet and Dialog are native `<dialog>`, with a native-feeling drag.
- The ticket's side holes are drawn with a CSS mask.
By: Frontend, delegated by the user. Source: Frontend's report of 27 Nov. Lives in: packages/ui.

### D215 · Project-wide UI rules · 2026-11-27 · Active
Stated by the user on the canvas, for every app, Admin included:
- **Focus:** never `:focus`, only `:focus-visible`. A test fails on a bare `:focus`.
- **Text wrap:** headings use `balance` and body text `pretty`. This answers U189 with (a).
- **Presses:** every interactive element gets a satisfying press, with travel, sound and haptics. Haptics is `navigator.vibrate` on Android phones; iPhones and iPads have no Vibration API, so they get sound and motion. Admin's presses are silent (D208). This is separate from the remote's vibrations (U177).
- **"On":** a temporary active state is always animated panning stripes and never on by default. A locked state is never striped.
- **Corners:** a control in a corner sits at equal distance from both edges. The user had to repeat it "a thousand times".
- **Rings:** one even gap all round, the 3D edge included.
By: the user via canvas. Source: Frontend's report of 27 Nov. Lives in: docs/team.md; requirements/screens.md › Every screen.

### D216 · The sponsors, redone · 2026-11-27 · Active
- **Projector:** much bigger logos, in a strip that pans slowly so every sponsor shows, starting at a random point so it isn't always the same ones first. It replaces the page of 8 at a time.
- **Phone:** big logos in a scrolling list; a tap opens a logo larger in a dialog.
- **The QR panel:** pure white, with more padding.
UI only; the sponsor data doesn't change.
By: the user via canvas. Source: Frontend's report of 27 Nov. Lives in: requirements/screens.md › Every sponsor appears, Projector, Player app.

### D217 · The special card stays one-sided, from pool 1, for now · 2026-11-27 · Superseded by D226
What the team agreed so far: the special card has one side, with pool 1's songs, and both special rounds play it. The user likes U167's two-sided card (the Desgraciat on pool 1, the Especial on pool 2) and will ask the team (U192). Until then the agreement is built. Answers U167 for now with (a).
By: the user and the team. Source: open-questions.md › Answered (U167). Lives in: requirements/songs-and-cards.md; requirements/game-rules.md; event.md › The songs.

### D218 · Build the phone's home as the canvas draws it · 2026-11-27 · Active
The corner buttons and the floating «+ Cartró», built now. The user's caution: "some pages in the artifact dont use the latest components from the design system". So the build follows the design system's components, and a board's outdated parts don't win. Answers U180 with (a).
By: the user. Source: open-questions.md › Answered (U180). Lives in: requirements/screens.md › Player app.

### D219 · The latest browsers only · 2026-11-27 · Active
"dont care for backwards compatibility in tablet nor admin, i use latest. and for the player app they most likely have chrome latest and ios latest, so compatibility is not a concern". The screens target the latest Chrome and Safari, with no fallbacks for older versions: container queries, `@starting-style` and the like can be used freely. The game works fully with paper, so a phone that can't update loses only the companion. Answers U187, beyond its options.
By: the user. Source: open-questions.md › Answered (U187). Supersedes: the 15.4 floor in packages/ui/HANDOFF.md. Lives in: requirements/screens.md › Every screen.

### D220 · The player app after the user's Android test · 2026-11-27 · Active
The user tried the production player on their Android phone and asked for:
- **It feels like an app:**
  - no blue tap highlight and no pull-to-refresh. `overscroll-behavior: none` is on every app, so the console can't reload from a stray swipe mid-show either;
  - no text selection outside the text fields;
  - the offline and your-song layers sized to the large viewport, so no bright strip shows while Android's URL bar hides;
  - typing with the phone's keyboard plays the keypad's sounds.
- **Drawers:**
  - one can be dragged closed from any point once its content is at the top, not only by the handle;
  - the glitch when a second drawer closes over Ajustos is fixed;
  - the QR scanner opens as its own stacked drawer.
- **Pressed buttons:** the 3D edge shrinks as the face sinks.
- **Editing a card:** the title is just «Editar», the number is the usual field with the QR button, and «Desar» is green.
- **«+ Cartró» floats** (D218), with less contrast, in a colour closer to the background.
- **The drum:** while idle it can be tugged sideways. It's very stiff and springs back on release, with no interaction while it spins.
- **The history's covers** get radii concentric with their card.
- **The home:**
  - Historial and Cartrons also switch by a horizontal swipe, one axis at a time; the indicator follows the swipe, each tab keeps its scroll, and the switch is always animated;
  - the drum morphs between tabs only when its look differs;
  - scrolling down collapses the drum into the compact look, stuck to the top on both tabs, while the tab switch doesn't stick;
  - Historial's rows shrink and fade very slightly at the bottom edge, where the corner buttons are.
By: the user (to Frontend). Source: Frontend's report of 27 Nov; the quick ones in cca19f4. Lives in: requirements/screens.md › Player app.

### D221 · The player app is an installable PWA · 2026-11-27 · Active; the button's place Pending (U193)
- **The home:** where the cards list shows the add-card button when a player has no cards, an install button can show instead. It appears only when the browser can install the app and the add-card button isn't showing there (U193 confirms the reading).
- **Ajustos** also offers the install, or says the app is already installed.
- **iPhones:** no install button on the home, only the one in Ajustos, which opens a drawer explaining how to install it. "If iOS has a way to trigger the install on one click, we can show the button, but I think apple hasn't done that yet" (research, 27 Nov).
By: the user. Source: the user's message of 27 Nov. Lives in: requirements/screens.md › Player app.

### D222 · The service worker is network-first and updates aggressively · 2026-11-27 · Active
"If you make a service worker make sure that it always uses network first and has a very aggressive auto update policy. I don't want issues of users having a old version." Last year's app was a PWA whose worker kept serving an old cached app at the same address; this year's app already removes it (apps/player/logic/cleanup.ts), and must recognise the new worker as its own. The cache is only the offline fallback: offline, the app keeps its normal screens, marked as offline.
By: the user. Source: the user's message of 27 Nov. Lives in: requirements/screens.md › Player app.

### D223 · The app icons from the afro nino · 2026-11-27 · Active
A maskable app icon and a monochrome badge icon (for Android's notifications in the status bar), from brand/ninos/figures/nino-afro.svg: only his head and hand, simple and funny. Frontend makes them.
By: the user. Source: the user's message of 27 Nov. Lives in: requirements/screens.md › Player app.

### D224 · The QR opens the right platform flow directly · 2026-11-27 · Active; how Pending (research)
The printed QR must take each player straight into the right flow for their phone, grandma-proof. The QR's URL is fixed when the cards are printed on 4–5 Dec (`/26/<number>`), so the routing works with it as it is. Research on 27 Nov covers iPhones (a one-tap install, an App Clip) and Android (a TWA on Play, the install prompt), and separately whether push notifications are worth it.
By: the user. Source: the user's message of 27 Nov. Lives in: requirements/screens.md › Player app; docs/research/reports/ (ios-install-and-app-clip.md, android-twa-and-install.md, push-notifications.md).

### D225 · The phone's reload and home details · 2026-11-27 · Active
The user to Frontend:
- **A reload must not flash the welcome screen** (built in 8912640):
  - the tab keeps its last public state in sessionStorage, for 5 minutes at most, and a reload opens on it;
  - with no state yet, the phone shows an empty sky;
  - the first paint has no fades, so the offline overlay shows from the load instead of fading in;
  - a phone that opened with no feed at all says «Sense connexió» after 20 s.
- **«En aquesta quina només juga el …» is irrelevant,** and is removed from the home: the drum panel and the cards list.
- **A card with no name** shows only its number, never a predefined or generated name.
- **A seated card's tilt** must not cover the «No juguen en aquesta quina» label or throw it off centre. Rotations never hurt the layout.
By: the user (to Frontend). Source: Frontend's report of 27 Nov. Lives in: requirements/screens.md › Player app.

### D226 · The special card has two sides: the Desgraciat on pool 1, the Especial on pool 2 · 2026-11-27 · Active
Confirmed with the team. The special card is printed on both sides, like the normal one. Side 1 has pool 1's songs and plays the Desgraciat, and side 2 has pool 2's songs and plays the Especial. "so the pool change happens on the break": Quines 1–5 and the Desgraciat play pool 1, the Descans comes, then Quines 6–10 and the Especial play pool 2. Six rounds per pool, which was D171's reason. One special card still plays both special rounds (D81). The Descans's "turn the card over" line (D202) now covers both cards. Answers U192 and U59, and supersedes D217.
By: the user and the team. Source: the user's message of 27 Nov. Supersedes: D217. Lives in: requirements/game-rules.md › The night's rounds; requirements/songs-and-cards.md; event.md › The songs.

### D227 · A temporary 2026 night in production, for a full manual test today · 2026-11-27 · Active; the edition file's details Pending (U68–U75)
Pool 2's playlist has 64 of its 70 songs. "we can already download them and generate a temporary set of cards, to put into production something similar to the actual quina for this year. and build the settigns json. when i have the full playlist we generate again and update. it is because i would like to do a manual test of all the pieces later today". So:
- **Pool 2:** download its 64 songs now, numbered and sorted by U57's and U58's defaults. They're regenerated when the playlist is final.
- **Temporary cards:** from both pools, with the normal card's two sides (D193) and the special card's two sides (D226).
- **Production:** the cloud gets a plan like this year's night (D192), the cards and the songs, so the user can test every piece by hand.
- **The edition file (D116):** built now. Its open details are U68–U75.
- **Hooks** (the orchestrator's reading, so the test can play at all): songs play with automatic hooks marked provisional, until the user's approval pass (U14).
Also asked: a short "how to run it" section in the README for humans, an SVG diagram of the setup showing what runs on each screen and device, and a short explanation of how Admin manages production (resetting a game, starting, sending messages).
By: the user. Source: the user's message of 27 Nov. Lives in: event.md › The songs; requirements/operations.md (once built).

### D228 · In the Descans, the presenters pick the break set or the Pausa set · 2026-11-27 · Active
"in descans i would like to be able to pick if i want the descans pool or the pause pool". The console offers the choice during the Descans, and the engine plays the chosen set.
By: the user. Source: the user's message of 27 Nov. Lives in: requirements/screens.md › Console; requirements/show-and-music.md › Music for each moment.

### D229 · A sound test for setting up the PA · 2026-11-27 · Active; the design Pending (Sound engine, Frontend)
"I need a functionality somewhere that i can do a sound test to adjust all volumes and make sure everything sounds right on the day of the event. i would do it whens eting up the sound system." A console mode plays each kind of sound in turn at its slider's level: songs, songs in Parlem, the effects, the drum's ticks, the Check's sounds, Hold, the win, the fail, the stinger, intros, breaks, Pausa, the throw and the storm, the doors, the end and the voices.
By: the user. Source: the user's message of 27 Nov. Lives in: requirements/screens.md › Console; requirements/operations.md › Rehearsals.

### D230 · Both playlists are final and sorted · 2026-11-27 · Active; the check Pending (Sound engine)
"Now the playlists are final, and sorted." The organizers edited pool 1 too. Sound engine re-fetches both, checks 70 songs each, the order (U58) and any repeats between them, and numbers pool 1 1–70 and pool 2 71–140 (U57). This is earlier than the planned 1 Dec.
By: the user. Source: the user's message of 27 Nov. Lives in: timeline.md; event.md › The songs.

### D231 · A sticker circle and a name space on the cards · 2026-11-27 · Active; the word and the sides Pending (U200, U201)
"on the printed cards, we can leave a ~19mm dotted circle with the word "GUMET" inside. and i buy colored shape stickers to put in it with the same colors we support. and on the tables we leave sticker sheets spread arround. we can also leave some markers and leave a space if they want to put the name as well." The sticker matches the card's mark on the phone (D5), so a player can tell which paper card is which in the app.
By: the user. Source: the user's message of 27 Nov. Lives in: event.md › The cards; requirements/songs-and-cards.md › The card.

### D232 · No permanent marks; a spoilt card is exchanged between rounds · 2026-11-27 · Active
"We have to make sure we make it clear to the people that they can't mark the songs permanently (with stickers or markers), or they woant be able to reuse the card for the following rounds." Kids are with adults, so it shouldn't happen much. A spoilt card can be exchanged for a new one if any are left, only between rounds, to keep it fair. The new card's number joins the cards in play (the console's in-game admin, D234).
By: the user. Source: the user's message of 27 Nov. Lives in: event.md › The cards; requirements/game-rules.md › Cards in play.

### D233 · Song covers on the cards, printed in colour · 2026-11-27 · Active; the design Pending (the card design session)
"to help players find the song faster we can add the song cover. but that would mean printing in colour, and therefore we should update the rest of the elements to take advantage of that. To make the cards, i want to first do the design with an agent/session." The user opened a fresh session for this task only (quina-musical-d1). The card design comes before the cards are made on 4–5 Dec.
By: the user. Source: the user's message of 27 Nov. Lives in: requirements/songs-and-cards.md › The card.

### D234 · The console does the night's admin, and every console stays in sync · 2026-11-27 · Active; the list Pending (U202, U203)
- **In-game admin:** "in the presenter i should be able to add the cards in game and other admin things that will likely be needed during the game." Adding sold cards to the cards in play comes first. The rest of the list is U202.
- **The tech's console:** "i forsee that maybe me (tech) also keep the presenter screen in the laptop in case the presenters want my help, so the info should be synced in realtime (the entire state." What "the entire state" covers is U203.
- **Holds lock the other consoles:** "the hold gestures may be problematic, but we have a button lock state that it can be locked while someone is holding a button." While one console holds a two-level button, the others show it locked.
By: the user. Source: the user's message of 27 Nov. Lives in: requirements/screens.md › Console.

### D235 · The realistic run · 2026-11-27 · Active; the schedule's time Pending (U204)
D227 grows: "Please prepare everythign so i can run a more realistic run (actual schedule, songs, prizes...)".
- **Prizes:** from the organizers' Col·laboradors sheet (the newest found, temp/wip prizes, 25 Nov). The orchestrator made example bundles from it for the 12 rounds, in temp/wip prizes/2026-example-bundles.json:
  - 58 sponsors, 47 of them with prizes;
  - money donors are thanked, with no prize and no amounts (D112);
  - the headline items with no sponsor are the organizers' own purchases.
- **Logos:** from temp/Logos 2 (the organizers' Google Drive folder). "dont worry about editing logos, i will do it later, just make sure it at least shows something."
- **Songs:** the final playlists (D230).
- **The schedule:** D192's order with the 10-minute Descans.
By: the user. Source: the user's message of 27 Nov. Amends: D227. Lives in: the cloud's plan; the edition file (D116).

### D236 · Every change lands in code, the mockups and the design system · 2026-11-27 · Active
A standing rule from the user (to Frontend): every change lands in the code, the mockups and the design system together. Nothing from earlier reviews may be lost.
By: the user (to Frontend). Source: Frontend's report of 27 Nov. Lives in: docs/team.md.

### D237 · From the user's production test (to Frontend) · 2026-11-27 · Active
The list is in temp/design-canvas/ds/comments-27nov.md §8. The main points:
- **The phone's drum matches the projector's:** the same cover order, the same landing, the same effects, blur included. Sound engine says what the phones need.
- **Automatic sounds:** the phone's drum stops clicking while it spins. The console switches each automatic sound (the drum's click and others) on or off; Sound engine defines the commands and state.
- **Wake lock** on the player, the console and the projector.
- **The your-song state:** particles from the card marks, yellow gradients, the theme colour, legible tabs and collapsed drum, and a vibration when your song lands.
- **Cards:** the playing song marked very clearly; the "last song for a line" marking removed.
- **The home:**
  - a sticky garland and lower corner buttons;
  - no «?» while the drum spins, and no layout shift;
  - a tap on the drum scrolls to the card, and arrows point to off-screen cards.
- **Drawers and forms:** the QR-close bug fixed; drag-to-close stays stiff on forms; the "add another card" flow researched and redone; toasts restyled; reordering fixed.
- **A collapsed view of the cards:** boards only, no code.
By: the user (to Frontend). Source: Frontend's report of 27 Nov. Lives in: requirements/screens.md; packages/ui.

### D238 · Song ids follow the playlists' letter-by-letter order · 2026-11-27 · Active
The user sorts the playlists with an online tool, and asked to "check the order is right and use that for the ids". That tool sorts letter by letter, ignoring spaces and punctuation, and both final playlists are exactly in its order (Sound engine, 27 Nov). So the ids follow the playlists as they are, and U58's convention is letter by letter, not the word-by-word default. Pool 1 is 1–70 and pool 2 starts at 71.
By: the orchestrator, applying the user's instruction of 25 Nov. Source: Sound engine's report of 27 Nov. Amends: D103. Lives in: requirements/songs-and-cards.md › The pool.

### D239 · A song the presenters let play loops; it never hands over by itself · 2026-11-27 · Active; Parlem Pending (U205)
"When the presenter lets a song play it should always loop and not switch to pause music." The user's test ran a 25 Nov build, but Sound engine found the rule broken in today's code in two places, now being fixed:
- Aguanta on a song with no 4- or 8-bar phrase in reach;
- manual advance with no Hold, at the song's end.
In both, the song loops its last phrase, or its last 4 bars when it has no phrase, until a presenter moves on. Parlem's 40 s switch to Hold music is U205. The other two things the user heard were the old build: Pausa as agreed (D128, D135) and Pausa playing the throw song or the intro.
By: the user. Source: the user's message of 27 Nov; Sound engine's check of 27 Nov. Lives in: requirements/show-and-music.md › The presenters' actions.

### D240 · Sessions delegate the work to subagents · 2026-11-27 · Active
The user (to Backend), for every future session: "i want you to make more subagents and do less work. for futire sessions". Subagents do the work: features with their tests, docs, investigations, sweeps and long verify runs. The session plans and briefs, reviews each result before committing, commits, pushes and deploys, and talks to peers and the user. Subagents never push, deploy or message peers. Effort follows the existing rule. A limit the user sets on parallel agents (Frontend's two, 27 Nov) wins.
By: the user (to Backend). Source: Backend's report of 27 Nov. Lives in: docs/team.md; the shared memory (feedback-delegate-to-subagents).

### D241 · "Add another card" becomes a step inside the drawer · 2026-11-27 · Active
The user asked for the "add another card" flow to be researched and redone (D237). Frontend followed government "add another" patterns: after «Desar», the drawer shows the card's mark with a ✓, «Cartró #N afegit!», the phone's cards, and «Vols afegir un altre cartró?» with «+ Un altre» (a fresh form) and «Fet» (closes, and rings the new card on the home), with a quiet cue and haptics. It replaces D200's banner over the cards list, so U174 is moot. Built in 3e3cb154, with the drawers' and forms' other fixes.
By: Frontend, as the user asked (D237). Source: Frontend's report of 27 Nov. Supersedes: D200. Lives in: requirements/screens.md › Player app.

### D242 · No prize panel in a Line's Celebration, for now · 2026-11-27 · Active; the design Pending (Frontend's proposals)
On the canvas: the projector's and the phones' Line Celebration lose their prize panel («Premis de línia · Entrada al spa…»). Frontend draws proposals for how a Celebration shows its prize, for the user to pick.
By: the user via canvas. Source: Frontend's report of 27 Nov. Lives in: requirements/screens.md › Projector, Player app.

### D243 · The "Before the Game" screen names each card's rounds · 2026-11-27 · Active
The normal card plays Quines 1–10, and the special card plays the Desgraciat and the Especial. The prices shown were out of date. They're D69's, from card-types.json: 1.50 € a regular round still to play, so 15 € before Quina 1 (the Desgraciat doesn't count), and 5 € for the special card before each special round (D81).
By: the user via canvas. Source: Frontend's report of 27 Nov. Lives in: requirements/screens.md › Projector.

### D244 · The player's prizes drawer · 2026-11-27 · Active
The round selector from board P1 and the content from P2. A locked round shows «Premis sorpresa» with its sponsors under it. The sponsor cards are bigger, and the drawer scrolls. Answers U30. How prizes really work (U36–U39) is still open.
By: the user via canvas. Source: Frontend's report of 27 Nov. Lives in: requirements/screens.md › Player app.

### D245 · The Llançament and Tempesta icons · 2026-11-27 · Active
Llançament option A and Tempesta option A, redrawn from scratch in the design system's outline style. Answers U170 once drawn.
By: the user via canvas. Source: Frontend's report of 27 Nov. Lives in: packages/ui icons.

### D246 · Last year's files in R2 are deleted; nothing else expires · 2026-11-27 · Active
"delete the old stuff now and leave the new files without expiring". An R2 lifecycle rule (`pools-before-d178`) expires `pools/` after one day: about 1,711 objects and 7.6 GB, last year's songs and the first copy of the Hold and Interval music. `repertoires/2026/` is untouched. Backend removes the rule once `pools/` is gone (28–29 Nov), so nothing else ever expires. It supersedes D113's "pruned after the night" for 2026's files.
By: the user (to Backend). Source: Backend's report of 27 Nov. Amends: D113. Lives in: apps/cloud/docs/deploy-plan.md (step 6.5).

### D247 · Last year's R2 copy is deleted today · 2026-11-27 · Active
"can't you simply delete everything that is not needed now?", and "i would like to not have to wait until tomorrow". Backend deletes the old `pools/default/` keys from their own manifest (1,906 files, 7.74 GB) instead of waiting for D246's one-day rule. The rule goes once `pools/` is shown empty.
By: the user (to Backend). Source: Backend's report of 27 Nov. Amends: D246.

### D248 · R2 stores each file once, by its content · 2026-11-27 · Active
"i dont think it is a good idea to use pool folders because we have songs shared, so we should only store the files and know wat each is in our code", and "build it now, and you can make that my laptop has the same filenames anf folder structure so it is easier to work with".
- R2 keeps each file once under its SHA-256, immutable.
- Each repertoire has a private manifest mapping its readable paths to `{size, sha256}`. The shared Hold, Interval, voice, fx and stinger music is stored once for every repertoire.
- A push uploads only the missing fingerprints, and a pull rebuilds the laptop's readable folders, checking every hash.
- Prune deletes only the fingerprints no manifest names, after a dry run. Nothing expires by date (D246).
- One deploy, with no second version kept beside it. 2026 is re-pushed, and its old copy is deleted after a test pull passes.

**The laptop's side:** the user left it to Backend ("whatever is best long term"). The laptops keep today's readable folders, so Sound engine's layout and the relay's paths don't change. Only R2 stores by fingerprint, and a pull rebuilds the readable folders, as git does with its store and working tree. Last year's `pools/` is fully gone (D247, 27 Nov), and the one-day rule is removed.
By: the user (to Backend). Source: Backend's report of 27 Nov. Lives in: apps/cloud/docs (Backend); requirements/operations.md › Storage.

### D249 · After a Back or a cancelled Spin, the drum returns the card to its place · 2026-11-27 · Active
So the phone's drum stays the same as the projector's (D237), the projector returns the card to its drumOrder place instead of wherever its drum stops:
- a Back turns the shortest way onto the card's place, at most half a lap and about 1.6 s. It's usually the neighbouring card, as today;
- a cancelled Spin brakes naturally, as today, then glides onto the card's place with the Back's timing, 0.8 s for one card up to 1.6 s for half a lap. Sound engine's change from "at most about 1 s": that cap made a half-lap glide whip round at about 54 cards a second, faster than a Spin. Now it peaks at about 34, like a Back.
There are no speed-ups and no long brakes. Built in 7ec0b6af and 39a39f01. The motion is specced in ANIMATIONS.md before it's built, and the phone follows it. Sound engine held a subagent's working fix that changed the motion more (nearly a full lap back, brakes up to 4 s, some speed-ups) until it was specced.
By: the orchestrator, within D237. Source: Sound engine's report of 27 Nov. Lives in: packages/ui ANIMATIONS.md; apps/show/engine/src/wheel/drum.ts.

### D250 · The printed cards: last year's style, with covers · 2026-11-27 · Active; the special card's labels Pending (the user)
The user's decisions with the card design session (canvas https://claude.ai/code/artifact/8af06588-238f-4095-8d67-a594d91c7392):
1. **Last year's style:** "It is a printed document, not a website!!!! dont use the web components. i want the same style as last year". The card is last year's (apps/cards/dist/cards-normal.pdf) plus the covers. The app-style colour panels are rejected.
2. **No event name:** "the event name is unnecessary, remove it, and put "1a part" and "Quines 1-5". and the other side part 2 and 6-10." This replaces D67's printed title. D85's edition marker is now the faint «2026» stamp and the new look. For the special card, the design session asked about «1a PART · QUINA DESGRACIADA» and «2a PART · QUINA ESPECIAL»; not yet decided.
3. **The corn-seeds line is very short, with no corn icon:** "make it very short, just a few words. and remove the corn icon". Drawn as «MARCA NOMÉS AMB BLAT DE MORO».
4. **No name field:** "Remove the name field". The sticker circle stays.
5. **A faded «#» before the card number:** "in front of the cartro number add a faded #".
Still open: U200, U201, U52 (the paper), U198, and whether the design is final by 1 Dec (Frontend estimates 2 days of building plus a proof round).
By: the user (to the card design session). Source: quina-musical-d1's report of 27 Nov. Amends: D67, D231, D233. Lives in: requirements/songs-and-cards.md › The card.

### D251 · The round is "Quina del Desgraciat" · 2026-11-27 · Active
"\"Quina Desgraciada\" is not the name. i want \"Quina del Desgraciat\", or simply desgraciat in some places." Every screen, label and voice line that says «Desgraciada» changes: the round's name, the side label in card-types.json, and the Desgraciat's round voice.
By: the user (to the card design session). Source: quina-musical-d1's report of 27 Nov. Lives in: requirements/screens.md › Every screen; requirements/game-rules.md › The night's rounds.

### D252 · The special card has no parts: «DESGRACIAT» and «ESPECIAL» · 2026-11-27 · Active
"on the special cards there are no parts. it is Quina del desgraciat, and quina especial", then "skip the quina word", since it may not fit. So side 1 says «DESGRACIAT» and side 2 «ESPECIAL». It replaces the design session's reading «1a PART · …» in D250.
By: the user (to the card design session). Source: quina-musical-d1's report of 27 Nov. Amends: D250. Lives in: requirements/songs-and-cards.md › The card.

### D253 · «GOMET», in a circle of about 15 mm · 2026-11-27 · Active
U200 answered (a): «GOMET». The circle is "less than 20mm, 15mm for example", with the word centred in it (D231 said about 19 mm).
By: the user (to the card design session). Source: quina-musical-d1's report of 27 Nov. Amends: D231. Lives in: requirements/songs-and-cards.md › The card.

### D254 · The cards' titles and branding · 2026-11-27 · Active
The user's picks from the card design session's tests (Proposal 5 on its canvas):
1. **Titles:** "i want the proposal 4 titles, quina 1-5 and withour quina on the especials". The normal card says «QUINES 1–5» on side 1 and «QUINES 6–10» on side 2, white on black. The special card says «DESGRACIAT» and «ESPECIAL» (D252).
2. **Branding:** "i want the option with event name in the brandign, but just put "QUINA QUINA!" without the 3. and in barrakudes put . 2026 after it". Beside the logo, «QUINA QUINA!», with «BARRAKUDES · 2026» under it, replacing «BARRAKUDES / JOVES • BEGUR».
3. **The stamp:** "we can remove the 2026 from the bg stamp". The faint background stamp keeps only the logo, and the year lives in the branding line.
4. **Centring:** "the title should be centered to the page", on the card's width, not in the space between the side blocks.
Answers U209. Amends D67 (no «3» in the printed name) and D250 (the event name is back, in the branding).
By: the user (to the card design session). Source: quina-musical-d1's report of 27 Nov. Lives in: requirements/songs-and-cards.md › The card.

### D255 · No corn-seeds line on the cards · 2026-11-27 · Active
"remove the disclaimer at the bottom". The cards no longer say «MARCA NOMÉS AMB BLAT DE MORO». D232's message, that songs are marked only with corn seeds so the card serves every round, is now said by the presenters at the welcome and by the table setup. Drawn as Proposal 6. The design session also made a page of the four sides (normal 1 and 2, special 1 and 2), captioned in Catalan, for the user to show the other organizers.
By: the user (to the card design session). Source: quina-musical-d1's report of 27 Nov. Amends: D232, D250. Lives in: event.md › The night, step by step; requirements/songs-and-cards.md › The card.

### D256 · Six cards on an A3 sheet, portrait · 2026-11-27 · Active; the normal amount Pending (U211)
"I want vertical a3. decided." The card layout is A3 portrait with 6 cards a sheet: 2 columns by 3 rows, each card about 149 × 140 mm, printed duplex on the long edge. Each back row is mirrored so the back lines up with the front, and a light-table overlay on the card design canvas shows the grids coinciding. Amounts now fill whole sheets, a multiple of 6: the special card's 300 fits, and the normal card's 399 becomes 402 or 396 (U211). The generator's 3-a-page assumption becomes 6 a page (Frontend, apps/cards). Answers U210.
By: the user (to the card design session). Source: quina-musical-d1's report of 27 Nov. Amends: D68 (the amounts), songs-and-cards' three cards a page. Lives in: requirements/songs-and-cards.md › The card, Numbers and amounts.

### D257 · The A3 card's header, in one line · 2026-11-27 · Active; the year stamp Pending (the card design session)
"make the a3 2x3 vertical also the same edits in the header. but on the right of the gomet put the nino from branding." The header is one line: the GOMET circle on the left, the Barrakudes figure from the branding beside it, the heading centred on the card (about 28 pt), then «CARTRÓ #n» and the QR. The covers sit above the songs' titles. «QUINA QUINA!» and «BARRAKUDES · 2026» leave the card. With the year also gone from the faint stamp (D254), nothing on the card names the edition any more, which was D85's way to spot last year's cards. The design session is asking whether «2026» goes back into the stamp, and whether this header is final.
By: the user (to the card design session). Source: quina-musical-d1's report of 27 Nov. Amends: D254. Lives in: requirements/songs-and-cards.md › The card.

### D258 · The card's QR and heading never shrink · 2026-11-27 · Active
Two rules for the printed cards:
- "qr code cannot be made smaller, it is already hard to scan. it is not negotiable": the QR is never smaller than last year's 45 pt (16 mm);
- "no, dont make the text smaller": the side's heading stays at 38 pt.
And "if doesnt fit remove the nino". So the header's balance is the user's pick: A puts the GOMET and the QR on the left and the figure and the number on the right, with the heading centred; B drops the figure and puts the heading between the GOMET and the number, about 1 cm left of centre.
By: the user (to the card design session). Source: quina-musical-d1's report of 27 Nov. Amends: D257 (its 28 pt). Lives in: requirements/songs-and-cards.md › The card.
