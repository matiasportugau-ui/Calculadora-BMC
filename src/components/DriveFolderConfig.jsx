// ═══════════════════════════════════════════════════════════════════════════
// src/components/DriveFolderConfig.jsx — per-user Drive folder configurator.
// ───────────────────────────────────────────────────────────────────────────
// Rendered inside the "Drive" tab (GoogleDrivePanel). Lets each internal user
// choose/create (in-app, via the Drive API + their own drive.file token),
// validate (write permission), and persist the folder where their quotations
// auto-save. State machine: idle | browsing | working | error; "configured" is
// derived from config.valid. See SPEC §6, §8, §12.
//
// Note: under the minimal drive.file scope the browser only lists folders this
// app created in the user's Drive (not arbitrary pre-existing folders); users
// create/select an app-managed folder. The shared/consolidated destination is
// handled separately by the company Drive archive.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from "react";
import {
  FolderInput, FolderCheck, FolderPlus, AlertTriangle, RefreshCw, CheckCircle,
} from "lucide-react";

import {
  listSelectableFolders, createSelectableFolder, validateFolderWritable,
} from "../utils/googleDrive.js";
import { saveDriveConfig } from "../utils/driveConfigApi.js";

const C = {
  surface: "#FFFFFF", surfaceAlt: "#FAFAFA",
  primary: "#0071E3", primarySoft: "#E8F1FB",
  brand: "#1A3A5C",
  success: "#34C759", successSoft: "#E9F8EE",
  danger: "#FF3B30", dangerSoft: "#FFECEB",
  border: "#E5E5EA",
  tp: "#1D1D1F", ts: "#6E6E73",
};
const TR = "all 150ms cubic-bezier(0.4,0,0.2,1)";

const REASON_MSG = {
  no_write_permission: "No tenés permiso de escritura en esa carpeta. Elegí o creá otra.",
  trashed: "Esa carpeta está en la papelera. Elegí o creá otra.",
  not_found: "No se pudo acceder a la carpeta. Elegí o creá otra.",
  not_a_folder: "El elemento seleccionado no es una carpeta.",
  missing_folder: "No se seleccionó ninguna carpeta.",
  error: "No se pudo validar la carpeta. Reintentá.",
};

