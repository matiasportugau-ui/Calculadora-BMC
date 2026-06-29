import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/applied-ai.css';
import './styles/bmc-mobile.css';

// Route-aware error labels — the previous "Error en la Calculadora" copy
// misled users who hit errors on /hub/tareas, /mi-espacio, /hub/admin/users
// etc. We now show "Error en la aplicación" + the current pathname so the
// user can report exactly which surface broke.
function currentPathLabel() {
  if (typeof window === 'undefined') return '';
  const p = window.location.pathname || '/';
  return p === '/' || p === '/calculadora' ? 'la Calculadora' : `la app (${p})`;
}

function showError(msg, stack = '') {
  const root = document.getElementById('root');
  if (root) {
    const where = currentPathLabel();
    root.innerHTML = `<div style="padding:24px;font-family:system-ui;max-width:600"><h2 style="color:#c00">Error en ${where}</h2><pre style="background:#f5f5f5;padding:16px;overflow:auto;font-size:12px">${msg}${stack ? '\n\n' + stack : ''}</pre><p style="font-size:12px;color:#666">Revisá la consola (F12) para más detalles.</p></div>`;
  }
}

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { console.error('App error:', err, info); }
  render() {
    if (this.state.error) {
      const where = currentPathLabel();
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 600 }}>
          <h2 style={{ color: '#c00' }}>Error en {where}</h2>
          <pre style={{ background: '#f5f5f5', padding: 16, overflow: 'auto', fontSize: 12 }}>
            {this.state.error.toString()}
          </pre>
          <p style={{ fontSize: 12, color: '#666' }}>Revisá la consola del navegador (F12) para más detalles.</p>
          <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Cuando recuperes la app, usá el botón <strong>🐛 Reportar</strong> en la barra superior (o el enlace en Wolfboard / hubs) para enviar el contexto al equipo.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Auto-recover from stale chunk hashes after a deploy. When the frontend is
// redeployed, asset filenames get new content hashes; a client still running
// the previous build requests an old chunk name that no longer exists, and Vite
// raises `vite:preloadError` — seen on lazy routes (e.g. /hub/canales) as
// "Unable to preload CSS". Reload to pull the fresh index.html + current assets.
// The timestamp guard reloads at most once per 10s, so a genuinely-missing chunk
// falls through to the normal error UI instead of looping.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    const KEY = 'bmc.preloadReloadAt';
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 10000) return; // already retried very recently
    sessionStorage.setItem(KEY, String(Date.now()));
    event.preventDefault?.(); // suppress the default unhandled rejection
    window.location.reload();
  });
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
