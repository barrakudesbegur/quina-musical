"""Prepare an edition's sponsor logos: each one as its original, a transparent logo and the sticker the screens make.

    tools/logos/.venv/bin/python tools/logos/prepare.py data/editions/2026.logos.json [--only id,id…] [--out DIR]

The manifest (data/editions/<year>.logos.json) names, for each sponsor of the plan, the file its logo comes from and
how to clean it. The originals are only read. For each sponsor it writes, under --out (default temp/logos-<year>):

- original/<id>.<ext>: the source file, byte for byte (only its name changes);
- transparent/<id>.png: the logo alone on transparency, trimmed to its pixels, at the source's resolution;
- sticker/<id>.png: the die-cut sticker made from it by packages/ui/components/die-cut.ts (the same code the
  projector and the phones run, through die-cut-cli.ts), so what you see here is what the screens show;
- comparison.png (and comparison-<n>.png pages): original, transparent and sticker side by side for every sponsor;
- report.md: what was done to each logo and what to look at; upload.json: the list `npm run edition -- logos` takes.

How a logo is cleaned (its manifest entry; every field but `id` and `name` is optional):
- `file`: "<source>:<file name>", a source being a folder named in the manifest's `sources`. No file: still missing.
- `crop`: [left, top, right, bottom], fractions of the source (0–1), applied first (a business card's phone numbers,
  a photo's surroundings).
- `background`:
  - "keep": the file is already transparent; only trimmed (the default when its border is transparent);
  - "edges": the background colour is removed where it touches the border, so the same colour inside the logo stays
    (the default for a plain border). The logo's antialiased edge is unblended from the background, not cut, so
    the transparent logo has no halo on a dark ground;
  - "all": the background colour is removed everywhere, as a colour-to-alpha (a logo printed on a coloured box: the
    box goes, the ink stays, each pixel unblended from the box's colour);
  - "light-ink" / "dark-ink": for a box that isn't one colour (a photo, a gradient, a watercolour): the ink is
    whatever is lighter (or darker) than the ground, its opacity ramped on luminance between `luma` [low, high]
    (0–255).
- `mask`: "ellipse": after the background, keep only the ellipse inscribed in the (cropped) image (a round badge).
- `color`: the background colour as "#rrggbb", if the border's median isn't it.
- `tolerance`: how far from the background colour still counts as background (0–1 of the channel range; default .1).
- `ink`: recolours the logo once it's cut out (the user, 28 Nov: logos printed in white on a box are cut out and
  recoloured, so they read on the sticker's white): {"color": "#rrggbb" | "box", "pixels": "all" | "light"}.
  "box" is the removed background's colour, darkened only as far as it needs to read on white (contrast 4.5:1, its
  hue kept); "light" recolours only the whitish pixels and keeps the coloured ones.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps
from scipy import ndimage

REPO = Path(__file__).resolve().parent.parent.parent
DIE_CUT_CLI = Path(__file__).resolve().parent / "die-cut-cli.ts"

TOLERANCE = 0.10  # max channel difference from the background colour that still counts as background
EDGE_BAND = 0.004  # the band unblended round an "edges" cut, as a share of the longer side (at least 2 px)
NOISE = (0.06, 0.45)  # colour-to-alpha: below the first, background (JPEG noise); above the second, fully opaque
STICKER_SIDE = 1024  # the sticker is made from the logo at this longer side (the rim is a share of it)
SMALL_SIDE = 400  # a source whose longer side is under this is reported as small
INK_CONTRAST = 4.5  # a recoloured box colour is darkened until it reads on white at least this well (WCAG AA)


@dataclass
class Logo:
    id: str
    name: str
    file: str | None = None
    crop: list[float] | None = None
    mask: str | None = None
    background: str | None = None
    color: str | None = None
    tolerance: float = TOLERANCE
    luma: list[float] = field(default_factory=lambda: [60.0, 160.0])
    ink: dict | None = None
    note: str | None = None


@dataclass
class Done:
    logo: Logo
    source: Path | None = None
    background: str | None = None
    notes: list[str] = field(default_factory=list)
    source_size: tuple[int, int] | None = None
    size: tuple[int, int] | None = None


# ---------- pixels (floats 0–1, H×W×4 straight alpha) ----------


def hex_rgb(value: str) -> np.ndarray:
    value = value.lstrip("#")
    return np.array([int(value[i : i + 2], 16) / 255 for i in (0, 2, 4)])


def rgb_hex(rgb: np.ndarray) -> str:
    return "#" + "".join(f"{round(float(c) * 255):02x}" for c in rgb)


def border_of(a: np.ndarray) -> np.ndarray:
    return np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])


def border_color(px: np.ndarray) -> np.ndarray:
    b = border_of(px)
    opaque = b[b[:, 3] > 0.5]
    return np.median((opaque if len(opaque) else b)[:, :3], axis=0)


def unblend(rgb: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """Colour-to-alpha: the least opacity that, over `bg`, gives each pixel's colour."""
    up = np.where(rgb > bg, (rgb - bg) / np.maximum(1 - bg, 1e-6), 0)
    down = np.where(rgb < bg, (bg - rgb) / np.maximum(bg, 1e-6), 0)
    return np.clip(np.maximum(up, down).max(axis=2), 0, 1)


