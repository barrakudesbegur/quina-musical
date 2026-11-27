# Card design handoff

Resume the 2026 printed-card design from this file. The card design session (quina-musical-d1) was opened by the user
on 27 Nov 2026 for this task only. The design is final (two options), and this session builds it into `apps/cards`
itself (the user, 27 Nov), before the cards are made on 4–5 Dec (D83). The Orchestrator keeps the decision log: report every user decision to it
the same day.

## Now (28 Nov 2026, night)

- **Two options for the organizers (U212):** «Quadrat amb portades» (A3 · 6, 17 mm covers, the default) and «Apaïsat
  sense portades» (21 × 9.9 cm, black and white). «Apaïsat amb portades» (the mockup's `3x1-h`) was shown, then
  dropped (the user, Q21). The organizers got an image of card #1 in both on blue paper, made with
  [swift/share.swift](swift/share.swift) (each card multiplied onto the paper colour, the same scale), plus a short message in
  Catalan.
- **Since the first push:** the square card's covers are 17 mm (acd8f1a9). «2026» sits on the stamp exactly as last
  year's code put it, and the stamp is drawn over the songs so a cover never hides it (4e4c0fe2). Summercat prints
  «Billie The Vision» (sent to Sound engine).
- **The generator is built and pushed (7092e216):** both layouts behind `CARD_LAYOUT` (`'a3-6'` now, `--layout a4-3`
  proofs B), print names, `pools`, «MOSTRA» samples, `checkLabel` + `heading` per side, tests in
  `apps/show/tests/ui/cards-print.test.ts`. Frontend has apps/cards back and switches the screens to `checkLabel`.
  Sound engine remakes the temporary cards with it. When the organizers pick, delete the other layout.
- **The playlists changed (28 Nov, the user):** pool 1 is alphabetical with Las Ketchup's «Aserejé» (shared with pool
  2) instead of Grupo Arenas; pool 2's #93 is Raffaella's own «Sensational Hits» release and #112 Coyote Dax's original.
  Sound engine renumbers (ids follow the playlist order) and re-prepares; 135 songs, 5 shared.
- **Covers:** Sound engine's audit replaced #122; #112 and #93 came right with the new tracks; #117's «?» disc is the
  real 1996 art. #100's white cover goes on the proof sheet's checklist.
- **#117's print names (Q20, the user: yes):** «Els Segadors Remix» / «Pont Aeri-Chasis», sent to Sound engine for
  print-names.json (Spotify id 6azT5xEjuB5FNW3YC4Ed3i) and to the Orchestrator.
- **Waiting:** U212, the organizers' pick; the 1 Dec playlist, then the real cards on 4–5 Dec (a proof sheet first).

## Decided with the user (all reported to the Orchestrator)

- **Last year's style** (`apps/cards/dist/cards-normal.pdf`): a printed document, black ink, Londrina Solid, the
  double-bordered 3 × 4 grid, the faint logo stamp. Never the app's look (proposal 1 was rejected for that).
- **Headings** (D252): normal side 1 «QUINES 1–5», side 2 «QUINES 6–10» in white on black; special side 1 «DESGRACIAT»,
  side 2 «ESPECIAL» in white on black. The round is «Quina del Desgraciat» (D251). No event name in the heading.
- **GOMET circle** (D253): dashed, 15 mm, «GOMET» in Londrina Light 10.5 pt, letter-spaced, centred.
- **Removed:** the name field, the corn-seeds line. (The year came back into the stamp, D263.)
- **The number** has a faded «#», and always sits next to its QR (the QR encodes it).
- **Layout:** A3, 6 cards a sheet, 149 × 140 mm, long-edge duplex; the backs line up (light-table check on the canvas).
  This holds if the organizers pick covers.
