# Status

One screen: where each area stands, what's blocked, and what waits on the user. Written by the orchestrator from each handoff's "Now" block; the detail is in the handoffs. Dates are in [timeline.md](timeline.md), and the user's items (U1, U2…) in [open-questions.md](open-questions.md).

**Updated:** 2026-11-25. **The night:** Sun 27 Dec. **The final playlist:** Tue 1 Dec. The cards are made on 4–5 Dec if the playlist is ready (D83); rehearsals have no fixed dates (D82).

## The critical path

| Step | State |
|---|---|
| Card type per round, every screen and the cloud | **Done** |
| The Desgraciat round: engine, cloud and screens | **Done**, including the shared win and no celebration title. Its default card type becomes the special card (D70) |
| Songs downloaded | **Two pools of 70 (D100, D101).** Pool 1 is final: the 76 were downloaded and checked, and the temporary cards are remade from its 70. Pool 2 is still being filled; the special rounds' pool is pending U49. Storage, disk and hook time for 140–210 songs are being checked |
| The card generator ready | **Ready**, with provisional values (D67, D68) and the PDF's install-script approval still to do (U17) |
| The pool prepared and validated (from 1 Dec) | Waits on the downloads. The pipeline and its quality check are ready |
| Hooks approved | Waits on prep, then the user (U14). Draft approvals carry over to the final pool (D79) |
| This year's pool in R2, laptops synced | Waits on the pool. Under 100 songs fits the free tier (D80) |
| QR domain switched | **Done (25 Nov, 14:20 UTC):** the QR address serves this year's player; last year's app moved to its GitHub Pages address |
| Rehearsals | **No fixed dates (D82):** the tech rehearsal when everything feels ready; maybe a presenters' one a day or two before or on the day |
| Cards made | **4–5 Dec (D83)**, if the playlist is ready. Waits on the pool's quality check (1–3 Dec); the PDF's module is approved and built (U17). The generator now refuses repeated lines (65b74ef) |

## By area

| Area | Now | Next | Waiting on the user |
|---|---|---|---|
| **Sound engine** ([handoff](../apps/show/docs/HANDOFF.md)) | Temporary cards from Part 1's 70; the expected end at 70 done (8e6f563: Line ~14, Bingo ~46, last standing ~21 songs; 2025's night reproduced within 2 min a round); the side/Part protocol agreed | Pool 2 when filtered; prep by 3 Dec; the expected end for 70 songs | U13, U14, U49, U51, U55–U57 |
| **Frontend** ([handoff](../packages/ui/HANDOFF.md)) | **UI code frozen;** designs on the canvas only. The 15 comments on `Mobil-B-J2` addressed on canvas v61 (D95, D96) | The double-sided card with the user (D102); the prizes drawer after U36–U39; build only on the user's "implement" | U12, U30, U46, U47, U50 |
| **Backend** ([handoff](../apps/cloud/docs/HANDOFF.md)) | The QR address live (D76); the same-day rehearsal rule | The settings file (`plan check/push/pull`) after U43 | U16, U19, U43, U48 |
| **Orchestrator** ([handoff](HANDOFF.md)) | D66–D102 logged on 25 Nov; the pool-size study and the 2025 data delivered | The Check's redesign with the user (in chat); the prizes model once U36–U39 are answered | U36–U39, U43, U48, U49, U52–U56 |

## Recently done (25–26 Nov)

- Card type per round across the stack (plan v3); prices live with the card types, with a rule per type.
- The Desgraciat end to end, run live on quina-dev with a phone: shared wins, no title, its Check.
- The Check's result decides: the engine refuses to accept a failed Check, and the cloud only flags.
- The winner's slip number; throw breaks in the Schedule and Admin; the night's expected end by round kind.
- Fallbacks: the laptop-only setup in the runbook and the preflight, a USB clicker, the Wii range test.
- Phones: no winning numbers, offline keeps the normal screen, the 3 tabs, add-card asks before leaving.
- Prep: a quality check, the double-tempo fix, full-quality downloads once unblocked.
- `npm run sync-main`; the docs restructure (event.md, requirements, the decision log, numbered open questions).
