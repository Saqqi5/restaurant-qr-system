import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  PLANS,
  getPlanPrice,
  getPlanLimit,
  getStaffLimit,
  getMenuItemLimit,
  TRIAL_DAYS,
  normalizePlan,
} from "../config/plans";
import { createSignupRequest } from "../config/db";

// Sales go through this page now — the hero "Get Started" button lands
// here instead of bouncing straight to Telegram (t.me often just sits on
// "Loading"). A customer picks a plan, leaves restaurant details, and the
// request lands in Firestore (`signup_requests`) for the super admin.
// Payment is NOT taken here: there is no payment gateway. EVERY plan
// starts with a 7-day free trial at setup; after the trial the plan
// continues at the monthly price (paid via EasyPaisa / JazzCash / bank
// transfer, details shared on WhatsApp).
const TELEGRAM = "https://t.me/Saqlyndigital";
const CUISINES = ["Desi / Pakistani", "BBQ & Grill", "Fast Food", "Italian", "Chinese", "Cafe & Desserts", "Other"];
const PLAN_ORDER = ["basic", "standard", "premium"];

function planFeatures(key) {
  const tables = getPlanLimit(key, null);
  const staff = getStaffLimit(key, null);
  const menu = getMenuItemLimit(key, null);
  return [
    `${tables} tables`,
    `${staff} staff logins`,
    menu === null ? "Unlimited menu items" : `${menu} menu items`,
    "QR code ordering",
    "Kitchen & cash dashboards",
    PLANS[key].support,
  ];
}

function formatRs(amount) {
  return `Rs. ${amount.toLocaleString("en-US")}`;
}

