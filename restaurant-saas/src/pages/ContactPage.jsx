import { useState } from "react";
import { Link } from "react-router-dom";
import { Browser } from "@capacitor/browser";
import SiteDrawer from "../components/SiteDrawer";

// Contact page — opened from the menu's Contact item (and from anywhere
// else that links here). One place with every way to reach Saqlain:
// WhatsApp (his business number), Telegram, and the Saqlyn portfolio.
const WHATSAPP_NUMBER = "92317809485"; // 0317 8094845
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
const TELEGRAM_URL = "https://t.me/Saqlyndigital";
const PORTFOLIO_URL = "https://saqlain-portfolio.saqlainmushtaq555.workers.dev/";

async function openExternal(url) {
  try {
    await Browser.open({ url });
  } catch (e) {
    window.open(url, "_blank", "noopener");
  }
}

// WhatsApp brand mark (Simple Icons, CC0) — the real WhatsApp logo,
// not a generic speech bubble.
const WHATSAPP_SVG = (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="#25D366" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const CONTACTS = [
  {
    icon: WHATSAPP_SVG,
    title: "WhatsApp",
    // No number shown on the card (his order) — the link still opens
    // WhatsApp with the number in the URL, it is just not displayed.
    detail: "",
    text: "Fastest reply — message us about a plan, a demo, or support.",
    url: WHATSAPP_URL,
    primary: true,
  },
  {
    icon: "✈️",
    title: "Telegram",
    detail: "@SAQLYNDIGITAL",
    text: "Message us on Telegram for sales and support.",
    url: TELEGRAM_URL,
    primary: false,
  },
  {
    icon: "🌐",
    title: "Saqlyn Digital Services",
    detail: "Our portfolio website",
    text: "See our other work — websites, QR systems, Google Ads and design.",
    url: PORTFOLIO_URL,
    primary: false,
  },
];

export default function ContactPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="landing">
      {/* Nav — same header as the homepage: ☰ menu (left), SAQLYN logo
          centered, Staff Login (right). The menu + login must never
          disappear on any page. */}
      <nav className="landing-nav">
        <button className="site-menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label={menuOpen ? "Close menu" : "Menu"}>
          {menuOpen ? "✕" : "☰"}
        </button>
        <Link to="/" className="nav-brand">
          <img src="/images/saqlyn-logo-tagline.png" alt="SAQLYN — Scan, Order, Pay" className="nav-logo" />
        </Link>
        <Link to="/login" className="nav-login"><span className="nav-login-full">Staff Login</span><span className="nav-login-short">Login</span></Link>
      </nav>
      <SiteDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="gs-wrap">
        <p className="section-label">Contact Us</p>
        <h1 className="section-title">Talk to us</h1>
        <p className="gs-sub">
          Questions about a plan, a demo, or support for your restaurant?
          Reach us on WhatsApp or Telegram — or see our other work on the
          Saqlyn portfolio.
        </p>

        <div className="contact-list">
          {CONTACTS.map((c) => (
            <button
              key={c.title}
              type="button"
              className={`contact-card${c.primary ? " primary" : ""}`}
              onClick={() => openExternal(c.url)}
            >
              <span className="contact-icon">{c.icon}</span>
              <span className="contact-body">
                <span className="contact-title">{c.title}</span>
                {c.detail ? <span className="contact-detail">{c.detail}</span> : null}
                <span className="contact-text">{c.text}</span>
              </span>
              <span className="contact-arrow">↗</span>
            </button>
          ))}
        </div>

        <p className="gs-sub" style={{ marginTop: 28 }}>
          Want a plan for your restaurant? It takes 2 minutes —{" "}
          <Link to="/get-started" className="contact-inline-link">Buy a plan</Link>.
        </p>
      </div>
    </div>
  );
}
