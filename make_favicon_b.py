from PIL import Image, ImageDraw, ImageFont
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
# Erase the leftover QR-corner fragments at the top corners of the crop
# (the plate's top arc is centred, so the far-left/right top corners
# are safe to clear).
pp = plate.load()
for y in range(0, 42):
    for x in range(0, 46):
        pp[x, y] = (0, 0, 0, 0)
    for x in range(plate.size[0]-46, plate.size[0]):
        pp[x, y] = (0, 0, 0, 0)

S = 192
dark = (10, 16, 14)
fav = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(fav)
d.rounded_rectangle([0, 0, S-1, S-1], radius=40, fill=dark + (255,))
p = plate.copy(); p.thumbnail((118, 118), Image.LANCZOS)
fav.paste(p, ((S - p.size[0])//2, 16), p)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30)
except Exception:
    font = ImageFont.load_default()
d2 = ImageDraw.Draw(fav)
t1, t2 = "SAQL", "YN"
w1 = d2.textlength(t1, font=font); w2 = d2.textlength(t2, font=font)
x0 = (S - (w1 + w2)) // 2; y0 = 140
d2.text((x0, y0), t1, font=font, fill=(255, 255, 255, 255))
d2.text((x0 + w1, y0), t2, font=font, fill=(32, 201, 151, 255))

os.makedirs("restaurant-saas/public/images", exist_ok=True)
fav.save("restaurant-saas/public/images/saqlyn-favicon.png")
buf = io.BytesIO(); fav.save(buf, format="PNG")
b64 = base64.b64encode(buf.getvalue()).decode()
os.makedirs("restaurant-saas/menu-images", exist_ok=True)
with open("restaurant-saas/menu-images/saqlyn-favicon.png.b64", "w") as f:
    f.write(b64)
print("favicon B saved, b64 chars:", len(b64))
# Preview on light tab bar
prev = Image.new("RGB", (192, 192), (245, 235, 220))
prev.paste(fav, (0, 0), fav)
prev.save("/tmp/favicon_B_final.png")
print("preview written")
