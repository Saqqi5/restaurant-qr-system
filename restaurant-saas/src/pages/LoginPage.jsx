import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { useAuth } from "../contexts/AuthContext";

// Native Autofill plugin (registered in MainActivity): commit() asks
// Android to show the Google "Save password?" prompt after a successful
// sign-in. On the website (or if the plugin is missing) this is a no-op.
const Autofill = Capacitor.isNativePlatform() ? registerPlugin("Autofill") : null;

const ROLE_REDIRECTS = {
  super_admin: "/admin/super",
  general_admin: "/admin/restaurant",
  kitchen: "/admin/kitchen",
  cash_counter: "/admin/cash",
  server: "/admin/server",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { profile } = await login(email, password);
      // Tell Android the credentials are good — show the Google
      // "Save password?" prompt. Never blocks the login itself.
      try { await Autofill?.commit(); } catch (e) { /* autofill unavailable */ }
      const redirect = location.state?.from?.pathname || ROLE_REDIRECTS[profile?.role] || "/";
      navigate(redirect, { replace: true });
    } catch (err) {
      // login() throws a plain message for an expired trial (thrown only
      // AFTER a successful sign-in, so it leaks nothing). A real wrong
      // password comes back as a Firebase error (with a code) and keeps
      // the generic message.
      setError(err?.code ? "Invalid email or password. Please try again." : (err?.message || "Invalid email or password. Please try again."));
    }
    setLoading(false);
  }

  // When the keyboard opens, bring the tapped field up above it: scroll
  // it into the middle of the visible area once the keyboard has settled.
  function scrollFieldIntoView(e) {
    const el = e.target;
    setTimeout(() => {
      try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (err) { /* ignore */ }
    }, 350);
  }

  return (
    <div className="login-page">
      <a href="/" className="login-back-link">← Back to home</a>
      <div className="login-card">
        <div className="login-logo">
          <img src="/images/saqlyn-logo-tagline.png" alt="SAQLYN — Scan, Order, Pay" className="login-logo-img" />
          <p>Restaurant Management System</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <h2>Staff Login</h2>

          {error && <div className="error-banner">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={scrollFieldIntoView}
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={scrollFieldIntoView}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? <span className="spinner-sm" /> : "Sign In"}
          </button>
        </form>

        <div className="login-footer">
          Staff? Ask your restaurant admin for your login.
        </div>
        <div className="login-footer" style={{ marginTop: 8 }}>
          Forgot your password? Contact the administrator —{" "}
          <a href="https://t.me/Saqlyndigital" target="_blank" rel="noreferrer">
            Telegram @SAQLYNDIGITAL
          </a>
          .
        </div>
      </div>
    </div>
  );
}
