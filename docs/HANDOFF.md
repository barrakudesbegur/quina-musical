# Orchestrator handoff

Resume the orchestrator from this file after a clear. The durable state is in [status.md](status.md), [open-questions.md](open-questions.md), [decision-log.md](decision-log.md) (next free: **D272**, **U214**) and [timeline.md](timeline.md). This file holds only what's in flight.

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

## In flight (27 Nov, evening)

**The sessions:**
- **Sound engine:** important tasks only (the user, 27 Nov). It's idle apart from replies.
- **Frontend:** at most two agents in parallel. It's working through the user's comment list (temp/design-canvas/ds/comments-27nov.md §8, §11), the projector's end screen (board Projector-Final, waiting for the user's OK), and the Celebration-prize proposals (D242).
- **Backend:** cleared and resumed on 27 Nov. Its queue is empty; it waits for U204's time.
- **The card design session (quina-musical-d1):** cleared on 27 Nov evening. Its handoff is tools/card-mockup/HANDOFF.md (2d572401), with the spec in tools/card-mockup/README.md and the canvas at https://claude.ai/code/artifact/8af06588-238f-4095-8d67-a594d91c7392. A new card session resumes from there. The generator with both options is on main (7092e216), and apps/cards is Frontend's again. Only the organizers' pick (U212) remains, then the proof round before 4–5 Dec.

**Live (last deploy 58be65b4):**
- the realistic run's plan on quina-dev: D192's order, 96 example prizes from the organizers' sheet (temp/wip prizes/2026-example-bundles.json), 58 sponsors and 55 logos, with the 27 Dec times;
- the 2026 cards (699 temporary, both cards two-sided) and covers on the QR domain;
- repertoire 2026 in R2's content-addressed layout (D248: manifests/2026.json, 2,785 blobs, 8.09 GB), with the final playlists (D230), provisional hooks and placeholder voices;
- the installable player (D221–D223);
- the drum matching on the phone (D237, D249);
- the console items: D228, D229, D234's sold cards and the two-level lock (engine-enforced, cloud consoles told apart), D237's switches;
- «Quina del Desgraciat» (D251).

**To run the show on the laptop:** `cd apps/show && npm start -- --lan --repertoire 2026` (it builds first and refuses a stale build), `cd apps/cloud && npm run link`, then `npm run preflight`.

**Waiting on the user (open-questions.md › Decisions), most useful first:**
- U204: the realistic run's start time today, or 27 Dec;
- the cards (the deadline is 4–5 Dec): U201 (the circle on both sides), U210 (cards per page), U198 (the screens' special labels), U52 (paper);
- U199: the 4 songs in both final playlists (today pool 2 has 66);
- U205 (Parlem's 40 s Hold music), U206 (the drum's landing), U207 (✕ in a stack), U208 (the near-win sounds);
- U194 (push), U196 (App Clip), U197 (TWA): the research says pass;
- U202, U203: the console's in-game admin and sync;
- U55: the old song data on the laptop; U56: faster hook approval (before the rehearsals); U14: approving the hooks;
- the question format: the grill format for everyone, or only the card session;
- U68–U75: the edition file's details (it's built and passes; nothing is committed until U75);
- older ones: U157–U160, U163, U166, U167 (closed), U168, U169, U173, U176–U179, U181, U188, U193, U36–U39, U12, U50, U79.

**Ideas, not decided (docs/ideas.md):** the presenters' notebook on the tablet (U191: ask the presenters), and ordering from the tables to the bar.

**Other threads:**
- Optional, not now: the garland on the beat, an "effect is playing" state, and the relay's asset caching.
- The listening pass and trying the remote (U13).

## Where things are

- **The design canvas:** "Quina Musical look", https://claude.ai/artifact/Rs66YhT4XyRe8zQ84YUPSv (= code/artifact/c959a819…). Frontend owns it, and comments are read only when the user says so.
- **The 2025 night in data:** `docs/research/reports/night-2025-data.md`. **The research of 27 Nov:** docs/research/reports/ (push-notifications.md, ios-install-and-app-clip.md, android-twa-and-install.md).
- **Cards:** made on 4–5 Dec with `npm start -- --repertoire 2026` in apps/cards, from the final design.
