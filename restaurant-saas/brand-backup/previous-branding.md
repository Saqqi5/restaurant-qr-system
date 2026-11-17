# Previous branding — backup (2026-11-17)

Saqlain's order: keep what was on the website BEFORE the logo/banner
change, so it can be put back any time.

## What the old branding was

- **Header + login logo: plain TEXT, no image**
  - Header: `SAQL` in white + `YN` in SAQLYN green (`#20C997`)
  - Login page: a green `S` mark + the same `SAQL`/`YN` text
- **Favicon: `public/favicon.svg`** (copy kept here as `favicon.svg`)
- **Hero: NO banner image** — just the headline + phone mockup

## How to restore (exact old code)

### 1. `index.html` — favicon link back to the SVG

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

### 2. `src/pages/LandingPage.jsx` — header brand back to text

```jsx
<Link to="/" className="nav-brand">
  SAQL<span className="nav-brand-dot">YN</span>
</Link>
```

### 3. `src/pages/LandingPage.jsx` — remove the hero banner

Delete this line from the hero section:

```jsx
<img src="/images/saqlyn-banner.png" alt="Saqlyn — Scan, Order, Pay" className="hero-banner" />
```

### 4. `src/pages/LoginPage.jsx` — login logo back to text

```jsx
<div className="login-logo">
  <span className="logo-mark">S</span>
  <div className="logo-brand">SAQL<span>YN</span></div>
  <p>Restaurant Management System</p>
</div>
```

## Notes

- The CSS for the old branding (`.nav-brand`, `.nav-brand-dot`,
  `.logo-mark`, `.logo-brand`) was NOT deleted from `src/index.css`,
  so restoring the JSX above is enough — no CSS changes needed.
- The new brand rules (`.nav-logo`, `.hero-banner`, `.login-logo-img`)
  can stay in the CSS harmlessly, or be removed.
- The new brand images live as base64 in `menu-images/saqlyn-*.png.b64`
  (decoded to `public/images/` by the prebuild script). Restoring the
  old branding does NOT require deleting them.
- The app icon (APK) is separate: v1.4 uses Saqlain's sent icon.
  The text-only wordmark icon from v1.3 is superseded, not backed up
  here — it can be regenerated with `regen_logo.py` if ever needed.