export default function DriveFolderConfig({ config, accessToken, onConfigured }) {
  const [status, setStatus] = useState("idle"); // idle | browsing | working | error
  const [error, setError] = useState(null);
  const [folders, setFolders] = useState([]);
  const [newName, setNewName] = useState("");

  const configured = !!(config?.folderId && config?.valid);
  const busy = status === "working";

  const openBrowser = useCallback(async () => {
    setError(null);
    setStatus("working");
    try {
      const list = await listSelectableFolders();
      setFolders(list);
      setStatus("browsing");
    } catch (err) {
      setError(err?.message || "No se pudieron listar las carpetas.");
      setStatus("error");
    }
  }, []);

  // Validate write permission then persist { folderId, folderName }.
  const commitFolder = useCallback(async (folderId, folderName) => {
    setStatus("working");
    setError(null);
    try {
      const check = await validateFolderWritable(folderId);
      if (!check.valid) {
        setError(REASON_MSG[check.reason] || REASON_MSG.error);
        setStatus("error");
        return;
      }
      const saved = await saveDriveConfig(accessToken, {
        folderId,
        folderName: check.name || folderName,
        valid: true,
      });
      onConfigured?.(saved);
      setNewName("");
      setStatus("idle");
    } catch (err) {
      setError(err?.message || "No se pudo configurar la carpeta.");
      setStatus("error");
    }
  }, [accessToken, onConfigured]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setStatus("working");
    setError(null);
    try {
      const created = await createSelectableFolder(name);
      await commitFolder(created.id, created.name);
    } catch (err) {
      setError(err?.message || "No se pudo crear la carpeta.");
      setStatus("error");
    }
  }, [newName, commitFolder]);

  // The folder config is persisted via /api/drive/config, which requires the
  // BMC identity JWT (accessToken) — distinct from the Google Drive token.
  // Without it the POST/GET would 401, so prompt for BMC login instead of
  // rendering controls that can't succeed. (Codex P2.)
  if (!accessToken) {
    return (
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.brand, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Carpeta de guardado
        </div>
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 7,
          padding: "10px 12px", borderRadius: 10,
          background: C.surfaceAlt, border: `1px solid ${C.border}`,
          fontSize: 12, color: C.ts, lineHeight: 1.4,
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1, color: "#FF9F0A" }} />
          Iniciá sesión en BMC para configurar tu carpeta de guardado.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}` }}>
      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.brand, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Carpeta de guardado
      </div>

      {/* Current status */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", borderRadius: 10, marginBottom: 10,
        background: configured ? C.successSoft : C.surfaceAlt,
        border: `1px solid ${configured ? "#BCE8C8" : C.border}`,
      }}>
        {configured ? <FolderCheck size={18} color="#1B7A2E" /> : <FolderInput size={18} color={C.ts} />}
        <div style={{ minWidth: 0 }}>
          {configured ? (
            <>
              <div style={{ fontSize: 11, color: "#1B7A2E", fontWeight: 600 }}>Carpeta configurada</div>
              <div style={{ fontSize: 13, color: C.tp, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {config.folderName || config.folderId}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: C.ts }}>Sin carpeta configurada</div>
          )}
        </div>
      </div>

      {/* Trigger */}
      {status !== "browsing" && (
        <button
          onClick={openBrowser}
          disabled={busy}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: `1px solid ${C.border}`,
            background: busy ? C.surfaceAlt : C.surface,
            color: C.primary, cursor: busy ? "wait" : "pointer", transition: TR,
          }}
        >
          {busy
            ? (<><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Trabajando…</>)
            : (<><FolderInput size={14} /> {configured ? "Cambiar carpeta" : "Elegir carpeta"}</>)}
        </button>
      )}

      {/* In-app browser */}
      {status === "browsing" && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ maxHeight: 180, overflowY: "auto", background: C.surface }}>
            {folders.length === 0 && (
              <div style={{ padding: "12px 14px", fontSize: 12, color: C.ts }}>
                No hay carpetas creadas por la app todavía. Creá una abajo.
              </div>
            )}
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => commitFolder(f.id, f.name)}
                style={{
                  width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", border: "none", borderBottom: `1px solid ${C.border}`,
                  background: C.surface, color: C.tp, fontSize: 13, cursor: "pointer",
                }}
              >
                <FolderInput size={14} color={C.ts} />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
              </button>
            ))}
          </div>
          {/* Create new */}
          <div style={{ display: "flex", gap: 6, padding: 8, background: C.surfaceAlt, borderTop: `1px solid ${C.border}` }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              placeholder="Crear carpeta nueva…"
              style={{
                flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 13,
                border: `1px solid ${C.border}`, outline: "none", color: C.tp,
              }}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: "none", background: newName.trim() ? C.primary : C.border,
                color: "#fff", cursor: newName.trim() ? "pointer" : "default",
              }}
            >
              <FolderPlus size={13} /> Crear
            </button>
          </div>
        </div>
      )}

      {/* Error feedback */}
      {status === "error" && error && (
        <div style={{
          marginTop: 10, padding: "9px 12px", borderRadius: 10,
          background: C.dangerSoft, color: C.danger, fontSize: 12,
          display: "flex", alignItems: "flex-start", gap: 7, lineHeight: 1.4,
        }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      {!configured && status !== "error" && status !== "browsing" && (
        <div style={{ fontSize: 11, color: C.ts, marginTop: 8, lineHeight: 1.4, display: "flex", alignItems: "flex-start", gap: 6 }}>
          <CheckCircle size={12} style={{ flexShrink: 0, marginTop: 2, color: C.success }} />
          Configurá tu carpeta una sola vez; desde ahí cada cotización se guarda automáticamente.
        </div>
      )}
    </div>
  );
}
