#!/usr/bin/env python3
"""Generate the SDG brand logo assets for the exam platform.

Source is a flat-background JPEG (WhatsApp export). This script:

1. Keys the near-white background out to a real alpha channel.
2. Keeps a soft alpha ramp for smooth antialiasing, but borrows edge colours
   from the solid interior instead of dividing them out arithmetically, which
   would amplify JPEG noise into a light "halo" outline.
3. Trims to the artwork bounds and writes a padded, resolution-appropriate PNG.
4. Writes a dark-mode variant: dark ink is remapped to white while the brand
   blue/orange are preserved, so the mark stays legible on a dark surface.

Usage:
    python3 scripts/prepare_logo.py [source.jpg]

Requires Pillow. Output lands in public/assets/.
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "public" / "assets"

DEFAULT_SOURCE = Path.home() / "Downloads" / "WhatsApp Image 2026-10-03 at 10.13.53 PM.jpeg"

# Flat background colour of the source export.
BG = (247, 247, 247)

# Alpha ramp endpoints, measured from the source: JPEG noise around the artwork
# sits at ~2-10 units of distance, the first genuinely covered pixel at ~25.
# Anything between is partial coverage and gets a smooth alpha.
ALPHA_LO = 14
ALPHA_HI = 50

# Output heights in pixels. Each mark is only ever rendered small, so these
# keep it crisp on HiDPI screens without shipping unnecessary weight.
OUTPUT_HEIGHT = 512
HORIZONTAL_HEIGHT = 192
MARK_HEIGHT = 320
FAVICON_HEIGHT = 180


def smoothstep(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def distance_from_bg(pixel: tuple[int, int, int]) -> int:
    return max(abs(pixel[i] - BG[i]) for i in range(3))


def key_out_background(image: Image.Image) -> Image.Image:
    """Replace the flat background with a real alpha channel.

    The alpha ramp is measured from the source. Edge *colours* are not
    recovered arithmetically: dividing by a small alpha amplifies JPEG noise
    and clips channels to white, which is what produces the classic light
    "halo" outline around a logo that has been background-keyed. Instead the
    ramp is kept for smoothness and each partial pixel borrows the colour of
    the nearest fully-covered pixel, so the antialiased border stays on-brand.
    """
    rgb = image.convert("RGB")
    width, height = rgb.size
    src = rgb.load()

    alphas = bytearray(width * height)
    colours: list[tuple[int, int, int] | None] = [None] * (width * height)

    frontier: deque[int] = deque()
    for y in range(height):
        for x in range(width):
            index = y * width + x
            pixel = src[x, y]
            distance = distance_from_bg(pixel)

            if distance <= ALPHA_LO:
                continue  # background: leave fully transparent

            if distance >= ALPHA_HI:
                alphas[index] = 255
                colours[index] = pixel
                frontier.append(index)
                continue

            # Partial coverage: alpha is trustworthy, colour is not.
            alphas[index] = round(smoothstep((distance - ALPHA_LO) / (ALPHA_HI - ALPHA_LO)) * 255)

    # Flood the partial-coverage pixels outward from the solid interior.
    while frontier:
        index = frontier.popleft()
        colour = colours[index]
        if colour is None:
            continue
        x = index % width
        y = index // width
        for ny in range(max(0, y - 1), min(height, y + 2)):
            base = ny * width
            for nx in range(max(0, x - 1), min(width, x + 2)):
                neighbour = base + nx
                if alphas[neighbour] and colours[neighbour] is None:
                    colours[neighbour] = colour
                    frontier.append(neighbour)

    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    dst = out.load()
    for index, colour in enumerate(colours):
        if colour is None:
            continue
        y, x = divmod(index, width)
        dst[x, y] = (*colour, alphas[index])

    return out


def trim(image: Image.Image, padding_ratio: float = 0.04) -> Image.Image:
    """Crop to the visible artwork and re-pad with a proportional margin."""
    alpha = image.getchannel("A")
    # Ignore near-transparent noise when computing the bounds.
    mask = alpha.point(lambda a: 255 if a > 24 else 0)
    bbox = mask.getbbox()
    if not bbox:
        return image
    cropped = image.crop(bbox)

    pad = max(4, int(max(cropped.size) * padding_ratio))
    padded = Image.new("RGBA", (cropped.width + pad * 2, cropped.height + pad * 2), (0, 0, 0, 0))
    padded.paste(cropped, (pad, pad), cropped)
    return padded


def resize_to_height(image: Image.Image, height: int) -> Image.Image:
    if image.height == height:
        return image
    width = max(1, round(image.width * height / image.height))
    return image.resize((width, height), Image.LANCZOS)


def to_dark_variant(image: Image.Image) -> Image.Image:
    """Remap dark ink to white so the mark reads on dark surfaces.

    Brand hues (blue, orange, teal) are left alone. Only near-neutral dark
    pixels are lifted, with a soft ramp so antialiased letterforms do not go
    patchy.
    """
    out = image.copy()
    src = image.load()
    dst = out.load()

    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = src[x, y]
            if a == 0:
                continue

            chroma = max(r, g, b) - min(r, g, b)
            luma = (r * 299 + g * 587 + b * 114) / 1000.0

            # Neutral and dark only: leave anything with real colour alone.
            if chroma > 60 or luma > 110:
                continue

            strength = smoothstep((110.0 - luma) / 110.0)
            dst[x, y] = (
                round(r + (255 - r) * strength),
                round(g + (255 - g) * strength),
                round(b + (255 - b) * strength),
                a,
            )

    return out


def content_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    mask = image.getchannel("A").point(lambda a: 255 if a > 24 else 0)
    return mask.getbbox()


def split_bands(image: Image.Image, min_gap: int = 5) -> list[tuple[int, int]]:
    """Split the stacked lockup into its horizontal bands.

    The source is a vertical lockup: graphic mark on top, wordmark in the
    middle, Arabic descriptor at the bottom. They are separated by fully
    transparent rows, which is all we need to find them.
    """
    px = image.load()
    width, height = image.size

    gaps: list[tuple[int, int]] = []
    run: int | None = None
    for y in range(height):
        inked = any(px[x, y][3] > 40 for x in range(width))
        if not inked:
            if run is None:
                run = y
        else:
            if run is not None and y - run >= min_gap:
                gaps.append((run, y - 1))
            run = None

    bands: list[tuple[int, int]] = []
    cursor = 0
    for start, end in gaps + [(height, height)]:
        if start - cursor >= min_gap:
            bands.append((cursor, start - 1))
        cursor = end + 1
    return bands


def compose_horizontal(image: Image.Image, gap_ratio: float = 0.14) -> Image.Image:
    """Rebuild the vertical lockup as a horizontal one for the navbar.

    Stacked artwork turns to mush at navbar sizes (~40 CSS px). Laying the mark
    beside the wordmark keeps every element legible and is the conventional
    fix for horizontal navigation.
    """
    bands = split_bands(image)
    if len(bands) < 2:
        return image

    mark_box = content_bbox(image.crop((0, bands[0][0], image.width, bands[0][1] + 1)))
    if mark_box is None:
        return image
    mark = image.crop((mark_box[0], bands[0][0] + mark_box[1], mark_box[2], bands[0][0] + mark_box[3]))

    text_top = bands[1][0]
    text_box = content_bbox(image.crop((0, text_top, image.width, image.height)))
    if text_box is None:
        return image
    text = image.crop((text_box[0], text_top + text_box[1], text_box[2], text_top + text_box[3]))

    height = max(mark.height, text.height)
    scale = height / mark.height
    mark = mark.resize((max(1, round(mark.width * scale)), height), Image.LANCZOS)
    text = text.resize(
        (max(1, round(text.width * height / text.height)), height),
        Image.LANCZOS,
    )

    gap = max(4, round(height * gap_ratio))
    width = mark.width + gap + text.width
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.paste(mark, (0, 0), mark)
    canvas.paste(text, (mark.width + gap, 0), text)
    return canvas


def main() -> int:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    if not source.exists():
        print(f"source not found: {source}", file=sys.stderr)
        print("pass the logo path as the first argument", file=sys.stderr)
        return 1

    ASSETS.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as raw:
        keyed = trim(key_out_background(raw))

    horizontal = trim(compose_horizontal(keyed))

    outputs = {
        "logo.png": resize_to_height(keyed, OUTPUT_HEIGHT),
        "logo-horizontal.png": resize_to_height(horizontal, HORIZONTAL_HEIGHT),
        "logo-mark.png": resize_to_height(
            trim(keyed.crop((0, 0, keyed.width, split_bands(keyed)[0][1] + 1))),
            MARK_HEIGHT,
        ),
        # 180px يغطي apple-touch-icon بأعلى كثافة، ويبقي الأيقونة خفيفة.
        "logo-favicon.png": resize_to_height(
            trim(keyed.crop((0, 0, keyed.width, split_bands(keyed)[0][1] + 1))),
            FAVICON_HEIGHT,
        ),
    }

    written: list[Path] = []
    for name, image in outputs.items():
        light_path = ASSETS / name
        image.save(light_path, "PNG", optimize=True)
        written.append(light_path)

        # الأيقونة تعتمد لون العلامة (أزرق/برتقالي) فيقرأها المتصفح على
        # أي خلفية، فلا تحتاج نسخة داكنة.
        if "favicon" in name:
            continue

        dark_path = ASSETS / name.replace(".png", "-dark.png")
        to_dark_variant(image).save(dark_path, "PNG", optimize=True)
        written.append(dark_path)

    for path in written:
        with Image.open(path) as check:
            print(f"{path.relative_to(ROOT)}  {check.size[0]}x{check.size[1]}  {path.stat().st_size // 1024} KB")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())