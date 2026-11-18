// Pick theme colours from a restaurant logo image (client-side, no server).
// Draws the image small on a canvas and counts the most common SATURATED
// colours — near-white, near-black and grey background pixels are ignored —
// returning the top two as primary + accent. Only works for same-origin
// sources (an uploaded file as a blob/data URL): a pasted cross-origin URL
// taints the canvas, so callers should run this on file uploads only and
// leave a pasted URL's colours for the admin to pick by hand.
export function extractLogoColors(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const counts = new Map();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue; // transparent
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          if (mx > 245 && mn > 235) continue; // near-white background
          if (mx < 25) continue; // near-black background
          if (mx === 0 || (mx - mn) / mx < 0.25) continue; // grey / dull
          const key = `${r >> 4},${g >> 4},${b >> 4}`;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        if (!sorted.length) { resolve(null); return; }
        const toHex = (key) => {
          const [r, g, b] = key.split(",").map((v) => (parseInt(v, 10) << 4) + 8);
          return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
        };
        const primary = toHex(sorted[0][0]);
        // Accent: the next most common colour that is clearly different
        // from the primary; otherwise a darker shade of the primary.
        let accent = null;
        for (let i = 1; i < sorted.length; i++) {
          const c = toHex(sorted[i][0]);
          if (colorDistance(c, primary) > 60) { accent = c; break; }
        }
        if (!accent) accent = shade(primary, 0.7);
        resolve({ primary, accent });
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}

function colorDistance(a, b) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2);
}

function shade(hex, f) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(Math.round(r * f), Math.round(g * f), Math.round(b * f));
}
