import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  getAllRestaurants, createRestaurant, updateRestaurant, deleteRestaurant,
  getRestaurantUsers, mapDomain,
  subscribeToPlanPayments, verifyPlanPayment, rejectPlanPayment,
  subscribeToSignupRequests, updateSignupRequest,
  subscribeToDemoLeads
} from "../config/db";
import { PLANS, getPlanLimit, getPlanLabel, normalizePlan, DOMAIN_CHARGE_PKR_PER_YEAR } from "../config/plans";
import { buildQrUrl } from "../config/tenantResolver";
import AdminLayout from "../components/admin/AdminLayout";
import RestaurantCard from "../components/admin/RestaurantCard";
import CreateRestaurantModal from "../components/admin/CreateRestaurantModal";
import CurrencySelect from "../components/admin/CurrencySelect";
import { THEME_PRESETS, DEFAULT_THEME } from "../config/themes";
import StaffModal from "../components/admin/StaffModal";
import QRModal from "../components/admin/QRModal";
import ConfirmModal from "../components/admin/ConfirmModal";
import StatsBar from "../components/admin/StatsBar";

export default function SuperAdminDashboard() {
  const { userProfile, logout, createDefaultStaff } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [modalType, setModalType] = useState(null); // "staff" | "qr" | "edit" | "domain"
  const [searchTerm, setSearchTerm] = useState("");
  const [deleting, setDeleting] = useState(null); // restaurant awaiting delete confirm
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [planPayments, setPlanPayments] = useState([]);
  const [planActionId, setPlanActionId] = useState(null);
  const [pendingReject, setPendingReject] = useState(null); // plan payment awaiting reject confirm
  const [signupRequests, setSignupRequests] = useState([]);
  const [signupActionId, setSignupActionId] = useState(null);
  const [demoLeads, setDemoLeads] = useState([]);
  const [createFromSignup, setCreateFromSignup] = useState(null); // request being turned into a restaurant
  const [staffNotice, setStaffNotice] = useState(null); // { restaurantName, results } after a create

  useEffect(() => {
    getAllRestaurants().then((data) => {
      setRestaurants(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => subscribeToPlanPayments(setPlanPayments), []);
  useEffect(() => subscribeToSignupRequests(setSignupRequests), []);
  useEffect(() => subscribeToDemoLeads(setDemoLeads), []);

  // Verify a plan payment: the plan activates for 30 days (see db.js).
  async function handleVerifyPlanPayment(payment) {
    if (planActionId) return;
    setPlanActionId(payment.id);
    try {
      await verifyPlanPayment(payment);
      setRestaurants((prev) => prev.map((r) =>
        r.id === payment.restaurantId
          ? { ...r, plan: payment.plan, plan_expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000) }
          : r
      ));
    } finally {
      setPlanActionId(null);
    }
  }

  async function handleRejectPlanPayment(payment) {
    if (planActionId) return;
    // Ask in the styled in-app dialog (not the browser's plain popup).
    setPendingReject(payment);
  }

  async function confirmRejectPlanPayment() {
    const payment = pendingReject;
    setPendingReject(null);
    if (!payment) return;
    setPlanActionId(payment.id);
    try {
      await rejectPlanPayment(payment);
    } finally {
      setPlanActionId(null);
    }
  }

  // Turn a Get Started signup request into a restaurant: opens the create
  // modal prefilled with the request's name, plan and table count.
  function handleCreateFromSignup(request) {
    setCreateFromSignup(request);
    setShowCreate(true);
  }

  async function handleDismissSignup(request) {
    if (signupActionId) return;
    setSignupActionId(request.id);
    try {
      await updateSignupRequest(request.id, { status: "dismissed" });
    } finally {
      setSignupActionId(null);
    }
  }

  async function handleCreateRestaurant(formData) {
    const newRestaurant = await createRestaurant(formData);
    setRestaurants((prev) => [newRestaurant, ...prev]);
    setShowCreate(false);
    // Created from a Get Started signup request: mark it done so it
    // leaves the pending list.
    if (createFromSignup) {
      await updateSignupRequest(createFromSignup.id, { status: "created", restaurantId: newRestaurant.id });
      setCreateFromSignup(null);
    }
    // Auto-create the 4 default staff logins (admin / kitchen / cashier /
    // waiter) exactly like the demo restaurants. One failure never blocks
    // the others — the notice lists what was created and what failed.
    const results = await createDefaultStaff(newRestaurant.id, newRestaurant.slug);
    setStaffNotice({ restaurantName: newRestaurant.name, results });
  }

  async function handleUpdateRestaurant(id, data) {
    await updateRestaurant(id, data);
    setRestaurants((prev) => prev.map((r) => r.id === id ? { ...r, ...data } : r));
    setModalType(null);
  }

  async function handleDeleteRestaurant() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteRestaurant(deleting.id);
      setRestaurants((prev) => prev.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleMapDomain(restaurantId, domain) {
    await mapDomain(domain, restaurantId);
    // The request is served — clear it so the card stops showing it.
    await updateRestaurant(restaurantId, { custom_domain: domain, domain_request: null, domain_request_at: null });
    setRestaurants((prev) =>
      prev.map((r) => r.id === restaurantId ? { ...r, custom_domain: domain, domain_request: null } : r)
    );
  }

  function openModal(restaurant, type) {
    setSelectedRestaurant(restaurant);
    setModalType(type);
  }

  const filtered = restaurants.filter((r) =>
    r.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: restaurants.length,
    active: restaurants.filter((r) => r.active).length,
    withCustomDomain: restaurants.filter((r) => r.custom_domain).length,
  };

  return (
    <AdminLayout
      title="Administrator"
      subtitle="Manage all restaurants on the platform"
      onLogout={logout}
      userProfile={userProfile}
    >
      <StatsBar stats={[
        { label: "Total Restaurants", value: stats.total, icon: "🏪" },
        { label: "Active", value: stats.active, icon: "✅" },
        { label: "Custom Domains", value: stats.withCustomDomain, icon: "🌐" },
      ]} />

      {/* ── Default staff logins created with a new restaurant ── */}
      {staffNotice && (
        <div className="settings-section" style={{ marginBottom: 24, borderColor: "var(--color-primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="settings-section-title">👥 Staff logins created for {staffNotice.restaurantName}</h2>
            <button className="modal-close" onClick={() => setStaffNotice(null)}>✕</button>
          </div>
          {staffNotice.results.map((r) => (
            <div key={r.role} className="form-hint" style={{ marginBottom: 4 }}>
              {r.ok ? "✅" : "❌"} {r.name} ({r.role}) — {r.email} / {r.password}
              {!r.ok && ` — ${r.error === "auth/email-already-in-use" ? "email already in use (the account may belong to a deleted restaurant — remove it or create the staff manually)" : r.error}`}
            </div>
          ))}
          <p className="form-hint">Default passwords — share them with the restaurant owner and ask them to change the passwords.</p>
        </div>
      )}

      <div className="dashboard-actions">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search restaurants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + New Restaurant
        </button>
      </div>

      {/* ── New signup requests (Get Started page) ── */}
      {(() => {
        const pending = signupRequests.filter((r) => r.status === "new");
        const done = signupRequests.filter((r) => r.status !== "new").slice(0, 5);
        if (signupRequests.length === 0) return null;
        return (
          <div className="settings-section" style={{ marginBottom: 24, borderColor: "var(--color-primary)" }}>
            <h2 className="settings-section-title">🆕 New Signup Requests</h2>
            {pending.length === 0 && (
              <p className="form-hint">No pending signup requests. {done.length > 0 && "Recent ones are below."}</p>
            )}
            {pending.map((r) => (
              <div key={r.id} style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--color-surface2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <strong>{r.restaurantName}</strong>
                  <span>
                    {getPlanLabel(r.plan)} plan — <strong>Rs. {r.amount?.toLocaleString?.() || r.amount}/month</strong>
                  </span>
                </div>
                <div className="form-hint" style={{ marginBottom: 10 }}>
                  {r.ownerName} · <a href={`https://wa.me/${r.whatsapp}`} target="_blank" rel="noreferrer">{r.whatsapp}</a> · {r.city} · {r.cuisine} · {r.tables} tables
                  {r.notes ? ` · “${r.notes}”` : ""}
                </div>
                <div className="form-hint" style={{ marginBottom: 10 }}>
                  {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : ""}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn-primary" onClick={() => handleCreateFromSignup(r)} disabled={signupActionId === r.id}>
                    🏪 Create Restaurant
                  </button>
                  <button className="btn-secondary" onClick={() => handleDismissSignup(r)} disabled={signupActionId === r.id}>
                    ❌ Dismiss
                  </button>
                </div>
                <p className="form-hint" style={{ marginTop: 8 }}>
                  Creating the restaurant starts the {r.plan === "basic" ? "7-day free trial" : "paid 30-day period"} and creates the 4 staff logins automatically.
                </p>
              </div>
            ))}
            {done.length > 0 && (
              <>
                <h3 style={{ fontSize: 14, margin: "16px 0 8px" }}>Recent</h3>
                {done.map((r) => (
                  <div key={r.id} className="form-hint" style={{ padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
                    {r.status === "created" ? "✅" : "❌"} {r.restaurantName} — {getPlanLabel(r.plan)} plan, Rs. {r.amount?.toLocaleString?.() || r.amount}/month
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })()}

      {/* ── Demo leads (visitors who added their own dish in Try Demo) ── */}
      {demoLeads.length > 0 && (
        <div className="settings-section" style={{ marginBottom: 24, borderColor: "var(--color-primary)" }}>
          <h2 className="settings-section-title">🎯 Demo Leads ({demoLeads.length})</h2>
          <p className="form-hint" style={{ marginBottom: 12 }}>
            Visitors who added their own menu item in the Try Demo and left their details. Contact them on WhatsApp about buying SAQLYN.
          </p>
          {demoLeads.map((l) => (
            <div key={l.id} style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: 14, marginBottom: 10, background: "var(--color-surface2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                <strong>{l.name}</strong>
                <span className="form-hint">{l.restaurantName || l.restaurantId}</span>
              </div>
              <div className="form-hint">
                <a href={`mailto:${l.email}`}>{l.email}</a>
                {" · "}
                <a href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noreferrer">💬 {l.whatsapp}</a>
                {" · "}
                {l.createdAt?.toDate ? l.createdAt.toDate().toLocaleString() : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Plan payment requests (owners buying/upgrading a plan) ── */}
      {(() => {
        const pending = planPayments.filter((p) => p.status === "pending");
        const decided = planPayments.filter((p) => p.status !== "pending").slice(0, 5);
        if (planPayments.length === 0) return null;
        return (
          <div className="settings-section" style={{ marginBottom: 24 }}>
            <h2 className="settings-section-title">💳 Plan Payment Requests</h2>
            {pending.length === 0 && (
              <p className="form-hint">No pending plan payments. {decided.length > 0 && "Recent decisions are below."}</p>
            )}
            {pending.map((p) => (
              <div key={p.id} style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--color-surface2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <strong>{p.restaurantName || p.restaurantId}</strong>
                  <span>
                    {getPlanLabel(p.plan)} plan — <strong>Rs. {p.amount?.toLocaleString?.() || p.amount}</strong> ({p.method})
                  </span>
                </div>
                <div className="form-hint" style={{ marginBottom: 10 }}>
                  {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString() : ""} · {p.restaurantId}
                </div>
                {p.proofImage && (
                  <img src={p.proofImage} alt="Payment proof" style={{ maxWidth: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 8, marginBottom: 12, display: "block" }} />
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn-primary" onClick={() => handleVerifyPlanPayment(p)} disabled={planActionId === p.id}>
                    {planActionId === p.id ? "Activating…" : "✅ Verify & Activate Plan"}
                  </button>
                  <button className="btn-secondary" onClick={() => handleRejectPlanPayment(p)} disabled={planActionId === p.id}>
                    ❌ Reject
                  </button>
                </div>
                <p className="form-hint" style={{ marginTop: 8 }}>
                  Verifying switches the restaurant to the {getPlanLabel(p.plan)} plan and starts a fresh 30-day period.
                </p>
              </div>
            ))}
            {decided.length > 0 && (
              <>
                <h3 style={{ fontSize: 14, margin: "16px 0 8px" }}>Recent decisions</h3>
                {decided.map((p) => (
                  <div key={p.id} className="form-hint" style={{ padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
                    {p.status === "verified" ? "✅" : "❌"} {p.restaurantName || p.restaurantId} — {getPlanLabel(p.plan)} plan, Rs. {p.amount?.toLocaleString?.() || p.amount}
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })()}

      {loading ? (
        <div className="grid-skeleton">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton-card-lg" />)}
        </div>
      ) : (
        <div className="restaurant-grid">
          {filtered.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              onEdit={() => openModal(restaurant, "edit")}
              onManageStaff={() => openModal(restaurant, "staff")}
              onViewQR={() => openModal(restaurant, "qr")}
              onMapDomain={() => openModal(restaurant, "domain")}
              onDelete={() => setDeleting(restaurant)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="empty-state">
              <p>No restaurants found.</p>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateRestaurantModal
          onClose={() => { setShowCreate(false); setCreateFromSignup(null); }}
          onCreate={handleCreateRestaurant}
          initial={createFromSignup ? {
            name: createFromSignup.restaurantName,
            plan: createFromSignup.plan,
            table_count: Math.min(
              createFromSignup.tables || 10,
              getPlanLimit(normalizePlan(createFromSignup.plan), null) || 10
            ),
          } : undefined}
        />
      )}

      {modalType === "staff" && selectedRestaurant && (
        <StaffModal
          restaurant={selectedRestaurant}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === "qr" && selectedRestaurant && (
        <QRModal
          restaurant={selectedRestaurant}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === "edit" && selectedRestaurant && (
        <EditRestaurantModal
          restaurant={selectedRestaurant}
          onClose={() => setModalType(null)}
          onSave={(data) => handleUpdateRestaurant(selectedRestaurant.id, data)}
        />
      )}

      {deleting && (
        <div className="modal-overlay" onClick={() => setDeleting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🗑️ Delete Restaurant</h3>
              <button className="modal-close" onClick={() => setDeleting(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-info">
                Delete <strong>{deleting.name}</strong>? This permanently removes the
                restaurant, its menu, orders and payments. Staff accounts are not
                deleted. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDeleting(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleDeleteRestaurant} disabled={deleteBusy}
                style={{ background: "#c0392b" }}>
                {deleteBusy ? "Deleting..." : "🗑️ Delete Restaurant"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalType === "domain" && selectedRestaurant && (
        <DomainModal
          restaurant={selectedRestaurant}
          onClose={() => setModalType(null)}
          onSave={(domain) => domain
            ? handleMapDomain(selectedRestaurant.id, domain)
            : setRestaurants((prev) =>
              prev.map((r) => r.id === selectedRestaurant.id ? { ...r, custom_domain: null } : r)
            )
          }
        />
      )}

      {pendingReject && (
        <ConfirmModal
          title="Reject plan payment?"
          message={`Reject the ${getPlanLabel(pendingReject.plan)} plan payment from ${pendingReject.restaurantName}? The owner can submit a new one.`}
          confirmLabel="Reject"
          danger
          onConfirm={confirmRejectPlanPayment}
          onCancel={() => setPendingReject(null)}
        />
      )}
    </AdminLayout>
  );
}

function EditRestaurantModal({ restaurant, onClose, onSave }) {
  const [form, setForm] = useState({
    name: restaurant.name || "",
    table_count: restaurant.table_count || 10,
    logo_url: restaurant.logo_url || "",
    active: restaurant.active !== false,
    plan: normalizePlan(restaurant.plan),
    currency: restaurant.currency || "$",
    address: restaurant.address || "",
    order_taker_enabled: restaurant.order_taker_enabled === true,
    theme: restaurant.theme || { ...DEFAULT_THEME },
  });
  const editLimit = getPlanLimit(form.plan, null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Restaurant</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Restaurant Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Plan</label>
            <select value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              {Object.values(PLANS).map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}{p.defaultTableLimit === null ? " (no table limit)" : ` (up to ${p.defaultTableLimit} tables)`}
                </option>
              ))}
            </select>
            {editLimit !== null && form.table_count > editLimit && (
              <p className="form-hint">
                This restaurant has {form.table_count} tables, above the {form.plan} limit of {editLimit}.
                Existing tables stay, but no new tables can be added until the plan is upgraded.
              </p>
            )}
          </div>
          <div className="form-group">
            <label>Table Count</label>
            <input type="number" value={form.table_count}
              onChange={(e) => setForm({ ...form, table_count: parseInt(e.target.value) })} />
          </div>
          <div className="form-group">
            <label>Logo URL</label>
            <input value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://..." />
          </div>
          <div className="form-group">
            <label>Currency</label>
            <CurrencySelect value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
            <p className="form-hint">Shown on every bill and in revenue.</p>
          </div>
          <div className="form-group">
            <label>Address (shows on the receipt)</label>
            <input value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. 12 Main Bazaar, Lahore" />
          </div>
          <div className="form-group">
            <label>🎨 Theme Colors — match the restaurant&apos;s logo</label>
            <p className="form-hint">Only the administrator sets this. The restaurant&apos;s staff panels and customer menu use these colours.</p>
            <div className="theme-presets">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="theme-preset-btn"
                  title={preset.name}
                  onClick={() => setForm({ ...form, theme: { primary: preset.primary, accent: preset.accent } })}
                  style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})` }}
                >
                  {form.theme.primary === preset.primary && (
                    <span className="theme-check">✓</span>
                  )}
                </button>
              ))}
            </div>
            <div className="settings-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label>Primary Color</label>
                <div className="color-input-row">
                  <input
                    type="color"
                    value={form.theme.primary}
                    onChange={(e) => setForm({ ...form, theme: { ...form.theme, primary: e.target.value } })}
                    className="color-swatch-input"
                  />
                  <input
                    type="text"
                    value={form.theme.primary}
                    onChange={(e) => setForm({ ...form, theme: { ...form.theme, primary: e.target.value } })}
                    placeholder="#e85d04"
                    style={{ fontFamily: "monospace", width: "100%" }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Accent Color</label>
                <div className="color-input-row">
                  <input
                    type="color"
                    value={form.theme.accent}
                    onChange={(e) => setForm({ ...form, theme: { ...form.theme, accent: e.target.value } })}
                    className="color-swatch-input"
                  />
                  <input
                    type="text"
                    value={form.theme.accent}
                    onChange={(e) => setForm({ ...form, theme: { ...form.theme, accent: e.target.value } })}
                    placeholder="#f48c06"
                    style={{ fontFamily: "monospace", width: "100%" }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="form-group-inline">
            <label>
              <input type="checkbox" checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active
            </label>
          </div>
          <div className="form-group-inline">
            <label>
              <input type="checkbox" checked={!!form.order_taker_enabled}
                onChange={(e) => setForm({ ...form, order_taker_enabled: e.target.checked })} />
              Order Taker mode enabled
            </label>
            <p className="form-hint">Standard and Premium plans include Order Taker mode. Tick this to enable it for this restaurant even on the Basic plan.</p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function DomainModal({ restaurant, onClose, onSave }) {
  const { callWorkerApi } = useAuth();
  const [domain, setDomain] = useState(restaurant.domain_request || restaurant.custom_domain || "");
  const [check, setCheck] = useState(null); // {available, price, currency, premium}
  const [busy, setBusy] = useState(""); // "", "check", "buy", "link", "unlink"
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // success message lines
  const [confirmBuy, setConfirmBuy] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const linked = restaurant.custom_domain || "";
  const isPremium = normalizePlan(restaurant.plan) === "premium";

  async function run(label, fn) {
    setBusy(label);
    setError("");
    setResult(null);
    try {
      return await fn();
    } catch (e) {
      setError(e.message || "Failed.");
      return null;
    } finally {
      setBusy("");
    }
  }

  function describe(data) {
    if (!data) return;
    if (data.attached) {
      setResult([
        `✅ ${data.domain} is live — the menu opens at https://${data.domain}?table=1`,
        "QR codes for this restaurant now use the custom domain automatically.",
      ]);
      onSave(data.domain);
    } else if (data.pending) {
      setResult([`⏳ Registration is still processing at the registrar.`, "Press Link once it completes."]);
    } else if (data.needsNameservers) {
      setResult([
        `🌐 ${data.domain} is registered but its nameservers are not set yet.`,
        `Ask the customer to set these nameservers at their registrar: ${(data.nameservers || []).join(", ")}`,
        "Then press Link again.",
      ]);
    } else if (data.detached) {
      setResult([`✅ ${data.domain} is unlinked. The menu is back on the normal link.`]);
      onSave("");
    }
    if (data.warning) setError(data.warning);
  }

  async function handleCheck() {
    const data = await run("check", () => callWorkerApi("/api/admin/domain/check", { domain }));
    if (data) setCheck(data);
  }

  async function handleBuy() {
    const data = await run("buy", () => callWorkerApi("/api/admin/domain/buy", { restaurantId: restaurant.id, domain }));
    setConfirmBuy(false);
    describe(data);
  }

  async function handleLink() {
    const data = await run("link", () => callWorkerApi("/api/admin/domain/link", { restaurantId: restaurant.id, domain }));
    describe(data);
  }

  async function handleUnlink() {
    const data = await run("unlink", () => callWorkerApi("/api/admin/domain/unlink", { restaurantId: restaurant.id }));
    setConfirmUnlink(false);
    describe(data);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🌐 Custom Domain</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {!isPremium && (
            <p className="form-hint">Custom domain is a Premium feature — this restaurant is on the {getPlanLabel(restaurant.plan)} plan.</p>
          )}
          {restaurant.domain_request && !linked && (
            <p className="form-hint">💬 The restaurant asked for: <strong>{restaurant.domain_request}</strong></p>
          )}
          {linked ? (
            <>
              <p className="modal-info">
                ✅ Linked — the menu is live at{" "}
                <a href={`https://${linked}?table=1`} target="_blank" rel="noreferrer">https://{linked}</a>
              </p>
              {!confirmUnlink ? (
                <button className="btn-secondary" onClick={() => setConfirmUnlink(true)} disabled={!!busy}>
                  Unlink domain
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" onClick={handleUnlink} disabled={!!busy} style={{ background: "#c1121f" }}>
                    {busy === "unlink" ? "Unlinking…" : "Yes, unlink it"}
                  </button>
                  <button className="btn-secondary" onClick={() => setConfirmUnlink(false)}>Cancel</button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="modal-info">
                Buy a domain for this restaurant (charged to the SAQLYN card, about $10–15 a year),
                or link a domain the customer already owns. The menu then opens at that domain —
                no DNS work needed from you for a domain we buy.
              </p>
              <div className="form-group">
                <label>Domain</label>
                <input
                  value={domain}
                  onChange={(e) => { setDomain(e.target.value); setCheck(null); }}
                  placeholder="myrestaurant.com"
                />
              </div>
              {error && <div className="error-banner">{error}</div>}
              {result && (
                <div className="modal-info">
                  {result.map((line, i) => <div key={i}>{line}</div>)}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn-secondary" onClick={handleCheck} disabled={!!busy || !domain.trim()}>
                  {busy === "check" ? "Checking…" : "🔍 Check availability"}
                </button>
                <button className="btn-secondary" onClick={handleLink} disabled={!!busy || !domain.trim()}>
                  {busy === "link" ? "Linking…" : "🔗 Link domain"}
                </button>
              </div>
              {check && (
                <div className="modal-info" style={{ marginTop: 12 }}>
                  {check.available ? (
                    <>
                      <div>✅ {check.domain} is available{check.price ? ` — $${check.price} a year` : ""}.</div>
                      {check.premium && <div>⚠️ Premium domain — the price above is higher than usual.</div>}
                      {!confirmBuy ? (
                        <button className="btn-primary" style={{ marginTop: 8 }} onClick={() => setConfirmBuy(true)} disabled={!!busy}>
                          Buy &amp; Link{check.price ? ` — $${check.price}` : ""}
                        </button>
                      ) : (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ marginBottom: 8 }}>
                            This charges {check.price ? `$${check.price}` : "the domain price"} a year to the SAQLYN card.
                            Registrations are non-refundable. The customer pays PKR {DOMAIN_CHARGE_PKR_PER_YEAR.toLocaleString("en-US")} a year
                            for the domain, charged separately from the plan.
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn-primary" onClick={handleBuy} disabled={!!busy}>
                              {busy === "buy" ? "Buying…" : "Yes, buy it"}
                            </button>
                            <button className="btn-secondary" onClick={() => setConfirmBuy(false)}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>❌ {check.domain} is not available. Try another name.</div>
                  )}
                </div>
              )}
              <p className="form-hint" style={{ marginTop: 12 }}>
                Linking a customer-owned domain: if its nameservers are not on Cloudflare yet,
                Link creates the zone and shows the nameservers — the customer sets them at
                their registrar, then you press Link again.
              </p>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
