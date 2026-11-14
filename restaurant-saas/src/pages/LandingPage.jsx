import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDocs } from "firebase/firestore";
import { getAllRestaurants, menuCol } from "../config/db";
import { formatPrice } from "../utils/currency";

export default function LandingPage() {
  const [demos, setDemos] = useState({});
  const [liveRestaurants, setLiveRestaurants] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const restaurants = await getAllRestaurants();
        const byId = {};
        for (const r of restaurants) {
          const snap = await getDocs(menuCol(r.id));
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          byId[r.id] = items.filter((i) => i.available !== false).slice(0, 4);
        }
        if (!cancelled) {
          setDemos(byId);
          // Newest first, so a newly added restaurant shows up at the top.
          setLiveRestaurants([...restaurants].sort((a, b) =>
            (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)));
        }
      } catch {
        // Public reads not available yet — cards still show, menu preview stays hidden
      }
    })();
    return () => { cancelled = true; };
  }, []);
  // The demo cards keep their hand-written taglines; any other live
  // restaurant gets a generic card. A demo whose restaurant no longer
  // exists is hidden. Before the live list loads, the demos show as before.
  const demoIds = DEMO_RESTAURANTS.map((d) => d.id);
  const listed = liveRestaurants === null
    ? DEMO_RESTAURANTS
    : [
        ...DEMO_RESTAURANTS.filter((d) =>
          liveRestaurants.some((r) => r.id === d.id && r.active !== false)),
        ...liveRestaurants
          .filter((r) => !demoIds.includes(r.id) && r.active !== false)
          .map((r) => ({
            id: r.id,
            name: r.name,
            cuisine: `🪑 ${r.table_count || 0} tables`,
            theme: r.theme?.primary || "#20C997",
            currency: r.currency || "$",
            tagline: "Scan the table QR to order — no app needed.",
          })),
      ];
  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="nav-brand">
          SAQL<span className="nav-brand-dot">YN</span>
        </div>
        <div className="nav-links">
          <a href="#demos" className="nav-link">Demo Restaurants</a>
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
                  ["🍕", "Margherita Pizza", "$13.00"],
                  ["🍝", "Spaghetti Carbonara", "$14.50"],
                  ["🍰", "Tiramisu", "$6.50"],
                  ["🥖", "Bruschetta al Pomodoro", "$7.50"],
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
              <div className="mock-cart-bar">🛒 2 items · $19.50</div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Restaurants */}
      <section id="demos" className="demos">
        <p className="section-label">Try It Live</p>
        <h2 className="section-title">Our demo restaurants</h2>
        <div className="demos-grid">
          {listed.map((r) => {
            const items = demos[r.id] || [];
            return (
              <div key={r.id} className="demo-card">
                <div className="demo-card-head" style={{ background: r.theme }}>
                  <div className="demo-card-name">{r.name}</div>
                  <div className="demo-card-cuisine">{r.cuisine}</div>
                  <div className="demo-card-tag">{r.tagline}</div>
                </div>
                {items.length > 0 && (
                  <div className="demo-items">
                    {items.map((item) => (
                      <div key={item.id} className="demo-item">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="demo-item-img" loading="lazy" />
                        ) : (
                          <div className="demo-item-emoji">{CATEGORY_EMOJI[item.category] || "🍽️"}</div>
                        )}
                        <div className="demo-item-info">
                          <div className="demo-item-name">{item.name}</div>
                          <div className="demo-item-price">{formatPrice(item.price, r.currency)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Link to={`/r/${r.id}?table=1`} className="demo-cta">View Full Menu →</Link>
              </div>
            );
          })}
        </div>
        <p className="demo-note">Scan any table QR in the restaurant to order — no app needed.</p>
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

const DEMO_RESTAURANTS = [
  {
    id: "demo_restaurant_002",
    name: "Lahori Dastarkhwan",
    cuisine: "Pakistani • Desi",
    theme: "#2d6a4f",
    currency: "Rs.",
    tagline: "Biryani, Nihari, Karahi — asli Lahori zaiqa, Rs. prices.",
  },
  {
    id: "demo_restaurant_001",
    name: "Bella Italia",
    cuisine: "Italian",
    theme: "#e85d04",
    currency: "$",
    tagline: "Pasta, Pizza and Tiramisu — classic Italian flavours.",
  },
];

const CATEGORY_EMOJI = {
  Desi: "🍛", BBQ: "🍖", Breads: "🥖", Starters: "🥗", Desserts: "🍰",
  Beverages: "🥤", Pasta: "🍝", Pizza: "🍕",
};

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
