# Timeline to the night

**The night is Sunday 27 December 2026.** The final playlist arrives on **Tuesday 1 December**. Everything below is planned backwards from those two dates. The orchestrator keeps this page current; sessions plan their queues against it.

**Only the user's dates are dates.** The night (27 Dec) and the final playlist (1 Dec) are the user's. Every other step is ordered, not dated, until the user sets the rehearsals (U27) and the print date (U28). On 25 Nov the user corrected dates the orchestrator had made up (sales from 12 Dec, a week's printing, rehearsals on 13 and 19 Dec): cards are sold only on the night and print in a few hours (D71).

## The critical path

The playlist → the pool prepared → the hooks approved → the rehearsals → the cards printed → the night. A song can't change once the cards are printed.

| When | Milestone | Who |
|---|---|---|
| Now | Work with last year's songs (D80); a study proposes the pool size with candidate schedules | Sound engine, orchestrator |
| **Tue 1 Dec** | **Playlist final** | User |
| Right after | The pool downloaded, decoded, analysed and validated. Unusable songs flagged the same day, so the user can swap them; the user downloads only the leftovers by hand | Sound engine, user |
| Then | Hooks approved and Signatures vetted on the audition page (about 2 min a song, U14). Stems rendered. This year's pool in R2, both laptops synced | User, Sound engine, Backend |
| Before the first rehearsal | The night's plan in Admin (U18); the real-device checks (U19) | User |
| Rehearsals (U27) | Whole shows with this year's pool, the real plan, the tablet, the Wii remote and real phones | Everyone |
| Print date (U28) | **Cards printed**, never the day before; checked with a printed card against the live address | User |
| After the last rehearsal | **Code freeze:** only fixes for what a rehearsal found | All sessions |
| Sat 26 Dec | Set up, run the preflight, sound check | Organizers |
| **Sun 27 Dec** | **The night**; cards sold at the start and during it | |

Rehearsals use the cloud's free daily quota too, so never hold one on the day of the show (see the decisions doc).

## The user's items

The items themselves, with their defaults, are in [open-questions.md](open-questions.md).
- **Now:** U26 (one special card for both special rounds), U27 (rehearsal dates), U28 (print date), U29 (how far "no fallbacks" goes), U13 (the listening pass), U17 (the PDF install script), U16 (the logo library).
- **1 Dec:** the final playlist; then swap any song the quality check flags.
- **When Frontend's proposals are ready:** U30 (the drawers and corner buttons).
- **Before the first rehearsal:** U14 (hooks), U18 (the plan in Admin), U19 (real devices).
- **Any time:** U20 (more Hold and victory music), U12 (the theme pass, not ready yet).

## Risks

- **Song downloads (25 Nov).** YouTube asked for a sign-in because the Mac's traffic went through a VPN. With the VPN off, downloads work (D66); the user downloads only the leftovers. The draft is 151 songs.
- **Hook approval is on the critical path.** A new pool has no playable song until its hooks are approved: about 2 minutes a song, about 3 hours for 86 songs. Prep then runs again in about 30 minutes.
- **Storage:** about 68 MB a song, so about 100 songs fit R2's free 10 GB. The final list will almost surely be under 100 (D80).

- **Disk space:** 12 GB free on 25 Nov; preparing a pool takes about 4 GB, and the stems guard wants 10 GB free. Nothing is deleted (D80).
- **A late playlist change** is possible until the cards are printed (U28), but each change needs its hook approved and the pool re-synced.
- **Hooks are proposals:** on last year's songs the automatic top candidate was within a bar of the real hook in only 26 of 77 songs. The user's approval pass is needed, not optional.
- **The QR domain switch** retires last year's app at that address; nobody uses it (D76). It's in `apps/cloud/docs/deploy-plan.md` (step 7), with an undo.
