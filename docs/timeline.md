# Timeline to the night

**The night is Sunday 27 December 2026.** The final playlist arrives on **Tuesday 1 December**. Everything below is planned backwards from those two dates. The orchestrator keeps this page current; sessions plan their queues against it.

**Only the user's dates are dates:** the final playlist (Tue 1 Dec), the cards made on 4–5 Dec if the playlist is ready (D83), and the night (Sun 27 Dec). Rehearsals have no fixed dates (D82): a tech rehearsal when everything feels ready, and maybe a presenters' one a day or two before the night or on the day. Cards are sold only on the night (D71).

## The critical path

The playlist → the pool prepared and checked → the cards made → the hooks → the rehearsals → the night. A song can't change once the cards are printed.

| When | Milestone | Who |
|---|---|---|
| Now | Two pools of 70 (D100, D101). Pool 1 is final (25 Nov): Sound engine re-fetches it and remakes the temporary cards. Pool 2 is being filled by the organizers, then filtered to 70. The double-sided card's design: the user with Frontend (D102) | User, Sound engine, Frontend |
| **Tue 1 Dec** | **Playlists final** (pool 1 already on 25 Nov) | User |
| 1 Dec, first | `data/pools/2026.json` created, its cards at `apps/cards/dist/cards.json`; last year's test cards move to `data/pools/default/cards/`, and every test reads cards through its pool | Sound engine, then Frontend and Backend |
| 1–3 Dec | The pool downloaded, prepared and quality-checked. Unusable songs are flagged at once, so the user can swap them; the user downloads only the leftovers by hand | Sound engine, user |
| **4–5 Dec** | **The cards generated (`npm start -- --pool 2026` in apps/cards), proofed and printed**. No song changes after this | User, Frontend |
| Then | Hooks approved on the audition page (U14), Signatures vetted, stems rendered; the pool in R2 and both laptops synced; the night's plan in Admin (U18); the real-device checks (U19) | User, Sound engine, Backend |
| When ready (D82) | The tech rehearsal: a whole show with this year's pool, the real plan, the tablet, the Wii remote and real phones | User, everyone |
| After the tech rehearsal | **Code freeze:** only fixes for what a rehearsal found. Every deploy changes what the printed QR codes open | All sessions |
| A day or two before, or on the day | Maybe a presenters' rehearsal (D82), without eating the night's cloud quota | Presenters |
| Sat 26 Dec | Set up, run the preflight, sound check | Organizers |
| **Sun 27 Dec** | **The night**; cards sold at the start and during it | |

## The user's items

The items themselves, with their defaults, are in [open-questions.md](open-questions.md).
- **Now:** U34 (the pool size), U13 (the listening pass), U16 (the logo library).
- **1 Dec:** the final playlist; then swap any song the quality check flags, by 3 Dec.
- **4–5 Dec:** make the cards.
- **When Frontend's proposals are on the canvas:** U30 (the drawers and corner buttons).
- **Before the tech rehearsal:** U14 (hooks), U18 (the plan in Admin), U19 (real devices).
- **Any time:** U20 (more Hold and victory music), U12 (the theme pass, not ready yet).

## Risks

- **Song downloads (25 Nov).** YouTube asked for a sign-in because the Mac's traffic went through a VPN. With the VPN off, downloads work (D66); the user downloads only the leftovers. All 76 songs downloaded on 25 Nov with none left for the user; 7 YouTube fallbacks were wrong versions or off-length and were swapped for official uploads (D99).
- **Hook approval is on the critical path.** A new pool has no playable song until its hooks are approved: about 2 minutes a song, about 3 hours for 86 songs. Prep then runs again in about 30 minutes.
- **Storage:** about 68 MB a song, so about 100 songs fit R2's free 10 GB. Two pools are 140 songs (about 9.5 GB) and a third would make 210 (about 14 GB), over the free tier: fine, at a few cents a month. Each set is uploaded as soon as it's ready and pruned after the night (D113).
- **Hook approval doubles or triples:** about 2 minutes a song is about 4.5 hours for 140 songs and 7 for 210. A quick-review mode and one hook per song would make it about 2 hours (U56).

- **The night's length:** first plays at 22 s (D174, D175) put the rounds' end about 9:46 pm, 9:58 pm in the bad case, against a planned 10:00 pm. Little margin left for a late start.
- **Disk space:** 20 GB free on 25 Nov (Sound engine's measure); a set of 70 takes about 6 GB fully prepared, about 18 GB for three. Preparing one set at a time fits; freeing last year's 7.3 GB test cache needs the user's OK (U55). Nothing is deleted (D80).
- **A late playlist change** is possible until the cards are made on 4–5 Dec (D83). The quality check must flag bad songs by 3 Dec, so the swaps fit.
- **Hooks are proposals:** on last year's songs the automatic top candidate was within a bar of the real hook in only 26 of 77 songs. The user's approval pass is needed, not optional.
- **The QR domain switch** retires last year's app at that address; nobody uses it (D76). It's in `apps/cloud/docs/deploy-plan.md` (step 7), with an undo.
