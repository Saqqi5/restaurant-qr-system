#!/usr/bin/env python3
"""Rebuild saqlyn-logo-tagline.png with the FULL QR mark (not cropped).

v2.0/v2.1 bug: the lockup was built by trimming the plain logo to rows
140-340, which chopped the QR mark's top and bottom (the mark spans the
full 480px height of the plain logo). The user caught it: the QR icon
looked cropped from the bottom and pushed up.

This rebuild composites the lockup FRESH from the banner, with the mark
scaled (never cropped) to fit a 340px-tall canvas:
  - mark:    banner (246,343)-(707,823) 461x480 -> scaled to 326x340, at (0,0)
  - SAQLYN:  banner (758,446)-(1802,652) 1044x206, at (370,28)
  - tagline: banner (769,684)-(1791,736) 1022x52, at (381,258)
Canvas 1444x340. Dark background -> transparent via a brightness ramp
(same as the v2.0 build). At a 42px header height: mark 42px (full),
SAQLYN ~25px, tagline ~6.4px.
"""
import base64
from PIL import Image
import numpy as np

BANNER = "/home/hatch/workspace/restaurant-qr-system/brand/saqlyn-website-banner.jpg"
OUT_PNG = "/home/hatch/workspace/restaurant-qr-system/restaurant-saas/public/images/saqlyn-logo-tagline.png"
OUT_B64 = "/home/hatch/workspace/restaurant-qr-system/restaurant-saas/menu-images/saqlyn-logo-tagline.png.b64"

banner = Image.open(BANNER).convert("RGB")
W, H = 1444, 340
canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))

mark = banner.crop((246, 343, 707, 823)).resize((326, 340), Image.LANCZOS)
text = banner.crop((758, 446, 1802, 652))
tag = banner.crop((769, 684, 1791, 736))

for piece, pos in ((mark, (0, 0)), (text, (370, 28)), (tag, (381, 258))):
    rgba = piece.convert("RGBA")
    arr = np.asarray(rgba).astype(np.float32)
    # brightness ramp: dark banner bg -> transparent, bright art -> opaque
    s = arr[..., 0] + arr[..., 1] + arr[..., 2]
    alpha = np.clip((s - 60) / (200 - 60), 0, 1) * 255
    arr[..., 3] = alpha
    canvas.alpha_composite(Image.fromarray(arr.astype(np.uint8)), pos)

canvas.save(OUT_PNG)
# verify: the mark must reach the canvas bottom (full, not cropped)
a = np.asarray(canvas)[..., 3]
bottom_rows = a[330:340, 0:326]
print("lockup size:", canvas.size)
print("mark pixels in bottom 10 rows (must be >0):", int((bottom_rows > 30).sum()))
print("mark pixels in top 10 rows (must be >0):", int((a[0:10, 0:326] > 30).sum()))
print("tagline pixels (rows 258-310, must be >0):", int((a[258:310, 381:1403] > 30).sum()))

with open(OUT_PNG, "rb") as f:
    b64 = base64.b64encode(f.read()).decode()
with open(OUT_B64, "w") as f:
    f.write(b64)
print("b64 chars:", len(b64))
