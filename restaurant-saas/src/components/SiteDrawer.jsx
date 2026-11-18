import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Browser } from "@capacitor/browser";

const TELEGRAM = "https://t.me/Saqlyndigital";
export const APP_VERSION = "4.1";

/* Drawer: ONLY the items NOT already in the bottom tab bar.
   Home / Try Demo / Buy a Plan / Staff Login live in the bottom bar,
   so they are NOT repeated here. */
const MENU_ITEMS = [
  // Homepage sections — absolute paths ("/#demos"), NOT bare "#demos":
  // a bare hash keeps the CURRENT page (/get-started#demos) where no such
  // section exists, so the click did nothing. "/#demos" goes home and
  // ScrollToTop (App.jsx) scrolls to the section.
  { label: "Demo Restaurants", icon: "🍽️", href: "/#demos" },
  { label: "Features", icon: "✨", href: "/#features" },
  { label: "Pricing", icon: "🏷️", href: "/#pricing" },
];

const BOTTOM_ITEMS = [
  { label: "Contact", icon: "💬", to: "/contact" },
  { label: "About", icon: "ℹ️", about: true },
];

async function openTelegram() {
  try {
    await Browser.open({ url: TELEGRAM });
  } catch (e) {
    window.open(TELEGRAM, "_blank", "noopener");
  }
}

/**
 * SiteDrawer — the ONE menu for the website AND the app.
 * Opens from the ☰ button in the landing header (top-left). The phone's
 * hardware back button closes it first (CapacitorNav dispatches the
 * saqlyn:close-menu / saqlyn:close-about events). Reuses the proven
 * .cap-drawer / .cap-about styling.
 */
export default function SiteDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    const closeMenu = () => onClose();
    const closeAbout = () => setAboutOpen(false);
    window.addEventListener("saqlyn:close-menu", closeMenu);
    window.addEventListener("saqlyn:close-about", closeAbout);
    return () => {
      window.removeEventListener("saqlyn:close-menu", closeMenu);
      window.removeEventListener("saqlyn:close-about", closeAbout);
    };
  }, [onClose]);

  const go = (item) => {
    onClose();
    if (item.about) { setAboutOpen(true); return; }
    if (item.href === TELEGRAM) { openTelegram(); return; }
    navigate(item.to);
  };

  return (
    <>
      {open && (
        <div className="cap-drawer-backdrop" onClick={onClose} />
      )}
      <div className={`cap-drawer${open ? " open" : ""}`} data-testid="site-menu">
        <div className="cap-drawer-head">
          <span className="cap-drawer-logo">SAQLYN</span>
          <button className="cap-drawer-close" onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        </div>
        {MENU_ITEMS.map((item) => (
          item.href && item.href !== TELEGRAM ? (
            <Link
              key={item.label}
              className="cap-drawer-item"
              to={item.href}
              onClick={onClose}
            >
              <span className="cap-drawer-icon">{item.icon}</span>
              {item.label}
            </Link>
          ) : (
            <button
              key={item.label}
              className={`cap-drawer-item${item.to && location.pathname === item.to ? " active" : ""}`}
              onClick={() => go(item)}
            >
              <span className="cap-drawer-icon">{item.icon}</span>
              {item.label}
            </button>
          )
        ))}
        <div className="cap-drawer-bottom">
          {BOTTOM_ITEMS.map((item) => (
            <button key={item.label} className="cap-drawer-item" onClick={() => go(item)}>
              <span className="cap-drawer-icon">{item.icon}</span>
              {item.label}
              {item.href && <span className="cap-drawer-ext">↗</span>}
            </button>
          ))}
        </div>
        <div className="cap-drawer-foot">Table QR v{APP_VERSION}</div>
      </div>

      {aboutOpen && (
        <div className="cap-about-backdrop" onClick={() => setAboutOpen(false)}>
          <div className="cap-about" data-testid="site-about" onClick={(e) => e.stopPropagation()}>
            <div className="cap-about-logo">SAQLYN</div>
            <div className="cap-about-title">Table QR</div>
            <div className="cap-about-version">Version {APP_VERSION}</div>
            <p className="cap-about-text">
              Scan. Order. Pay. — a QR code ordering system for restaurants.
              Customers scan the QR code at their table to order, the kitchen
              and cash counter see it live, and the bill is cleared with
              payment proof.
            </p>
            <p className="cap-about-text">Made by Saqlyn Digital Services.</p>
            <button className="cap-about-telegram" onClick={openTelegram}>
              💬 Contact on Telegram
            </button>
            <button className="cap-about-close" onClick={() => setAboutOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
