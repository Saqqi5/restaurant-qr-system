import { useAuth } from "../../contexts/AuthContext";

// Pages that only make sense for ONE branch (kitchen, cash, server,
// tables, settings, order taker) show this when "All branches" is active
// in the switcher — pick a branch to continue.
export default function BranchRequired({ title }) {
  const { branches, setActiveRestaurantId } = useAuth();
  return (
    <div className="empty-state" style={{ minHeight: 200 }}>
      <div className="empty-icon">🏪</div>
      <h3>{title || "Pick a branch"}</h3>
      <p>This view shows one branch at a time. Choose a branch to continue:</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 12 }}>
        {branches.map((b) => (
          <button key={b.id} className="btn-primary" onClick={() => setActiveRestaurantId(b.id)}>
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}
