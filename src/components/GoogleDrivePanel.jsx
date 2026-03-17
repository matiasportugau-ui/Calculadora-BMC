// ═══════════════════════════════════════════════════════════════════════════
// src/components/GoogleDrivePanel.jsx — Google Drive save/load panel
// ═══════════════════════════════════════════════════════════════════════════

import { useRef } from "react";
import {
  X, Upload, Download, Trash2, ExternalLink,
  CheckCircle, AlertTriangle, RefreshCw, LogIn, LogOut,
  FolderOpen, Cloud, CloudOff,
} from "lucide-react";

const C = {
  bg: "#F5F5F7", surface: "#FFFFFF", surfaceAlt: "#FAFAFA",
  primary: "#0071E3", primarySoft: "#E8F1FB",
  brand: "#1A3A5C", brandLight: "#EEF3F8",
  dark: "#1D1D1F",
  success: "#34C759", successSoft: "#E9F8EE",
  warning: "#FF9F0A", warningSoft: "#FFF5E6",
  danger: "#FF3B30", dangerSoft: "#FFECEB",
  border: "#E5E5EA",
  tp: "#1D1D1F", ts: "#6E6E73", tt: "#AEAEB2",
};
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif";
const TR = "all 150ms cubic-bezier(0.4,0,0.2,1)";

function StatusBadge({ connected }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: connected ? C.successSoft : C.dangerSoft,
      color: connected ? "#1B7A2E" : C.danger,
    }}>
      {connected ? <Cloud size={12} /> : <CloudOff size={12} />}
      {connected ? "Conectado" : "Desconectado"}
    </span>
  );
}

export default function GoogleDrivePanel({
  visible,
  onClose,
  onSave,
  onLoad,
  onDelete,
  isAuthenticated,
  onSignIn,
  onSignOut,
  quotations,
  loading,
  saving,
  error,
  onRefresh,
  currentQuotationCode,
  lastSaveResult,
}) {
  const listRef = useRef(null);

  if (!visible) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 250,
        display: "flex", justifyContent: "flex-end",
        background: "rgba(0,0,0,0.4)",
        animation: "bmc-fade 150ms ease-in-out",
      }}
    >
      <div style={{
        width: 420, maxWidth: "90vw",
        background: C.surface,
        boxShadow: "-4px 0 40px rgba(0,0,0,0.15)",
        display: "flex", flexDirection: "column",
        fontFamily: FONT,
        animation: "bmc-slideInUp 200ms ease-out",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", background: C.dark, color: "#fff",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FolderOpen size={18} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Google Drive</span>
            <StatusBadge connected={isAuthenticated} />
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#fff",
            cursor: "pointer", padding: 4, borderRadius: 6,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Auth section */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}` }}>
          {isAuthenticated ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: C.ts }}>Sesión activa en Google</span>
              <button onClick={onSignOut} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 14px", borderRadius: 8, fontSize: 12,
                border: `1px solid ${C.border}`, background: C.surface,
                color: C.ts, cursor: "pointer", transition: TR,
              }}>
                <LogOut size={13} /> Cerrar sesión
              </button>
            </div>
          ) : (
            <button onClick={onSignIn} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: "none", background: "#4285F4", color: "#fff",
              cursor: "pointer", transition: TR,
            }}>
              <LogIn size={16} /> Iniciar sesión con Google
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            margin: "10px 20px", padding: "10px 14px", borderRadius: 10,
            background: C.dangerSoft, color: C.danger,
            fontSize: 13, display: "flex", alignItems: "center", gap: 8,
          }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Last save confirmation */}
        {lastSaveResult && (
          <div style={{
            margin: "10px 20px", padding: "10px 14px", borderRadius: 10,
            background: C.successSoft, color: "#1B7A2E",
            fontSize: 13, display: "flex", alignItems: "center", gap: 8,
          }}>
            <CheckCircle size={14} />
            <div>
              <div style={{ fontWeight: 600 }}>Guardado en Drive</div>
              <a href={lastSaveResult.folderUrl} target="_blank" rel="noopener noreferrer" style={{
                color: C.primary, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 3,
              }}>
                Abrir carpeta <ExternalLink size={10} />
              </a>
            </div>
          </div>
        )}

        {/* Save button */}
        {isAuthenticated && (
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}` }}>
            <button onClick={onSave} disabled={saving} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: "none",
              background: saving ? C.border : C.primary,
              color: "#fff", cursor: saving ? "wait" : "pointer",
              transition: TR, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? (
                <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</>
              ) : (
                <><Upload size={16} /> Guardar cotización actual en Drive</>
              )}
            </button>
            {currentQuotationCode && (
              <div style={{ fontSize: 11, color: C.ts, marginTop: 6, textAlign: "center" }}>
                Código: {currentQuotationCode}
              </div>
            )}
          </div>
        )}

        {/* Quotation list */}
        {isAuthenticated && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 20px", borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.brand }}>
                Cotizaciones guardadas
              </span>
              <button onClick={onRefresh} disabled={loading} style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 6, fontSize: 11,
                border: `1px solid ${C.border}`, background: C.surface,
                color: C.ts, cursor: loading ? "wait" : "pointer",
                transition: TR,
              }}>
                <RefreshCw size={12} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
                Actualizar
              </button>
            </div>

            <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "10px 20px" }}>
              {loading && quotations.length === 0 && (
                <div style={{ textAlign: "center", padding: 30, color: C.ts, fontSize: 13 }}>
                  <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
                  <div>Cargando cotizaciones…</div>
                </div>
              )}

              {!loading && quotations.length === 0 && (
                <div style={{ textAlign: "center", padding: 30, color: C.tt, fontSize: 13 }}>
                  No hay cotizaciones guardadas en Drive
                </div>
              )}

              {quotations.map((q) => (
                <div key={q.id} style={{
                  padding: "12px 14px", borderRadius: 12, marginBottom: 8,
                  border: `1px solid ${C.border}`, background: C.surfaceAlt,
                  transition: TR,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.tp, marginBottom: 4 }}>
                    {q.name}
                  </div>
                  <div style={{ fontSize: 11, color: C.ts, marginBottom: 10 }}>
                    {q.modifiedTime
                      ? new Date(q.modifiedTime).toLocaleString("es-UY", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : ""}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onLoad(q.id)} style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: "none", background: C.primary, color: "#fff", cursor: "pointer",
                    }}>
                      <Download size={13} /> Cargar
                    </button>
                    <a
                      href={`https://drive.google.com/drive/folders/${q.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "7px 10px", borderRadius: 8,
                        border: `1px solid ${C.border}`, background: C.surface,
                        color: C.ts, cursor: "pointer", textDecoration: "none",
                      }}
                    >
                      <ExternalLink size={13} />
                    </a>
                    <button onClick={() => onDelete(q.id)} style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "7px 10px", borderRadius: 8,
                      border: `1px solid ${C.dangerSoft}`, background: C.surface,
                      color: C.danger, cursor: "pointer",
                    }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
