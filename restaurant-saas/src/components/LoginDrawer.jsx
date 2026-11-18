import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { PLANS, getPlanPrice, getPlanLimitsLine } from "../config/plans";
import { APP_VERSION } from "./SiteDrawer";

// Login drawer — the ONLY menu on the login page (app and website).
// Three options, and each opens its details INSIDE the drawer — no
// separate page:
//   • Buy a Plan → the three plans; tapping one goes to the existing
//     /get-started flow with that plan preselected (?plan=...).
//   • Contact → WhatsApp / Telegram / portfolio, opened externally.
//   • About → the About text + version, right here in the drawer.
const WHATSAPP_URL = "https://wa.me/92317809485";
const TELEGRAM_URL = "https://t.me/Saqlyndigital";
const PORTFOLIO_URL = "https://saqlain-portfolio.saqlainmushtaq555.workers.dev/";

async function openExternal(url) {
  try {
    await Browser.open({ url });
  } catch (e) {
    window.open(url, "_blank", "noopener");
  }
}

const CONTACT_ROWS = [
  { label: "WhatsApp", icon: "💬", detail: "+92 317 8094845", url: WHATSAPP_URL },
  { label: "Telegram", icon: "✈️", detail: "@SAQLYNDIGITAL", url: TELEGRAM_URL },
  { label: "Saqlyn Digital Services", icon: "🌐", detail: "Our portfolio website", url: PORTFOLIO_URL },
];

export default function LoginDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const [view, setView] = useState("menu"); // menu | plans | contact | about

  // Reset to the option list every time the drawer opens.
  useEffect(() => { if (open) setView("menu"); }, [open ]);
  // Hardware back closes the drawer first (CapacitorNav dispatches it).
  useEffect(() => {
    const closeMenu = () => onClose();
    window.addEventListener("saqlyn:close-menu", closeMenu);
    return () => window.removeEventListener("saqlyn:close-menu", closeMenu);
  }, [onClose]);

  function close() {
    setView("menu");
    onClose();
  }

  function pickPlan(key) {
    close();
    navigate(`/get-started?plan=${key}`);
  }

  return (
    <>
      {open && <div className="cap-drawer-backdrop" onClick={close} />}
      <div className={`cap-drawer${open ? " open" : ""}`} data-testid="login-menu">
        <div className="cap-drawer-head">
          <span className="cap-drawer-logo">SAQLYN</span>
          <button className="cap-drawer-close" onClick={close} aria-label="Close menu">
            ✕
          </button>
        </div>

        {view === "menu" && (
          <>
            <button className="cap-drawer-item" onClick={() => setView("plans")}>
              <span className="cap-drawer-icon">💰</span>
              Buy a Plan
              <span className="cap-drawer-ext">›</span>
            </button>
            <button className="cap-drawer-item" onClick={() => setView("contact")}>
              <span className="cap-drawer-icon">💬</span>
              Contact
              <span className="cap-drawer-ext">›</span>
            </button>
            <button className="cap-drawer-item" onClick={() => setView("about")}>
              <span className="cap-drawer-icon">ℹ️</span>
              About
              <span className="cap-drawer-ext">›</span>
            </button>
            <div className="cap-drawer-foot">Table QR v{APP_VERSION}</div>
          </>
        )}

        {view !== "menu" && (
          <button className="cap-drawer-item" onClick={() => setView("menu")}>
            <span className="cap-drawer-icon">←</span>
            Back
          </button>
        )}

        {view === "plans" && (
          <div className="login-drawer-panel">
            <div className="login-drawer-title">Choose a plan</div>
            <p className="login-drawer-sub">7-day free trial on every plan.</p>
            {Object.values(PLANS).map((p) => (
              <button
                key={p.key}
                className="login-drawer-plan"
                onClick={() => pickPlan(p.key)}
              >
                <span className="login-drawer-plan-name">{p.label}</span>
                <span className="login-drawer-plan-price">Rs. {getPlanPrice(p.key, null).toLocaleString()}/month</span>
                <span className="login-drawer-plan-spec">{getPlanLimitsLine(p.key, null)}</span>
              </button>
            ))}
          </div>
        )}

        {view === "contact" && (
          <div className="login-drawer-panel">
            <div className="login-drawer-title">Contact us</div>
            {CONTACT_ROWS.map((row) => (
              <button
                key={row.label}
                className="login-drawer-row"
                onClick={() => openExternal(row.url)}
              >
                <span className="cap-drawer-icon">{row.icon}</span>
                <span className="login-drawer-row-text">
                  <span className="login-drawer-row-label">{row.label}</span>
                  <span className="login-drawer-row-detail">{row.detail}</span>
                </span>
                <span className="cap-drawer-ext">↗</span>
              </button>
            ))}
          </div>
        )}

        {view === "about" && (
          <div className="login-drawer-panel">
            <div className="login-drawer-title">About Table QR</div>
            <p className="login-drawer-text">
              Scan. Order. Pay. — a QR code ordering system for restaurants.
              Customers scan the QR code at their table to order, the kitchen
              and cash counter see it live, and the bill is cleared with
              payment proof.
            </p>
            <p className="login-drawer-text">Made by Saqlyn Digital Services.</p>
            <p className="login-drawer-text">Version {APP_VERSION}</p>
          </div>
        )}
      </div>
    </>
  );
}
