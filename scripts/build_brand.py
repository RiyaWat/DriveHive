"""
One-off brand asset pipeline for DriveHive.

Reads the user-supplied logo JPEG and produces three brand assets:

  - brand/drivehive-logo.png   — full logo (car + wordmark), yellow car, black text,
                                  transparent background
  - brand/drivehive-mark.png   — just the car silhouette, yellow on transparent
  - brand/drivehive-mark-black.png — car silhouette in black for use on yellow
  - favicon.ico                 — square icon derived from the mark
"""
from PIL import Image
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "frontend" / "public" / "brand" / "drivehive-logo.jpeg"
OUT_DIR = SRC.parent
PUBLIC = SRC.parent.parent

# Target brand colors
YELLOW = (250, 204, 21)   # #FACC15
INK = (10, 10, 10)         # near-black

def recolor(img: Image.Image, swap_to_yellow=True) -> Image.Image:
    """
    Walk every pixel.
      - Near-white pixels → fully transparent
      - Orange pixels     → yellow (or black if swap_to_yellow=False)
      - Black/dark pixels → near-black, fully opaque
      - Anything else     → keep colour, alpha=255
    """
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    target = YELLOW if swap_to_yellow else INK
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            # White-ish background → transparent
            if r > 240 and g > 240 and b > 240:
                px[x, y] = (255, 255, 255, 0)
                continue
            # Orange-ish car (high R, mid G, low B)
            if r > 180 and 80 < g < 200 and b < 120:
                # Anti-alias-friendly: keep luminance, replace hue with target
                # Blend toward target by 90%
                nr = int(target[0] * 0.95 + r * 0.05)
                ng = int(target[1] * 0.95 + g * 0.05)
                nb = int(target[2] * 0.95 + b * 0.05)
                px[x, y] = (nr, ng, nb, 255)
                continue
            # Dark text — clamp to near-black
            if r < 80 and g < 80 and b < 80:
                px[x, y] = (*INK, 255)
                continue
            # Mid grey (anti-aliased edges) — keep as is, fully opaque
            px[x, y] = (r, g, b, 255)
    return img


def trim(img: Image.Image) -> Image.Image:
    """Crop to the non-transparent bounding box."""
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def find_car_bottom(img: Image.Image) -> int:
    """Scan the image top-to-bottom and return the last Y row that contains
    orange pixels (i.e. the bottom of the car silhouette).
    """
    px = img.convert("RGB").load()
    w, h = img.size
    last = 0
    for y in range(h):
        # sample every 8 px horizontally for speed
        for x in range(0, w, 8):
            r, g, b = px[x, y]
            if r > 180 and 80 < g < 200 and b < 120:
                last = y
                break
    return last


def main():
    src = Image.open(SRC).convert("RGBA")
    w, h = src.size
    print(f"Source size: {w}x{h}")

    # Find where the car silhouette actually ends so we don't include the
    # built-in wordmark or tagline in the "mark only" crop.
    car_bottom = find_car_bottom(src)
    # Add a tiny breathing margin (1.5% of height)
    split_y = min(h, car_bottom + int(h * 0.015))
    print(f"Detected car bottom at y={car_bottom}; cropping mark at y={split_y}")
    car_only = src.crop((0, 0, w, split_y))
    full = src

    # Yellow recoloured full logo (transparent bg)
    full_yellow = trim(recolor(full.copy(), swap_to_yellow=True))
    full_yellow.save(OUT_DIR / "drivehive-logo.png", optimize=True)
    print(f"Saved drivehive-logo.png  {full_yellow.size}")

    # Yellow car-only mark
    mark_yellow = trim(recolor(car_only.copy(), swap_to_yellow=True))
    mark_yellow.save(OUT_DIR / "drivehive-mark.png", optimize=True)
    print(f"Saved drivehive-mark.png  {mark_yellow.size}")

    # Black car-only mark (for use ON yellow backgrounds / favicons)
    mark_black = trim(recolor(car_only.copy(), swap_to_yellow=False))
    mark_black.save(OUT_DIR / "drivehive-mark-black.png", optimize=True)
    print(f"Saved drivehive-mark-black.png  {mark_black.size}")

    # Favicon — square, yellow car on black hex background
    fav_size = 256
    canvas = Image.new("RGBA", (fav_size, fav_size), (10, 10, 10, 255))
    mw, mh = mark_yellow.size
    scale = min(fav_size * 0.78 / mw, fav_size * 0.78 / mh)
    nw, nh = int(mw * scale), int(mh * scale)
    resized = mark_yellow.resize((nw, nh), Image.LANCZOS)
    canvas.paste(resized, ((fav_size - nw) // 2, (fav_size - nh) // 2), resized)
    canvas.save(PUBLIC / "favicon.ico", format="ICO", sizes=[(32, 32), (64, 64), (128, 128), (256, 256)])
    # Also save a high-res PNG version for apple-touch-icon
    canvas.save(PUBLIC / "logo192.png")
    canvas.resize((512, 512), Image.LANCZOS).save(PUBLIC / "logo512.png")
    print("Saved favicon.ico + logo192/512.png")


if __name__ == "__main__":
    main()
