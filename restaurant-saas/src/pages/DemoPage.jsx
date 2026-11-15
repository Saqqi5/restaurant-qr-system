import { useState } from "react";
import { Link } from "react-router-dom";

// Public live demo — a REAL restaurant running on SAQLYN, not a video.
// Visitors scan the Lahori Dastarkhwan QR, place an order, then log in
// with the demo staff accounts below and watch the order move through
// the kitchen and the cash counter. The demo logins are the same ones in
// the public seed data, so showing them here adds no new exposure. The
// super admin resets the demo (RestaurantCard "Reset demo") whenever it
// gets messy — orders, payment proofs and the menu go back to original.
const APP_URL = "https://restaurant-qr-system.saqlainmushtaq555.workers.dev";
const DEMO_MENU_URL = `${APP_URL}/r/demo_restaurant_002?table=1`;
const QR_SRC = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(DEMO_MENU_URL)}&format=png&qzone=2`;
const TELEGRAM = "https://t.me/Saqlyndigital";

const STEPS = [
  { n: 1, title: "Scan the QR code", text: "Point your phone camera at the Lahori Dastarkhwan QR. Table 1 opens — no app needed." },
  { n: 2, title: "Place an order", text: "Add dishes and place the order. It lands in the kitchen instantly." },
  { n: 3, title: "Log in as Kitchen", text: "Open the Kitchen login below and press Confirm on your order." },
  { n: 4, title: "Log in as Cashier", text: "Mark the order paid (Cash). No screenshot needed for the demo." },
  { n: 5, title: "Log in as Admin", text: "See your order in history and watch Today's Revenue update." },
];

const DEMO_LOGINS = [
  { role: "Restaurant Admin", desc: "Menu, staff, settings & revenue", email: "admin@lahoridastarkhwan.com", password: "Admin@123", to: "/admin/restaurant" },
  { role: "Kitchen", desc: "See orders & confirm them", email: "kitchen@lahoridastarkhwan.com", password: "Kitchen@123", to: "/admin/kitchen" },
  { role: "Cashier", desc: "Verify payments & mark paid", email: "cash@lahoridastarkhwan.com", password: "Cash@123", to: "/admin/cash" },
  { role: "Waiter", desc: "Take orders for a table", email: "server@lahoridastarkhwan.com", password: "Server@123", to: "/admin/server" },
];

export default function DemoPage() {
  const [copied, setCopied] = useState("");

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      // Clipboard unavailable — the text stays visible and selectable.
    }
  }

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="nav-brand">
          SAQL<span className="nav-brand-dot">YN</span>
        </div>
        <div className="nav-links">
          <Link to="/" className="nav-link">← Back to homepage</Link>
        </div>
      </nav>

      <div className="gs-wrap">
        <p className="section-label">Live Demo</p>
        <h1 className="section-title">Try the live demo</h1>
        <p className="gs-sub">
          This is a real restaurant running on SAQLYN — not a video. Scan the QR,
          place an order, then log in as the staff and watch it move through the kitchen.
        </p>

        <div className="demo-steps">
          {STEPS.map((s) => (
            <div className="demo-step" key={s.n}>
              <span className="demo-step-num">{s.n}</span>
              <div>
                <strong>{s.title}</strong>
                <p>{s.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="demo-grid">
          <div className="demo-card">
            <h2>🍽️ Customer — order food</h2>
            <p className="demo-card-sub">Lahori Dastarkhwan · Table 1 · Prices in Rs.</p>
            <img className="demo-qr" src={QR_SRC} alt="QR code for the Lahori Dastarkhwan demo menu" width="240" height="240" />
            <p className="form-hint">Scan with your phone camera, or open the menu here:</p>
            <div className="gs-actions">
              <a className="btn-primary" href={DEMO_MENU_URL}>Open demo menu →</a>
            </div>
          </div>

          <div className="demo-card">
            <h2>👨‍🍳 Restaurant manager — run the restaurant</h2>
            <p className="demo-card-sub">Log in with any demo account and try its dashboard.</p>
            {DEMO_LOGINS.map((l) => (
              <div className="demo-login" key={l.role}>
                <div className="demo-login-head">
                  <strong>{l.role}</strong>
                  <span>{l.desc}</span>
                </div>
                <div className="demo-cred">
                  <code>{l.email}</code>
                  <button type="button" className="demo-copy" onClick={() => copy(l.email, `${l.role}-email`)}>
                    {copied === `${l.role}-email` ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <div className="demo-cred">
                  <code>{l.password}</code>
                  <button type="button" className="demo-copy" onClick={() => copy(l.password, `${l.role}-pass`)}>
                    {copied === `${l.role}-pass` ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <Link className="demo-open" to={l.to}>Open {l.role} dashboard →</Link>
              </div>
            ))}
            <p className="form-hint">
              Tip: pay at the counter — the cashier marks the order paid, so no
              screenshot is needed for the demo. Want to add your own dishes?
              Log in as Admin — we&apos;ll ask for your email &amp; WhatsApp first
              so we can follow up. We reset the demo regularly, so don&apos;t
              worry about breaking anything.
            </p>
          </div>
        </div>

        <div className="gs-actions" style={{ marginTop: 32 }}>
          <Link to="/get-started" className="btn-primary">Like it? Buy a plan →</Link>
          <a className="btn-secondary" href={TELEGRAM} target="_blank" rel="noreferrer">💬 Chat with us on Telegram</a>
        </div>
      </div>

      <footer className="landing-footer">
        <div className="footer-inner">
          <div>
            <div className="footer-brand">SAQLYN</div>
            <div className="footer-copy">© {new Date().getFullYear()} Saqlyn. All rights reserved.</div>
          </div>
          <div className="footer-links">
            <Link to="/" className="footer-link">Homepage</Link>
            <a href={TELEGRAM} target="_blank" rel="noreferrer" className="footer-link">💬 Telegram</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
