import React from "react";

// Per-surface error boundary that lives *inside* the router (unlike the
// top-level boundary in main.jsx, which can never reset once tripped and
// forces a full page reload). This one resets automatically when `resetKey`
// changes — wired to the current pathname — so navigating to another module
// recovers the app without a reload, and offers an explicit retry.
//
// Reusable: drop it around any subtree that can throw on render. Keep the
// fallback dependency-free (inline styles) so a broken design-system import
// can't take the fallback down with it.
class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    // Navigating away (pathname change) clears a previously caught error so
    // the destination route renders fresh instead of inheriting the fallback.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    console.error("RouteErrorBoundary caught:", error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const where =
      typeof window !== "undefined" && window.location
        ? window.location.pathname || "/"
        : "/";

    return (
      <div
        role="alert"
        style={{
          padding: 24,
          fontFamily: "system-ui, sans-serif",
          maxWidth: 640,
          margin: "32px auto",
        }}
      >
        <h2 style={{ color: "#c0392b", marginBottom: 8 }}>
          Algo falló en esta pantalla
        </h2>
        <p style={{ color: "#555", fontSize: 14, marginTop: 0 }}>
          Ruta: <code>{where}</code>. El resto de la app sigue disponible —
          podés reintentar o volver al inicio.
        </p>
        <pre
          style={{
            background: "#f5f5f5",
            padding: 16,
            overflow: "auto",
            fontSize: 12,
            borderRadius: 6,
            maxHeight: 200,
          }}
        >
          {this.state.error.toString()}
        </pre>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              padding: "8px 16px",
              border: "1px solid #c0392b",
              background: "#c0392b",
              color: "#fff",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Reintentar
          </button>
          <a
            href="/"
            style={{
              padding: "8px 16px",
              border: "1px solid #ccc",
              background: "#fff",
              color: "#333",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Ir al inicio
          </a>
        </div>
      </div>
    );
  }
}

export default RouteErrorBoundary;
