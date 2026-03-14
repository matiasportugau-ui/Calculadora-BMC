import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "100vh", padding: 40, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          background: "#F5F5F7", color: "#1D1D1F",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Algo salió mal</h1>
          <p style={{ fontSize: 14, color: "#6E6E73", marginBottom: 24, textAlign: "center", maxWidth: 400 }}>
            La calculadora encontró un error inesperado. Intenta recargar la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "12px 32px", borderRadius: 12, border: "none", background: "#0071E3",
              color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer",
            }}
          >
            Recargar página
          </button>
          {this.state.error && (
            <details style={{ marginTop: 24, fontSize: 12, color: "#AEAEB2", maxWidth: 500, wordBreak: "break-all" }}>
              <summary style={{ cursor: "pointer" }}>Detalles del error</summary>
              <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{String(this.state.error)}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
