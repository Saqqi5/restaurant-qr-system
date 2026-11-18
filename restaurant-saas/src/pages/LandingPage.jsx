import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDocs } from "firebase/firestore";
import { getDemoRestaurants, menuCol, sortMenuItems } from "../config/db";
import { formatPrice } from "../utils/currency";
import PlanPrice from "../components/PlanPrice";
import PlanFeatures, { PlanLimitsLine, SharedFeaturesStrip } from "../components/PlanFeatures";
import RestaurantLogo from "../components/customer/RestaurantLogo";
import SiteDrawer from "../components/SiteDrawer";

// Sales go through Telegram — restaurants contact Saqlain directly,
// and the administrator creates the restaurant (incl. the 7-day trial).
// New prospects start on the /get-started page instead: they pick a plan
// and leave their details, and the request lands in `signup_requests`.
const TELEGRAM = "https://t.me/Saqlyndigital";

export default function LandingPage() {
  const [demos, setDemos] = useState({});
  const [liveRestaurants, setLiveRestaurants] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Only the sample demo restaurants are listed here. Customer
        // restaurants (sold the software) never appear on the homepage.
        const restaurants = await getDemoRestaurants();
        const byId = {};
        for (const r of restaurants) {
          const snap = await getDocs(menuCol(r.id));
          const items = sortMenuItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
  // The demo cards keep their hand-written taglines. Only the two sample
  // demos are ever listed — customer restaurants are never shown here.
  // A demo whose restaurant no longer exists is hidden. Before the live
  // list loads, the demos show as before.
  const demoIds = DEMO_RESTAURANTS.map((d) => d.id);
  const listed = liveRestaurants === null
    ? DEMO_RESTAURANTS
    : DEMO_RESTAURANTS.filter((d) =>
        liveRestaurants.some((r) => r.id === d.id && r.active !== false));
  return (
    <div className="landing">
      {/* Nav — one ☰ menu button (left), SAQLYN logo centered, Staff Login (right) */}
      <nav className="landing-nav">
        <button className="site-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Menu">
          ☰
        </button>
        <Link to="/" className="nav-brand">
          <img src="/images/saqlyn-logo-tagline.png" alt="SAQLYN — Scan, Order, Pay" className="nav-logo" />
        </Link>
        <Link to="/login" className="nav-login">Staff Login</Link>
      </nav>
      <SiteDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Hero */}
      <section className="hero">
        <div className="hero-brand">
          <img src="/images/saqlyn-logo-tagline.png" alt="Saqlyn — Scan, Order, Pay" className="hero-logo" />
        </div>
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
            <Link to="/get-started" className="btn-hero-primary">
              Get Started →
            </Link>
            <Link to="/demo" className="btn-hero-secondary">Try Demo</Link>
          </div>
          <div className="hero-trust">
            <span>💬 Questions? Chat with us on Telegram — two live demo restaurants below, try the full flow right now.</span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="phone-mockup">
            <div className="phone-screen">
              <div className="mock-statusbar">
                <span>9:41</span>
                <span>●●● ○</span>
              </div>
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
                  <div className="demo-card-brand">
                    <RestaurantLogo restaurant={r} size={44} />
                    <div className="demo-card-name">{r.name}</div>
                  </div>
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
        <SharedFeaturesStrip variant="landing" />
        <div className="pricing-grid">
          {PLANS.map((plan, i) => {
            const selected = selectedPlan === plan.key;
            return (
            <div
              key={i}
              className={`pricing-card ${plan.featured ? "featured" : ""} ${selected ? "selected" : ""}`}
              onClick={() => setSelectedPlan(plan.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedPlan(plan.key); } }}
            >
              {plan.featured && <div className="pricing-badge">MOST POPULAR</div>}
              <div className="pricing-plan">{plan.name}</div>
              <div className="pricing-price">
                <PlanPrice pkr={plan.pricePkr} variant="landing" />
              </div>
              <div className="pricing-period">per month</div>
              <PlanLimitsLine plan={plan.key} variant="landing" />
              <p className="pricing-desc">{plan.desc}</p>
              <PlanFeatures plan={plan.key} variant="landing" />
              {/* Trial label — visual only, NOT clickable; highlights when this plan is selected */}
              <div className={`btn-pricing ${selected ? "filled" : "outline"}`}>
                {plan.cta}
              </div>
              {selected && (
                <Link
                  to={`/get-started?plan=${plan.key}`}
                  className="btn-pricing-continue"
                  onClick={(e) => e.stopPropagation()}
                >
                  Continue with {plan.name} →
                </Link>
              )}
            </div>
            );
          })}
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
            <a href={TELEGRAM} target="_blank" rel="noreferrer" className="footer-link">💬 Telegram</a>
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
    tagline: "Biryani, Nihari, Karahi — asli Lahori zaiqa.",
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
  {
    icon: "🧾",
    title: "Tax & Discount Billing",
    desc: "Set your tax and discount rates once — every bill adds them up automatically, to the rupee.",
  },
  {
    icon: "🛎️",
    title: "Order Taker Mode",
    desc: "Staff take orders from the panel — pick a table, add dishes, and the kitchen gets it instantly.",
  },
  {
    icon: "🍽️",
    title: "Server Dashboard",
    desc: "Waiters see live table orders, take new ones, and keep every table moving.",
  },
  {
    icon: "📊",
    title: "Advanced Analytics",
    desc: "Live revenue, best sellers, and daily trends — see what's actually selling, not what you guess.",
  },
  {
    icon: "🎨",
    title: "Custom Logo & Branding",
    desc: "Your restaurant's own logo and colours on the menu, the receipts, and the staff panels.",
  },
  {
    icon: "🌐",
    title: "Custom Domain",
    desc: "Serve your menu on your own domain, like menu.yourrestaurant.com.",
  },
  {
    icon: "💾",
    title: "Data Kept Safe",
    desc: "Your orders and menu history stay available — never deleted, ready whenever you need them.",
  },
];

const PLANS = [
  {
    key: "basic",
    name: "Basic",
    pricePkr: 5000,
    desc: "Perfect for small restaurants getting started with digital ordering.",
    featured: false,
    cta: "Start 7-day free trial",
  },
  {
    key: "standard",
    name: "Standard",
    pricePkr: 8000,
    desc: "For growing restaurants that need more tables, more staff and the server dashboard.",
    featured: true,
    cta: "Start 7-day free trial",
  },
  {
    key: "premium",
    name: "Premium",
    pricePkr: 12000,
    desc: "For busy restaurants — 50 tables, 30 staff logins, with priority support.",
    featured: false,
    cta: "Start 7-day free trial",
  },
];
