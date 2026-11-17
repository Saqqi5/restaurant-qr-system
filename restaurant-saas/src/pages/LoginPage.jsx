import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

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

  return (
    <div className="login-page">
      <a href="/" className="login-back-link">← Back to home</a>
      <div className="login-card">
        <div className="login-logo">
          <img src="/images/saqlyn-logo.png" alt="SAQLYN" className="login-logo-img" />
          <p>Restaurant Management System</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <h2>Staff Login</h2>

          {error && <div className="error-banner">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
