import React from 'react';
import ReactDOM from 'react-dom/client';

function showError(msg, stack = '') {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding:24px;font-family:system-ui;max-width:600"><h2 style="color:#c00">Error en la Calculadora</h2><pre style="background:#f5f5f5;padding:16px;overflow:auto;font-size:12px">${msg}${stack ? '\n\n' + stack : ''}</pre><p style="font-size:12px;color:#666">Revisá la consola (F12) para más detalles.</p></div>`;
  }
}

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { console.error('App error:', err, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 600 }}>
          <h2 style={{ color: '#c00' }}>Error en la Calculadora</h2>
          <pre style={{ background: '#f5f5f5', padding: 16, overflow: 'auto', fontSize: 12 }}>
            {this.state.error.toString()}
          </pre>
          <p style={{ fontSize: 12, color: '#666' }}>Revisá la consola del navegador (F12) para más detalles.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

import('./App.jsx')
  .then(({ default: App }) => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  })
  .catch((err) => {
    console.error('Failed to load App:', err);
    showError(err.message, err.stack);
  });
