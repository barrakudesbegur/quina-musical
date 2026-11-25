# Orchestrator handoff

Resume the orchestrator from this file after a clear. The durable state is in [status.md](status.md), [open-questions.md](open-questions.md), [decision-log.md](decision-log.md) (next free: **D95**, **U46**) and [timeline.md](timeline.md). This file holds only what's in flight.

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

- **Waiting on Frontend (canvas comments, 25 Nov 18:35–18:50):** it's fixing 15 threads on `Mobil-B-J2`, on the boards only. When it reports, log:
  - **D95:** "Desar i afegir-ne un altre" is removed; one full-width, square save button with an icon;
  - **D96:** Londrina is used in capitals on every screen. Frontend proposes where lowercase might be right, and that goes to the user as a U.

  Several threads were regressions (real covers, the cards' slight rotation, the corn's dark shade). Frontend was told to check every redraw against the agreed boards and the design system.
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
- **The settings file (D89; U42 and U43 open).** My recommendations:
  - U42 (a): the public repo, since prize secrecy isn't worth a second repo (D78);
  - U43: the file wins before the night, the cloud on the night, and an agent pulls the plan back afterwards.

  Backend's facts and plan are in its reply of 25 Nov: `npm run plan -- check|push|pull` and a preflight diff, about a day of work. Build it after the user answers. Then the orchestrator parses the organizers' spreadsheet into the file.
- **The pool size (U34):** the study is in `docs/research/reports/pool-size-2026.md`, and the user's page is https://claude.ai/code/artifact/dd4e4ff9-b838-4402-8f64-d6b02677703b. I recommend 70. When the user picks:
  - tell Sound engine (its expected-end proposal: seconds per song per round, from the seeded Queue);
  - tell Frontend (Admin's default `roundMinutes`, 25 → about 15).
- **The listening pass (U13):** the user is listening. Transitions stay frozen until then.

## Where things are

- **The design canvas:** "Quina Musical look", https://claude.ai/artifact/Rs66YhT4XyRe8zQ84YUPSv (= code/artifact/c959a819…). Frontend owns it. Comments are addressed when the user asks; nobody watches it.
- **The 2025 night in data:** `docs/research/reports/night-2025-data.md`.
- **On 1 Dec:** Sound engine creates `data/pools/2026.json`, with its cards at `apps/cards/dist/cards.json`; the tests move to `data/pools/default/cards/`. The cards are made on 4–5 Dec with `npm start -- --pool 2026`.
