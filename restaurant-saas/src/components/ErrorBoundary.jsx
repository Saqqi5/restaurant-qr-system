import { Component } from "react";

// Catches render errors anywhere in the app and shows the error on screen
// instead of a black page (his 2026-11-20 order — Settings went black with
// no message, so the cause could not be found). The error text + which
// component crashed is shown, so the cause can be read and fixed.
// Navigating away resets the boundary, so a crash on one page never traps
// the user — the next page renders normally.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null, path: window.location.pathname };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("App error:", error, info);
    this.setState({ info });
  }

  componentDidUpdate() {
    if (this.state.hasError && window.location.pathname !== this.state.path) {
      this.setState({ hasError: false, error: null, info: null, path: window.location.pathname });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const err = this.state.error;
    return (
      <div style={{ minHeight: "100vh", background: "#070C0C", color: "#fff", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>⚠️ Something went wrong</h1>
        <p style={{ color: "#ccc", marginBottom: 16 }}>The page could not load. Please send a screenshot of this error.</p>
        <div style={{ background: "#111", border: "1px solid #e05252", borderRadius: 8, padding: 12, marginBottom: 16, overflowX: "auto" }}>
          <strong style={{ color: "#ff8a80" }}>{err?.name || "Error"}: {err?.message || "Unknown error"}</strong>
          {this.state.info?.componentStack && (
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#aaa", marginTop: 8 }}>{this.state.info.componentStack}</pre>
          )}
        </div>
        <button onClick={() => window.location.reload()} style={{ background: "#20C997", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer", marginRight: 10 }}>Reload page</button>
        <a href="/admin/restaurant" style={{ color: "#20C997" }}>Go to dashboard</a>
      </div>
    );
  }
}
