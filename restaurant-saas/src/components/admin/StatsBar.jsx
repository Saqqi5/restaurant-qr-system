// StatsBar.jsx
export function StatsBar({ stats }) {
  return (
    <div className="stats-bar">
      {stats.map((s, i) => (
        <div key={i} className={`stat-card ${s.alert ? "alert" : ""}`}>
          <span className="stat-icon">{s.icon}</span>
          <div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
export default StatsBar;
