# Status

One screen: where each area stands, what's blocked, and what waits on the user. Written by the orchestrator from each handoff's "Now" block; the detail is in the handoffs. Dates are in [timeline.md](timeline.md), and the user's items (U1, U2…) in [open-questions.md](open-questions.md).

**Unverified (28 Nov, after the user's realistic test went badly):** this page lists what was deployed and what the sessions reported, not what was checked against the boards and requirements. The sessions' «What's left» sections and the next orchestrator's check replace it. **Updated:** 2026-11-28. **The night:** Sun 27 Dec. **The playlists:** final since Fri 27 Nov (D230, D269). The cards are made on 4–5 Dec (D83); rehearsals have no fixed dates (D82).

## The critical path

| Step | State |
|---|---|
| Card type per round, every screen and the cloud | **Done** |
| The Desgraciat round: engine, cloud and screens | **Done**, as «Quina del Desgraciat» (D251) |
| The playlists | **Done (27–28 Nov):** final (D230, D269). One repertoire of 135 songs: pool 1 has 70, pool 2 has 70, 5 of them shared (D268, d6bb94ae) |
| The repertoire downloaded, checked and prepared | **Done (27–28 Nov):** every song downloaded and checked, renumbered in playlist order (3cb10aaa, 8e50cd01), with clean print names (D260, 0800e5e8). It plays on provisional hooks |
| Hooks approved | Waits on the user (U14); U56 would make it faster. Placeholder voices until the user's recordings |
| The repertoire in R2, deployed | **Done (28 Nov):** R2 by content (D248): manifests/2026.json, 8.04 GB. Last deploy b488bafa, with 699 temporary cards and the covers. Push again when hooks, stems or voices change |
| QR domain switched | **Done (25 Nov)** |
| The card generator | Both layouts built (7092e216, acd8f1a9, 4e4c0fe2); the organizers picked «Apaïsat sense portades» (D295), the default; the A3 layout stays for a test on the night |
| Cards made | **4–5 Dec (D83)**, in D295's layout, after a proof sheet (D267) |
| Rehearsals | **No fixed dates (D82).** The realistic run's plan is on quina-dev; its start time waits on U204 |

## By area

| Area | Now | Next | Waiting on the user |
|---|---|---|---|
| **Sound engine** ([handoff](../apps/show/docs/HANDOFF.md)) | Important tasks only. Idle: the renumbered 2026 is prepared, in R2 and deployed; D268 is complete (d6bb94ae) | The Pausa, break and Hold music into the repertoire (D268's part C), designed with Backend before the rehearsals; durable cover fixes | U14, U56, U55, U13, U205, U206, U166, U173, U176–U178 |
| **Frontend** ([handoff](../packages/ui/HANDOFF.md)) | The user's comment list; the projector's end screen (board Projector-Final); the Celebration-prize proposals (D242). apps/cards is Frontend's again | The phone drum's jank; the canvas redraw; the screens switch to `checkLabel` | U206, U207, U157/U158, U169, U173, U177–U179, U181, U188, U193, U196, U197, U202, U203, U12 |
| **Backend** ([handoff](../apps/cloud/docs/HANDOFF.md)) | Queue empty. The realistic run's plan is up on quina-dev (D235); 2026 in R2 and deployed (b488bafa) | Upload the plan with `--start` once U204 is relayed; push to R2 when Sound engine changes media | U204, U63–U65, U75, U19 |
| **Card design** ([handoff](../tools/card-mockup/HANDOFF.md)) | Done: the organizers picked the A4 card (D295); the A3 layout stays for a test | The A4 layout as the default, the proof sheet, then the cards on 4–5 Dec | — |
| **Orchestrator** ([handoff](HANDOFF.md)) | D141–D272 logged | Relay the user's answers | U36–U39, U194–U197, U214 |

## Recently done (27–28 Nov)

- The playlists made final, and one repertoire with shared songs (D230, D268, D269): 135 songs, renumbered, clean print names.
- Repertoire 2026 in R2 by content (D248) and deployed (b488bafa), with 699 temporary cards and covers.
- The card design: last year's style, two options in the generator (D250–D272).
- The realistic run's plan on quina-dev (D235): D192's order, 96 example prizes, 58 sponsors.
- The installable player (D221–D223); the drum matching on the phone (D237, D249).
- The console: the sold cards and the two-level lock (D234), the sound test (D229), the auto-sound switches (D237).
- The design system in code (D211), with cascade layers.
