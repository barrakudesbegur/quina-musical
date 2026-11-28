# Sponsor logos: preparing them before the event

Every sponsor shows on the projector and the phones as a sticker (D309). The screens show the sticker files made here,
all at one common scale (D328). For the organizers' Drive, each logo is kept three ways (D320).

`prepare.py` turns each sponsor's logo file into three files:
- **original:** the file as it came;
- **transparent:** the logo alone on transparency, with no background, not even inside letters;
- **sticker:** the white die-cut sticker the screens show. It's made by `packages/ui/components/die-cut.ts` through
  `die-cut-cli.ts`, at the common scale.

It also makes two sheets for a person to check them. The edition's list of logos, and how each is cleaned, lives in
`data/editions/<year>.logos.json` (the manifest). The logo files themselves never go in git (D307).

## Set up once

From the repo root, with `uv` and Node installed:

```sh
uv venv --python /opt/homebrew/bin/python3.13 tools/logos/.venv
uv pip install --python tools/logos/.venv/bin/python -r tools/logos/requirements.txt
```

Tests: `tools/logos/.venv/bin/python -m unittest discover -s tools/logos`.

## For each edition

1. **Collect the files.**
   - The organizers' Drive folder `Col·laboradors/Logos` goes in `temp/`, under a folder named for the download.
   - Last year's logo stands in when a sponsor sent none this year (D322).
   - Logos found online go in `temp/logos-<year>/candidates/<sponsor id>/`, each named after its source (website,
     Facebook…). Write down where each came from, and have the organizers confirm each find.
   - `temp/` is git-ignored: keep the files there.
2. **The sponsors come first:** every business marked «Si» in the organizers' sheet is a sponsor in
   `data/editions/<year>.plan.json`. See `apps/admin/docs/sponsor-sheet.md`, including its privacy rules.
3. **The manifest:** `data/editions/<year>.logos.json` names its source folders (`sources`), and has one entry per
   sponsor of the plan, with the same `id` and `name`.
   - `file` is `"<source>:<file name>"`; leave it out while the logo is missing.
   - Every field is described at the top of `prepare.py`.
4. **Run it:** `npm run logos -- data/editions/<year>.logos.json`.
   - The output goes to `temp/logos-<year>/`, rewritten on every run.
   - While tuning a few logos, add `--only id,id --out <a scratch folder>`.
5. **Check:**
   - `comparison.png` shows each sponsor's original, transparent logo and sticker. The transparent one sits on tinted
     squares, so any white left over shows.
   - `stickers-together.png` shows every sticker at the common scale on the projector's navy: rims and sizes should
     look even.
   - `report.md` lists what was done to each logo and what to look at.
6. **Fix by hand when the tool can't:** edit in ArtCraft (or any image editor), save as
   `temp/logos-<year>-edited/<id>.png`, and point the entry at it: `"file": "edited:<id>.png"`. The sticker is then
   made from your file.
7. **Deliver:**
   - Copy `original/`, `transparent/` and `sticker/` to the organizers' Drive.
   - The stickers reach the plan through `npm run edition -- logos`. It's being changed to upload the sticker files,
     all shrunk by one common factor (D328). Tell the Orchestrator before any upload: it's a cloud write.

## Which settings for which logo

| The logo | The entry |
|---|---|
| a PNG already on transparency | nothing (`keep` is the default when the border is transparent) |
| on a plain white or light background | nothing (`edges` is the default): the background goes, and the holes inside letters too |
| no white anywhere in the design | `"background": "all"`: every white goes, the drawing's included |
| white lettering on a coloured box (D321) | `"background": "all", "ink": {"color": "box"}`: the box goes, and the lettering takes the box's colour, darkened until it reads on white |
| on a box that isn't one colour (a photo, a gradient) | `"light-ink"` or `"dark-ink"` with `"luma": [low, high]`, plus `ink` for white lettering |
| white letters outlined in a colour | `"holes": 0`, or `"keepWhite": [[l, t, r, b]]` round only those letters |
| a drawing whose white is part of it (a face) | a lower `"holes"` (e.g. `0.008`) |
| an address, a phone number, a person's name, a social handle | `"crop"`: none of these ever shows on screen |
| a round badge in a photo | `"crop"` round it and `"mask": "ellipse"` |
| the sticker's outline has dips | `"sticker": {"reach": 0.18}` (up to `0.35`) |
| an open shape that should close (a circle drawn with a gap) | `"sticker": {"shape": "convex"}` |
| a pale logo (cream, light gold) | `"ink": {"color": "#8c6a2c"}`, or another dark tone of its colour |

The common scale is set by `STICKER_AREA`, `STICKER_RIM` and `STICKER_ELONGATION` in `prepare.py`. Every sticker gets
the same rim in pixels. Each sticker's white shape gets about the same area, and a long logo a little more, so its
letters don't get tiny.

## A logo that arrives later

The plan accepts a sponsor without a logo: it shows as a plate with the business's name. To give it a logo, add it to
the manifest, run the tool and upload as above. A logo added in Admin on the night will need its sticker made the same
way; that's in the build queue with D328.
