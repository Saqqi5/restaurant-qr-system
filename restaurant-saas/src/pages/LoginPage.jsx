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
      setError("Invalid email or password. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-icon">🍽️</span>
          <h1>TableQR</h1>
          <p>Restaurant Management Platform</p>
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
          <a href="/">← Back to home</a>
        </div>
      </div>

      <div className="login-bg">
        <div className="login-bg-pattern" />
      </div>
    </div>
  );
}
