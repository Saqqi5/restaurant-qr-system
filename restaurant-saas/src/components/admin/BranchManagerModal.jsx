import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

// Create a multi-branch manager login (super admin only, his 2026-11-19
// decision). The super admin picks the restaurants this manager may
// manage; the password is generated here (same memorable
// word-word-word-1234 format as the staff reset) and shown once, so the
// super admin can copy it and hand it to the manager. The manager sees
// only Orders / Revenue / Menu, manages one branch at a time (no "All
// branches" view), and may cancel orders but never delete them.
const WORDS = [
  "apple", "river", "mango", "cloud", "tiger", "ocean", "lemon", "eagle",
  "coral", "maple", "falcon", "harbor", "meadow", "rocket", "silver", "velvet",
  "willow", "canyon", "marble", "orchid", "pepper", "quartz", "saffron", "timber",
  "umber", "violet", "walnut", "yonder", "zephyr", "amber", "breeze", "cedar",
  "daisy", "ember", "flint", "grove", "hazel", "ivory", "jasper", "karma",
  "lunar", "minty", "noble", "onyx", "pearl", "raven", "sandy", "topaz",
];

function generatePassword() {
  const rnd = new Uint32Array(3);
  crypto.getRandomValues(rnd);
  const pick = (i) => WORDS[rnd[i] % WORDS.length];
  return `${pick(0)}-${pick(1)}-${pick(2)}-${1000 + (rnd[0] % 9000)}`;
}

export default function BranchManagerModal({ restaurants = [], onClose, onCreated }) {
  const { registerStaff } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null); // { email, password } — shown once
  const [copied, setCopied] = useState(false);

  function toggleRestaurant(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Please enter the manager's name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Please enter a valid email address.");
    if (selected.length === 0) return setError("Please select at least one restaurant for this manager.");
    setBusy(true);
    try {
      await registerStaff(email.trim(), password, name.trim(), "branch_manager", selected[0], selected);
      setCreated({ email: email.trim(), password });
      if (onCreated) onCreated();
    } catch (err) {
      setError(err.message || "Could not create this manager login.");
    }
    setBusy(false);
  }

  function copyCredentials() {
    const text = `Email: ${created.email}\nPassword: ${created.password}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>👥 New Branch Manager</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {created ? (
          <div className="modal-body">
            <p className="modal-info">
              Manager login created. Share these credentials with the manager — the
              password is shown <strong>only here</strong>.
            </p>
            <div style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "14px 16px", margin: "12px 0" }}>
              <div style={{ fontSize: 14, marginBottom: 6 }}><strong>Email:</strong> {created.email}</div>
              <div style={{ fontSize: 14 }}><strong>Password:</strong> <span style={{ fontFamily: "monospace", fontSize: 15 }}>{created.password}</span></div>
            </div>
            <div className="modal-footer" style={{ padding: 0, border: "none" }}>
              <button className="btn-secondary" onClick={copyCredentials}>{copied ? "Copied ✓" : "📋 Copy login"}</button>
              <button className="btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate}>
            <div className="modal-body">
              <div className="form-group">
                <label>Manager name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed Raza" autoFocus />
              </div>
              <div className="form-group">
                <label>Login email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. manager@saqlyn.com" />
              </div>
              <div className="form-group">
                <label>Password (generated — the manager can change it later)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} style={{ flex: 1, fontFamily: "monospace" }} />
                  <button type="button" className="btn-secondary" onClick={() => setPassword(generatePassword())} title="Generate a new password">↻</button>
                </div>
              </div>
              <div className="form-group">
                <label>Restaurants this manager may manage (pick one or more)</label>
                {restaurants.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--color-muted)" }}>No restaurants yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: 10, padding: 12 }}>
                    {restaurants.map((r) => (
                      <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer" }}>
                        <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleRestaurant(r.id)} style={{ width: 18, height: 18, accentColor: "#20C997" }} />
                        <span>{r.name}</span>
                        <span style={{ color: "var(--color-muted)", fontSize: 12 }}>· {r.plan || "basic"}</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="form-hint">The manager sees only Orders, Revenue and Menu — one branch at a time, no “All branches” view. They can cancel orders, but never delete them.</p>
              </div>
              {error && <div className="error-banner">{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Creating…" : "Create Manager"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
