/**
 * Panelin Multi-Context Agent — SharedWorkspace helpers.
 * Spec: docs/sdd/panelin-email-admin/SDD.md (ADR-PMCA-001)
 *
 * A ContextGroup shares one chat history + one workspace snapshot.
 * Focus tab is UI/OCR priority only — tools may act on any tab ref.
 */

export const WORKSPACE_TAB_KINDS = new Set(["email", "admin", "calc", "note", "crm"]);

/**
 * @param {unknown} raw
 * @returns {null | {
 *   groupId: string,
 *   groupLabel: string,
 *   focusTabId: string|null,
 *   tabs: Array<{id:string,kind:string,label?:string,ref?:object,summary?:string}>,
 *   sharedMemory: object,
 * }}
 */
export function normalizeSharedWorkspace(raw) {
  if (!raw || typeof raw !== "object") return null;
  const groupId = String(raw.groupId || raw.group_id || "").trim() || "default";
  const groupLabel = String(raw.groupLabel || raw.group_label || "Workspace").trim() || "Workspace";
  const focusTabId = raw.focusTabId != null || raw.focus_tab_id != null
    ? String(raw.focusTabId ?? raw.focus_tab_id)
    : null;
  const tabsIn = Array.isArray(raw.tabs) ? raw.tabs : [];
  const tabs = [];
  for (const t of tabsIn.slice(0, 12)) {
    if (!t || typeof t !== "object") continue;
    const id = String(t.id || "").trim();
    const kind = String(t.kind || "").trim().toLowerCase();
    if (!id || !WORKSPACE_TAB_KINDS.has(kind)) continue;
    tabs.push({
      id,
      kind,
      label: t.label != null ? String(t.label).slice(0, 80) : undefined,
      ref: t.ref && typeof t.ref === "object" ? t.ref : {},
      summary: t.summary != null ? String(t.summary).slice(0, 240) : undefined,
    });
  }
  const sharedMemory = raw.sharedMemory && typeof raw.sharedMemory === "object"
    ? raw.sharedMemory
    : (raw.shared_memory && typeof raw.shared_memory === "object" ? raw.shared_memory : {});
  return { groupId, groupLabel, focusTabId, tabs, sharedMemory };
}

/**
 * Prompt block for SharedWorkspace (append to operator context).
 * @param {ReturnType<typeof normalizeSharedWorkspace>} workspace
 */
export function formatSharedWorkspaceBlock(workspace) {
  if (!workspace) return "";
  const lines = [
    "## SHARED WORKSPACE (Multi-Context — todas las pestañas del grupo)",
    `- Grupo: ${workspace.groupLabel} (\`${workspace.groupId}\`)`,
    `- Focus tab (UI/OCR): ${workspace.focusTabId || "(ninguna)"}`,
    "- **Regla:** podés leer y actuar (via tools) sobre CUALQUIER pestaña del grupo sin que el operador cambie de pestaña. Focus ≠ aislamiento.",
  ];
  if (workspace.tabs.length === 0) {
    lines.push("- (sin pestañas pinned — usá tools email_*/sheets_*/calc según pedido)");
  } else {
    lines.push("- Pestañas:");
    for (const t of workspace.tabs) {
      const bit = t.summary ? ` — ${t.summary}` : "";
      const ref = t.ref && Object.keys(t.ref).length
        ? ` ref=${JSON.stringify(t.ref).slice(0, 160)}`
        : "";
      lines.push(`  · [${t.kind}] ${t.label || t.id}${ref}${bit}`);
    }
  }
  const flags = Array.isArray(workspace.sharedMemory?.flags)
    ? workspace.sharedMemory.flags.map(String)
    : [];
  if (workspace.sharedMemory?.clientName) {
    lines.push(`- sharedMemory.clientName: ${workspace.sharedMemory.clientName}`);
  }
  if (flags.length) lines.push(`- sharedMemory.flags: ${flags.join(", ")}`);
  return lines.join("\n");
}

/**
 * Heuristic classify for email / inbound text → Admin signals.
 * @param {string} text
 * @returns {{ label: string, confidence: number, reasons: string[], suggestAdminLead: boolean }}
 */
export function classifyEmailSignal(text) {
  const t = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const reasons = [];
  let scoreConsulta = 0;
  let scoreAlerta = 0;

  const consultaRe = [
    [/cotiz|presupuesto|precio|m2|panel|isoroof|isodec|techo|pared/, 2],
    [/necesito|consulta|cuanto|cuánto|envio|envio a/, 1],
    [/cliente|obra|galpon|galpón/, 1],
  ];
  const alertaRe = [
    [/urgente|asap|hoy mismo|reclamo|queja|demora|no llego|no llegó/, 2],
    [/factura|pago|deuda|bps|dgi|legal|abogado/, 2],
    [/error|falla|roto|problema grave/, 1],
  ];
  for (const [re, w] of consultaRe) {
    if (re.test(t)) {
      scoreConsulta += w;
      reasons.push(`consulta:${re}`);
    }
  }
  for (const [re, w] of alertaRe) {
    if (re.test(t)) {
      scoreAlerta += w;
      reasons.push(`alerta:${re}`);
    }
  }

  let label = "otro";
  let confidence = 0.35;
  if (scoreAlerta >= 2 && scoreAlerta >= scoreConsulta) {
    label = "alerta_admin";
    confidence = Math.min(0.95, 0.45 + scoreAlerta * 0.12);
  } else if (scoreConsulta >= 2) {
    label = "consulta_cliente";
    confidence = Math.min(0.95, 0.45 + scoreConsulta * 0.12);
  } else if (scoreConsulta >= 1) {
    label = "consulta_cliente";
    confidence = 0.55;
  }

  return {
    label,
    confidence,
    reasons: reasons.slice(0, 8),
    suggestAdminLead: label === "consulta_cliente" || label === "alerta_admin",
  };
}
