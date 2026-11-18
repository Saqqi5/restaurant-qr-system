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

const CONTACTS = [
  {
    icon: "💬",
    title: "WhatsApp",
    detail: "+92 317 8094845",
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
                <span className="contact-detail">{c.detail}</span>
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