export default function GetStarted() {
  const [searchParams] = useSearchParams();
  const initialPlan = normalizePlan(searchParams.get("plan") || "standard");
  const [step, setStep] = useState("plan"); // plan | details | review | done
  const [plan, setPlan] = useState(initialPlan);
  const [form, setForm] = useState({
    restaurantName: "",
    ownerName: "",
    whatsapp: "",
    city: "",
    cuisine: CUISINES[0],
    tables: 10,
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [requestId, setRequestId] = useState(null);

  const limit = getPlanLimit(plan, null);
  const price = getPlanPrice(plan, null);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function pickPlan(key) {
    setPlan(key);
    const nextLimit = getPlanLimit(key, null);
    setForm((f) => ({ ...f, tables: Math.min(f.tables || 1, nextLimit) }));
  }

  function validateDetails() {
    const e = {};
    const digits = form.whatsapp.replace(/\D/g, "");
    if (form.restaurantName.trim().length < 2) e.restaurantName = "Restaurant name is required.";
    if (form.ownerName.trim().length < 2) e.ownerName = "Your name is required.";
    if (digits.length < 10 || digits.length > 15) e.whatsapp = "Enter a valid WhatsApp number (10–15 digits).";
    if (form.city.trim().length < 2) e.city = "City is required.";
    const tables = Number(form.tables);
    if (!Number.isInteger(tables) || tables < 1 || tables > limit) e.tables = `Tables must be 1–${limit} on this plan.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const ref = await createSignupRequest({
        plan,
        amount: price,
        restaurantName: form.restaurantName.trim(),
        ownerName: form.ownerName.trim(),
        whatsapp: form.whatsapp.replace(/\D/g, ""),
        city: form.city.trim(),
        cuisine: form.cuisine,
        tables: Number(form.tables),
        notes: form.notes.trim(),
      });
      setRequestId(ref.id);
      setStep("done");
    } catch (err) {
      // Firestore write failed (e.g. rules not deployed yet, offline).
      // Never strand the customer: fall through to the Telegram backup
      // below, which carries the full order prefilled.
      setSubmitError("We could not save your request just now. Please send it on Telegram instead — your details are already filled in below.");
    } finally {
      setSubmitting(false);
    }
  }

  const telegramText = `Hi! I want SAQLYN for my restaurant.\nPlan: ${PLANS[plan].label} (${formatRs(price)}/month)\nRestaurant: ${form.restaurantName.trim() || "-"}\nOwner: ${form.ownerName.trim() || "-"}\nWhatsApp: ${form.whatsapp.trim() || "-"}\nCity: ${form.city.trim() || "-"}\nCuisine: ${form.cuisine}\nTables: ${form.tables}`;

  return (
    <div className="landing">
      <nav className="landing-nav gs-nav">
        <div className="nav-links">
          <Link to="/" className="nav-link">← Back to homepage</Link>
        </div>
        <div className="nav-brand">
          SAQL<span className="nav-brand-dot">YN</span>
        </div>
      </nav>

      <div className="gs-wrap">
        {step !== "done" && (
          <>
            <p className="section-label">Get Started</p>
            <h1 className="section-title">Buy a plan for your restaurant</h1>
            <p className="gs-sub">Pick a plan, tell us about your restaurant, and we set everything up for you — menu, QR codes, staff logins.</p>

            <div className="gs-steps">
              {["Plan", "Details", "Review"].map((label, i) => {
                const active = (step === "plan" && i === 0) || (step === "details" && i === 1) || (step === "review" && i === 2);
                const doneStep = (step === "details" && i === 0) || (step === "review" && i <= 1);
                return (
                  <span key={label} className={`gs-step ${active ? "active" : ""} ${doneStep ? "done" : ""}`}>
                    <span className="gs-step-num">{doneStep ? "✓" : i + 1}</span> {label}
                  </span>
                );
              })}
            </div>
          </>
        )}

        {step === "plan" && (
          <>
            <div className="gs-plans">
              {PLAN_ORDER.map((key) => {
                const p = PLANS[key];
                const pPrice = getPlanPrice(key, null);
                const featured = key === "standard";
                return (
                  <div className="gs-plan-col" key={key}>
                    <button
                      type="button"
                      className={`gs-plan ${plan === key ? "selected" : ""} ${featured ? "featured" : ""}`}
                      onClick={() => pickPlan(key)}
                    >
                      {featured && <span className="gs-badge">MOST POPULAR</span>}
                      <span className="gs-plan-name">{p.label}</span>
                      <span className="gs-plan-price">{formatRs(pPrice)}<small>/month</small></span>
                      <span className="gs-trial">{TRIAL_DAYS}-day free trial</span>
                      <ul>
                        {planFeatures(key).map((f) => (
                          <li key={f}>✓ {f}</li>
                        ))}
                      </ul>
                    </button>
                    {plan === key && (
                      <button
                        type="button"
                        className="btn-primary gs-continue"
                        onClick={() => setStep("details")}
                      >
                        Continue with {p.label} →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="form-hint" style={{ textAlign: "center" }}>
              Every plan starts with a {TRIAL_DAYS}-day free trial. After the trial, the plan continues at the monthly price.
            </p>
          </>
        )}

        {step === "details" && (
          <form
            className="gs-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (validateDetails()) setStep("review");
            }}
          >
            <div className="form-group">
              <label>Restaurant name *</label>
              <input
                value={form.restaurantName}
                onChange={(e) => setField("restaurantName", e.target.value)}
                placeholder="e.g. Lahori Dastarkhwan"
              />
              {errors.restaurantName && <p className="gs-error">{errors.restaurantName}</p>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Owner name *</label>
                <input
                  value={form.ownerName}
                  onChange={(e) => setField("ownerName", e.target.value)}
                  placeholder="Your full name"
                />
                {errors.ownerName && <p className="gs-error">{errors.ownerName}</p>}
              </div>
              <div className="form-group">
                <label>WhatsApp number *</label>
                <input
                  value={form.whatsapp}
                  onChange={(e) => setField("whatsapp", e.target.value)}
                  placeholder="03XX-XXXXXXX"
                  inputMode="tel"
                />
                {errors.whatsapp && <p className="gs-error">{errors.whatsapp}</p>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>City *</label>
                <input
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="e.g. Lahore"
                />
                {errors.city && <p className="gs-error">{errors.city}</p>}
              </div>
              <div className="form-group">
                <label>Cuisine</label>
                <select value={form.cuisine} onChange={(e) => setField("cuisine", e.target.value)}>
                  {CUISINES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Number of tables * (max {limit} on {PLANS[plan].label})</label>
                <input
                  type="number"
                  min="1"
                  max={limit}
                  value={form.tables}
                  onChange={(e) => setField("tables", e.target.value)}
                />
                {errors.tables && <p className="gs-error">{errors.tables}</p>}
              </div>
              <div className="form-group">
                <label>Anything else? (optional)</label>
                <input
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="e.g. home delivery, two branches"
                />
              </div>
            </div>
            <div className="gs-actions">
              <button type="button" className="btn-secondary" onClick={() => setStep("plan")}>← Change plan</button>
              <button type="submit" className="btn-primary">Review order →</button>
            </div>
          </form>
        )}

        {step === "review" && (
          <>
            <div className="gs-review">
              <h2>Your order</h2>
              <div className="gs-review-row"><span>Plan</span><strong>{PLANS[plan].label} — {formatRs(price)}/month</strong></div>
              <div className="gs-review-row"><span>Restaurant</span><strong>{form.restaurantName.trim()}</strong></div>
              <div className="gs-review-row"><span>Owner</span><strong>{form.ownerName.trim()}</strong></div>
              <div className="gs-review-row"><span>WhatsApp</span><strong>{form.whatsapp.trim()}</strong></div>
              <div className="gs-review-row"><span>City</span><strong>{form.city.trim()}</strong></div>
              <div className="gs-review-row"><span>Cuisine</span><strong>{form.cuisine}</strong></div>
              <div className="gs-review-row"><span>Tables</span><strong>{form.tables}</strong></div>
              {form.notes.trim() && <div className="gs-review-row"><span>Notes</span><strong>{form.notes.trim()}</strong></div>}
              <div className="gs-review-row gs-total">
                <span>First {TRIAL_DAYS} days</span>
                <strong>FREE trial</strong>
              </div>
              <p className="form-hint">
                {`Your restaurant starts with a ${TRIAL_DAYS}-day free trial. After the trial, the plan continues at ${formatRs(price)}/month.`}
              </p>
            </div>
            {submitError && <p className="gs-error" style={{ textAlign: "center" }}>{submitError}</p>}
            <div className="gs-actions">
              <button type="button" className="btn-secondary" onClick={() => setStep("details")}>← Edit details</button>
              <button type="button" className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Placing order…" : "Confirm order"}
              </button>
            </div>
            {submitError && (
              <div className="gs-actions">
                <a
                  className="btn-primary"
                  href={`${TELEGRAM}?text=${encodeURIComponent(telegramText)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  💬 Send order on Telegram instead →
                </a>
              </div>
            )}
          </>
        )}

        {step === "done" && (
          <div className="gs-success">
            <div className="gs-check">✓</div>
            <h1 className="section-title">Request received!</h1>
            <p className="gs-sub">
              Your <strong>{PLANS[plan].label}</strong> plan request for <strong>{form.restaurantName.trim()}</strong> is in.
              {requestId ? ` (Ref: ${requestId.slice(0, 8)})` : ""}
            </p>
            <div className="gs-review">
              <h2>What happens next</h2>
              <ol className="gs-next">
                <li><strong>We contact you on WhatsApp</strong> ({form.whatsapp.trim()}) within 24 hours to confirm your menu and tables.</li>
                <li><strong>We set up your restaurant</strong> — menu, QR codes for every table, and staff logins.</li>
                <li><strong>Your {TRIAL_DAYS}-day free trial starts</strong> as soon as setup is done. After the trial, the plan continues at {formatRs(price)}/month — pay via EasyPaisa, JazzCash or bank transfer (account details will be shared with you on WhatsApp).</li>
              </ol>
            </div>
            <div className="gs-actions">
              <a
                className="btn-primary"
                href={`${TELEGRAM}?text=${encodeURIComponent(telegramText)}`}
                target="_blank"
                rel="noreferrer"
              >
                💬 Chat with us on Telegram
              </a>
              <Link to="/" className="btn-secondary">Back to homepage</Link>
            </div>
          </div>
        )}
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
