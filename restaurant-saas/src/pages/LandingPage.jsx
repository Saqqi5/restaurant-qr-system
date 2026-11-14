import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="nav-brand">
          SAQL<span className="nav-brand-dot">YN</span>
        </div>
        <div className="nav-links">
          <a href="#features" className="nav-link">Features</a>
          <a href="#pricing" className="nav-link">Pricing</a>
          <Link to="/login" className="nav-login">Staff Login</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            QR-Based Restaurant Ordering
          </div>
          <h1 className="hero-title">
            Scan. Order. Pay.
            <span className="hero-accent">Smart Dining Experience</span>
          </h1>
          <p className="hero-desc">
            Saqlyn transforms restaurants with QR-based ordering and seamless workflows.
            No apps, no queues — just scan and enjoy.
          </p>
          <div className="hero-ctas">
            <Link to="/login" className="btn-hero-primary">Get Started →</Link>
            <a href={`/r/demo_restaurant_001?table=1`} className="btn-hero-secondary">Try Demo</a>
          </div>
          <div className="hero-trust">
            <div className="hero-trust-avatars">
              {["👨‍🍳", "👩‍💼", "🧑‍💻"].map((e, i) => (
                <div key={i} className="hero-trust-avatar">{e}</div>
              ))}
            </div>
            Trusted by restaurants across the region
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
                {[
                  ["🍕", "Margherita Pizza", "$8.00"],
                  ["🍝", "Pasta Carbonara", "$11.00"],
                  ["🍰", "Tiramisu", "$6.00"],
                  ["🥗", "Caesar Salad", "$9.00"],
                ].map(([emoji, name, price], i) => (
                  <div key={i} className="mock-item">
                    <div className="mock-item-info">
                      <span className="mock-item-name">{emoji} {name}</span>
                      <span className="mock-item-price">{price}</span>
                    </div>
                    <button className="mock-add">+</button>
                  </div>
                ))}
              </div>
              <div className="mock-cart-bar">🛒 2 items · $19.00</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="features">
        <p className="section-label">Why Saqlyn</p>
        <h2 className="section-title">Everything your restaurant needs</h2>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon-wrap">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="pricing">
        <p className="section-label">Simple Pricing</p>
        <h2 className="section-title">Choose your plan</h2>
        <div className="pricing-grid">
          {PLANS.map((plan, i) => (
            <div key={i} className={`pricing-card ${plan.featured ? "featured" : ""}`}>
              {plan.featured && <div className="pricing-badge">MOST POPULAR</div>}
              <div className="pricing-plan">{plan.name}</div>
              <div className="pricing-price">
                <span className="pricing-currency">$</span>
                <span className="pricing-amount">{plan.price}</span>
              </div>
              <div className="pricing-period">per month</div>
              <p className="pricing-desc">{plan.desc}</p>
              <ul className="pricing-features">
                {plan.features.map((f, j) => (
                  <li key={j}>
                    <span className="pricing-check">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className={`btn-pricing ${plan.featured ? "filled" : "outline"}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div>
            <div className="footer-brand">SAQLYN</div>
            <div className="footer-copy">© {new Date().getFullYear()} Saqlyn. All rights reserved.</div>
          </div>
          <div className="footer-links">
            <a href="#features" className="footer-link">Features</a>
            <a href="#pricing" className="footer-link">Pricing</a>
            <Link to="/login" className="footer-link">Staff Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: "📱",
    title: "QR Code Ordering",
    desc: "Customers scan, browse, and order from their phone in seconds. Zero app downloads, zero friction.",
  },
  {
    icon: "⚡",
    title: "Live Kitchen Updates",
    desc: "Orders appear instantly on kitchen screens. Status updates flow back to customers in real time.",
  },
  {
    icon: "👥",
    title: "Multi-Role Dashboards",
    desc: "Dedicated views for kitchen, cash counter, and server — each with exactly the tools they need.",
  },
  {
    icon: "💳",
    title: "Fast Billing & Payments",
    desc: "Customers pay via EasyPaisa, JazzCash, or bank transfer and upload proof directly in the app.",
  },
];

const PLANS = [
  {
    name: "Basic",
    price: "29",
    desc: "Perfect for small restaurants getting started with digital ordering.",
    featured: false,
    cta: "Get Started",
    features: [
      "Up to 20 tables",
      "QR code ordering",
      "Kitchen & cash dashboards",
      "Basic analytics",
      "Email support",
    ],
  },
  {
    name: "Pro",
    price: "79",
    desc: "For growing restaurants that need advanced features and more tables.",
    featured: true,
    cta: "Start Free Trial",
    features: [
      "Unlimited tables",
      "Online payment proof uploads",
      "Server dashboard",
      "Advanced analytics",
      "Custom domain",
      "Priority support",
    ],
  },
];
