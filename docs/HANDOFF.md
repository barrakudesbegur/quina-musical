# Orchestrator handoff

Resume the orchestrator from this file after a clear. The durable state is in [status.md](status.md), [open-questions.md](open-questions.md), [decision-log.md](decision-log.md) (next free: **D157**, **U134**) and [timeline.md](timeline.md). This file holds only what's in flight.

## How the orchestrator works here

- **Commit from the worktree** (`.claude/worktrees/orchestrator-timeline`), docs only. `git fetch` and `git rebase origin/main`, then `git push origin <sha>:main`. The harness refuses compound git commands, so run each one on its own.
- **The user answers in chat or on the canvas.** Every decision gets a D-entry, the requirement changes, and the U moves to "Answered" the same day. Sessions report their user decisions to the orchestrator.
- **Rules learned on 25 Nov (also in memory):**
  - never invent dates: the only dates are the user's (1 Dec playlist, 4–5 Dec cards, 27 Dec night);
  - don't get ahead: no work on this year's songs before the playlist arrives;
  - a pick on a board is not a go to build: UI code stays frozen until the user says "implement";
  - UI starts from the model: a content spec, checked against event.md, comes before boards;
  - clock times for the user are in 12-hour format.

## In flight

- **The user is away (26 Nov, evening).** All three sessions were told to keep building what's decided (D132, D140–D145, D141), keep today's behaviour for every open question, list those in their handoffs, and report to me. On the user's return, give them one batched list of the open questions in the plain format, plus what was built. **First on that list: U127** (approve Backend's deploy of the plan-save fix, 2503050; the auto-mode check refused it, and no other session may deploy it instead), **U124 is done (Frontend's fd498ad, the console's labels),** the user's OK in Frontend's own session for the console's two labels, which blocks the push of Sound engine's and Backend's range. Frontend's session refuses the edit on a relayed answer, rightly.
- **Two pools and double-sided cards (D100–D102, 25 Nov).** Pool 1 (70, final) plays Quines 1–5 on side 1; pool 2 (being filled, then 70) plays Quines 6–10 on side 2; the special rounds play their own playlist, 79G8VcNrkih9GGjIzb47Gt, empty for now, with Part 1's songs until it's final (D105). Asked on 25 Nov:
  - Sound engine: re-fetch pool 1 and remake the temporary cards; an impact report on several pools (engine, protocol, Shuffle, cards.json with sides, disk, R2, hook time) before building; don't download pool 2 until the user says it's filtered;
  - Backend: the cloud's side (a round's pool, a card's sides on phones, the settings file) and R2 options past 10 GB;
  - Frontend: a content spec for the double-sided card for me to check, then boards with the user (D102); nothing before the user comes.

  Frontend's content spec for the double-sided card arrived and checks out (notes sent on 25 Nov). Backend's facts arrived: storage is U53, and its "one prepared pool of 210 with three lists" became the naming question U54. Sound engine's impact report arrived: one night pool with a playlist per song; card types list their sides; `RoundPlan.side`; about a day for the engine. Told on 25 Nov:
  - start: the expected end at 70 (done, 8e6f563); the protocol proposal to Frontend and Backend (agreed, below);
  - wait: the engine build (after Frontend and Backend agree and U54 is answered), round 6's pace (U51), preparing Part 1 (U55), storage (U53), the hook tools (U56).

  **The side/Part protocol is agreed** by all three sessions (25 Nov). It waits on U54 (`part` by default) and the user's go:
  - one night pool with `part` per song; card-types sides `{ side, part, label?, mark? }`; cards.json `{ id, type, sides: [{ side, lines }] }`, one shape only (D84); `side` on the plan, the commands, the journal and the resume point (`-C<n>`);
  - step A: Sound engine, protocol only, plus `sideWarnings`;
  - step B: Backend (journal-check, projection, preflight, then deploy), and Frontend after the UI freeze lifts; Frontend runs the cards.json conversion in one commit;
  - step C: Sound engine, the engine, after B is deployed.
