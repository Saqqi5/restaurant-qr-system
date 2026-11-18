from PIL import Image
import base64, io, os

# Mark (QR square with plate + fork & knife) from the website banner.
# Coordinates verified in the v2.0/v2.2 lockup work.
banner = Image.open("brand/saqlyn-website-banner.jpg").convert("RGB")
mark = banner.crop((246, 343, 707, 823))  # 461x480
print("mark size:", mark.size)

# Dark -> transparent (same brightness ramp as the logo lockup), so only
# the green plate + fork & knife shows on the light browser tab bar.
px = mark.load()
w, h = mark.size
out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
op = out.load()
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        s = r + g + b
        a = max(0, min(255, int((s - 60) * 255 / 140)))
        op[x, y] = (r, g, b, a)

# Favicon: 192x192 (browsers scale down to 16/32/48). Pad to square.
S = 192
fav = Image.new("RGBA", (S, S), (0, 0, 0, 0))
out.thumbnail((S, S), Image.LANCZOS)
fav.paste(out, ((S - out.size[0]) // 2, (S - out.size[1]) // 2), out)
os.makedirs("restaurant-saas/public/images", exist_ok=True)
fav.save("restaurant-saas/public/images/saqlyn-favicon.png")
print("saved saqlyn-favicon.png", fav.size)

# .b64 for the push (binary files are rejected by push-files).
buf = io.BytesIO()
fav.save(buf, format="PNG")
b64 = base64.b64encode(buf.getvalue()).decode()
os.makedirs("restaurant-saas/menu-images", exist_ok=True)
with open("restaurant-saas/menu-images/saqlyn-favicon.png.b64", "w") as f:
    f.write(b64)
print("b64 chars:", len(b64))
