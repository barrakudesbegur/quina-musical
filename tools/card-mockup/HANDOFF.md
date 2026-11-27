# Card design handoff

Resume the 2026 printed-card design from this file. The card design session (quina-musical-d1) was opened by the user
on 27 Nov 2026 for this task only. When the design is final, the spec goes to Frontend, who builds it into `apps/cards`
before the cards are made on 4–5 Dec (D83). The Orchestrator keeps the decision log: report every user decision to it
the same day.

## Now (27 Nov 2026, night)

- **Waiting on the organizers.** The user sent them an A3 sheet with last year's card and two options, each at real
  size (`out/cartrons-2026-opcions.pdf`, made by [organizers.cjs](organizers.cjs); also on the canvas's organizers page):
  - **Option 1, covers in colour:** the A3 · 6 card, 149 × 140 mm, header option C (`a3-6-gomet-nino-between`);
  - **Option 2, no covers, black and white:** the 21 × 9.9 cm card, 3 per A4, as the organizers saw before, without
    covers, with 16 pt titles (`3x1-h-bw`). "The one we agreed before" is my reading of the user's words, and I told
    them; if they meant option C without covers, draw that instead.
- **Next:** draw the organizers' pick on all four sides, settle the open questions below, then send Frontend the final
  spec (README's tables, the four sides, the rules) with the generator's changes listed: 6 or 3 a sheet, amounts,
  covers, the header, the fit, the duplex.

## Decided with the user (all reported to the Orchestrator)

- **Last year's style** (`apps/cards/dist/cards-normal.pdf`): a printed document, black ink, Londrina Solid, the
  double-bordered 3 × 4 grid, the faint logo stamp. Never the app's look (proposal 1 was rejected for that).
- **Headings** (D252): normal side 1 «QUINES 1–5», side 2 «QUINES 6–10» in white on black; special side 1 «DESGRACIAT»,
  side 2 «ESPECIAL» in white on black. The round is «Quina del Desgraciat» (D251). No event name in the heading.
- **GOMET circle** (D253): dashed, 15 mm, «GOMET» in Londrina Light 10.5 pt, letter-spaced, centred.
- **Removed:** the name field, the corn-seeds line, the year in the background stamp.
- **The number** has a faded «#», and always sits next to its QR (the QR encodes it).
- **Layout:** A3, 6 cards a sheet, 149 × 140 mm, long-edge duplex; the backs line up (light-table check on the canvas).
  This holds if the organizers pick covers.
- **A3 · 6 header, option C:** the GOMET circle, the Barrakudes figure, the heading at 38 pt centred in the space between
  (about 5 mm left of the card's centre), «CARTRÓ #n» next to the QR. No branding text.
- **Hard rules:** the QR is never smaller than last year's 45 pt, 16 mm ("it is already hard to scan. it is not
  negotiable"); headings stay at 38 pt ("dont make the text smaller"); song titles fit by shrinking only as needed and
  are never hyphenated.

## Open with the user (asked in the grill-with-docs format, each with a recommendation)

- Q15: «2026» back into the faint stamp (nothing else on the A3 · 6 card names the edition). Recommended: yes.
- Q13: 402 normal cards (a multiple of 6), 300 special: 117 A3 sheets. Recommended: 402.
- Q3 (U201): the GOMET circle on both sides. Recommended: both.
- Q4 (U198): the special card's label on screens during the Check is the printed word, «Desgraciat» / «Especial».
- Q5 (U52): last year's coloured paper (blue normal, pink special), with a proof sheet first.
- Q6: clean print titles on paper and screens ([print-titles.py](print-titles.py); 20 of 136 change, #90 by hand).
  If yes, Sound engine owns the data field.
- Q7: the design final by 1 Dec (Frontend: about 2 days of building plus a proof round).
- A task for the user: ask the copy shop the price per sheet (colour, duplex, about 160 g/m²) for A4, A3 and SRA3, and
  whether they cut.
- Sound engine offered a list of compilation covers (wrong artwork, e.g. #1 «Aserejé» shows «Ritmo latino»).

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
