# Timeline to the night

**The night is Sunday 27 December 2026.** The final playlist arrives on **Tuesday 1 December**. Everything below is planned backwards from those two dates. The orchestrator keeps this page current; sessions plan their queues against it.

Dates marked *(default)* are the orchestrator's assumption until the user confirms them.

## The critical path

The playlist → the printed cards → the QR domain → the cards handed out. A song can't change once the cards are printed, and the printed QR codes only work once `quina.barrakudesbegur.org` points at the new app.

| Date | Milestone | Who |
|---|---|---|
| Fri 27 Nov | Card type per round: built on every screen and in the cloud | Sound engine, Frontend, Backend |
| Mon 30 Nov | The Desgraciat round: engine and protocol built. Its boards and animation specs ready for the user's review | Sound engine, Frontend |
| Mon 30 Nov | Ready for the playlist: the prep pipeline tested end to end on a few songs of the draft playlist; the card generator configured for this year (title, colour, card types, prices); disk space freed | Sound engine, Frontend, user |
| **Tue 1 Dec** | **Playlist final** | User |
| Wed 2 Dec | The pool downloaded, decoded, analysed and validated. Unusable songs flagged the same day, so the user can swap them before the cards | Sound engine, user |
| Thu 3 Dec | Cards generated, proofed by the user, and sent to print *(default: about a week to print; 8 Dec is a holiday)* | Frontend, user |
| Fri 4 Dec | The Desgraciat round's screens built | Frontend |
| Thu 10 Dec | Hooks approved and Signatures vetted on the audition page (about 2 min a song). Stems rendered. The variety and phrase measures rerun on the new pool | User, Sound engine |
| Thu 10 Dec | Last year's test pool pruned from R2, this year's pushed; the show laptop and the spare synced | Backend |
| Fri 11 Dec | **Cards printed.** `quina.barrakudesbegur.org` points at the new app (needs the user's explicit OK), checked with a printed card | User, Backend |
| Sun 13 Dec | **Rehearsal 1:** a whole show with this year's pool, the real plan, the tablet, the Wii remote and real phones | Everyone |
| Sat 19 Dec | **Rehearsal 2 (dress):** the venue's projector and PA if possible, the spare laptop, the runbook from scratch | Everyone |
| Mon 21 Dec | **Code freeze.** After this, only fixes for problems found at a rehearsal | All sessions |
| Sat 26 Dec | Set up, run the preflight, sound check | Organizers |
| **Sun 27 Dec** | **The night** | |

Rehearsals use the cloud's free daily quota too, so never hold one on the day of the show (see the decisions doc).

## The user's tasks, by date

- **By 30 Nov:**
  - the 4 design choices on the canvas (prizes corner icon, the effect when the landed song is on your card, the Efectes pads, the player drawers);
  - a listening pass on the new sound;
  - the card's title, colour and prices;
  - upload the logo library in Admin.
- **1 Dec:** the final playlist.
- **2–3 Dec:** swap any unusable songs; proof and send the cards to print.
- **By 10 Dec:** approve the hooks and Signatures.
- **By 11 Dec:** give the OK to switch the QR domain.
- **By 13 Dec:**
  - the night's plan in Admin (rounds, a card type per round, prize bundles, sponsors);
  - the real-device checks in `open-questions.md`.
- **Optional, any time:** more Hold music and victory tracks.

## Assumptions to confirm

- **When the cards are handed out** *(default: from about 12 Dec, sold before the night)*. If they're only handed out at the door on the 27th, printing and the domain switch can move later.
- **Print lead time** *(default: about a week from 3 Dec)*.
- **The rehearsal dates** *(default: 13 and 19 Dec)*.

## Risks

- **Disk space:** the show Mac has about 21 GB free, and a new pool's preparation (audio, analysis, windowed stems) needs several GB. Free space before 1 Dec.
- **A late playlist change** after 3 Dec means reprinting cards. After 11 Dec it's not possible.
- **Hooks are proposals:** on last year's songs the automatic top candidate was within a bar of the real hook in only 26 of 77 songs. The user's approval pass is needed, not optional.
- **The QR domain switch** retires last year's app at that address. It's planned in `apps/cloud/docs/deploy-plan.md` (step 7), with an undo.
