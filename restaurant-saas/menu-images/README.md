# Menu photos

Dish photos live here as `.b64` files (base64 text) because the GitHub push
tool only accepts UTF-8 files. The `.jpg` files are generated at build time
by `scripts/decode-images.mjs` (runs as `prebuild` before `vite build`) into
`public/images/` and are git-ignored there.

To change a photo: replace the `.jpg`, re-encode it to `.b64` here, commit the `.b64`.