- **A3 · 6 header, option C:** the GOMET circle, the Barrakudes figure, the heading at 38 pt centred in the space between
  (about 5 mm left of the card's centre), «CARTRÓ #n» next to the QR. No branding text.
- **Hard rules:** the QR is never smaller than last year's 45 pt, 16 mm ("it is already hard to scan. it is not
  negotiable"); headings stay at 38 pt ("dont make the text smaller"); song titles fit by shrinking only as needed and
  are never hyphenated.

## Answered on 27 Nov, night (D260–D268, all reported to the Orchestrator)

- Print names (D260): tags off, the main artist only, hand fixes; «Aserejé» for #5 and #128 (D261; the user asks the
  organizers whether #5 by Grupo Arenas was a mistake).
- U212 (D262): not picked yet, A assumed, both coded.
- Q15 (D263): «2026» back above the faint stamp, as last year's code did.
- Q13 / U211 (D264): 399 normal (1–399) and 300 special (400–699), so the first digit tells the type. Empty places repeat
  the last cards as «MOSTRA» samples (both sides, not in cards.json).
- Q3 / U201 (D265): the GOMET circle on both sides.
- Q4 / U198 (D266): «Desgraciat» / «Especial» on the screens.
- Q5 / U52 (D267): last year's coloured paper, a proof sheet first.
- U199 (D268): pools may share songs; one song library, the Pausa and Break music included.
- Q7 dropped: the user asked for the final design now.
- Still a task for the user: the copy shop's price per sheet (colour, duplex, about 160 g/m²) and whether they cut.

## Where things are

- **The canvas** "Quina cards 2026": https://claude.ai/code/artifact/8af06588-238f-4095-8d67-a594d91c7392. It opens on
  the organizers' page («Per als organitzadors»), the link the user shared with them, so keep that page clean and in
  Catalan. Then "Headers (A3 · 6)" (header options, the light-table check), "Layouts (proposal 7)" (every layout
  tried), and Proposals 5 to 1. Every version is kept: never delete a proposal, add a page or mark it superseded or
  rejected.
- **This folder:** [README.md](README.md) is the spec and the comparisons; [mockup.cjs](mockup.cjs) draws any layout
  (`node tools/card-mockup/mockup.cjs <layout…>`); [organizers.cjs](organizers.cjs) makes the organizers' sheet;
  [print-titles.py](print-titles.py) writes [data/songs-print.json](data/songs-print.json);
  [data/sample-cards.json](data/sample-cards.json) holds the sample cards. The PDFs (with album covers) go to `out/`,
  ignored by git.
- **[swift/](swift/)** (macOS): `pdf2png.swift` renders PDF pages, `crop.swift` crops page regions (stack several; set
  `GAP=0` for one), `lighttable.swift` overlays a front page with its flipped back to check the duplex alignment. Run
  them with `swift <file> …`, or compile with `swiftc -O`.

## How this session worked (keep doing it)

- **Mock with the real print pipeline.** Change `mockup.cjs` (react-pdf, as `apps/cards`), build the PDF, check it
  (crop the headers and look), render page images, upload them to the canvas as image boards. Never HTML mockups for
  print.
- **Canvas edits:** the editor re-saves `project/canvas.json` in its own format. Always `read_file` it first and edit
  that saved copy, then publish your new boards with it.
- **Git:** commit from a clean worktree off `origin/main` (the shared checkout's main diverges), with explicit paths,
  then `git fetch && git rebase origin/main` and push the explicit sha. Design files only, never under `apps/cards`:
  its tsconfig (allowJs, no include, rootDir src) would pick up a `.cjs` and break its build.
- **Questions to the user:** the grill-with-docs format in this session (numbered ❓ rounds, ➡️ a recommendation,
  "yes" accepts it); the Orchestrator is checking with the user whether that format applies everywhere. Use the
  glossary's words; boards in English, organizers' content in Catalan.
- **The user's working style:** they iterate fast and decide visually. Show the result after each change, keep every
  earlier version, say plainly when a rule they set conflicts with another (centring vs. the QR and number), and don't
  shrink text or the QR to make something fit.
