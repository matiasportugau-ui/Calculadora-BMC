// ═══════════════════════════════════════════════════════════════════════════
// src/components/DriveFolderConfig.jsx — per-user Drive folder configurator.
// ───────────────────────────────────────────────────────────────────────────
// Rendered inside the "Drive" tab (GoogleDrivePanel). Lets each internal user
// pick (via Google Picker), validate (write permission), and persist the folder
// where their quotations auto-save. State machine: idle | picking | validating
// | error; "configured" is derived from config.valid. See SPEC §6, §8, §12.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import {
  FolderInput, FolderCheck, AlertTriangle, RefreshCw, CheckCircle,
} from "lucide-react";

import { pickFolder, validateFolderWritable } from "../utils/googleDrive.js";
import { saveDriveConfig } from "../utils/driveConfigApi.js";

const C = {
  surface: "#FFFFFF", surfaceAlt: "#FAFAFA",
  primary: "#0071E3",
  brand: "#1A3A5C",
  success: "#34C759", successSoft: "#E9F8EE",
  warning: "#FF9F0A", warningSoft: "#FFF5E6",
  danger: "#FF3B30", dangerSoft: "#FFECEB",
  border: "#E5E5EA",
  tp: "#1D1D1F", ts: "#6E6E73",
};
const TR = "all 150ms cubic-bezier(0.4,0,0.2,1)";

const REASON_MSG = {
  no_write_permission: "No tenés permiso de escritura en esa carpeta. Elegí otra o pedí acceso de editor.",
  trashed: "Esa carpeta está en la papelera. Restaurála o elegí otra.",
  not_found: "No se pudo acceder a la carpeta (¿borrada o sin permiso?). Volvé a seleccionarla.",
  not_a_folder: "El elemento seleccionado no es una carpeta.",
  missing_folder: "No se seleccionó ninguna carpeta.",
  error: "No se pudo validar la carpeta. Reintentá.",
};

export default function DriveFolderConfig({
  config,
  accessToken,
  pickerConfigured = true,
  onConfigured,
}) {
  const [status, setStatus] = useState("idle"); // idle | picking | validating | error
  const [error, setError] = useState(null);

  const configured = !!(config?.folderId && config?.valid);
  const busy = status === "picking" || status === "validating";

  async function handleSelect() {
    setError(null);
    setStatus("picking");
    try {
      const picked = await pickFolder();
      if (!picked) {
        // Picker cancelado → volver al estado anterior sin cambios (SPEC §12).
        setStatus("idle");
        return;
      }
      setStatus("validating");
      const check = await validateFolderWritable(picked.folderId);
      if (!check.valid) {
        setError(REASON_MSG[check.reason] || REASON_MSG.error);
        setStatus("error");
        return;
      }
      const saved = await saveDriveConfig(accessToken, {
        folderId: picked.folderId,
        folderName: check.name || picked.folderName,
        valid: true,
      });
      onConfigured?.(saved);
      setStatus("idle");
    } catch (err) {
      setError(err?.message || "No se pudo configurar la carpeta.");
      setStatus("error");
    }
  }

  if (!pickerConfigured) {
    return (
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{
          padding: "12px 14px", borderRadius: 10,
          background: C.warningSoft, color: "#7A4A00", fontSize: 12, lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={14} /> Selector de carpeta no configurado
          </div>
          Falta <code style={{ background: "#fff", padding: "1px 5px", borderRadius: 4 }}>VITE_GOOGLE_API_KEY</code>.
          {" "}Pedile al admin que habilite la Google Picker API y sincronice la variable.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}` }}>
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

      {/* Action */}
      <button
        onClick={handleSelect}
        disabled={busy}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          border: `1px solid ${C.border}`,
          background: busy ? C.surfaceAlt : C.surface,
          color: C.primary, cursor: busy ? "wait" : "pointer", transition: TR,
        }}
      >
        {status === "picking" && (<><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Abriendo selector…</>)}
        {status === "validating" && (<><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Validando carpeta…</>)}
        {!busy && (<><FolderInput size={14} /> {configured ? "Cambiar carpeta" : "Seleccionar carpeta"}</>)}
      </button>

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

      {!configured && status !== "error" && (
        <div style={{ fontSize: 11, color: C.ts, marginTop: 8, lineHeight: 1.4, display: "flex", alignItems: "flex-start", gap: 6 }}>
          <CheckCircle size={12} style={{ flexShrink: 0, marginTop: 2, color: C.success }} />
          Configurá tu carpeta una sola vez; desde ahí cada cotización se guarda automáticamente.
        </div>
      )}
    </div>
  );
}
