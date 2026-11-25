# Loading the sponsor sheet into Admin

For the agent, or the person, who loads the organizers' sponsor sheet ("Col·laboradors") into the night's Game plan. It covers what each column means, what goes into the plan, and what never does. Written by Platform with Frontend (Admin is Frontend's), 2026-11-25.

## The privacy rule first

The plan is **public**: every phone gets its sponsors, and each round's prizes once they're revealed. Only sponsors' names and logos (and the prizes you write by hand) go in.

- **Never copy into the plan, a commit, a message or a log:** who holds each prize (the team members' names), the delivery state, the to-dos, or the Instagram posts.
- **The sheet and its CSV stay out of git.** They live in `temp/`, which is ignored. Don't move them anywhere else in the repo.
- This guide names no business and no person, and neither should anything you write from it.

## The sheet

- **This year's (2026, work in progress):** `temp/wip prizes/Col·laboradors - Full 1.csv`, and the `.xlsx` beside it.
- **Last year's (2025, final):** `temp/info-from-2025/Colaboradors - Full 1.csv`. Reference only (see below).

**Layout, top to bottom:**
1. A row that explains each column (it starts with "EXEMPLE").
2. The header row (below).
3. Category rows: a name in capitals and nothing else in the row. They group the businesses under them. In 2026: RESTAURACIÓ, ALIMENTACIÓ, "SALUT, BELLESA, BENESTAR", BOTIGUES I COMERÇOS, IMMOBILIÀRIES, HOTELS.
4. One row per business. Businesses that haven't confirmed yet are listed too.

**The 2026 columns:**

| Header | What it says | Values | Admin reads it? | Where it goes |
|---|---|---|---|---|
| (first, unnamed) | nothing | empty | no | — |
| COMERÇ | the business | its name | yes | the sponsor's `name` |
| PARTICIPA (new in 2026) | whether it takes part | `Si`, `Esperant` (waiting for an answer), `No`, or empty | yes | `Si`: ticked in the importer. `Esperant` or empty: listed unticked. `No`: hidden |
| COL·LABORACIÓ | what it gives | an item, a voucher, or just an amount of money (`N €`) | yes, as a suggestion | kept only in that browser, and suggested when a prize's sponsor is picked. Never written into the plan by itself |
| LOGO | its logo is received and saved in the organizers' Drive | `OK` or empty | yes (shown) | upload the file to Admin before the night (below) |
| ENTREGA | whether it was delivered | `OK`, `Pendent nosaltres`, `Pendent ells`, or empty | **never** | — |
| QUI HO TE | who keeps it: a team member, or `BANC` for money in the bank | names, or `BANC` | **never** (people's names) | — (but `BANC` tells you it's a money donor: read it by eye, never copy the names) |
| FER | what's still to do (pick-ups, times) | free text | **never** | — |
| PENJAT INSTA | which Instagram post thanked it | `1` to `6` | **never** | — |

**The 2025 sheet** has COMERÇ, COL·LABORACIÓ, LOGO, ENTREGA, MEMBRE (who keeps it, like QUI HO TE), FER and PENJAT INSTA (`publi 1` to `publi 6`). It has **no PARTICIPA**, so Admin's importer refuses it ("No trobo la fila de capçalera"). Use it only to compare: who gave last year, and the categories (2025 had FARMÀCIES and BOTIGUES).

## The main route: Admin's importer

It needs a browser and an organizer's Google login (Admin is behind Cloudflare Access).

1. **Export the sheet as CSV:** in Google Sheets, File → Download → Comma-separated values (the current sheet). The `.xlsx` can be saved as CSV too.
2. **In Admin** (`/admin/` on the cloud: `quina-dev.barrakudesbegur.org` until the QR domain moves), open **Preparació** → **Importar patrocinadors del full** → **Fitxer CSV**.
3. **Check the table:**
   - each business shows its category, what it gives and whether there's a logo;
   - the ones that take part are ticked; `esperant` and `sense resposta` (no answer) are not: tick them only once the organizers confirm;
   - `ja hi és` means it's already a sponsor in the plan (matched by name), so it isn't added twice.
4. **Afegir N patrocinadors**, then **save the plan**. Nothing is saved until you do ("Recorda desar").
5. **Logos:** every business with LOGO = `OK` needs its file uploaded in Preparació (**Pujar logos a la biblioteca**, then each sponsor's **Biblioteca de logos**; PNG or JPEG, Admin makes the JPEG XL). A sponsor without a logo shows on the projector as its name on a plate. That's fine, but if a logo exists, upload it before the night.
6. **Prizes:** in each round's Line and Quina bundles, pick the prize's sponsor. Admin suggests what that sponsor gives (from COL·LABORACIÓ); write the prize's title as the presenters will read it.

## Money donors

Rows with QUI HO TE = `BANC`, usually with just an amount in COL·LABORACIÓ (`N €`), give money, not a prize.

- **Add them as sponsors like the others, and link them to no prize.** Don't drop them: every sponsor is to be thanked.
- They show on the projector before the show and in the closing credits, and on phones, like any sponsor.
- Checked end to end on 2026-11-25:
  - the plan accepts a sponsor that no prize refers to;
  - phones get every sponsor;
  - the projector lists every sponsor in the plan, not only the prizes' ones.

## Fallback: the plan's JSON (an agent without a browser)

An agent that can't log in to Admin writes the plan's JSON instead, and a person pastes it into Admin → **Importar i exportar**, then saves. The format, its rules and its errors are in [`../README.md`](../README.md) › "The plan's JSON (for an AI agent)". For the sponsors:

- **One sponsor per business that takes part,** money donors included: `{ "id": "…", "name": "…", "logo": null }`.
  - `id`: lowercase letters, digits and dashes, unique. Prizes refer to it.
  - `name`: COMERÇ, as shown on screen.
  - `logo`: `null`. Logos are uploaded in Admin afterwards.
- **Categories and what each one gives are not plan fields.** Use COL·LABORACIÓ only to write prizes (`title`, `detail`, `sponsorId`) that the organizers have confirmed.
- **Read only** COMERÇ, PARTICIPA, COL·LABORACIÓ and LOGO, plus QUI HO TE = `BANC` to spot money donors. Nothing from the other columns goes anywhere.

## Before the night

- Every business that takes part is a sponsor in the plan, money donors included.
- Every LOGO = `OK` has its file uploaded. Check the projector's before-the-show strip, which shows the logos.
- No personal data in the plan: export it (Admin → **Importar i exportar**) and search it for the team members' names. There must be none.
