# Orchestrator handoff

Resume the orchestrator from this file after a clear. The durable state is in [status.md](status.md), [open-questions.md](open-questions.md), [decision-log.md](decision-log.md) (next free: **D205**, **U181**) and [timeline.md](timeline.md). This file holds only what's in flight.

## How the orchestrator works here

- **Commit from the worktree** (`.claude/worktrees/orchestrator-timeline`), docs only. `git fetch` and `git rebase origin/main`, then `git push origin <sha>:main`. The harness refuses compound git commands, so run each one on its own.
- **The user answers in chat or on the canvas.** Every decision gets a D-entry, the requirement changes, and the U moves to "Answered" the same day. Sessions report their user decisions to the orchestrator.
- **Rules learned on 25 Nov (also in memory):**
  - never invent dates: the only dates are the user's (1 Dec playlist, 4–5 Dec cards, 27 Dec night);
  - don't get ahead: no work on this year's songs before the playlist arrives;
  - a pick on a board is not a go to build: UI code stays frozen until the user says "implement";
  - UI starts from the model: a content spec, checked against event.md, comes before boards;
  - clock times for the user are in 12-hour format.

## In flight (26 Nov, late)

**How to work with the user now** (all in memory too):
- ask, never assume;
- use the glossary's words;
- ask only real choices, one set of options per numbered question, in plain format;
- look for a design that removes a trade-off before offering it;
- record the reason for each mechanic, and push back with it;
- batch docs pushes, and never push inside a session's announced push window;
- relayed user decisions count as theirs (D156);
- event.md facts go in without asking.

**Built and live on 26 Nov** (sessions push tested shas; Backend deploys first):
- the presenter-paced Check, its review and Enrere inside it;
- Pausa resuming what was playing;
- the Hold rules (Següent ends Parlem; Aguanta and Suspens block it);
- Suspens with B + A (D176, D177), the shake switch;
- the music sets, the throw, the storm, the sliders 0–150 %;
- first plays at 22 s (D174, D175);
- the Desgraciat's finale on stage with one winner (D180, D183);
- the repertoire rename (D178);
- two-sided cards end to end (Admin defaults count normal rounds only);
- round names: "Quina N" for normal rounds only;
- slow confetti;
- the finale screens, the new tabs (Estat, Cerca, Futur), D121's resumed Check, D193's 1–5 / 6–10, D194, D197 (c612e95, deployed 0948f16b).

**Being built:**
- **Frontend:** D195, D196, D199 (the console layout), D188 (the phone's add pad), D189 (the round-buttons pass), the D200 banner on the canvas first; U169 and U170 on the canvas; the design-system spec (U175+).
- **Sound engine and Backend: paused (the user, 26 Nov, late),** so the user can focus on the Frontend. Each finishes its current task only if past about half, otherwise parks it unpushed. Backend still pushes and deploys Frontend's tested commits. Nothing new for either until the user says so. Parked: the voices and padHold engine side (D198, D202–D204), and the voice sync root and clock checks.

**Waiting on the user:**
- **The live list:** open-questions.md › Decisions.
- **Most useful next:**
  - U160: built as (b), so confirm;
  - U163: what the round total counts;
  - U157–U159: the Celebration music pick and the numbered slip;
  - U68–U75 and U63: the edition file, with nothing built until answered;
  - U55, U56: preparing pool 1 and cutting hook approval, both before the rehearsals;
  - U36–U39, U30: the prizes;
  - U161: a spare laptop's music.
- **The design session:** side 2's design, the rounds mark (D102), U50 and U59 are for the user with Frontend.

**The night's order (D192, the organizers', 26 Nov):** card sales 5 pm, start 6 pm, Quines 1–5, the Desgraciat, one 10-minute Descans with the throw, Quines 6–10, the Especial last, the end about 10 pm. The split is 1–5 / 6–10 (D193); the specials' pool is U167. Pool 2 isn't filtered or downloaded yet; download it only when the user says so.

**Other threads:**
- The playlist covers' canvas: "Portades Spotify", https://claude.ai/code/artifact/a14bdc4a-9b8a-4e63-aaf7-635262b35d62. Outside the product.
- The listening pass and trying the remote (U13): the chaotic moments' loudness (D158), the 1.5 s window (D148), 600 ms before "Seguides".

## Where things are

- **The design canvas:** "Quina Musical look", https://claude.ai/artifact/Rs66YhT4XyRe8zQ84YUPSv (= code/artifact/c959a819…). Frontend owns it. Comments are addressed when the user asks; nobody watches it.
- **The 2025 night in data:** `docs/research/reports/night-2025-data.md`.
- **Cards:** made on 4–5 Dec with `npm start -- --repertoire 2026` in apps/cards (D178 renamed pools to repertoires: `data/repertoires/`, R2 `repertoires/<name>/`).
