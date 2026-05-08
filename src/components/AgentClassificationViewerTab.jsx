import { useCallback, useEffect, useMemo, useState } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";

const LS_KEY = "bmc.agent.entityTaxonomy.v1";

const C = {
  bg: "#f5f5f7",
  surface: "#ffffff",
  border: "#e5e5ea",
  text: "#1d1d1f",
  sub: "#6e6e73",
  primary: "#0071e3",
  navy: "#1a3a5c",
  success: "#34c759",
  warn: "#ff9f0a",
  ff: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
};

const TIPOS = [
  { value: "cliente", label: "Cliente", color: C.primary },
  { value: "proveedor", label: "Proveedor", color: "#7c3aed" },
  { value: "lead", label: "Lead", color: C.warn },
  { value: "interno", label: "Interno", color: C.sub },
  { value: "otro", label: "Otro", color: C.navy },
];

function uid() {
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadEntities() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveEntities(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

function taxonomyAuthHeaders() {
  const key =
    typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_AUTH_TOKEN || "" : "";
  const h = { "Content-Type": "application/json", Accept: "application/json" };
  if (key) h["x-api-key"] = key;
  return h;
}

function Btn({ children, onClick, disabled, variant = "default", style: extra = {} }) {
  const base = {
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    background: C.surface,
    color: C.text,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontFamily: C.ff,
    whiteSpace: "nowrap",
    ...extra,
  };
  if (variant === "primary") Object.assign(base, { background: C.primary, color: "#fff", border: "none" });
  if (variant === "danger") Object.assign(base, { background: "#ff3b30", color: "#fff", border: "none" });
  if (variant === "navy") Object.assign(base, { background: C.navy, color: "#fff", border: "none" });
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={base}>
      {children}
    </button>
  );
}

function Pill({ children, color = C.primary }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        background: `${color}22`,
        color,
        letterSpacing: 0.3,
        textTransform: "uppercase",
        fontFamily: C.ff,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Viewer local para organizar actores (clientes, proveedores, etc.) con tipo y tags.
 * Persistencia: localStorage (migrable luego a columnas CRM / API).
 */
export default function AgentClassificationViewerTab() {
  const [entities, setEntities] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [filterTipo, setFilterTipo] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tipo, setTipo] = useState("cliente");
  const [tagsInput, setTagsInput] = useState("");
  const [notes, setNotes] = useState("");
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState("");
  const [crmRow, setCrmRow] = useState("");
  const [crmPushBusy, setCrmPushBusy] = useState(false);

  useEffect(() => {
    setEntities(loadEntities());
    setHydrated(true);
  }, []);

  const persist = useCallback((next) => {
    setEntities(next);
    saveEntities(next);
  }, []);

  const allTags = useMemo(() => {
    const s = new Set();
    for (const e of entities) {
      for (const t of e.tags || []) {
        if (t && String(t).trim()) s.add(String(t).trim().toLowerCase());
      }
    }
    return [...s].sort();
  }, [entities]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tagQ = filterTag.trim().toLowerCase();
    return entities.filter((e) => {
      if (filterTipo && e.tipo !== filterTipo) return false;
      if (tagQ && !(e.tags || []).some((t) => String(t).toLowerCase().includes(tagQ))) return false;
      if (q) {
        const blob = `${e.name || ""} ${e.email || ""} ${(e.tags || []).join(" ")} ${e.notes || ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [entities, filterTipo, filterTag, search]);

  const grouped = useMemo(() => {
    const g = {};
    for (const t of TIPOS) g[t.value] = [];
    for (const e of filtered) {
      const k = TIPOS.some((t) => t.value === e.tipo) ? e.tipo : "otro";
      if (!g[k]) g[k] = [];
      g[k].push(e);
    }
    return g;
  }, [filtered]);

  function parseTags(str) {
    return str
      .split(/[,;]+|\s+#/)
      .map((s) => s.replace(/^#/, "").trim())
      .filter(Boolean);
  }

  function addEntity() {
    if (!name.trim()) {
      setMsg("Nombre obligatorio.");
      return;
    }
    const row = {
      id: uid(),
      name: name.trim(),
      email: email.trim(),
      tipo,
      tags: parseTags(tagsInput),
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    persist([row, ...entities]);
    setName("");
    setEmail("");
    setTagsInput("");
    setNotes("");
    setMsg("Registro agregado.");
    setTimeout(() => setMsg(""), 2500);
  }

  function remove(id) {
    if (!window.confirm("¿Eliminar este registro?")) return;
    persist(entities.filter((e) => e.id !== id));
    setMsg("Eliminado.");
    setTimeout(() => setMsg(""), 2000);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(entities, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bmc-taxonomy-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Exportación lista.");
    setTimeout(() => setMsg(""), 2000);
  }

  function importJson() {
    try {
      const arr = JSON.parse(importText);
      if (!Array.isArray(arr)) throw new Error("El JSON debe ser un array.");
      const norm = arr.map((x) => ({
        id: x.id && String(x.id).startsWith("e_") ? x.id : uid(),
        name: String(x.name || "").trim() || "(sin nombre)",
        email: String(x.email || "").trim(),
        tipo: TIPOS.some((t) => t.value === x.tipo) ? x.tipo : "otro",
        tags: Array.isArray(x.tags) ? x.tags.map(String) : parseTags(String(x.tags || "")),
        notes: String(x.notes || "").trim(),
        updatedAt: x.updatedAt || new Date().toISOString(),
      }));
      persist([...norm, ...entities]);
      setImportText("");
      setMsg(`Importados ${norm.length} registros (fusionados al inicio).`);
      setTimeout(() => setMsg(""), 3500);
    } catch (e) {
      setMsg(String(e.message || e));
    }
  }

  if (!hydrated) {
    return <div style={{ fontSize: 13, color: C.sub, fontFamily: C.ff }}>Cargando datos locales…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: C.ff }}>
      <p style={{ margin: 0, fontSize: 13, color: C.sub, lineHeight: 1.55, maxWidth: 720 }}>
        Clasificá contactos para que el agente y vos compartan criterios: tipo de relación y etiquetas libres.
        Los datos locales viven en <code style={{ fontSize: 11 }}>localStorage</code>. Para la planilla, la taxonomía va en{" "}
        <strong>CRM_Operativo</strong> columnas <strong>AL–AN</strong> (ver doc cockpit): tipo, tags, notas. Exportá JSON antes de limpiar caché.
      </p>

      {msg ? (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: `${C.success}18`,
            border: `1px solid ${C.success}`,
            fontSize: 12,
            color: "#166534",
          }}
        >
          {msg}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            flex: "1 1 300px",
            minWidth: 0,
            maxWidth: "100%",
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Nuevo registro</div>
          <label style={{ fontSize: 11, color: C.sub }}>
            Nombre / razón social
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Depósito X / María Pérez"
              style={{
                marginTop: 4,
                width: "100%",
                boxSizing: "border-box",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13,
              }}
            />
          </label>
          <label style={{ fontSize: 11, color: C.sub }}>
            Email (opcional)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contacto@…"
              style={{
                marginTop: 4,
                width: "100%",
                boxSizing: "border-box",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13,
              }}
            />
          </label>
          <label style={{ fontSize: 11, color: C.sub }}>
            Tipo
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              style={{
                marginTop: 4,
                width: "100%",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13,
              }}
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 11, color: C.sub }}>
            Etiquetas (coma o #tag)
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="obra, materia-prima, #urgente"
              style={{
                marginTop: 4,
                width: "100%",
                boxSizing: "border-box",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13,
              }}
            />
          </label>
          <label style={{ fontSize: 11, color: C.sub }}>
            Notas
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Contexto para el futuro agente / CRM…"
              style={{
                marginTop: 4,
                width: "100%",
                boxSizing: "border-box",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 12,
                resize: "vertical",
              }}
            />
          </label>
          <Btn variant="primary" onClick={addEntity}>
            Agregar
          </Btn>

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Enviar borrador a CRM (fila)</div>
            <label style={{ fontSize: 11, color: C.sub }}>
              Nº fila CRM_Operativo (≥ 4)
              <input
                type="number"
                min={4}
                value={crmRow}
                onChange={(e) => setCrmRow(e.target.value)}
                placeholder="ej. 42"
                style={{
                  marginTop: 4,
                  width: "100%",
                  boxSizing: "border-box",
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 13,
                }}
              />
            </label>
            <Btn
              variant="navy"
              disabled={crmPushBusy || !crmRow.trim()}
              onClick={async () => {
                const row = Number(String(crmRow).trim());
                if (!row || row < 4) {
                  setMsg("Fila inválida (≥ 4).");
                  return;
                }
                const token =
                  typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_AUTH_TOKEN || "" : "";
                if (!token) {
                  setMsg("Configurá VITE_API_AUTH_TOKEN para escribir en CRM.");
                  return;
                }
                const extra =
                  [name.trim() && `Contacto: ${name.trim()}`, email.trim() && `Email: ${email.trim()}`]
                    .filter(Boolean)
                    .join(" · ");
                const notasMerged = [notes.trim(), extra].filter(Boolean).join("\n");
                setCrmPushBusy(true);
                try {
                  const url = `${getCalcApiBase().replace(/\/$/, "")}/api/crm/cockpit/taxonomy-row`;
                  const res = await fetch(url, {
                    method: "POST",
                    headers: taxonomyAuthHeaders(),
                    body: JSON.stringify({
                      row,
                      tipoContacto: tipo,
                      tags: tagsInput.trim() || undefined,
                      notas: notasMerged || undefined,
                    }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok || !data.ok) {
                    setMsg(data.error || `HTTP ${res.status}`);
                    return;
                  }
                  setMsg(`CRM fila ${row}: taxonomía actualizada (AL–AN).`);
                  setTimeout(() => setMsg(""), 3500);
                } catch (e) {
                  setMsg(String(e.message || e));
                } finally {
                  setCrmPushBusy(false);
                }
              }}
              style={{ marginTop: 10, background: C.navy, color: "#fff", border: "none" }}
            >
              {crmPushBusy ? "Guardando…" : "Escribir AL–AN en CRM"}
            </Btn>
            <div style={{ fontSize: 10, color: C.sub, marginTop: 6, lineHeight: 1.45 }}>
              Requiere API con Sheets y títulos en fila 3 para AL–AN. Usa los valores del formulario de arriba.
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "1 1 300px",
            minWidth: 0,
            maxWidth: "100%",
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Filtros y datos</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}
            >
              <option value="">Todos los tipos</option>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              placeholder="Filtrar por tag…"
              style={{ flex: "1 1 140px", minWidth: 120, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar texto libre…"
              style={{ flex: "2 1 200px", minWidth: 160, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}
            />
          </div>
          {allTags.length > 0 && (
            <div style={{ fontSize: 11, color: C.sub, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>Tags en uso:</span>
              {allTags.slice(0, 24).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterTag(t)}
                  style={{
                    border: `1px solid ${C.border}`,
                    background: "#fff",
                    borderRadius: 20,
                    padding: "2px 8px",
                    fontSize: 10,
                    cursor: "pointer",
                  }}
                >
                  {t}
                </button>
              ))}
              {allTags.length > 24 ? <span>…</span> : null}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn onClick={exportJson}>Exportar JSON</Btn>
            <Btn
              variant="danger"
              onClick={() => {
                if (!window.confirm("¿Borrar todos los registros locales?")) return;
                persist([]);
                setMsg("Lista vaciada.");
                setTimeout(() => setMsg(""), 2000);
              }}
            >
              Vaciar todo
            </Btn>
          </div>
          <label style={{ fontSize: 11, color: C.sub }}>
            Pegar JSON para importar (array de objetos)
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={4}
              placeholder='[{"name":"…","tipo":"proveedor","tags":["ladrillos"]}]'
              style={{
                marginTop: 4,
                width: "100%",
                boxSizing: "border-box",
                fontFamily: "monospace",
                fontSize: 11,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 8,
              }}
            />
          </label>
          <Btn onClick={importJson}>Importar y fusionar</Btn>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
        Vista agrupada · {filtered.length} de {entities.length} registros
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {TIPOS.map((t) => {
          const list = grouped[t.value] || [];
          if (list.length === 0) return null;
          return (
            <section key={t.value}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Pill color={t.color}>{t.label}</Pill>
                <span style={{ fontSize: 11, color: C.sub }}>{list.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {list.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 4 }}>{e.name}</div>
                      {e.email ? (
                        <div style={{ fontSize: 12, color: C.primary, marginBottom: 4 }}>
                          <a href={`mailto:${e.email}`}>{e.email}</a>
                        </div>
                      ) : null}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
                        {(e.tags || []).map((tag) => (
                          <Pill key={tag} color={C.sub}>
                            {tag}
                          </Pill>
                        ))}
                      </div>
                      {e.notes ? (
                        <div style={{ fontSize: 12, color: C.sub, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{e.notes}</div>
                      ) : null}
                      <div style={{ fontSize: 10, color: C.sub, marginTop: 6 }}>
                        actualizado {e.updatedAt ? new Date(e.updatedAt).toLocaleString("es-UY") : "—"}
                      </div>
                    </div>
                    <Btn variant="danger" onClick={() => remove(e.id)} style={{ padding: "4px 8px", fontSize: 11 }}>
                      Borrar
                    </Btn>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {entities.length === 0 && (
        <div style={{ fontSize: 13, color: C.sub, fontStyle: "italic", padding: "24px 0" }}>
          No hay registros todavía. Agregá proveedores y clientes clave para entrenar consistencia con el agente.
        </div>
      )}
    </div>
  );
}
