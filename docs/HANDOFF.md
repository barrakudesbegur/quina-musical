# Orchestrator handoff

Resume the orchestrator from this file after a clear. The durable state is in [status.md](status.md), [open-questions.md](open-questions.md), [decision-log.md](decision-log.md) (next free: **D100**, **U49**) and [timeline.md](timeline.md). This file holds only what's in flight.

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

- **The playlist (D99, 25 Nov).** It held 76 songs when fetched. Sound engine downloaded and checked all of them (none left for the user) and made temporary cards in `data/media/2026/cards-TEMPORARY-not-for-print/` from an untracked pool `data/pools/2026-temp.json`. About 10 more are cut, probably to 70 (U34 stays open until the user confirms). When the cut comes, tell Sound engine to re-fetch and remake the cards (minutes), and log U34 if the user settles it.
- **The Check's redesign (grilling the user in chat, from 25 Nov evening).** The user dislikes today's Check flow and the console's Check screen. The projector's look is fine. Their complaints: it's an awkward, boring moment; the presenters can't build hype or time the fanfare around their voices; the console should show the card as a grid; the queue makes no sense, since it's usually one card; and the Confirmar button goes against the model, since rejecting is only for exceptions. Round 1 asked: Q1 the presenters pace each reveal, plus "Seguides" stopping before the last song; Q2 the console knows the result first, in private; Q3 a pass needs no confirmation and the fanfare fires on the presenters' cue; Q4 the suspense order, deciding song last; Q5 "Algú més?" asked while taking the number. Next round: the cue's form, an exceptional reject, how a fail plays out, the console's grid, the Desgraciat's Check, voices in the Celebration. When understanding is shared: D-entries, then the requirements (game-rules › The Check, screens › Console, show-and-music › the Check's sound), then Sound engine (engine and protocol) and Frontend (a content spec, then boards). No code until the user says "implement".
- **Frontend's canvas comments are done** (v61, logged as D95 and D96). Two threads on `Mobil-B-J2` stay open for the user: #3 is U47 (the icon picker's style) and #4 is U46 (Londrina's two lowercase exceptions). Frontend's to-do for when the code unfreezes: the corn's shade path in CardMark and pending covers on the drum's decoy tiles; IconPicker, NumberField's QR button, the save button and the corners follow the v61 boards.
- **71caa9c, keep or revert:** Frontend's handoff says the orchestrator would ask the user. Asked in chat on 25 Nov; no answer yet. Meanwhile it stays, until the user agrees the boards that replace it.
- **UI code is frozen.** `71caa9c` (the drawers, B + J2) stays as it is. D90's started code is set aside in `temp/patches/d90-player-code.patch`. Build only on the user's explicit "implement", from the canvas boards.
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
- **The settings file (D89, D97, D98).** The user answered U42 to Backend: the file lives in this public repo with every prize, and hiding prizes is only for the hype on screens. Backend put it at `data/nights/2026.json` (one per edition, beside the pool): the whole GamePlan plus Admin's soundsDefault. Still open:
  - U43: I recommend the file wins before the night, the cloud on the night, and `plan pull` brings the night back into the file;
  - U48: I recommend sponsors' names and logos in the file, never their money amounts.

  Backend's plan: `npm run plan -- check|push|pull` and a preflight diff, about a day of work, built after U43. Then the orchestrator parses the organizers' spreadsheet into the file.
- **The pool size (U34):** the study is in `docs/research/reports/pool-size-2026.md`, and the user's page is https://claude.ai/code/artifact/dd4e4ff9-b838-4402-8f64-d6b02677703b. I recommend 70. When the user picks:
  - tell Sound engine (its expected-end proposal: seconds per song per round, from the seeded Queue);
  - tell Frontend (Admin's default `roundMinutes`, 25 → about 15).
- **The listening pass (U13):** the user is listening. Transitions stay frozen until then.

## Where things are

- **The design canvas:** "Quina Musical look", https://claude.ai/artifact/Rs66YhT4XyRe8zQ84YUPSv (= code/artifact/c959a819…). Frontend owns it. Comments are addressed when the user asks; nobody watches it.
- **The 2025 night in data:** `docs/research/reports/night-2025-data.md`.
- **On 1 Dec:** Sound engine creates `data/pools/2026.json`, with its cards at `apps/cards/dist/cards.json`; the tests move to `data/pools/default/cards/`. The cards are made on 4–5 Dec with `npm start -- --pool 2026`.
