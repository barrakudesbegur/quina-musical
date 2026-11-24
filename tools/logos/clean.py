"""Clean up the sponsors' logos for the screens: one PNG and one JPEG XL per sponsor, ready for Admin's upload.

    tools/logos/.venv/bin/python tools/logos/clean.py [--src "temp/Logos empreses externes"] [--out temp/logos-clean]

For each image in --src (the originals are only read):
- a near-white, near-uniform background connected to the edges becomes transparent (a flood fill from the
  border, so white inside the logo stays); any other background is kept and reported;
- the transparent margins are trimmed, a small margin is added back, and the longest side is at most --max px;
- it is written as <slug>.png (the fallback) and <slug>.jxl (cjxl, the user's choice: JPEG XL, never WebP).

Files that are not single logos are skipped (see SKIP), and duplicates keep one copy (see DUPLICATES). The
report (report.md) lists what happened to each file, and contact-sheet.png shows every result on a checkerboard
and on the projector's dark background, for a person to look over before anything is uploaded.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

REPO = Path(__file__).resolve().parent.parent.parent
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}

# Not a single logo: a collage of last year's sponsors, a screenshot, a photo (reported, never processed).
SKIP = {
    "sponsors 2025-3.png": "a collage of last year's sponsors",
    "IMG_1187.jpg": "a photo, not a clean logo (look at it by hand)",
}
SKIP_PATTERNS = [(re.compile(r"^Captura de Pantalla", re.I), "a screenshot")]
# The same sponsor twice: the first name wins, the second is reported.
DUPLICATES = {"croack.jpg": "Croak.png", "fusteria pascual.png": "fusteria-pascual.png"}

BG_TOLERANCE = 48  # sum of |R|,|G|,|B| differences from the border's colour that still counts as background
WHITE_MIN = 225  # every channel of a "near-white" background is at least this
UNIFORM_SHARE = 0.85  # the share of border pixels close to the border's colour for it to count as uniform
MARGIN = 0.04  # added back around the trimmed logo, as a share of its longest side
JXL_DISTANCE = "1.0"  # visually lossless: logos have hard edges
JXL_EFFORT = "7"


@dataclass
class Result:
    source: str
    slug: str | None = None
    notes: list[str] = field(default_factory=list)
    size: tuple[int, int] | None = None
    png_bytes: int = 0
    jxl_bytes: int = 0
    skipped: str | None = None


def slug_of(name: str) -> str:
    stem = Path(name).stem
    ascii_ = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_.lower()).strip("-") or "logo"


def border_pixels(img: Image.Image) -> list[tuple[int, int, int, int]]:
    w, h = img.size
    px = img.load()
    coords = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    return [px[c] for c in coords]


def median_color(pixels: list[tuple[int, int, int, int]]) -> tuple[int, int, int, int]:
    return tuple(sorted(p[i] for p in pixels)[len(pixels) // 2] for i in range(4))  # type: ignore[return-value]


def close(a: tuple[int, ...], b: tuple[int, ...], tol: int = BG_TOLERANCE) -> bool:
    return sum(abs(x - y) for x, y in zip(a[:3], b[:3])) <= tol


def clear_background(img: Image.Image, notes: list[str]) -> Image.Image:
    """Make a near-white background that touches the edges transparent; report any other background."""
    border = border_pixels(img)
    if sum(1 for p in border if p[3] < 16) / len(border) > 0.5:
        notes.append("already transparent")
        return img
    bg = median_color([p for p in border if p[3] >= 16])
    uniform = sum(1 for p in border if close(p, bg)) / len(border)
    if uniform < UNIFORM_SHARE:
        notes.append(f"busy border ({uniform:.0%} uniform): background kept, LOOK")
        return img
    if min(bg[:3]) < WHITE_MIN:
        notes.append(f"coloured background rgb{bg[:3]} kept (a plate may be part of the brand), LOOK")
        return img
    # Flood fill from every edge pixel close to the background, on a copy framed by one background pixel.
    framed = Image.new("RGBA", (img.width + 2, img.height + 2), bg)
    framed.paste(img, (1, 1))
    ImageDraw.floodfill(framed, (0, 0), (255, 255, 255, 0), thresh=BG_TOLERANCE)
    notes.append("white background removed")
    return framed.crop((1, 1, img.width + 1, img.height + 1))


def trim(img: Image.Image, notes: list[str]) -> Image.Image:
    alpha = img.getchannel("A").point(lambda a: 255 if a > 8 else 0)
    box = alpha.getbbox()
    if not box:
        notes.append("EMPTY after cleaning, LOOK")
        return img
    if box != (0, 0, img.width, img.height):
        img = img.crop(box)
        notes.append("trimmed")
    pad = round(max(img.size) * MARGIN)
    out = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (255, 255, 255, 0))
    out.paste(img, (pad, pad))
    return out


def fit(img: Image.Image, max_px: int, notes: list[str]) -> Image.Image:
    if max(img.size) <= max_px:
        if max(img.size) < 200:
            notes.append(f"small source ({img.width}×{img.height}): ask for a bigger logo")
        return img
    scale = max_px / max(img.size)
    return img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.Resampling.LANCZOS)


def checkerboard(size: tuple[int, int], cell: int = 10) -> Image.Image:
    board = Image.new("RGB", size, (235, 235, 235))
    draw = ImageDraw.Draw(board)
    for y in range(0, size[1], cell):
        for x in range((y // cell) % 2 * cell, size[0], cell * 2):
            draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(200, 200, 200))
    return board


def contact_sheet(results: list[Result], out: Path) -> Path:
    done = [r for r in results if r.slug]
    tile, label, cols = 220, 34, 6
    rows = (len(done) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tile * 2 // 2, rows * (tile + label)), (255, 255, 255))
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    draw = ImageDraw.Draw(sheet)
    half = tile // 2
    for i, r in enumerate(done):
        x, y = (i % cols) * tile, (i // cols) * (tile + label)
        logo = Image.open(out / f"{r.slug}.png").convert("RGBA")
        # Left half: on a checkerboard (what is transparent); right half: on the projector's dark background.
        for j, ground in enumerate([checkerboard((half, tile)), Image.new("RGB", (half, tile), (24, 22, 40))]):
            cell = ground.copy()
            thumb = ImageOps.contain(logo, (half - 10, tile - 10))
            cell.paste(thumb, ((half - thumb.width) // 2, (tile - thumb.height) // 2), thumb)
            sheet.paste(cell, (x + j * half, y))
        flag = " !" if any("LOOK" in n or "ask" in n for n in r.notes) else ""
        draw.text((x + 4, y + tile + 4), f"{r.slug}{flag}"[:30], fill=(20, 20, 20), font=font)
        draw.text((x + 4, y + tile + 19), f"{r.size[0]}×{r.size[1]}  {r.jxl_bytes // 1024} KB jxl" if r.size else "", fill=(110, 110, 110), font=font)
    path = out / "contact-sheet.png"
    sheet.save(path, optimize=True)
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--src", default=str(REPO / "temp" / "Logos empreses externes"))
    parser.add_argument("--out", default=str(REPO / "temp" / "logos-clean"))
    parser.add_argument("--max", type=int, default=512, help="the longest side, in px (default 512)")
    args = parser.parse_args()
    src, out = Path(args.src), Path(args.out)
    if not shutil.which("cjxl"):
        print("needs cjxl (brew install jpeg-xl)", file=sys.stderr)
        return 1
    if out.resolve() == src.resolve():
        print("--out must not be --src: the originals are kept as they are", file=sys.stderr)
        return 1
    out.mkdir(parents=True, exist_ok=True)

    results: list[Result] = []
    seen: dict[str, str] = {}
    for path in sorted(src.iterdir(), key=lambda p: p.name.lower()):
        r = Result(source=path.name)
        results.append(r)
        if path.is_dir() or path.suffix.lower() not in IMAGE_EXTS:
            r.skipped = "not an image (folder, .docx, .pdf)"
            continue
        reason = SKIP.get(path.name) or next((why for pattern, why in SKIP_PATTERNS if pattern.search(path.name)), None)
        if reason:
            r.skipped = reason
            continue
        if path.name in DUPLICATES:
            r.skipped = f"duplicate of {DUPLICATES[path.name]}"
            continue
        r.slug = slug_of(path.name)
        if r.slug in seen:
            r.skipped, r.slug = f"same name as {seen[r.slug]}", None
            continue
        seen[r.slug] = path.name
        img = ImageOps.exif_transpose(Image.open(path)).convert("RGBA")
        img = fit(trim(clear_background(img, r.notes), r.notes), args.max, r.notes)
        r.size = img.size
        png, jxl = out / f"{r.slug}.png", out / f"{r.slug}.jxl"
        img.save(png, optimize=True)
        subprocess.run(["cjxl", str(png), str(jxl), "-d", JXL_DISTANCE, "-e", JXL_EFFORT, "--quiet"], check=True)
        r.png_bytes, r.jxl_bytes = png.stat().st_size, jxl.stat().st_size

    sheet = contact_sheet(results, out)
    done = [r for r in results if r.slug]
    lines = [
        "# Cleaned-up sponsor logos",
        "",
        f"From `{src}` (the originals are unchanged), by `tools/logos/clean.py`. {len(done)} logos, each as `<slug>.png`",
        "(the fallback) and `<slug>.jxl`. Look over `contact-sheet.png` (left: transparency, right: the projector's",
        "dark background) before uploading them in Admin. Rows marked LOOK need a person's eye.",
        "",
        "| Source | Result | Size | PNG | JXL | Notes |",
        "|---|---|---|---|---|---|",
    ]
    for r in results:
        if r.slug:
            lines.append(f"| {r.source} | `{r.slug}` | {r.size[0]}×{r.size[1]} | {r.png_bytes // 1024} KB | {r.jxl_bytes // 1024} KB | {'; '.join(r.notes)} |")
        else:
            lines.append(f"| {r.source} | skipped | | | | {r.skipped} |")
    (out / "report.md").write_text("\n".join(lines) + "\n")
    looks = sum(1 for r in done if any("LOOK" in n or "ask" in n for n in r.notes))
    print(f"{len(done)} logos → {out} ({looks} to look at), {len(results) - len(done)} skipped; contact sheet: {sheet}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
