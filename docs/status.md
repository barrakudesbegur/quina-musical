# Status

One screen: where each area stands, what's blocked, and what waits on the user. Written by the orchestrator from each handoff's "Now" block; the detail is in the handoffs. Dates are in [timeline.md](timeline.md), and the user's items in [open-questions.md](open-questions.md).

**Updated:** 2026-11-25, evening. **The night:** Sun 27 Dec. **The final playlist:** Tue 1 Dec.

## The critical path

| Step | State |
|---|---|
| Card type per round, every screen and the cloud (due 27 Nov) | **Done** |
| The Desgraciat round: engine, cloud and screens (due 30 Nov and 4 Dec) | **Done**, with follow-ups: the shared win when the last players fall together, and no celebration title |
| Songs downloadable (before 2 Dec) | **Blocked on the user:** YouTube's bot check (U1) |
| The card generator ready (30 Nov) | **Ready**, except the user's values (U2, U3) and the PDF's install-script approval (U17) |
| The pool prepared and validated (2 Dec) | Waits on U1. The pipeline and its quality check are ready |
| Cards printed (sent 3 Dec, back about 11 Dec) | Waits on the pool, U2, U3 and U4 |
| Hooks approved (by 10 Dec) | Waits on the pool, then the user (U14) |
| This year's pool in R2, laptops synced (10 Dec) | Waits on the pool. It fits the free tier (about 68 MB a song) |
| QR domain switched (11 Dec) | Waits on the user's OK (U15) |
| Rehearsals (13 and 19 Dec) | Waits on the plan in Admin (U18) and the real-device checks (U19) |

## By area

| Area | Now | Next | Blocked or waiting |
|---|---|---|---|
| **Sound engine** ([handoff](../apps/show/docs/HANDOFF.md)) | The Desgraciat shared win (`fellLast`), the winner's slip, the Check's recorded outcome; the card price rule (U5) | Throw breaks in the Schedule; this year's songs as soon as they download; provisional hook approval (test aid) | U1 downloads; U13 listening pass (transitions frozen until then) |
| **Frontend** ([handoff](../packages/ui/HANDOFF.md)) | Realistic 17–19-item prize bundles in the fixtures; `fellLast` and the slip in the console; the coming round's card price on the Interval screen; dropping "DEMPEUS!" | Throw breaks in Admin and Horari; every sponsor on the projector; "el tècnic" wording; the laptop-only and iPad/Android fallbacks | U2, U3, U7–U12, U17 |
| **Backend** ([handoff](../apps/cloud/docs/HANDOFF.md)) | The sponsor-sheet import guide; the cloud side of `fellLast` and the slip | Runbook and preflight for the laptop-only setup and the Wii's Bluetooth range; this year's pool in R2 (10 Dec) | U15 the QR domain; U16 the logo library |
| **Orchestrator** | The docs restructure: requirements per area, the decision log, this page | Keep the decision log and requirements current as the user decides | — |

## Recently done (25 Nov)

- Card type per round across the whole stack; the old `plan.cardTypes` gone (plan v3), older plans still load.
- The Desgraciat round end to end, run live on quina-dev with a phone following. The run found and fixed two cloud bugs, including phones missing round 1's intro.
- The engine refuses to accept a card whose Check failed (a real bug against the user's rule).
- The old Decoys experiment retired; `remote.status` and card ranges moved into the protocol.
- Phones: no winning card numbers, offline keeps the normal screen, the 3 tabs, add-card asks before leaving.
- Prep: a quality check, the double-tempo fix, and full-quality downloads (YouTube's own audio, no MP3 re-encode).
- `npm run sync-main` keeps the shared checkout in step with origin.
- The docs: event.md (approved by the user), the map, numbered open questions.
