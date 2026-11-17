"""Prepare Saqlain's website brand assets from brand/saqlyn-website-banner.jpg:
- public/images/saqlyn-banner.png : full banner (hero showcase)
- public/images/saqlyn-logo.png   : cropped mark + SAQLYN wordmark (no
  tagline), dark background made transparent so it blends into the dark
  header/login card.
- public/favicon.png : his app icon at 192px (replaces the old favicon.svg)
Run from restaurant-saas/."""
from PIL import Image

BANNER = "../brand/saqlyn-website-banner.jpg"
ICON = "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"

ban = Image.open(BANNER).convert("RGBA")
W, H = ban.size
print("banner", (W, H))

# full banner as-is (PNG)
ban.save("public/images/saqlyn-banner.png")
print("saved public/images/saqlyn-banner.png")

# cropped logo: mark + SAQLYN wordmark composited (no tagline). The mark is
# taller than the text and the tagline sits under the TEXT only, so a single
# rectangle can't include the full mark without catching the tagline.
def transparent_dark(img):
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = max(r, g, b)
            n = min(r, g, b)
            # dark bg + neutral-gray anti-alias fringe -> transparent;
            # bright white text and the green mark stay opaque
            if m < 40 or (m - n < 20 and m < 220):
                px[x, y] = (r, g, b, 0)
    return img


mark = transparent_dark(ban.crop(
    (int(W * 0.12), int(H * 0.30), int(W * 0.345), int(H * 0.72))))
text = transparent_dark(ban.crop(
    (int(W * 0.37), int(H * 0.39), int(W * 0.88), int(H * 0.57))))
gap = int(W * 0.025)
canvas = Image.new("RGBA", (mark.size[0] + gap + text.size[0], mark.size[1]),
                   (0, 0, 0, 0))
canvas.paste(mark, (0, 0), mark)
canvas.paste(text, (mark.size[0] + gap, (mark.size[1] - text.size[1]) // 2),
             text)
canvas.save("public/images/saqlyn-logo.png")
print("saved public/images/saqlyn-logo.png", canvas.size)

# favicon from his app icon
Image.open(ICON).save("public/favicon.png")
print("saved public/favicon.png")
print("DONE")
