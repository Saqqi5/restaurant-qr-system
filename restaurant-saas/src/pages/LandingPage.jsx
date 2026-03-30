import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="nav-brand">
          <span>🍽️</span>
          <span>TableQR</span>
        </div>
        <div className="nav-links">
          <Link to="/login" className="nav-login">Staff Login</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">QR-Based Restaurant Ordering</div>
          <h1 className="hero-title">
            Transform Your Restaurant
            <br />
            <span className="hero-accent">with Smart QR Menus</span>
          </h1>
          <p className="hero-desc">
            Multi-tenant SaaS platform for restaurants. QR code ordering, real-time
            kitchen management, and role-based staff dashboards.
          </p>
          <div className="hero-ctas">
            <Link to="/login" className="btn-hero-primary">Get Started</Link>
            <a href="#features" className="btn-hero-secondary">See Features</a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="phone-mockup">
            <div className="phone-screen">
              <div className="mock-header">
                <div className="mock-restaurant-name">Bella Italia</div>
                <div className="mock-table">Table 4</div>
              </div>
              <div className="mock-menu">
                {["Margherita Pizza", "Pasta Carbonara", "Tiramisu", "Caesar Salad"].map((item, i) => (
                  <div key={i} className="mock-item">
                    <div className="mock-item-info">
                      <span className="mock-item-name">{item}</span>
                      <span className="mock-item-price">${(8 + i * 3).toFixed(2)}</span>
                    </div>
                    <button className="mock-add">+</button>
                  </div>
                ))}
              </div>
              <div className="mock-cart-bar">🛒 2 items · $21.00</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features">
        <h2>Everything you need to run your restaurant</h2>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="roles-section">
        <h2>Role-Based Access for Every Team Member</h2>
        <div className="roles-grid">
          {ROLES.map((r, i) => (
            <div key={i} className="role-card">
              <div className="role-icon">{r.icon}</div>
              <h3>{r.title}</h3>
              <ul>
                {r.permissions.map((p, j) => <li key={j}>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="deploy-section">
        <h2>Flexible Deployment</h2>
        <div className="deploy-cards">
          <div className="deploy-card">
            <div className="deploy-icon">☁️</div>
            <h3>Shared SaaS</h3>
            <p>Multiple restaurants on one platform. Access via <code>/r/restaurant-id</code></p>
          </div>
          <div className="deploy-card featured">
            <div className="deploy-icon">🏷️</div>
            <h3>White Label</h3>
            <p>Deploy as standalone for a single restaurant with custom domain support.</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <p>© 2025 TableQR. Multi-tenant restaurant ordering platform.</p>
      </footer>
    </div>
  );
}

const FEATURES = [
  { icon: "📱", title: "QR Code Ordering", desc: "Customers scan and order directly from their phone. No app download needed." },
  { icon: "⚡", title: "Real-time Updates", desc: "Kitchen, counter, and servers see order updates instantly via Firebase." },
  { icon: "👥", title: "Multi-Role Staff", desc: "Kitchen, Cash Counter, Server — each with the right tools for their job." },
  { icon: "📊", title: "Analytics Dashboard", desc: "Track revenue, popular items, and order trends in real time." },
  { icon: "🌐", title: "Custom Domains", desc: "Each restaurant can have its own domain like myrestaurant.com." },
  { icon: "🎨", title: "White Label Ready", desc: "Deploy as a standalone app for any restaurant with minimal config." },
];

const ROLES = [
  {
    icon: "👑", title: "Super Admin",
    permissions: ["Create restaurants", "Assign admins", "Configure domains", "Full system access"]
  },
  {
    icon: "🏪", title: "General Admin",
    permissions: ["Manage menu", "Upload images", "View orders", "Manage staff"]
  },
  {
    icon: "👨‍🍳", title: "Kitchen Operator",
    permissions: ["View incoming orders", "Update order status", "Real-time queue"]
  },
  {
    icon: "💳", title: "Cash Counter",
    permissions: ["View ready orders", "Process payments", "Revenue tracking"]
  },
  {
    icon: "🛎️", title: "Server",
    permissions: ["Create manual orders", "View table status", "Order overview"]
  },
];
