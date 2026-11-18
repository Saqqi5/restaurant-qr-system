from PIL import Image, ImageFilter
import base64, io, os

# Start from the Option C plate (four-corner erase) — the ellipse mask
# clipped the plate ring, so go back to C and make the strokes BOLDER
# instead: a slightly thicker plate + fork/knife reads clearer and
# "pyara" at 16px tab size.
banner = Image.open("brand/saqlyn-website-banner.jpg").convert("RGB")
mark = banner.crop((246, 343, 707, 823))  # 461x480

def dark_transparent(img):
    px = img.load(); w, h = img.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0)); op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]; s = r + g + b
            a = max(0, min(255, int((s - 60) * 255 / 140)))
            op[x, y] = (r, g, b, a)
    return out

mark_t = dark_transparent(mark)
plate = mark_t.crop((70, 60, 391, 420))  # 321x360
Wc, Hc = plate.size
pp = plate.load()
for y in range(0, 42):
    for x in range(0, 46):
        pp[x, y] = (0, 0, 0, 0)
    for x in range(Wc-46, Wc):
        pp[x, y] = (0, 0, 0, 0)
for y in range(Hc-42, Hc):
    for x in range(0, 46):
        pp[x, y] = (0, 0, 0, 0)
    for x in range(Wc-46, Wc):
        pp[x, y] = (0, 0, 0, 0)

# Bolden: dilate the alpha channel so the ring + fork/knife strokes get
# thicker (MaxFilter on alpha, then re-apply the green colour).
r, g, b, a = plate.split()
a_bold = a.filter(ImageFilter.MaxFilter(5))
plate_bold = Image.merge("RGBA", (r, g, b, a_bold))
# Trim to visible content.
bbox = plate_bold.getbbox()
plate_bold = plate_bold.crop(bbox)

S = 192
fav = Image.new("RGBA", (S, S), (0, 0, 0, 0))
p = plate_bold.copy(); p.thumbnail((S-6, S-6), Image.LANCZOS)
fav.paste(p, ((S - p.size[0])//2, (S - p.size[1])//2), p)

os.makedirs("restaurant-saas/public/images", exist_ok=True)
fav.save("restaurant-saas/public/images/saqlyn-favicon.png")
buf = io.BytesIO(); fav.save(buf, format="PNG")
b64 = base64.b64encode(buf.getvalue()).decode()
os.makedirs("restaurant-saas/menu-images", exist_ok=True)
with open("restaurant-saas/menu-images/saqlyn-favicon.png.b64", "w") as f:
    f.write(b64)
print("favicon E saved, b64 chars:", len(b64))
prev = Image.new("RGB", (192, 192), (245, 235, 220))
prev.paste(fav, (0, 0), fav)
prev.save("/tmp/favicon_E_final.png")
sm = fav.resize((16, 16), Image.LANCZOS)
s = Image.new("RGB", (16, 16), (245, 235, 220))
s.paste(sm, (0, 0), sm)
s = s.resize((96, 96), Image.NEAREST)
s.save("/tmp/favicon_E_16px.png")
print("previews written")