- **Alphabetical ids (D103, 25 Nov):** the user sorted Part 1's playlist by hand. Done (Sound engine, edbdf3a): no song out of place, ids 1–70 follow the playlist, the temporary cards remade. Three spots depend on the convention (word by word or letter by letter): U58. Part 2 likewise when it's final; its numbering is U57.
- **The Interval music (D104, 26 Nov):** a new source playlist, 0XTlZPUpt7xPoPxk4AUU3O, with more songs. Done (628d385): 37 of 39 tracks prepared, none flagged; the old set is kept in `data/media/interval-old-0SsuXelEzN8gsS7WufySOg/`; the other two are left out (D106). Not uploaded to R2 until U53.
- **Playlist covers:** a session named quina-musical-df is making three Spotify covers (part 1, part 2, especial) with the user. The user wants a plain style, not the game's look: canvas "Portades Spotify", https://claude.ai/code/artifact/a14bdc4a-9b8a-4e63-aaf7-635262b35d62. The user's picks (26 Nov): the Barrakudes logo (the white round one), no Quines numbers on the covers, a big full-width "QUINA MUSICAL", a bigger "2026", and a big 1 / 2 / star. Still open there: who listens to the playlists and when. The Especial playlist exists (D105). Covers are outside the product, so they're not in the decision log.
- **The Check's redesign (D107–D110, 26 Nov).** The user answered Q1–Q5 in chat. The user doesn't want the grilling format; give plain questions and the original options. The presenters pace the Check (tap or A, hold A, a tablet toggle) in grid order, see the result first, and need no Confirmar. The fanfare waits for their cue, and a smaller button stops the Check quietly (the details are the orchestrator's, at the user's request). "Algú més?" is asked while taking the number. U62 is answered as D117 (automatic reveal runs through the fanfare and stops there). D118 corrected my reading of the stop: its own screen on the projector and the tablet, the music keeps playing, and Pausa only by hand. The screens' content is U76–U79, with no defaults. D119 renamed "stopped" to "under review" ("En revisió", button "Revisió manual"); the code's status name is `reviewing` (D120). D121: after a review the organizers continue the Check, win or lose by hand (skipping the remaining songs, with a warning when it goes against the card), or discard it. D122 and D125: a discard returns to the music from before the Check, in Parlem with the existing "aturat" mode (the auto-advance override), until "Següent". D123: the projector shows "Revisió manual" on the Check screen. D124: `discarded`. Still open: U77 (the tablet), U78 (the music's level), U79 (phones). 26 Nov, later: D126–D130 (unknown numbers refused privately, Enrere inside a Check, Pausa resumes what was playing, music for each moment, volumes), with U84 reframed (does Següent end Parlem?) and U90–U102 grilled in chat. Sound engine's check arrived (no code): saving and resuming playback is the main new engine work; its questions became U103–U114 and the revised U101. Sent on 26 Nov: Sound engine (its proposal went to Frontend and Backend: `claim {cardIds[]}`, `checkNext`, `checkAuto`, `checkStop`, `checkStart`, `claimDrop`; `decide` goes; the public Check reveals nothing in advance; agreed by all three on 26 Nov; I gave the go for step 1, the additive protocol plus Backend's cloud acceptance; removing `decide` waits for the console, which waits for the user's "implement"), Frontend (its content spec checked on 26 Nov and folded into U62; next, boards drawn locally, and published to the canvas only with the user's OK), Backend (the cloud's side).
- **Frontend's canvas comments are done** (v61, logged as D95 and D96). The user answered the two open threads on 26 Nov: #4 → D114 (both lowercase exceptions) and #3 → D115 (picker style A, with a softer QR icon). Frontend was told to reply on and resolve both. Frontend's to-do for when the code unfreezes: the corn's shade path in CardMark and pending covers on the drum's decoy tiles; IconPicker, NumberField's QR button, the save button and the corners follow the v61 boards.
- **D140 (26 Nov): the user's go to design and build the new things** (the Check and its review, Enrere, Pausa, the Hold rules, the music sets, throws, volumes), which lifts the freeze for those parts. Open questions stay out until answered (U77–U79, U85, U88, U89, U97, U99, U103–U119). Sound engine started on 26 Nov, with today's behaviour standing in for each open question (its list: U116 "Següent" still ends Parlem until answered; U104 no landing undo inside a Check; U105 Suspense cancelled; U106 Parlem; U107 as today; U108–U109 their own level; U110 the countdown runs; U111 not journaled; U113 ring out; U114 counts as lost; U85/U78 very low; U99 over today's span).
- **The phone's drawers (D132, 26 Nov):** Frontend builds them to match the boards, on top of the pushed `71caa9c`, with the picker as D131. The prizes drawer is excluded (U30). D90's started code is set aside in `temp/patches/d90-player-code.patch`. Build only on the user's explicit "implement", from the canvas boards.
- **The prizes model (U36–U39)** was asked in chat and is unanswered. My recommendations:
  - U36: the Line wins a 2024-style small bundle;
  - U37: a hamper has three tiers (the big item, sponsor gifts with logos, uncredited basics);
  - U38: a gift can be entered by its sponsor alone;
  - U39: money donors are thanked, never tied to a prize.

  Sources: `temp/info-from-2025/Premis paneres.md`, the 2025 sponsors CSV, and this year's `temp/wip prizes/Col·laboradors - Full 1.csv`. Once answered:
  1. update event.md › Prizes and sponsors and game-rules › Prizes and bundles;
  2. Frontend writes a content spec for the prizes drawer, and I check it against the model;
  3. Frontend draws boards from the real 2025 hampers (real names only on boards, never in the repo);
  4. the user picks (U30).
- **The edition's JSON (D116, 26 Nov).** I had misread the user, so D111 and D112 dropped a git file the user wants. Now there's one JSON per edition in git with everything (plan, prizes, businesses' names, songs, cards). Local seeding uses it, the user or an agent uploads it by hand to configure or reset the cloud, and an upload always saves the old settings first. Git isn't read at runtime, and logos stay in the bucket. Their joint proposal arrived on 26 Nov: U68–U75 (plus U54); nothing is built until the user answers. Bring every open point to the user as a question, not a default. U63 (the agent credential) applies to the upload.
- **The pool size is 70 (D100, answering U34).** Told on 25 Nov: Sound engine (its expected-end proposal, seconds per song per round from the seeded Queue) and Frontend (Admin's default `roundMinutes`, 25 → about 15, when the code unfreezes).
- **The listening pass (U13):** the user is listening. Transitions stay frozen until then.

## Where things are

- **The design canvas:** "Quina Musical look", https://claude.ai/artifact/Rs66YhT4XyRe8zQ84YUPSv (= code/artifact/c959a819…). Frontend owns it. Comments are addressed when the user asks; nobody watches it.
- **The 2025 night in data:** `docs/research/reports/night-2025-data.md`.
- **On 1 Dec:** Sound engine creates `data/pools/2026.json`, with its cards at `apps/cards/dist/cards.json`; the tests move to `data/pools/default/cards/`. The cards are made on 4–5 Dec with `npm start -- --pool 2026`.
