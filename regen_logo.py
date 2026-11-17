"""Regenerate Table QR app icon + splash as a professional full-name
'SAQLYN' wordmark (dark bg #070C0C, white text). Replaces the invented
white-'S'-on-green mark the user never gave us. Run from restaurant-saas/."""
from PIL import Image, ImageDraw, ImageFont
import glob

RES = "android/app/src/main/res"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
DARK = (7, 12, 12, 255)
WHITE = (255, 255, 255, 255)
GRAY = (158, 168, 164, 255)


def fit_font(draw, text, max_w, start):
    size = start
    while size > 8:
        f = ImageFont.truetype(FONT, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 1
    return ImageFont.truetype(FONT, 8)


def draw_centered(draw, cx, cy, text, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), text, font=font, fill=fill)


def wordmark_icon(path, size, shape):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if shape == "round":
        d.ellipse([0, 0, size - 1, size - 1], fill=DARK)
        f = fit_font(d, "SAQLYN", size * 0.76, size // 2)
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=DARK)
        f = fit_font(d, "SAQLYN", size * 0.86, size // 2)
    draw_centered(d, size / 2, size / 2, "SAQLYN", f, WHITE)
    im.save(path)
    print("icon", path, size, shape)


def foreground(path):
    size = 432
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = fit_font(d, "SAQLYN", 340, 150)
    draw_centered(d, size / 2, size / 2, "SAQLYN", f, WHITE)
    im.save(path)
    print("foreground", path)


def splash(path):
    im = Image.open(path)
    w, h = im.size
    bg = Image.new("RGBA", (w, h), DARK)
    d = ImageDraw.Draw(bg)
    f1 = fit_font(d, "SAQLYN", w * 0.72, h // 6)
    f2 = fit_font(d, "Table QR", w * 0.5, f1.size // 2)
    gap = int(f1.size * 0.4)
    total = f1.size + gap + f2.size
    y0 = (h - total) / 2
    draw_centered(d, w / 2, y0 + f1.size / 2, "SAQLYN", f1, WHITE)
    draw_centered(d, w / 2, y0 + f1.size + gap + f2.size / 2, "Table QR", f2, GRAY)
    bg.save(path)
    print("splash", path, (w, h))


for p in glob.glob(f"{RES}/mipmap-*/ic_launcher.png"):
    wordmark_icon(p, Image.open(p).size[0], "square")
for p in glob.glob(f"{RES}/mipmap-*/ic_launcher_round.png"):
    wordmark_icon(p, Image.open(p).size[0], "round")
foreground(f"{RES}/mipmap-xxxhdpi/ic_launcher_foreground.png")
for p in glob.glob(f"{RES}/drawable*/splash.png"):
    splash(p)
xml = f"{RES}/values/ic_launcher_background.xml"
open(xml, "w").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    '    <color name="ic_launcher_background">#070C0C</color>\n</resources>\n'
)
print("background xml -> #070C0C")
print("DONE")
