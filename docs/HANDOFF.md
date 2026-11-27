# Orchestrator handoff

Resume the orchestrator from this file after a clear. The durable state is in [status.md](status.md), [open-questions.md](open-questions.md), [decision-log.md](decision-log.md) (next free: **D273**, **U215**) and [timeline.md](timeline.md). This file holds only what's in flight.

## How the orchestrator works here

- **Commit from the worktree** (`.claude/worktrees/orchestrator-timeline`), docs only. `git fetch` and `git rebase origin/main`, then `git push origin <sha>:main`. The harness refuses compound git commands, so run each one on its own.
- **The user answers in chat or on the canvas.** Every decision gets a D-entry, the requirement changes, and the U moves to "Answered" the same day. Sessions report their user decisions to the orchestrator, and send docs/ changes to it rather than editing docs/ themselves.
- **How to work with the user** (all in memory too):
  - ask, never assume; use the glossary's words;
  - ask only real choices, one set of options per numbered question, in plain format (the grill format only in the card design session, until the user answers whether it's for everyone);
  - look for a design that removes a trade-off before offering it;
  - record the reason for each mechanic, and push back with it;
  - relayed user decisions count as theirs (D156); event.md facts go in without asking;
  - clock times for the user are in 12-hour format; never invent dates.
- **Team rules from 27 Nov (docs/team.md):**
  - sessions delegate the work to subagents (D240), within the user's limits on parallel agents;
  - canvas comments only when the user says so, all of them in creation order;
  - boards and design docs in English;
  - every change lands in code, mockups and the design system together (D236);
  - the UI code rules (D215);
  - web UI work loads modern-web-guidance first.

## In flight (28 Nov, early)

**The sessions:**
- **Sound engine:** important tasks only (the user, 27 Nov). Idle; D268 is complete (d6bb94ae, membership is `pools` only).
- **Frontend:** at most two agents in parallel. It's working through the user's comment list (temp/design-canvas/ds/comments-27nov.md §8, §11), the projector's end screen (board Projector-Final, waiting for the user's OK), and the Celebration-prize proposals (D242).
- **Backend:** cleared and resumed on 27 Nov. Its queue is empty; it waits for U204's time.
- **The card design session (quina-musical-d1):** its work is done except U212. Its handoff is tools/card-mockup/HANDOFF.md, the spec tools/card-mockup/README.md, the canvas https://claude.ai/code/artifact/8af06588-238f-4095-8d67-a594d91c7392. The generator with both layouts is on main (7092e216, acd8f1a9, 4e4c0fe2), and apps/cards is Frontend's again. Decisions D250–D272.

**Live (last deploy b488bafa, 28 Nov: the renumbered 2026 repertoire, 135 songs, 70/70 with 5 shared, the remade temporary cards and covers):**
- the realistic run's plan on quina-dev: D192's order, 96 example prizes from the organizers' sheet (temp/wip prizes/2026-example-bundles.json), 58 sponsors and 55 logos, with the 27 Dec times;
- the 2026 cards (699 temporary, both cards two-sided) and covers on the QR domain;
- repertoire 2026 in R2's content-addressed layout (D248: manifests/2026.json, 2,772 blobs, 8.04 GB), with the final playlists (D230, D269: 135 songs, 5 shared), clean print names (D260, D270, D271), provisional hooks and placeholder voices;
- the installable player (D221–D223);
- the drum matching on the phone (D237, D249);
- the console items: D228, D229, D234's sold cards and the two-level lock (engine-enforced, cloud consoles told apart), D237's switches;
- «Quina del Desgraciat» (D251).

**To run the show on the laptop:** `cd apps/show && npm start -- --lan --repertoire 2026` (it builds first and refuses a stale build), `cd apps/cloud && npm run link`, then `npm run preflight`.

**Waiting on the user (open-questions.md › Decisions), most useful first:**
- U204: the realistic run's start time today, or 27 Dec (Backend uploads the plan with `--start` when it's relayed);
- U212: the organizers pick the card, «Quadrat amb portades» (the default, A3 six a sheet) or «Apaïsat sense portades» (A4 three a page). The generator makes both (`--layout a4-3`); the cards are made on 4–5 Dec, after a proof sheet;
- U214: the grill format only in a card design session (the default), or plain questions there too;
- U205 (Parlem's 40 s Hold music), U206 (the drum's landing public 2.5 s early), U207 (✕ in a stack), U208 (the near-win sounds);
- U194 (push), U196 (App Clip), U197 (TWA): the research says pass; U195 (uncollected prizes);
- U202, U203: the console's in-game admin and second-console sync;
- U55 (old song data on the laptop), U56 (faster hook approval) and U14 (approving the hooks), before the rehearsals;
- U68–U75: the edition file's details (built and passing; not committed until U75);
- older ones: U157–U160, U163, U166, U168, U169, U173, U176–U179, U181, U188, U193, U36–U39, U12, U50, U79, U97/U99, U103–U114, U128, U129, U136–U139, U150, U85, U89.
- User tasks: U191 (ask the presenters about the notebook), U19 (the real-device checks, now with the iPad icon and Android scans), U126, U65, U64, U16, U18, U20, U13.

**Sound engine's later item:** the Pausa, break and Hold music into the repertoire (D268's part C), designed with Backend before the rehearsals.

**Ideas, not decided (docs/ideas.md):** the presenters' notebook on the tablet (U191: ask the presenters), and ordering from the tables to the bar.

**Other threads:**
- Optional, not now: the garland on the beat, an "effect is playing" state, and the relay's asset caching.
- The listening pass and trying the remote (U13).

## Where things are

- **The design canvas:** "Quina Musical look", https://claude.ai/artifact/Rs66YhT4XyRe8zQ84YUPSv (= code/artifact/c959a819…). Frontend owns it, and comments are read only when the user says so.
- **The 2025 night in data:** `docs/research/reports/night-2025-data.md`. **The research of 27 Nov:** docs/research/reports/ (push-notifications.md, ios-install-and-app-clip.md, android-twa-and-install.md).
- **Cards:** made on 4–5 Dec with `npm start -- --repertoire 2026` in apps/cards, from the final design.
