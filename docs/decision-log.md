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

### D62 · The Desgraciat's Celebration has no title · 2026-11-25 · Active
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

### D101 · Two pools of 70, one for each half of the regular rounds · 2026-11-25 · Amended by D105
The night has two playlists of 70 songs each, with different songs: Quines 1–5 play pool 1 and Quines 6–10 play pool 2. Pool 1 is final; the organizers are adding songs to pool 2 before filtering it to 70. Which pool the Quina Especial and the Desgraciat play isn't decided; assume a third one (U49).
By: the user. Source: the user's message of 25 Nov. Amends: D99; event.md's "every round plays a shuffle of the whole pool" (now: of its own pool). Lives in: requirements/songs-and-cards.md › The pool; requirements/game-rules.md › The night's rounds.

### D102 · The normal card is printed on both sides · 2026-11-25 · Active
Side 1 plays Quines 1–5 (pool 1) and side 2 plays Quines 6–10 (pool 2), with the same card number on both sides. Side 2 has its own design, and each side carries a new mark showing the rounds it's for; the user designs both with Frontend, so nobody changes the card's design before then. The presenters explain it in rounds 1 and 6 and keep reminding people during the round.
By: the user. Source: the user's message of 25 Nov. Lives in: requirements/songs-and-cards.md › The card; event.md › The cards.

### D103 · A final Part's song ids are alphabetical · 2026-11-25 · Active; Part 2's numbering Pending (U57)
Once a Part is final, the user sorts its Spotify playlist alphabetically by hand (with an online tool), and the song ids follow that order. Leading articles count: "The …" sorts under T, unlike Spotify's own sort, which ignores "The". Sound engine checks the order before using it, and reports any song out of place to the user rather than fixing the playlist. Until a Part is final, ids follow the Spotify track (D79).
By: the user. Source: the user's message of 25 Nov. Amends: D79. Lives in: requirements/songs-and-cards.md › Hooks.

### D104 · The Interval music comes from a new playlist · 2026-11-26 · Amended by D129
The Interval's music, which Pausa plays too, now comes from the Spotify playlist 0XTlZPUpt7xPoPxk4AUU3O, which has more songs. It replaces 0SsuXelEzN8gsS7WufySOg. The old files stay (D80).
By: the user. Source: the user's message of 26 Nov. Lives in: requirements/show-and-music.md › The Interval and the throw breaks.

### D105 · The special rounds play their own playlist · 2026-11-26 · Active; the special card's back Pending (U59)
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

### D144 · Suspens with A on the remote; the shake becomes optional · 2026-11-26 · Active; the landing and the default Pending (U120, U121)
While B is held (Aguanta), holding A too starts Suspens. It works if A goes down slightly before B, or at any time after B is held. Letting go of A alone, with B still held, cancels the Suspens: the build backs out and fades, and the song is back in Aguanta. The engine can cancel a Suspense already: Pausa does. A toggle in the settings and in the remote's mapping turns the shake gesture on or off, and each shake gives one vibration.
By: the user. Source: the user's message of 26 Nov. Lives in: requirements/show-and-music.md › The presenters' actions.

### D145 · With manual advance, holding B starts Suspens · 2026-11-26 · Active; the window's length Pending (U122)
With the advance manual, holding B starts a Suspens straight away. Three evenly spaced vibrations follow, and letting go of B before the third cancels it. After the third it can't be undone: a gentler vibration, oscillating or below full power, lasts as long as the Suspens, and letting go of B lands it. With the auto-advance on, B stays Aguanta. Answers U119 with (b).
By: the user. Source: open-questions.md › Answered (U119). Lives in: requirements/show-and-music.md › The presenters' actions.
