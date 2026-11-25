# Status

One screen: where each area stands, what's blocked, and what waits on the user. Written by the orchestrator from each handoff's "Now" block; the detail is in the handoffs. Dates are in [timeline.md](timeline.md), and the user's items (U1, U2…) in [open-questions.md](open-questions.md).

**Updated:** 2026-11-26. **The night:** Sun 27 Dec. **The final playlist:** Tue 1 Dec.

## The critical path

| Step | State |
|---|---|
| Card type per round, every screen and the cloud (due 27 Nov) | **Done** |
| The Desgraciat round: engine, cloud and screens (due 30 Nov and 4 Dec) | **Done**, including the shared win and no celebration title |
| Songs downloadable (before 2 Dec) | **Blocked on the user (U1):** YouTube's bot check |
| The card generator ready (30 Nov) | **Ready**, except the user's values (U2, U3) and the PDF's install-script approval (U17) |
| The pool prepared and validated (2 Dec) | Waits on U1. The pipeline and its quality check are ready |
| Cards printed (sent 3 Dec, back about 11 Dec) | Waits on the pool, U2, U3 and U4 |
| Hooks approved (by 10 Dec) | Waits on the pool, then the user (U14) |
| This year's pool in R2, laptops synced (10 Dec) | Waits on the pool. It fits the free tier (about 68 MB a song) |
| QR domain switched (11 Dec) | Waits on the user's OK (U15) |
| Rehearsals (13 and 19 Dec) | Waits on the plan in Admin (U18) and the real-device checks (U19) |

## By area

| Area | Now | Next | Waiting on the user |
|---|---|---|---|
| **Sound engine** ([handoff](../apps/show/docs/HANDOFF.md)) | A listening demo of a whole round, with a cue list, for U13 | This year's songs as soon as they download; provisional hook approval (test aid) | U1, U13, U14 |
| **Frontend** ([handoff](../packages/ui/HANDOFF.md)) | Realistic 17–19-item prize bundles on every screen and the cheat sheet | The coming round's card price on the projector; the "Final Lap!" switch; the card-types preview on phones; the presenters' checklist; the pool-size report | U2, U3, U7–U12, U17, U21 |
| **Backend** ([handoff](../apps/cloud/docs/HANDOFF.md)) | The whole-show e2e with real wins only | This year's pool in R2 (10 Dec); the Wii drop count in the preflight, when it lands | U15, U16, U19, U24 |
| **Orchestrator** | Keeping the requirements and decision log in step with what's built | Gather the user's answers; send the listening demo | — |

## Recently done (25–26 Nov)

- Card type per round across the stack (plan v3); prices live with the card types, with a rule per type.
- The Desgraciat end to end, run live on quina-dev with a phone: shared wins, no title, its Check.
- The Check's result decides: the engine refuses to accept a failed Check, and the cloud only flags.
- The winner's slip number; throw breaks in the Schedule and Admin; the night's expected end by round kind.
- Fallbacks: the laptop-only setup in the runbook and the preflight, a USB clicker, the Wii range test.
- Phones: no winning numbers, offline keeps the normal screen, the 3 tabs, add-card asks before leaving.
- Prep: a quality check, the double-tempo fix, full-quality downloads once unblocked.
- `npm run sync-main`; the docs restructure (event.md, requirements, the decision log, numbered open questions).
