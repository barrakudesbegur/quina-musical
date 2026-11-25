# Status

One screen: where each area stands, what's blocked, and what waits on the user. Written by the orchestrator from each handoff's "Now" block; the detail is in the handoffs. Dates are in [timeline.md](timeline.md), and the user's items (U1, U2…) in [open-questions.md](open-questions.md).

**Updated:** 2026-11-25. **The night:** Sun 27 Dec. **The final playlist:** Tue 1 Dec. The cards are made on 4–5 Dec if the playlist is ready (D83); rehearsals have no fixed dates (D82).

## The critical path

| Step | State |
|---|---|
| Card type per round, every screen and the cloud | **Done** |
| The Desgraciat round: engine, cloud and screens | **Done**, including the shared win and no celebration title. Its default card type becomes the special card (D70) |
| Songs downloaded | **Waits on the playlist (D80):** no work on the draft until the user hands it over; last year's songs meanwhile. A study of the pool size is running |
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
| **Sound engine** ([handoff](../apps/show/docs/HANDOFF.md)) | Nothing running; the listening demo is out for U13 | Download this year's draft songs by any method that passes the quality check (D66), prep, propose hooks | U13, U14 |
| **Frontend** ([handoff](../packages/ui/HANDOFF.md)) | Nothing running | Proposals for the drawers' content, the prizes drawer and the corner buttons (D73); the your-song effect's spec (D74); the presenters' checklist; the card-types preview on phones | U12, U30 |
| **Backend** ([handoff](../apps/cloud/docs/HANDOFF.md)) | Nothing running | The QR domain switch now (D76); this year's pool in R2 | U16, U19, U24 |
| **Orchestrator** | The user's answers of 25 Nov recorded (D66–D86); the pool-size study delivered (U34) | 2025's export aggregates into a doc (U24); the pool size relayed once picked | — |

## Recently done (25–26 Nov)

- Card type per round across the stack (plan v3); prices live with the card types, with a rule per type.
- The Desgraciat end to end, run live on quina-dev with a phone: shared wins, no title, its Check.
- The Check's result decides: the engine refuses to accept a failed Check, and the cloud only flags.
- The winner's slip number; throw breaks in the Schedule and Admin; the night's expected end by round kind.
- Fallbacks: the laptop-only setup in the runbook and the preflight, a USB clicker, the Wii range test.
- Phones: no winning numbers, offline keeps the normal screen, the 3 tabs, add-card asks before leaving.
- Prep: a quality check, the double-tempo fix, full-quality downloads once unblocked.
- `npm run sync-main`; the docs restructure (event.md, requirements, the decision log, numbered open questions).