def ramp(x: np.ndarray, low: float, high: float) -> np.ndarray:
    t = np.clip((x - low) / max(high - low, 1e-6), 0, 1)
    return t * t * (3 - 2 * t)


def over_bg(rgb: np.ndarray, bg: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """The colour that, at `alpha` over `bg`, gives `rgb` back (the unblended colour)."""
    safe = np.maximum(alpha, 1e-6)[..., None]
    return np.clip(bg + (rgb - bg) / safe, 0, 1)


def remove_color(px: np.ndarray, bg: np.ndarray, tolerance: float, everywhere: bool) -> np.ndarray:
    rgb, alpha0 = px[..., :3], px[..., 3]
    # Everywhere, the tolerance is the noise floor: a box's JPEG noise and texture go, not only its exact colour.
    opacity = ramp(unblend(rgb, bg), max(NOISE[0], tolerance) if everywhere else NOISE[0], NOISE[1])
    if everywhere:
        alpha = opacity
    else:
        near = np.abs(rgb - bg).max(axis=2) < tolerance
        labels, _ = ndimage.label(near)
        touching = np.unique(border_of(labels))
        region = np.isin(labels, touching[touching > 0])
        band = max(2, round(max(px.shape[:2]) * EDGE_BAND))
        edge = ndimage.binary_dilation(region, iterations=band) & ~region
        alpha = np.where(region, 0.0, np.where(edge, opacity, 1.0))
    out = px.copy()
    out[..., :3] = np.where((alpha < 1)[..., None], over_bg(rgb, bg, alpha), rgb)
    out[..., 3] = alpha * alpha0
    return out


def key_luma(px: np.ndarray, low: float, high: float, light: bool) -> np.ndarray:
    level = (px[..., :3] @ np.array([0.2126, 0.7152, 0.0722])) * 255  # luminance (Rec. 709)
    alpha = ramp(level, low, high) if light else 1 - ramp(level, low, high)
    out = px.copy()
    out[..., 3] = alpha * px[..., 3]
    return out


def despeckle(px: np.ndarray) -> np.ndarray:
    """Drop specks a colour key leaves in a JPEG's noise: islands far smaller than any letter."""
    solid = px[..., 3] > 0.1
    labels, n = ndimage.label(solid)
    if n < 2:
        return px
    sizes = ndimage.sum(solid, labels, index=np.arange(1, n + 1))
    floor = max(6, px.shape[0] * px.shape[1] * 0.00001)
    small = np.isin(labels, np.flatnonzero(sizes < floor) + 1)
    out = px.copy()
    out[..., 3] = np.where(small, 0, out[..., 3])
    return out


def contrast_on_white(rgb: np.ndarray) -> float:
    linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    return 1.05 / (float(linear @ np.array([0.2126, 0.7152, 0.0722])) + 0.05)


def readable(rgb: np.ndarray, contrast: float = INK_CONTRAST) -> np.ndarray:
    """The colour, darkened only as far as it takes to read on the sticker's white (its hue kept)."""
    k = 1.0
    while contrast_on_white(rgb * k) < contrast and k > 0:
        k -= 0.01
    return rgb * max(k, 0)


def recolor(px: np.ndarray, color: np.ndarray, which: str) -> np.ndarray:
    out = px.copy()
    rgb = px[..., :3]
    if which == "all":
        weight = np.ones(rgb.shape[:2])
    else:  # the whitish pixels only: light and unsaturated
        light = ramp(rgb.min(axis=2), 0.62, 0.82)
        saturation = rgb.max(axis=2) - rgb.min(axis=2)
        weight = light * (1 - ramp(saturation, 0.10, 0.25))
    out[..., :3] = rgb * (1 - weight[..., None]) + color * weight[..., None]
    return out


def ellipse_mask(px: np.ndarray) -> np.ndarray:
    h, w = px.shape[:2]
    y, x = np.mgrid[0:h, 0:w]
    d = np.hypot((x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2))
    out = px.copy()
    out[..., 3] *= np.clip((1 - d) * min(w, h) / 2 + 0.5, 0, 1)
    return out


def trim(px: np.ndarray) -> np.ndarray | None:
    solid = px[..., 3] > 8 / 255
    if not solid.any():
        return None
    ys, xs = np.nonzero(solid)
    return px[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def to_image(px: np.ndarray) -> Image.Image:
    return Image.fromarray(np.round(np.clip(px, 0, 1) * 255).astype(np.uint8))


# ---------- one logo ----------


def clean(logo: Logo, path: Path, done: Done) -> np.ndarray | None:
    image = ImageOps.exif_transpose(Image.open(path)).convert("RGBA")
    done.source_size = image.size
    px = np.asarray(image).astype(np.float64) / 255
    if logo.crop:
        h, w = px.shape[:2]
        l, t, r, b = logo.crop
        px = px[round(t * h) : round(b * h), round(l * w) : round(r * w)]
        done.notes.append("cropped")
    background = logo.background
    if background is None:
        border = border_of(px)
        background = "keep" if (border[:, 3] < 0.1).mean() > 0.5 else "edges"
    done.background = background
    bg = hex_rgb(logo.color) if logo.color else border_color(px)
    if background in ("edges", "all"):
        px = remove_color(px, bg, logo.tolerance, everywhere=background == "all")
        done.notes.append(f"background {rgb_hex(bg)} removed ({'everywhere' if background == 'all' else 'from the edges'})")
    elif background in ("light-ink", "dark-ink"):
        px = key_luma(px, logo.luma[0], logo.luma[1], light=background == "light-ink")
        done.notes.append(f"{background} keyed between {logo.luma[0]:.0f} and {logo.luma[1]:.0f}")
    elif background != "keep":
        raise ValueError(f"{logo.id}: unknown background {background!r}")
    if logo.mask == "ellipse":
        px = ellipse_mask(px)
        done.notes.append("cut round")
    if background != "keep":
        px = despeckle(px)
    if logo.ink:
        color = readable(bg) if logo.ink.get("color", "box") == "box" else hex_rgb(logo.ink["color"])
        which = logo.ink.get("pixels", "all")
        px = recolor(px, color, which)
        done.notes.append(f"recoloured {'every pixel' if which == 'all' else 'the white'} to {rgb_hex(color)}")
    px = trim(px)
    if px is None:
        done.notes.append("EMPTY after cleaning: LOOK")
        return None
    done.size = (px.shape[1], px.shape[0])
    if max(done.source_size) < SMALL_SIDE:
        done.notes.append(f"small source ({done.source_size[0]}×{done.source_size[1]}): find a bigger one")
    return px


def sticker(transparent: Image.Image, work: Path) -> Image.Image:
    """The die-cut from packages/ui/components/die-cut.ts, at STICKER_SIDE."""
    k = STICKER_SIDE / max(transparent.size)
    logo = transparent.resize((max(1, round(transparent.width * k)), max(1, round(transparent.height * k))), Image.Resampling.LANCZOS)
    raw_in, raw_out = work / "in.rgba", work / "out.rgba"
    raw_in.write_bytes(logo.tobytes())
    result = subprocess.run(
        ["node", str(DIE_CUT_CLI), str(raw_in), str(logo.width), str(logo.height), str(raw_out)],
        check=True, capture_output=True, text=True,
    )
    size = json.loads(result.stdout)
    return Image.frombytes("RGBA", (size["width"], size["height"]), raw_out.read_bytes())


# ---------- the comparison sheet ----------

TILE_W, TILE_H, LABEL_H, GAP = 240, 170, 40, 6
NAVY = (22, 28, 64)  # the projector's ground


def checker(w: int, h: int, cell: int = 10) -> Image.Image:
    # Tinted light and dark squares: leftover white or grey shows on both, a halo on the dark ones.
    board = Image.new("RGB", (w, h), (206, 226, 246))
    draw = ImageDraw.Draw(board)
    for y in range(0, h, cell):
        for x in range((y // cell) % 2 * cell, w, cell * 2):
            draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(92, 102, 132))
    return board


def framed(image: Image.Image | None, ground: Image.Image, text: str | None = None, font=None) -> Image.Image:
    cell = ground.copy()
    if image is not None:
        thumb = ImageOps.contain(image.convert("RGBA"), (cell.width - 16, cell.height - 16), Image.Resampling.LANCZOS)
        cell.paste(thumb, ((cell.width - thumb.width) // 2, (cell.height - thumb.height) // 2), thumb)
    elif text:
        ImageDraw.Draw(cell).text((12, cell.height // 2 - 8), text, fill=(150, 40, 40), font=font)
    return cell


def comparison(rows: list[tuple[Done, Image.Image | None, Image.Image | None, Image.Image | None]], out: Path, per_page: int = 15) -> list[Path]:
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14)
        small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 12)
    except OSError:
        font = small = ImageFont.load_default()
    cols = 3
    cell_w = 3 * TILE_W + 2 * GAP
    cell_h = TILE_H + LABEL_H
    head = 30

    def page(items, title: str) -> Image.Image:
        nrows = (len(items) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell_w + (cols + 1) * 24, head + nrows * (cell_h + 18) + 12), (246, 244, 238))
        draw = ImageDraw.Draw(sheet)
        draw.text((24, 8), title, fill=(40, 40, 40), font=font)
        for i, (done, original, transparent, stuck) in enumerate(items):
            x = 24 + (i % cols) * (cell_w + 24)
            y = head + (i // cols) * (cell_h + 18)
            light = Image.new("RGB", (TILE_W, TILE_H), (255, 255, 255))
            sheet.paste(framed(original, light, "no logo yet", font), (x, y))
            sheet.paste(framed(transparent, checker(TILE_W, TILE_H)), (x + TILE_W + GAP, y))
            sheet.paste(framed(stuck, Image.new("RGB", (TILE_W, TILE_H), NAVY)), (x + 2 * (TILE_W + GAP), y))
            look = any("LOOK" in n or "small" in n for n in done.notes) or not done.source
            draw.text((x, y + TILE_H + 4), f"{done.logo.name}  ·  {done.logo.id}{'  !' if look else ''}", fill=(20, 20, 20), font=font)
            info = f"{done.background or 'missing'}"
            if done.source_size:
                info += f"  ·  source {done.source_size[0]}×{done.source_size[1]}"
            draw.text((x, y + TILE_H + 22), info, fill=(110, 110, 110), font=small)
        return sheet

    title = "original  ·  transparent (on light and dark squares)  ·  sticker (on the projector's navy)"
    whole = page(rows, title)
    paths = [out / "comparison.png"]
    whole.save(paths[0], optimize=True)
    for n, start in enumerate(range(0, len(rows), per_page), 1):
        path = out / f"comparison-{n}.png"
        page(rows[start : start + per_page], f"{title}  ·  page {n}").save(path, optimize=True)
        paths.append(path)
    return paths


# ---------- main ----------


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("manifest")
    parser.add_argument("--out")
    parser.add_argument("--only", help="comma-separated sponsor ids (the comparison then shows only these)")
    args = parser.parse_args()
    manifest_path = Path(args.manifest)
    manifest = json.loads(manifest_path.read_text())
    sources = {key: (REPO / folder) for key, folder in manifest["sources"].items()}
    out = Path(args.out) if args.out else REPO / "temp" / f"logos-{manifest['edition']}"
    for folder in sources.values():
        if out.resolve() == folder.resolve():
            print("--out must not be a source folder: the originals are kept as they are", file=sys.stderr)
            return 1
    if not shutil.which("node"):
        print("needs node (the sticker is made by packages/ui/components/die-cut.ts)", file=sys.stderr)
        return 1
    only = set(args.only.split(",")) if args.only else None
    logos = [Logo(**entry) for entry in manifest["logos"]]
    unknown = (only or set()) - {l.id for l in logos}
    if unknown:
        print(f"not in the manifest: {', '.join(sorted(unknown))}", file=sys.stderr)
        return 1
    for sub in ("original", "transparent", "sticker"):
        (out / sub).mkdir(parents=True, exist_ok=True)

    rows = []
    report = [f"# Sponsor logos {manifest['edition']}", "", f"From `{manifest_path}`. Folders: original/, transparent/, sticker/.", ""]
    upload = []
    with tempfile.TemporaryDirectory() as tmp:
        for logo in logos:
            if only and logo.id not in only:
                continue
            done = Done(logo)
            original = transparent = stuck = None
            if logo.file:
                key, _, name = logo.file.partition(":")
                path = sources[key] / name
                if not path.is_file():
                    done.notes.append(f"source file not found: {logo.file}: LOOK")
                else:
                    done.source = path
                    for old in (out / "original").glob(f"{logo.id}.*"):
                        old.unlink()
                    ext = (path.suffix or "." + (Image.open(path).format or "img")).lower()
                    shutil.copyfile(path, out / "original" / f"{logo.id}{ext}")
                    original = ImageOps.exif_transpose(Image.open(path)).convert("RGBA")
                    px = clean(logo, path, done)
                    if px is not None:
                        transparent = to_image(px)
                        transparent.save(out / "transparent" / f"{logo.id}.png", optimize=True)
                        stuck = sticker(transparent, Path(tmp))
                        stuck.save(out / "sticker" / f"{logo.id}.png", optimize=True)
                        upload.append({"id": logo.id, "logoFile": f"{logo.id}.png"})
            else:
                done.notes.append("no logo yet")
            if logo.note:
                done.notes.append(logo.note)
            rows.append((done, original, transparent, stuck))
            source = f"`{logo.file}`" if logo.file else "—"
            size = f"{done.source_size[0]}×{done.source_size[1]} → {done.size[0]}×{done.size[1]}" if done.size and done.source_size else ""
            report.append(f"- **{logo.name}** (`{logo.id}`): {source} {size}. {'; '.join(done.notes)}.")
            print(f"{logo.id:28} {done.background or '-':10} {'; '.join(done.notes)}")

    paths = comparison(rows, out)
    if not only:
        (out / "report.md").write_text("\n".join(report) + "\n")
        (out / "upload.json").write_text(json.dumps({"sponsors": upload}, indent=2) + "\n")
    print(f"\n{len(rows)} sponsors, {sum(1 for r in rows if r[2] is not None)} logos → {out}\n{paths[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
