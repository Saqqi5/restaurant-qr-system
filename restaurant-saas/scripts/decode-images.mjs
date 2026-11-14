// decode-images.mjs — menu photos are stored as base64 text (.b64) in menu-images/
// because the GitHub push tool only accepts UTF-8 files. This prebuild step
// (runs before `vite build`) decodes each .b64 back to its .jpg in public/images/
// so Vite copies it into dist. To change a photo: replace the .jpg, re-encode
// it to .b64 in menu-images/, commit the .b64.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "menu-images");
const outDir = join(root, "public", "images");
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(srcDir)) {
  if (!f.endsWith(".b64")) continue;
  const jpg = join(outDir, f.slice(0, -4)); // "biryani.jpg.b64" -> "biryani.jpg"
  const b64 = join(srcDir, f);
  if (existsSync(jpg) && statSync(jpg).mtimeMs >= statSync(b64).mtimeMs) continue;
  writeFileSync(jpg, Buffer.from(readFileSync(b64, "utf8").replace(/\s+/g, ""), "base64"));
  console.log("decoded", f);
}
