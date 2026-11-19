import { useState, useEffect } from "react";
import { subscribeToSettingsLogs } from "../../config/db";

// Settings activity log — SUPER ADMIN ONLY (firestore.rules: only the
// super admin can read settings_logs). Shows what the restaurant admin /
// branch manager changed in Settings, and when. The admin / manager never
// see this log.
export default function SettingsLogModal({ restaurantId, restaurantName, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    const unsub = subscribeToSettingsLogs(restaurantId, (data) => {
      setLogs(data);
      setLoading(false);
    });
    return unsub;
  }, [restaurantId]);

  function fmtTime(ts) {
    const d = ts?.toDate?.();
    if (!d) return "—";
    return d.toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function roleLabel(role) {
    return role === "branch_manager" ? "Branch Manager"
      : role === "general_admin" ? "Restaurant Admin"
      : role === "super_admin" ? "Super Admin"
      : role || "—";
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h3>📋 Settings Log — {restaurantName || "Restaurant"}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="form-hint" style={{ marginTop: 0 }}>
          Every Settings change by the restaurant admin or branch manager, newest first.
          Only you (the administrator) can see this log.
        </p>
        <div className="modal-body">
          {loading ? (
            <p>Loading…</p>
          ) : logs.length === 0 ? (
            <p style={{ color: "var(--color-muted)" }}>No settings changes recorded yet.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} style={{ borderBottom: "1px solid var(--color-border)", padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <strong>{log.by_name || "—"}</strong>
                  <span style={{ color: "var(--color-muted)", fontSize: 13 }}>
                    {roleLabel(log.by_role)} · {fmtTime(log.at)}
                  </span>
                </div>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {(log.changes || []).map((c, i) => (
                    <li key={i} style={{ fontSize: 14, lineHeight: 1.5 }}>
                      <strong>{c.label || c.field}:</strong>{" "}
                      <span style={{ color: "#e05252" }}>{c.from === "" ? "(empty)" : c.from}</span>
                      {" → "}
                      <span style={{ color: "#12805c" }}>{c.to === "" ? "(empty)" : c.to}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
