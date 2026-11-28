# Timeline to the night

**The night is Sunday 27 December 2026.** The playlists were made final on **Friday 27 November**, earlier than the planned 1 December (D230). Everything below is planned backwards from the cards and the night. The orchestrator keeps this page current; sessions plan their queues against it.

**Only the user's dates are dates:** the final playlists (Fri 27 Nov), the cards made on 4–5 Dec (D83), and the night (Sun 27 Dec). Rehearsals have no fixed dates (D82): a tech rehearsal when everything feels ready, and maybe a presenters' one a day or two before the night or on the day. Cards are sold only on the night (D71).

## The critical path

The playlists → the repertoire prepared and checked → the cards made → the hooks → the rehearsals → the night. A song can't change once the cards are printed.

| When | Milestone | Who |
|---|---|---|
| **Fri 27 Nov** | **Playlists final**, sorted (the user, D230, D269; earlier than the planned 1 Dec) | User |
| Done (27–28 Nov) | Repertoire 2026 (`data/repertoires/2026.json`, 3cb10aaa; pools became repertoires in D178): one repertoire of 135 songs, two pools of 70 with 5 shared (D268, d6bb94ae) | Sound engine |
| Done (27–28 Nov) | Every song downloaded, checked, renumbered (8e50cd01) and prepared on provisional hooks; in R2 (D248) and deployed (b488bafa) with 699 temporary cards | Sound engine, Backend |
| Done (28 Nov) | The organizers picked «Apaïsat sense portades», the A4 card without covers (D295) | Organizers |
| Before the cards | Last year's test cards move under the default repertoire, and every test reads cards through its repertoire (still `apps/cards/dist/cards.json` today) | Sound engine, then Frontend and Backend |
| **4–5 Dec** | **The cards generated (`npm start -- --repertoire 2026` in apps/cards) in the organizers' layout (D295: A4, three a page, no covers), proofed on a proof sheet (D267) and printed**. No song changes after this | User, Frontend |
| Then | Hooks approved on the audition page (U14, faster with U56), Signatures vetted, stems rendered, pushed to R2 and both laptops synced; the Pausa, break and Hold music into the repertoire (D268); the night's plan in Admin (U18); the real-device checks (U19) | User, Sound engine, Backend |
| **22 Dec** | The user has the Wii remote again (D325): the first test with the real one (U220's pairing, the Mac app's reader, the reconnect, the range); a tech rehearsal includes the remote only from then | User |
| When ready (D82) | The tech rehearsal: a whole show with this year's repertoire, the real plan, the tablet, the Wii remote and real phones | User, everyone |
| After the tech rehearsal | **Code freeze:** only fixes for what a rehearsal found. Every deploy changes what the printed QR codes open | All sessions |
| A day or two before, or on the day | Maybe a presenters' rehearsal (D82), without eating the night's cloud quota | Presenters |
| Sat 26 Dec | Set up, run the preflight, sound check | Organizers |
| **Sun 27 Dec** | **The night**; cards sold at the start and during it | |

## The user's items

The items themselves, with their defaults, are in [open-questions.md](open-questions.md).
- **Now:** U13 (the listening pass), U16 (the logo library).
- **4–5 Dec:** make the cards (D295's layout), after a proof sheet.
- **Before the tech rehearsal:** U14 (hooks; U56 would make it faster), U18 (the plan in Admin), U19 (real devices), U55 (old song data on the laptop).
- **Any time:** U20 (more Hold and victory music), U12 (the theme pass, not ready yet).

## Risks

- **Hook approval is on the critical path.** Every song plays on provisional hooks today, but the user's approval is still needed (U14): about 2 minutes a song, about 4.5 hours for 135 songs. A quick-review mode would make it about 1.4 hours, and one hook per song cuts it further (U56). Prep then runs again, and the changes go up to R2.
- **Storage:** repertoire 2026 takes 8.04 GB in R2 for 135 songs (D248: each file stored once), under the free 10 GB. Past it is fine, at a few cents a month (D113). It's pruned after the night.
- **The night's length:** first plays at 22 s (D174, D175) put the rounds' end about 21:46, 21:58 in the bad case, against a planned 22:00. Little margin left for a late start. With the organizers' order (D192), Sound engine's model puts the end about **21:45**. That counts an 18:00 start, 2.5-minute breaks between rounds, the Descans after the Desgraciat as a 10-minute break, and first plays costing about 6 minutes in Q1 and Q6. It doesn't count Pausa or long Checks. U167 doesn't change it.
- **Disk space:** both final pools are prepared, and the laptop has about 70 GiB free (U55). Two old sets wait for the user's OK to delete: last year's 77 test songs and 2026's data from before the final playlists. Nothing is deleted without it (D80).
- **A late playlist change** is possible until the cards are made on 4–5 Dec (D83). A swapped song must be downloaded, checked, prepared and pushed again first.
- **Hooks are proposals:** on last year's songs the automatic top candidate was within a bar of the real hook in only 26 of 77 songs. The user's approval pass is needed, not optional.
- **The QR domain switch** retires last year's app at that address; nobody uses it (D76). It's in `apps/cloud/docs/deploy-plan.md` (step 7), with an undo.
