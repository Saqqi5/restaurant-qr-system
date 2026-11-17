"""Apply Saqlain's sent app icon (brand/saqlyn-app-icon.jpg, 2048x2048)
as the Android launcher icon + splash. The source has WHITE corners
outside the dark rounded square; those become transparent.
Run from restaurant-saas/."""
from PIL import Image, ImageDraw
import glob

RES = "android/app/src/main/res"
SRC = "../brand/saqlyn-app-icon.jpg"
DARK = (10, 16, 14, 255)  # icon's own dark, matches top-mid pixel

src = Image.open(SRC).convert("RGBA")
w, h = src.size
px = src.load()
# near-white -> transparent (only the corner background)
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if r > 240 and g > 240 and b > 240:
            px[x, y] = (0, 0, 0, 0)
print("corners transparent; corner alpha now", src.getpixel((0, 0))[3])

# Content-only variant: the icon's dark background is a subtle gradient,
# so pasting the square onto a flat dark leaks a visible seam, and the
# rounded-square rim (dark/white anti-alias blend) shows as a faint arc.
# Make very dark pixels transparent (smooth ramp), and also neutral-gray
# pixels below near-white (the rim) — the green plate, QR squares and the
# bright white SAQL text stay opaque; fork/knife silhouettes show the flat
# bg behind them, which reads identically dark against the green plate.
content = src.copy()
cp = content.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = cp[x, y]
        if a == 0:
            continue
        m = max(r, g, b)
        n = min(r, g, b)
        if m < 30 or (m - n < 20 and m < 220):
            cp[x, y] = (r, g, b, 0)
        elif m < 60:
            cp[x, y] = (r, g, b, int(255 * (m - 30) / 30))
# The rim's outermost pixels are bright gray (max >= 220), so the pixel
# rules above can't kill them without also eating the white SAQL text.
# Clip the content to a rounded square inset 1.5% inside the icon's own
# square (content sits >= 17% inside the boundary, so nothing real is cut)
# — the hard mask edge passes only through already-transparent area.
_inset = int(w * 0.015)
_mask = Image.new("L", (w, h), 0)
ImageDraw.Draw(_mask).rounded_rectangle(
    [_inset, _inset, w - 1 - _inset, h - 1 - _inset],
    radius=int(w * 0.22), fill=255)
_alpha = Image.composite(
    content.split()[3], Image.new("L", (w, h), 0), _mask)
content.putalpha(_alpha)


def launcher(path, size, shape):
    im = src.resize((size, size), Image.LANCZOS)
    if shape == "round":
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(im, (0, 0), mask)
        out.save(path)
    else:
        im.save(path)
    print("icon", path, size, shape)


for p in glob.glob(f"{RES}/mipmap-*/ic_launcher.png"):
    launcher(p, Image.open(p).size[0], "square")
for p in glob.glob(f"{RES}/mipmap-*/ic_launcher_round.png"):
    launcher(p, Image.open(p).size[0], "round")

# adaptive foreground: content only (no dark square) on transparent, 432x432
content.resize((432, 432), Image.LANCZOS).save(
    f"{RES}/mipmap-xxxhdpi/ic_launcher_foreground.png")
print("foreground 432x432 (content only)")

# adaptive background: match the icon's dark so it blends seamlessly
xml = f"{RES}/values/ic_launcher_background.xml"
open(xml, "w").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    '    <color name="ic_launcher_background">#0A100E</color>\n</resources>\n')
print("background xml -> #0A100E")

# splash: content-only icon centered on the flat dark, ~62% of short side
for p in glob.glob(f"{RES}/drawable*/splash.png"):
    im = Image.open(p)
    sw, sh = im.size
    bg = Image.new("RGBA", (sw, sh), DARK)
    side = int(min(sw, sh) * 0.62)
    icon = content.resize((side, side), Image.LANCZOS)
    bg.paste(icon, ((sw - side) // 2, (sh - side) // 2), icon)
    bg.save(p)
    print("splash", p, (sw, sh))
print("DONE")
