from PIL import Image
import base64, io, os

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
# Plate region only (cuts the QR corner squares off the sides).
plate = mark_t.crop((70, 60, 391, 420))  # 321x360
# Erase the leftover QR-corner fragments at ALL FOUR corners of the crop
# (the plate's top arc is centred, so the far-left/right top corners
# are safe to clear).
pp = plate.load()
Wc, Hc = plate.size
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

# Favicon: ONLY the plate + fork & knife, transparent — no background,
# no text, no QR corners. 192x192, plate centred.
S = 192
fav = Image.new("RGBA", (S, S), (0, 0, 0, 0))
p = plate.copy(); p.thumbnail((S, S), Image.LANCZOS)
fav.paste(p, ((S - p.size[0])//2, (S - p.size[1])//2), p)

os.makedirs("restaurant-saas/public/images", exist_ok=True)
fav.save("restaurant-saas/public/images/saqlyn-favicon.png")
buf = io.BytesIO(); fav.save(buf, format="PNG")
b64 = base64.b64encode(buf.getvalue()).decode()
os.makedirs("restaurant-saas/menu-images", exist_ok=True)
with open("restaurant-saas/menu-images/saqlyn-favicon.png.b64", "w") as f:
    f.write(b64)
print("favicon C saved, b64 chars:", len(b64))
# Preview on light tab bar
prev = Image.new("RGB", (192, 192), (245, 235, 220))
prev.paste(fav, (0, 0), fav)
prev.save("/tmp/favicon_C_final.png")
# 16px real tab size, enlarged to see
sm = fav.resize((16, 16), Image.LANCZOS)
s = Image.new("RGB", (16, 16), (245, 235, 220))
s.paste(sm, (0, 0), sm)
s = s.resize((96, 96), Image.NEAREST)
s.save("/tmp/favicon_C_16px.png")
print("previews written")
