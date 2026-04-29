import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import BmcModuleNav from "./BmcModuleNav.jsx";

// ── tokens ─────────────────────────────────────────────────────────────────
const C = {
  bg: "#f5f5f7",
  surface: "#ffffff",
  border: "#e5e5ea",
  text: "#1d1d1f",
  sub: "#6e6e73",
  primary: "#0071e3",
  navy: "#1a3a5c",
  danger: "#ff3b30",
  success: "#34c759",
  warn: "#ff9f0a",
  sidebar: "#1a3a5c",
  sidebarText: "rgba(255,255,255,0.85)",
  sidebarActive: "rgba(255,255,255,0.14)",
  ff: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
};

function authHeaders() {
  const key =
    typeof import.meta !== "undefined"
      ? import.meta.env?.VITE_API_AUTH_TOKEN || ""
      : "";
  const h = { "Content-Type": "application/json", Accept: "application/json" };
  if (key) h["x-api-key"] = key;
  return h;
}

function apiBase() {
  return getCalcApiBase();
}

async function apiFetch(path, opts = {}) {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, { headers: authHeaders(), ...opts });
  const json = await res.json().catch(() => ({ ok: false, error: "JSON parse error" }));
  if (!res.ok && json.ok === undefined) json.ok = false;
  return json;
}

// ── small helpers ──────────────────────────────────────────────────────────
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
  if (variant === "danger") Object.assign(base, { background: C.danger, color: "#fff", border: "none" });
  if (variant === "navy") Object.assign(base, { background: C.navy, color: "#fff", border: "none" });
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={base}>
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, style: extra = {}, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 12,
        fontFamily: C.ff,
        color: C.text,
        background: "#fff",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        ...extra,
      }}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 4, style: extra = {} }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
        fontFamily: "monospace",
        color: C.text,
        background: "#fff",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        resize: "vertical",
        lineHeight: 1.5,
        ...extra,
      }}
    />
  );
}

function Select({ value, onChange, options, style: extra = {} }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 12,
        fontFamily: C.ff,
        color: C.text,
        background: "#fff",
        outline: "none",
        ...extra,
      }}
    >
      {options.map(({ value: v, label }) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}

function Card({ children, style: extra = {} }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 16,
        ...extra,
      }}
    >
      {children}
    </div>
  );
}

function Alert({ msg, type = "error" }) {
  if (!msg) return null;
  const color = type === "error" ? C.danger : type === "success" ? C.success : C.warn;
  return (
    <div style={{ padding: "8px 12px", borderRadius: 8, background: `${color}18`, border: `1px solid ${color}`, fontSize: 12, color, fontFamily: C.ff, marginBottom: 8 }}>
      {msg}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, fontFamily: C.ff }}>{children}</div>;
}

// ── KB TAB ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: "", label: "Todas" },
  { value: "sales", label: "Ventas" },
  { value: "product", label: "Producto" },
  { value: "math", label: "Matemática" },
  { value: "conversational", label: "Conversacional" },
];

function KBEntry({ entry, onEdit, onDelete, selected, onToggle }) {
  const catColor = { sales: C.primary, product: C.success, math: C.warn, conversational: C.navy }[entry.category] || C.sub;
  return (
    <div
      style={{
        border: `1px solid ${selected ? C.primary : C.border}`,
        borderRadius: 8,
        padding: "10px 12px",
        background: selected ? `${C.primary}08` : "#fff",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(entry.id)}
        style={{ marginTop: 2, cursor: "pointer", flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
          <Pill color={catColor}>{entry.category}</Pill>
          {entry.permanent && <Pill color={C.success}>permanente</Pill>}
          {entry.tags?.map((t) => <Pill key={t} color={C.sub}>{t}</Pill>)}
          {(entry.goodAnswer || entry.answer || "").length > 350 && !entry.goodAnswerML && (
            <Pill color="#dc2626" title="goodAnswer >350 chars sin override ML — truncación automática activa">⚠ ML gap</Pill>
          )}
          {entry.reviewDueAt && entry.reviewDueAt < new Date().toISOString() && (
            <Pill color="#d97706" title={`Vence: ${entry.reviewDueAt?.slice(0,10)}`}>vencida</Pill>
          )}
          {entry.retrievalCount != null && (
            <span style={{ fontSize: 10, color: entry.retrievalCount === 0 ? "#9ca3af" : "#16a34a", fontFamily: C.ff }}>
              {entry.retrievalCount}× usado
            </span>
          )}
          <span style={{ fontSize: 10, color: C.sub, marginLeft: "auto", fontFamily: C.ff }}>
            {entry.id?.slice(0, 8)}
          </span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 3, fontFamily: C.ff, lineHeight: 1.35 }}>
          {entry.question}
        </div>
        <div style={{ fontSize: 12, color: C.sub, fontFamily: C.ff, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
          {entry.answer}
        </div>
        {entry.context && (
          <div style={{ fontSize: 11, color: C.sub, marginTop: 4, fontStyle: "italic", fontFamily: C.ff }}>
            Contexto: {entry.context}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        <Btn onClick={() => onEdit(entry)} style={{ padding: "4px 8px", fontSize: 11 }}>Editar</Btn>
        <Btn onClick={() => onDelete(entry.id)} variant="danger" style={{ padding: "4px 8px", fontSize: 11 }}>Borrar</Btn>
      </div>
    </div>
  );
}

function KBEditModal({ entry, onClose, onSaved }) {
  const [q, setQ] = useState(entry?.question || "");
  const [a, setA] = useState(entry?.answer || "");
  const [cat, setCat] = useState(entry?.category || "conversational");
  const [ctx, setCtx] = useState(entry?.context || "");
  const [permanent, setPermanent] = useState(entry?.permanent || false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const isNew = !entry?.id;

  async function save() {
    if (!q.trim() || !a.trim()) { setErr("Pregunta y respuesta son obligatorias."); return; }
    setSaving(true); setErr("");
    try {
      const body = { question: q.trim(), answer: a.trim(), category: cat, context: ctx.trim(), permanent };
      const path = isNew ? "/api/agent/train" : `/api/agent/train/${entry.id}`;
      const method = isNew ? "POST" : "PUT";
      const data = await apiFetch(path, { method, body: JSON.stringify(body) });
      if (!data.ok) { setErr(data.error || "Error al guardar"); return; }
      onSaved(data.entry);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 600, display: "flex", flexDirection: "column", gap: 12, fontFamily: C.ff }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{isNew ? "Nueva entrada KB" : "Editar entrada KB"}</span>
          <Btn onClick={onClose}>✕</Btn>
        </div>
        <Alert msg={err} />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <SectionLabel>Categoría</SectionLabel>
            <Select value={cat} onChange={setCat} options={CATEGORIES.slice(1)} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <label style={{ fontSize: 12, color: C.sub, display: "flex", gap: 6, alignItems: "center", paddingBottom: 2 }}>
              <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
              Permanente (siempre incluida)
            </label>
          </div>
        </div>
        <div>
          <SectionLabel>Pregunta / trigger</SectionLabel>
          <Input value={q} onChange={setQ} placeholder="¿Cuál es el precio del ISODEC 100mm?" />
        </div>
        <div>
          <SectionLabel>Respuesta correcta</SectionLabel>
          <Textarea value={a} onChange={setA} placeholder="El ISODEC EPS 100mm tiene un precio de..." rows={5} />
        </div>
        <div>
          <SectionLabel>Contexto (opcional)</SectionLabel>
          <Input value={ctx} onChange={setCtx} placeholder="Lista web, cliente final, etc." />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn onClick={save} disabled={saving} variant="primary">{saving ? "Guardando…" : "Guardar"}</Btn>
        </div>
      </div>
    </div>
  );
}

function KBTab() {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [query, setQuery] = useState("");
  const [editEntry, setEditEntry] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkMsg, setBulkMsg] = useState("");
  const [uploadErr, setUploadErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [matchQuery, setMatchQuery] = useState("");
  const [matchResults, setMatchResults] = useState(null);
  const [generatingML, setGeneratingML] = useState(false);
  const [mlGenMsg, setMlGenMsg] = useState("");
  const fileRef = useRef();

  const PAGE_SIZE = 30;
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const params = catFilter ? `?category=${encodeURIComponent(catFilter)}` : "";
      const data = await apiFetch(`/api/agent/training-kb${params}`);
      if (!data.ok) { setErr(data.error || "Error al cargar KB"); return; }
      setEntries(data.entries || []);
      setStats(data.stats || null);
      setSelectedIds(new Set());
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, [catFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter((e) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (e.question || "").toLowerCase().includes(q) ||
      (e.answer || "").toLowerCase().includes(q) ||
      (e.context || "").toLowerCase().includes(q)
    );
  });

  const pageEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function deleteEntry(id) {
    if (!window.confirm("¿Borrar esta entrada?")) return;
    const data = await apiFetch(`/api/agent/train/${id}`, { method: "DELETE" });
    if (data.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
    else setErr(data.error || "Error al borrar");
  }

  async function bulkDelete() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!window.confirm(`¿Borrar ${ids.length} entrada(s)?`)) return;
    setBulkMsg("Borrando…");
    const data = await apiFetch("/api/agent/train/bulk", { method: "DELETE", body: JSON.stringify({ ids }) });
    if (data.ok) {
      setEntries((prev) => prev.filter((e) => !selectedIds.has(e.id)));
      setSelectedIds(new Set());
      setBulkMsg(`${ids.length} entrada(s) borradas.`);
    } else {
      setBulkMsg(data.error || "Error en bulk delete");
    }
    setTimeout(() => setBulkMsg(""), 3000);
  }

  function selectAll() {
    setSelectedIds(new Set(pageEntries.map((e) => e.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(""); setUploading(true);
    try {
      const text = await file.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { setUploadErr("Archivo JSON inválido."); return; }
      const items = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(items)) { setUploadErr("El JSON debe ser un array o tener campo 'entries'."); return; }
      const valid = items.filter((it) => it.question && it.answer).slice(0, 50);
      if (!valid.length) { setUploadErr("Sin entradas válidas (necesitan question + answer)."); return; }
      let ok = 0;
      for (const it of valid) {
        const body = {
          question: String(it.question || "").trim(),
          answer: String(it.answer || "").trim(),
          category: String(it.category || "conversational"),
          context: String(it.context || ""),
          permanent: !!it.permanent,
        };
        const r = await apiFetch("/api/agent/train", { method: "POST", body: JSON.stringify(body) });
        if (r.ok) ok++;
      }
      setUploadErr(`Importadas ${ok} de ${valid.length} entradas.`);
      load();
    } catch (ex) {
      setUploadErr(String(ex.message || ex));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function testMatch() {
    if (!matchQuery.trim()) return;
    const data = await apiFetch(`/api/agent/training-kb/match?q=${encodeURIComponent(matchQuery)}&limit=5`);
    setMatchResults(data.matches || []);
  }

  async function generateMLOverrides() {
    setGeneratingML(true); setMlGenMsg("");
    const data = await apiFetch("/api/agent/training-kb/generate-ml-overrides", { method: "POST", body: JSON.stringify({}) });
    setGeneratingML(false);
    if (data.ok) {
      setMlGenMsg(`✓ ${data.generated} overrides ML generados (${data.failed} fallaron)`);
      load();
    } else {
      setMlGenMsg("Error: " + (data.error || "desconocido"));
    }
    setTimeout(() => setMlGenMsg(""), 6000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats bar */}
      {stats && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            ["Total", stats.total, null],
            ["Sales", stats.byCategory?.sales || 0, null],
            ["Producto", stats.byCategory?.product || 0, null],
            ["Math", stats.byCategory?.math || 0, null],
            ["Pendientes", stats.pending || 0, stats.pending > 0 ? "#d97706" : null],
            ["Vencidas", stats.health?.stale || 0, stats.health?.stale > 0 ? "#dc2626" : null],
            ["Sin uso 30d", stats.health?.zeroRetrieval || 0, stats.health?.zeroRetrieval > 0 ? "#6b7280" : null],
            ["Gap ML", stats.health?.mlGap || 0, stats.health?.mlGap > 0 ? "#dc2626" : null],
          ].map(([label, val, color]) => (
            <Card key={label} style={{ padding: "8px 14px", flex: "none", borderColor: color ? color : undefined }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: color || C.navy, fontFamily: C.ff }}>{val}</div>
              <div style={{ fontSize: 11, color: C.sub, fontFamily: C.ff }}>{label}</div>
            </Card>
          ))}
          {stats.health?.score != null && (
            <Card style={{ padding: "8px 14px", flex: "none", borderColor: stats.health.score >= 80 ? "#16a34a" : stats.health.score >= 50 ? "#d97706" : "#dc2626" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: stats.health.score >= 80 ? "#16a34a" : stats.health.score >= 50 ? "#d97706" : "#dc2626", fontFamily: C.ff }}>{stats.health.score}/100</div>
              <div style={{ fontSize: 11, color: C.sub, fontFamily: C.ff }}>KB Score</div>
            </Card>
          )}
        </div>
      )}

      {/* Controls */}
      <Card>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Select value={catFilter} onChange={(v) => { setCatFilter(v); setPage(1); }} options={CATEGORIES} style={{ width: "auto" }} />
          <Input value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Buscar en KB…" style={{ width: 220 }} />
          <Btn onClick={load} disabled={loading}>{loading ? "Cargando…" : "↺ Recargar"}</Btn>
          <Btn onClick={() => { setEditEntry(null); setShowEdit(true); }} variant="primary">+ Nueva entrada</Btn>
          {(stats?.health?.mlGap || 0) > 0 && (
            <Btn onClick={generateMLOverrides} disabled={generatingML} style={{ background: "#dc2626", color: "#fff", border: "none" }}>
              {generatingML ? "Generando…" : `⚡ Auto-ML (${stats.health.mlGap})`}
            </Btn>
          )}
          {mlGenMsg && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>{mlGenMsg}</span>}
          <div style={{ flex: 1 }} />
          <label
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              background: uploading ? C.sub : C.navy,
              color: "#fff",
              fontSize: 12,
              fontWeight: 500,
              cursor: uploading ? "not-allowed" : "pointer",
              fontFamily: C.ff,
              whiteSpace: "nowrap",
            }}
          >
            {uploading ? "Importando…" : "↑ Importar JSON"}
            <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>
        {uploadErr && <div style={{ fontSize: 12, color: uploadErr.includes("Importadas") ? C.success : C.danger, marginTop: 8, fontFamily: C.ff }}>{uploadErr}</div>}
      </Card>

      {/* Test matching */}
      <Card>
        <SectionLabel>Test de matching KB</SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <Input value={matchQuery} onChange={setMatchQuery} placeholder="Escribí una pregunta para ver qué entradas matchean…" />
          <Btn onClick={testMatch} variant="navy">Testear</Btn>
        </div>
        {matchResults !== null && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {matchResults.length === 0
              ? <div style={{ fontSize: 12, color: C.sub, fontFamily: C.ff }}>Sin matches encontrados.</div>
              : matchResults.map((m, i) => (
                <div key={i} style={{ fontSize: 12, color: C.text, fontFamily: C.ff, borderLeft: `3px solid ${C.primary}`, paddingLeft: 8 }}>
                  <b>Score {m.score?.toFixed ? m.score.toFixed(2) : m.score}</b> · {m.question}
                </div>
              ))
            }
          </div>
        )}
      </Card>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", background: `${C.primary}12`, borderRadius: 8, border: `1px solid ${C.primary}44` }}>
          <span style={{ fontSize: 12, color: C.navy, fontFamily: C.ff }}>{selectedIds.size} seleccionada(s)</span>
          <Btn onClick={bulkDelete} variant="danger">Borrar selección</Btn>
          <Btn onClick={clearSelection}>Limpiar selección</Btn>
          {bulkMsg && <span style={{ fontSize: 12, color: C.success, fontFamily: C.ff }}>{bulkMsg}</span>}
        </div>
      )}

      <Alert msg={err} />

      {/* Entry list */}
      {!selectedIds.size && pageEntries.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Btn onClick={selectAll} style={{ padding: "4px 8px", fontSize: 11 }}>Seleccionar página</Btn>
          <span style={{ fontSize: 11, color: C.sub, fontFamily: C.ff }}>
            {filtered.length} entradas{query ? " (filtradas)" : ""} · página {page}/{totalPages}
          </span>
          <div style={{ flex: 1 }} />
          <Btn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: "4px 8px", fontSize: 11 }}>‹ Anterior</Btn>
          <Btn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: "4px 8px", fontSize: 11 }}>Siguiente ›</Btn>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pageEntries.map((e) => (
          <KBEntry
            key={e.id}
            entry={e}
            selected={selectedIds.has(e.id)}
            onToggle={toggleSelect}
            onEdit={(en) => { setEditEntry(en); setShowEdit(true); }}
            onDelete={deleteEntry}
          />
        ))}
        {pageEntries.length === 0 && !loading && (
          <div style={{ fontSize: 12, color: C.sub, fontFamily: C.ff, textAlign: "center", padding: 24 }}>
            Sin entradas. Agregá la primera con &quot;+ Nueva entrada&quot;.
          </div>
        )}
      </div>

      {showEdit && (
        <KBEditModal
          entry={editEntry}
          onClose={() => setShowEdit(false)}
          onSaved={(saved) => {
            setEntries((prev) => {
              const idx = prev.findIndex((e) => e.id === saved.id);
              if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n; }
              return [saved, ...prev];
            });
            setShowEdit(false);
          }}
        />
      )}
    </div>
  );
}

// ── PROMPT TAB ─────────────────────────────────────────────────────────────
const PROMPT_SECTIONS = ["IDENTITY", "CATALOG", "WORKFLOW", "ACTIONS_DOC"];

function PromptTab() {
  const [sections, setSections] = useState({});
  const [activeSec, setActiveSec] = useState("WORKFLOW");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "success" });
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [preview, setPreview] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch("/api/agent/dev-config");
    if (data.ok) setSections(data.sections || {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setDraft(sections[activeSec] || "");
    setHistory([]);
    setShowHistory(false);
  }, [activeSec, sections]);

  async function save() {
    setSaving(true); setMsg({ text: "", type: "success" });
    const data = await apiFetch("/api/agent/dev-config", {
      method: "POST",
      body: JSON.stringify({ section: activeSec, content: draft }),
    });
    if (data.ok) {
      setSections((prev) => ({ ...prev, [activeSec]: draft }));
      setMsg({ text: "Sección guardada.", type: "success" });
    } else {
      setMsg({ text: data.error || "Error al guardar", type: "error" });
    }
    setSaving(false);
    setTimeout(() => setMsg({ text: "", type: "success" }), 3000);
  }

  async function loadHistory() {
    const data = await apiFetch(`/api/agent/dev-config/${activeSec}/history`);
    setHistory(data.versions || []);
    setShowHistory(true);
  }

  async function revert(versionIndex) {
    if (!window.confirm(`¿Revertir ${activeSec} a la versión #${versionIndex + 1}?`)) return;
    const data = await apiFetch(`/api/agent/dev-config/${activeSec}/revert`, {
      method: "POST",
      body: JSON.stringify({ versionIndex }),
    });
    if (data.ok) {
      const newContent = data.content || data.section?.content || "";
      setDraft(newContent);
      setSections((prev) => ({ ...prev, [activeSec]: newContent }));
      setShowHistory(false);
      setMsg({ text: `Revertido a versión #${versionIndex + 1}`, type: "success" });
    } else {
      setMsg({ text: data.error || "Error al revertir", type: "error" });
    }
    setTimeout(() => setMsg({ text: "", type: "success" }), 3000);
  }

  async function loadPreview() {
    setPreviewLoading(true);
    const data = await apiFetch("/api/agent/prompt-preview", {
      method: "POST",
      body: JSON.stringify({ calcState: {}, query: "" }),
    });
    setPreview(data.prompt || "");
    setShowPreview(true);
    setPreviewLoading(false);
  }

  const isDirty = draft !== (sections[activeSec] || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {PROMPT_SECTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setActiveSec(s)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${activeSec === s ? C.primary : C.border}`,
                background: activeSec === s ? `${C.primary}14` : "#fff",
                color: activeSec === s ? C.primary : C.text,
                fontWeight: activeSec === s ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: C.ff,
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Btn onClick={loadHistory} style={{ fontSize: 11 }}>Historial</Btn>
        <Btn onClick={loadPreview} disabled={previewLoading} variant="navy" style={{ fontSize: 11 }}>
          {previewLoading ? "Cargando…" : "Vista previa prompt completo"}
        </Btn>
      </div>

      {msg.text && <Alert msg={msg.text} type={msg.type} />}

      <div style={{ position: "relative" }}>
        <Textarea
          value={loading ? "Cargando…" : draft}
          onChange={setDraft}
          rows={22}
          style={{ fontFamily: "monospace", fontSize: 12 }}
        />
        {isDirty && (
          <span style={{ position: "absolute", top: 8, right: 12, fontSize: 10, color: C.warn, fontFamily: C.ff }}>
            Cambios sin guardar
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={() => setDraft(sections[activeSec] || "")} disabled={!isDirty}>Descartar</Btn>
        <Btn onClick={save} disabled={saving || !isDirty || loading} variant="primary">
          {saving ? "Guardando…" : "Guardar sección"}
        </Btn>
      </div>

      {/* History modal */}
      {showHistory && (
        <div onClick={() => setShowHistory(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 600, maxHeight: "70vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: C.text, fontFamily: C.ff }}>Historial — {activeSec}</span>
              <Btn onClick={() => setShowHistory(false)}>✕</Btn>
            </div>
            {history.length === 0
              ? <div style={{ fontSize: 12, color: C.sub, fontFamily: C.ff }}>Sin historial guardado.</div>
              : history.map((v, i) => (
                <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.sub, fontFamily: C.ff }}>
                      v{i + 1} · {v.savedAt ? new Date(v.savedAt).toLocaleString("es-UY") : ""}
                    </span>
                    <Btn onClick={() => revert(i)} style={{ padding: "3px 8px", fontSize: 11 }}>Revertir</Btn>
                  </div>
                  <pre style={{ fontSize: 11, color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 120, overflowY: "auto", fontFamily: "monospace" }}>
                    {(v.content || "").slice(0, 400)}{v.content?.length > 400 ? "…" : ""}
                  </pre>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Preview modal */}
      {showPreview && (
        <div onClick={() => setShowPreview(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 800, maxHeight: "85vh", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: C.text, fontFamily: C.ff }}>System Prompt completo</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={() => navigator.clipboard?.writeText(preview)}>Copiar</Btn>
                <Btn onClick={() => setShowPreview(false)}>✕</Btn>
              </div>
            </div>
            <pre style={{ flex: 1, overflowY: "auto", fontSize: 11, color: C.text, whiteSpace: "pre-wrap", background: "#f9f9f9", borderRadius: 8, padding: 12, margin: 0, lineHeight: 1.5, fontFamily: "monospace" }}>
              {preview || "Sin contenido"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CONVERSATIONS TAB ──────────────────────────────────────────────────────
function ConvRow({ conv, expanded, onToggle, onAnalyze, analysis, analyzing }) {
  const { conversationId, startedAt, turnCount, provider, model, hedgeCount } = conv;
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div
        style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", cursor: "pointer", background: expanded ? `${C.primary}08` : "#fff" }}
        onClick={onToggle}
      >
        <span style={{ fontSize: 12, fontFamily: "monospace", color: C.sub, flexShrink: 0 }}>
          {conversationId?.slice(0, 12)}…
        </span>
        <span style={{ fontSize: 11, color: C.sub, fontFamily: C.ff }}>
          {startedAt ? new Date(startedAt).toLocaleString("es-UY") : ""}
        </span>
        <Pill color={C.navy}>{provider || "?"}</Pill>
        {model && <Pill color={C.sub}>{model?.split("-").slice(-1)[0]}</Pill>}
        <span style={{ fontSize: 12, color: C.text, fontFamily: C.ff }}>{turnCount} turnos</span>
        {hedgeCount > 0 && <Pill color={C.warn}>{hedgeCount} hedges</Pill>}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: C.sub }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={onAnalyze} disabled={analyzing} variant="navy" style={{ fontSize: 11 }}>
              {analyzing ? "Analizando…" : "Analizar con IA"}
            </Btn>
          </div>
          {analysis && (
            <div style={{ fontSize: 12, fontFamily: C.ff, display: "flex", flexDirection: "column", gap: 6 }}>
              {analysis.parseError && <div style={{ color: C.sub }}>{analysis.raw?.slice(0, 400)}</div>}
              {analysis.pros?.length > 0 && <div><b style={{ color: C.success }}>✓ Pros:</b> {analysis.pros.join(" · ")}</div>}
              {analysis.cons?.length > 0 && <div><b style={{ color: C.danger }}>✗ Cons:</b> {analysis.cons.join(" · ")}</div>}
              {analysis.hedgeTopics?.length > 0 && <div><b style={{ color: C.warn }}>Hedge topics:</b> {analysis.hedgeTopics.join(", ")}</div>}
              {analysis.kbSuggestions?.length > 0 && (
                <div>
                  <b>Sugerencias KB:</b>
                  {analysis.kbSuggestions.map((s, i) => (
                    <div key={i} style={{ marginLeft: 10, marginTop: 2, color: C.sub }}>{s.question}</div>
                  ))}
                </div>
              )}
              {analysis.improvementSuggestions?.length > 0 && (
                <div><b>Mejoras:</b> {analysis.improvementSuggestions.join(" · ")}</div>
              )}
            </div>
          )}
          {conv.turns?.map((t, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${t.role === "user" ? C.primary : C.success}`, paddingLeft: 10, fontSize: 12, color: C.text, fontFamily: C.ff }}>
              <span style={{ fontWeight: 600, color: t.role === "user" ? C.primary : C.success }}>
                {t.role === "user" ? "Usuario" : "Panelin"}:
              </span>{" "}
              {t.content?.slice(0, 400)}{t.content?.length > 400 ? "…" : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationsTab() {
  const [convs, setConvs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState({});
  const [details, setDetails] = useState({});
  const [analysis, setAnalysis] = useState({});
  const [analyzing, setAnalyzing] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const data = await apiFetch(`/api/agent/conversations?days=${days}&page=${page}&limit=${LIMIT}&_r=${refreshKey}`);
    if (data.ok) {
      setConvs(data.conversations || []);
      setTotal(data.total || 0);
    } else {
      setErr(data.error || "Error al cargar");
    }
    setLoading(false);
  }, [days, page, refreshKey]);

  useEffect(() => { load(); }, [load]);

  async function toggleExpand(conv) {
    const id = conv.conversationId;
    if (expanded[id]) {
      setExpanded((p) => ({ ...p, [id]: false }));
      return;
    }
    setExpanded((p) => ({ ...p, [id]: true }));
    if (!details[id]) {
      const data = await apiFetch(`/api/agent/conversations/${id}`);
      if (data.ok) setDetails((p) => ({ ...p, [id]: data.conversation }));
    }
  }

  async function analyze(id) {
    setAnalyzing((p) => ({ ...p, [id]: true }));
    const data = await apiFetch(`/api/agent/conversations/${id}/analysis`);
    if (data.ok) setAnalysis((p) => ({ ...p, [id]: data.analysis || data }));
    setAnalyzing((p) => ({ ...p, [id]: false }));
  }

  function mergeConvData(conv) {
    const det = details[conv.conversationId];
    return det ? { ...conv, turns: det.turns } : conv;
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Select
          value={String(days)}
          onChange={(v) => { setDays(Number(v)); setPage(1); }}
          options={[7, 14, 30, 60, 90].map((d) => ({ value: String(d), label: `${d} días` }))}
          style={{ width: "auto" }}
        />
        <Btn onClick={() => { setPage(1); setRefreshKey((k) => k + 1); }} disabled={loading}>{loading ? "Cargando…" : "↺ Recargar"}</Btn>
        <span style={{ fontSize: 12, color: C.sub, fontFamily: C.ff }}>{total} conversaciones en total</span>
        <div style={{ flex: 1 }} />
        <Btn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>‹ Anterior</Btn>
        <span style={{ fontSize: 12, color: C.sub, fontFamily: C.ff }}>p. {page}/{totalPages || 1}</span>
        <Btn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Siguiente ›</Btn>
      </div>
      <Alert msg={err} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {convs.map((c) => (
          <ConvRow
            key={c.conversationId}
            conv={mergeConvData(c)}
            expanded={!!expanded[c.conversationId]}
            onToggle={() => toggleExpand(c)}
            onAnalyze={() => analyze(c.conversationId)}
            analysis={analysis[c.conversationId]}
            analyzing={!!analyzing[c.conversationId]}
          />
        ))}
        {convs.length === 0 && !loading && (
          <div style={{ fontSize: 12, color: C.sub, fontFamily: C.ff, textAlign: "center", padding: 24 }}>
            Sin conversaciones registradas en los últimos {days} días.
          </div>
        )}
      </div>
    </div>
  );
}

// ── STATS TAB ──────────────────────────────────────────────────────────────
function StatsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [days, setDays] = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const r = await apiFetch(`/api/agent/stats?days=${days}`);
    if (r.ok) setData(r);
    else setErr(r.error || "Error al cargar stats");
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const rows = [
    ["Conversaciones", data?.conversations],
    ["Turnos totales", data?.turns],
    ["Activas última hora", data?.active_last_hour],
    ["Turnos promedio/conv", data?.avg_turns_per_conv],
    ["Hedge rate %", data?.hedge_rate_pct],
    ["Latencia promedio (ms)", data?.avg_latency_ms],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Select
          value={String(days)}
          onChange={(v) => setDays(Number(v))}
          options={[1, 3, 7].map((d) => ({ value: String(d), label: `${d} día${d > 1 ? "s" : ""}` }))}
          style={{ width: "auto" }}
        />
        <Btn onClick={load} disabled={loading}>{loading ? "Cargando…" : "↺ Actualizar"}</Btn>
      </div>
      <Alert msg={err} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
        {rows.map(([label, val]) => (
          <Card key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.navy, fontFamily: C.ff }}>{val ?? "—"}</div>
            <div style={{ fontSize: 12, color: C.sub, fontFamily: C.ff, marginTop: 2 }}>{label}</div>
          </Card>
        ))}
      </div>
      {data?.providers && (
        <Card>
          <SectionLabel>Proveedores IA</SectionLabel>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Object.entries(data.providers).map(([prov, count]) => (
              <div key={prov} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, fontFamily: C.ff }}>
                <Pill color={C.primary}>{prov}</Pill>
                <span style={{ fontWeight: 700 }}>{count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── ANALYTICS TAB ──────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [days, setDays] = useState(60);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const r = await apiFetch(`/api/ai-analytics/trends?days=${days}`);
    if (r.ok !== false) setData(r);
    else setErr(r.error || "Error al cargar analytics");
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Select
          value={String(days)}
          onChange={(v) => setDays(Number(v))}
          options={[7, 30, 60, 90, 120, 180, 365].map((d) => ({ value: String(d), label: `${d} días` }))}
          style={{ width: "auto" }}
        />
        <Btn onClick={load} disabled={loading}>{loading ? "Cargando…" : "↺ Actualizar"}</Btn>
        {data?.parsedInWindow != null && (
          <span style={{ fontSize: 12, color: C.sub, fontFamily: C.ff }}>
            {data.parsedInWindow} eventos en ventana
          </span>
        )}
      </div>
      <Alert msg={err} />
      {data?.filePath && (
        <div style={{ fontSize: 11, color: C.sub, fontFamily: "monospace", wordBreak: "break-all" }}>
          Archivo: {data.filePath}
        </div>
      )}
      {data?.trends?.length > 0 && (
        <Card>
          <SectionLabel>Tendencias detectadas</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {data.trends.map((t, i) => (
              <li key={i} style={{ fontSize: 13, color: C.text, fontFamily: C.ff, lineHeight: 1.45 }}>{t}</li>
            ))}
          </ul>
        </Card>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {data?.byTag?.length > 0 && (
          <Card>
            <SectionLabel>Por tag</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
              {data.byTag.slice(0, 20).map((row) => (
                <div key={row.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: C.ff }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.key}</span>
                  <span style={{ color: C.sub, flexShrink: 0, marginLeft: 8 }}>{row.count}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {data?.bySource?.length > 0 && (
          <Card>
            <SectionLabel>Por fuente</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
              {data.bySource.slice(0, 20).map((row) => (
                <div key={row.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: C.ff }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.key}</span>
                  <span style={{ color: C.sub, flexShrink: 0, marginLeft: 8 }}>{row.count}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      {data?.scoreStats && (
        <Card>
          <SectionLabel>Score eventos</SectionLabel>
          <div style={{ display: "flex", gap: 20, fontSize: 13, fontFamily: C.ff }}>
            <span>Promedio: <b style={{ color: C.navy }}>{data.scoreStats.avg}</b></span>
            <span>Mín: {data.scoreStats.min}</span>
            <span>Máx: {data.scoreStats.max}</span>
            <span>n: {data.scoreStats.n}</span>
          </div>
        </Card>
      )}
      {!data && !loading && !err && (
        <div style={{ fontSize: 12, color: C.sub, fontFamily: C.ff, textAlign: "center", padding: 24 }}>
          Sin datos de analytics. Verificá que exista el archivo de eventos de knowledge.
        </div>
      )}
    </div>
  );
}

// ── CONFIG TAB ─────────────────────────────────────────────────────────────
function ConfigTab() {
  const [defaults, setDefaults] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "success" });
  const [providers, setProviders] = useState(null);

  async function load() {
    setLoading(true);
    const [scoreRes, provRes] = await Promise.all([
      apiFetch("/api/agent/training-kb/score-config"),
      apiFetch("/api/agent/ai-options"),
    ]);
    if (scoreRes.ok) {
      setDefaults(scoreRes.defaults);
      setDraft({ ...scoreRes.config });
    }
    setProviders(provRes.providers || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true); setMsg({ text: "", type: "success" });
    const r = await apiFetch("/api/agent/training-kb/score-config", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    if (r.ok) {
      setMsg({ text: "Configuración guardada.", type: "success" });
    } else {
      setMsg({ text: r.error || "Error", type: "error" });
    }
    setSaving(false);
    setTimeout(() => setMsg({ text: "", type: "success" }), 3000);
  }

  function reset() {
    if (defaults) setDraft({ ...defaults });
  }

  const fields = [
    { key: "permanentBonus", label: "Bonus permanente", help: "Bonus extra para entradas marcadas como permanentes." },
    { key: "questionMatchWeight", label: "Peso coincidencia pregunta", help: "Cuánto vale hacer match en el campo question." },
    { key: "contextMatchWeight", label: "Peso coincidencia contexto", help: "Cuánto vale hacer match en el campo context." },
    { key: "answerMatchWeight", label: "Peso coincidencia respuesta", help: "Cuánto vale hacer match en el campo answer." },
  ];

  if (loading) return <div style={{ fontSize: 12, color: C.sub, fontFamily: C.ff }}>Cargando configuración…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 500 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: C.ff, marginBottom: 4 }}>Pesos de scoring KB</div>
        <div style={{ fontSize: 12, color: C.sub, fontFamily: C.ff, lineHeight: 1.5 }}>
          Controlá cómo se rankean las entradas de la KB cuando el agente busca respuestas relevantes.
          Valores más altos dan más importancia a ese campo.
        </div>
      </div>
      <Alert msg={msg.text} type={msg.type} />
      {fields.map(({ key, label, help }) => (
        <div key={key}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: C.ff }}>{label}</label>
            {defaults && (
              <span style={{ fontSize: 10, color: C.sub, fontFamily: C.ff }}>default: {defaults[key]}</span>
            )}
          </div>
          <Input
            type="number"
            value={draft[key] ?? ""}
            onChange={(v) => setDraft((p) => ({ ...p, [key]: v === "" ? "" : Number(v) }))}
            placeholder={String(defaults?.[key] || "")}
          />
          <div style={{ fontSize: 11, color: C.sub, fontFamily: C.ff, marginTop: 2 }}>{help}</div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={reset}>Restaurar defaults</Btn>
        <Btn onClick={save} disabled={saving} variant="primary">{saving ? "Guardando…" : "Guardar"}</Btn>
      </div>

      {/* Providers */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: C.ff, marginBottom: 8 }}>Proveedores IA activos</div>
        {providers === null ? (
          <div style={{ fontSize: 12, color: C.sub }}>Cargando…</div>
        ) : providers.length === 0 ? (
          <div style={{ fontSize: 12, color: C.sub }}>Ningún proveedor configurado con API key.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {providers.map((p) => (
              <div key={p.id} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>🟢</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#166534", fontFamily: C.ff }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: "#166534", fontFamily: "monospace" }}>
                    default: {p.defaultModel}
                    {p.models?.length > 1 && ` · ${p.models.length} modelos`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── HEALTH TAB ───────────────────────────────────────────────────────────────
function HealthTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const [msg, setMsg] = useState(null);
  const [generating, setGenerating] = useState(false);

  async function load() {
    setLoading(true);
    const d = await apiFetch("/api/agent/training-kb/health");
    setData(d);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function markReviewed(id) {
    setBusy((b) => ({ ...b, [id]: true }));
    const d = await apiFetch(`/api/agent/training-kb/${id}/mark-reviewed`, { method: "POST", body: JSON.stringify({}) });
    setBusy((b) => ({ ...b, [id]: false }));
    if (d.ok) { setMsg("Marcada como revisada — próxima revisión en el período estándar"); load(); }
    else setMsg("Error: " + (d.error || "desconocido"));
    setTimeout(() => setMsg(null), 4000);
  }

  async function archiveEntry(id) {
    setBusy((b) => ({ ...b, [id]: "archive" }));
    const d = await apiFetch(`/api/agent/train/${id}`, { method: "PUT", body: JSON.stringify({ status: "rejected" }) });
    setBusy((b) => ({ ...b, [id]: false }));
    if (d.ok) { setMsg("Entrada archivada"); load(); }
    else setMsg("Error: " + (d.error || "desconocido"));
    setTimeout(() => setMsg(null), 4000);
  }

  async function autoFixMLGaps() {
    setGenerating(true);
    const d = await apiFetch("/api/agent/training-kb/generate-ml-overrides", { method: "POST", body: JSON.stringify({}) });
    setGenerating(false);
    if (d.ok) { setMsg(`✓ ${d.generated} overrides ML generados`); load(); }
    else setMsg("Error: " + (d.error || "desconocido"));
    setTimeout(() => setMsg(null), 5000);
  }

  if (loading) return <div style={{ padding: 32, color: C.muted }}>Analizando KB…</div>;
  if (!data?.ok) return <div style={{ padding: 32, color: "#dc2626" }}>Error cargando datos de salud.</div>;

  const sections = [
    {
      key: "stale",
      label: "Entradas vencidas",
      color: "#dc2626",
      hint: "reviewDueAt expirado — el contenido puede estar desactualizado.",
      entries: data.stale || [],
      action: (e) => (
        <button onClick={() => markReviewed(e.id)} disabled={!!busy[e.id]}
          style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {busy[e.id] ? "…" : "Marcar revisada"}
        </button>
      ),
    },
    {
      key: "zeroRetrieval",
      label: "Sin uso en 30 días",
      color: "#6b7280",
      hint: "Nunca fueron recuperadas — posiblemente irrelevantes o mal redactadas.",
      entries: data.zeroRetrieval || [],
      action: (e) => (
        <button onClick={() => archiveEntry(e.id)} disabled={!!busy[e.id]}
          style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {busy[e.id] === "archive" ? "…" : "Archivar"}
        </button>
      ),
    },
    {
      key: "mlGap",
      label: "Gap canal ML",
      color: "#d97706",
      hint: "goodAnswer >350 chars sin override ML — se trunca automáticamente.",
      entries: data.mlGap || [],
      action: null,
      headerAction: data.mlGap?.length > 0 ? (
        <button onClick={autoFixMLGaps} disabled={generating}
          style={{ padding: "5px 14px", borderRadius: 7, border: "none", background: "#d97706", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {generating ? "Generando…" : `⚡ Auto-generar ${data.mlGap.length} overrides`}
        </button>
      ) : null,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {msg && (
        <div style={{ padding: "10px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534", fontSize: 13 }}>{msg}</div>
      )}
      {sections.every((s) => s.entries.length === 0) && (
        <div style={{ padding: "48px 0", textAlign: "center", color: C.muted, fontSize: 15 }}>
          KB en buen estado — sin entradas vencidas, sin gaps ni entradas sin uso.
        </div>
      )}
      {sections.map((sec) => sec.entries.length === 0 ? null : (
        <div key={sec.key}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: sec.color }}>{sec.label}</span>
              <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>({sec.entries.length})</span>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sec.hint}</div>
            </div>
            {sec.headerAction}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sec.entries.map((e) => (
              <div key={e.id} style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: C.navy, marginBottom: 2 }}>{e.question}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {sec.key === "stale" && `Vence: ${e.reviewDueAt?.slice(0, 10)} | cat: ${e.category}`}
                    {sec.key === "zeroRetrieval" && `Creada: ${e.createdAt?.slice(0, 10)} | src: ${e.source || "manual"}`}
                    {sec.key === "mlGap" && `${(e.goodAnswer || "").length} chars | cat: ${e.category}`}
                  </div>
                </div>
                {sec.action && sec.action(e)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AUTO-LEARN QUEUE TAB ─────────────────────────────────────────────────────
function AutoLearnTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const [msg, setMsg] = useState(null);

  async function load() {
    setLoading(true);
    const d = await apiFetch("/api/agent/autolearn/pending");
    setEntries(d.entries || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function act(id, action, reason = "") {
    setBusy((b) => ({ ...b, [id]: true }));
    const d = await apiFetch(`/api/agent/autolearn/${id}/${action}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    setBusy((b) => ({ ...b, [id]: false }));
    if (d.ok) {
      setMsg(action === "approve" ? "Aprobado y activo en KB" : "Rechazado");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } else {
      setMsg("Error: " + (d.error || "desconocido"));
    }
  }

  const confColor = (c) => c >= 0.9 ? "#16a34a" : c >= 0.75 ? "#d97706" : "#dc2626";

  if (loading) return <div style={{ padding: 32, color: C.muted }}>Cargando cola…</div>;

  return (
    <div>
      {msg && (
        <div style={{ marginBottom: 16, padding: "10px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534", fontSize: 13 }}>
          {msg} <button onClick={() => setMsg(null)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#166534", fontWeight: 700 }}>×</button>
        </div>
      )}
      {entries.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: C.muted, fontSize: 15 }}>
          Cola vacía — no hay entradas pendientes de revisión.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>
            {entries.length} entrada{entries.length !== 1 ? "s" : ""} pendiente{entries.length !== 1 ? "s" : ""}. Las de confianza ≥ 0.92 se auto-aprueban.
          </div>
          {entries.map((e) => (
            <div key={e.id} style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.navy, flex: 1 }}>{e.question}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: confColor(e.confidence ?? 0), background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 8px" }}>
                    {e.confidence != null ? `${Math.round(e.confidence * 100)}%` : "—"}
                  </span>
                  <span style={{ fontSize: 11, color: C.muted, background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>{e.category}</span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: C.text, background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 10, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {e.goodAnswer}
              </div>
              {e.context && (
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontStyle: "italic" }}>Contexto: {e.context}</div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => act(e.id, "approve")}
                  disabled={!!busy[e.id]}
                  style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  {busy[e.id] ? "…" : "Aprobar"}
                </button>
                <button
                  onClick={() => act(e.id, "reject")}
                  disabled={!!busy[e.id]}
                  style={{ padding: "7px 18px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CONFLICTS TAB ────────────────────────────────────────────────────────────
function ConflictsTab() {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const [msg, setMsg] = useState(null);

  async function load() {
    setLoading(true);
    const d = await apiFetch("/api/agent/training-kb/conflicts");
    setPairs(d.pairs || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function resolve(keepId, archiveId) {
    const key = `${keepId}|${archiveId}`;
    setBusy((b) => ({ ...b, [key]: true }));
    const d = await apiFetch(`/api/agent/training-kb/${keepId}/resolve-conflict`, {
      method: "POST",
      body: JSON.stringify({ keepId, archiveId }),
    });
    setBusy((b) => ({ ...b, [key]: false }));
    if (d.ok) {
      setMsg("Conflicto resuelto");
      setPairs((prev) => prev.filter((p) => p.a.id !== keepId && p.a.id !== archiveId && p.b.id !== keepId && p.b.id !== archiveId));
    } else {
      setMsg("Error: " + (d.error || "desconocido"));
    }
    setTimeout(() => setMsg(null), 4000);
  }

  if (loading) return <div style={{ padding: 32, color: C.muted }}>Buscando conflictos…</div>;

  return (
    <div>
      {msg && (
        <div style={{ marginBottom: 16, padding: "10px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534", fontSize: 13 }}>
          {msg}
        </div>
      )}
      {pairs.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: C.muted, fontSize: 15 }}>
          Sin conflictos detectados — preguntas similares tienen respuestas consistentes.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>
            {pairs.length} par{pairs.length !== 1 ? "es" : ""} conflictivo{pairs.length !== 1 ? "s" : ""} — misma pregunta, respuestas distintas.
          </div>
          {pairs.map((p, i) => {
            const key = `${p.a.id}|${p.b.id}`;
            return (
              <div key={key} style={{ background: C.white, borderRadius: 12, border: "1.5px solid #fca5a5", padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Conflicto #{i + 1}
                </div>
                {[{ label: "A", entry: p.a }, { label: "B", entry: p.b }].map(({ label, entry }) => (
                  <div key={entry.id} style={{ background: "#fafafa", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 4 }}>[{label}] {entry.question}</div>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{entry.goodAnswer}</div>
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={() => resolve(entry.id, label === "A" ? p.b.id : p.a.id)}
                        disabled={!!busy[key]}
                        style={{ padding: "5px 14px", borderRadius: 7, border: "none", background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        {busy[key] ? "…" : `Mantener ${label}, archivar ${label === "A" ? "B" : "A"}`}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── FEEDBACK TAB ─────────────────────────────────────────────────────────────
const RATING_COLORS = { good: "#16a34a", bad: "#dc2626", edit: "#2563eb" };
const RATING_LABELS = { good: "✓ Buena", bad: "✗ Mala", edit: "✏ Corregida" };
const CHANNEL_ICONS = { chat: "💬", wa: "📱", ml: "🛒" };

function FeedbackTab() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chanFilter, setChanFilter] = useState("all");
  const [days, setDays] = useState(7);

  async function load() {
    setLoading(true);
    const [feedRes, statRes] = await Promise.all([
      apiFetch(`/api/agent/feedback?days=${days}${chanFilter !== "all" ? `&channel=${chanFilter}` : ""}`),
      apiFetch(`/api/agent/feedback/stats?days=${days}`),
    ]);
    setEvents(feedRes.events || []);
    setStats(statRes);
    setLoading(false);
  }

  useEffect(() => { load(); }, [days, chanFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats bar */}
      {stats && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            ["Total", stats.total, null],
            ["Buenas ✓", stats.byRating?.good || 0, "#16a34a"],
            ["Malas ✗", stats.byRating?.bad || 0, "#dc2626"],
            ["Corregidas ✏", stats.byRating?.edit || 0, "#2563eb"],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: color || C.navy }}>{val}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {["all", "chat", "wa", "ml"].map((ch) => (
          <button key={ch} onClick={() => setChanFilter(ch)}
            style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${C.border}`, background: chanFilter === ch ? C.navy : C.white, color: chanFilter === ch ? "#fff" : C.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {ch === "all" ? "Todos" : `${CHANNEL_ICONS[ch]} ${ch.toUpperCase()}`}
          </button>
        ))}
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, color: C.text, background: C.white }}>
          {[7, 14, 30, 90].map((d) => <option key={d} value={d}>Últimos {d}d</option>)}
        </select>
        <button onClick={load} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, cursor: "pointer" }}>↺</button>
      </div>

      {/* Feed */}
      {loading ? (
        <div style={{ padding: 32, color: C.muted, textAlign: "center" }}>Cargando feedback…</div>
      ) : events.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: C.muted, fontSize: 14 }}>
          Sin feedback en el período seleccionado.<br />
          <span style={{ fontSize: 12 }}>Usá los botones 👍 / ✏️ en el chat o el Hub ML para registrar feedback.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {events.map((ev) => (
            <div key={ev.feedbackId} style={{ background: C.white, borderRadius: 12, border: `1.5px solid ${RATING_COLORS[ev.rating] || C.border}22`, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: RATING_COLORS[ev.rating], background: `${RATING_COLORS[ev.rating]}18`, borderRadius: 6, padding: "2px 8px" }}>
                    {RATING_LABELS[ev.rating]}
                  </span>
                  <span style={{ fontSize: 11, color: C.muted }}>{CHANNEL_ICONS[ev.channel] || ""} {ev.channel?.toUpperCase()}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{ev.ts?.slice(0, 16).replace("T", " ")}</span>
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 4 }}>{ev.question}</div>

              <div style={{ fontSize: 12, color: C.text, background: "#f8fafc", borderRadius: 8, padding: "8px 10px", marginBottom: ev.correction || ev.comment ? 8 : 0, lineHeight: 1.5 }}>
                {ev.generatedText}
              </div>

              {ev.correction && (
                <div style={{ fontSize: 12, color: "#166534", background: "#f0fdf4", borderRadius: 8, padding: "8px 10px", marginBottom: ev.comment ? 6 : 0, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700 }}>Corrección: </span>{ev.correction}
                </div>
              )}
              {ev.comment && (
                <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic", marginTop: 4 }}>
                  💬 {ev.comment}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── LOGS TAB ─────────────────────────────────────────────────────────────────
function LogsTab() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);

  async function loadList() {
    setLoading(true);
    const r = await apiFetch("/api/interaction-log/list");
    setFiles(r.files || []);
    setLoading(false);
  }

  async function loadFile(name) {
    if (selected === name) { setSelected(null); setFileData(null); return; }
    setSelected(name);
    setFileLoading(true);
    const r = await apiFetch(`/api/interaction-log/file/${encodeURIComponent(name)}`);
    setFileData(r.ok ? r.content : { error: r.error });
    setFileLoading(false);
  }

  useEffect(() => { loadList(); }, []);

  function fmtSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    return `${(bytes / 1024).toFixed(1)}KB`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ fontSize: 12, color: C.sub, fontFamily: C.ff, flex: 1 }}>
          Logs de interacción guardados desde la calculadora (últimos 50).
        </div>
        <button onClick={loadList} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, cursor: "pointer" }}>↺ Recargar</button>
      </div>

      {loading ? (
        <div style={{ color: C.sub, fontSize: 13, padding: 16 }}>Cargando…</div>
      ) : files.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: C.sub, fontSize: 13 }}>
          Sin logs guardados.<br />
          <span style={{ fontSize: 11 }}>Interactuá con la calculadora y usá el panel &quot;Log interacción&quot; para guardar.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {files.map((f) => (
            <div key={f.name} style={{ border: `1px solid ${selected === f.name ? C.primary : C.border}`, borderRadius: 10, overflow: "hidden", background: C.surface }}>
              <div
                onClick={() => loadFile(f.name)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: selected === f.name ? `${C.primary}0a` : "transparent" }}
              >
                <span style={{ fontSize: 16 }}>📄</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: C.text, fontFamily: C.ff }}>{f.name}</span>
                <span style={{ fontSize: 11, color: C.sub }}>{fmtSize(f.size)}</span>
                <span style={{ fontSize: 11, color: C.sub }}>{new Date(f.mtime).toLocaleString("es-UY")}</span>
                <span style={{ fontSize: 12, color: selected === f.name ? C.primary : C.sub }}>{selected === f.name ? "▲" : "▼"}</span>
              </div>
              {selected === f.name && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: 12 }}>
                  {fileLoading ? (
                    <div style={{ color: C.sub, fontSize: 12 }}>Cargando…</div>
                  ) : (
                    <pre style={{ margin: 0, fontSize: 11, color: C.text, overflowX: "auto", maxHeight: 320, fontFamily: "monospace", lineHeight: 1.5 }}>
                      {JSON.stringify(fileData, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── VOICE TAB ─────────────────────────────────────────────────────────────────
const VOICE_ACTIONS = [
  "setScenario", "setLP", "setTecho", "setPared",
  "setCamara", "setFlete", "setProyecto", "setWizardStep",
  "setTechoZonas", "advanceWizard", "buildQuote",
];

function VoiceTab() {
  const [providers, setProviders] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  async function loadProviders() {
    const r = await apiFetch("/api/agent/ai-options");
    setProviders(r.providers || []);
  }

  async function testSession() {
    setTesting(true);
    setTestResult(null);
    const r = await apiFetch("/api/agent/voice/session", {
      method: "POST",
      body: JSON.stringify({ calcState: {}, devMode: false }),
    });
    setTestResult(r);
    setTesting(false);
  }

  useEffect(() => { loadProviders(); }, []);

  const voiceAvailable = providers?.some((p) => p.id === "openai");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 600 }}>
      {/* Status */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: C.ff, marginBottom: 10 }}>Estado del módulo de voz</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>{voiceAvailable ? "🟢" : "🔴"}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: C.ff }}>
              OpenAI Realtime
            </div>
            <div style={{ fontSize: 11, color: C.sub, fontFamily: C.ff }}>
              {voiceAvailable
                ? "OPENAI_API_KEY configurada — sesiones de voz disponibles"
                : "OPENAI_API_KEY no configurada — voz no disponible"}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.sub, fontFamily: C.ff, lineHeight: 1.6 }}>
          Modelo: <code>gpt-4o-realtime-preview</code> · WebRTC peer-to-peer · Token efímero por sesión<br />
          Rate limit: 3 sesiones/min por IP · 120 acciones/min por IP
        </div>
      </div>

      {/* Available actions */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: C.ff, marginBottom: 10 }}>Acciones disponibles</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {VOICE_ACTIONS.map((a) => (
            <span key={a} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: `${C.primary}18`, color: C.primary, fontFamily: "monospace", fontWeight: 600 }}>{a}</span>
          ))}
        </div>
      </div>

      {/* Test session */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: C.ff, marginBottom: 6 }}>Test de sesión</div>
        <div style={{ fontSize: 12, color: C.sub, fontFamily: C.ff, marginBottom: 12, lineHeight: 1.5 }}>
          Mintea un token efímero de OpenAI Realtime. Requiere OPENAI_API_KEY en el servidor.
        </div>
        <Btn onClick={testSession} disabled={testing || !voiceAvailable} variant="primary">
          {testing ? "Minteando…" : "Testear sesión de voz"}
        </Btn>
        {testResult && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: testResult.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${testResult.ok ? "#bbf7d0" : "#fecaca"}` }}>
            {testResult.ok ? (
              <div style={{ fontSize: 12, color: "#166534", fontFamily: C.ff }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Sesión creada correctamente</div>
                <div>session_id: <code>{testResult.session_id}</code></div>
                <div>model: <code>{testResult.model}</code></div>
                {testResult.expires_at && (
                  <div>expira: {new Date(testResult.expires_at * 1000).toLocaleString("es-UY")}</div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#991b1b", fontFamily: C.ff }}>
                <span style={{ fontWeight: 700 }}>Error: </span>{testResult.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN MODULE ─────────────────────────────────────────────────────────────
const TABS = [
  { id: "kb", label: "Base de conocimiento", icon: "📚" },
  { id: "prompt", label: "System prompt", icon: "✏️" },
  { id: "conversations", label: "Conversaciones", icon: "💬" },
  { id: "stats", label: "Estadísticas", icon: "📊" },
  { id: "analytics", label: "Analytics IA", icon: "🔍" },
  { id: "feedback", label: "Feedback", icon: "💬" },
  { id: "health", label: "Salud KB", icon: "🩺" },
  { id: "autolearn", label: "Cola IA", icon: "🧠" },
  { id: "conflicts", label: "Conflictos", icon: "⚡" },
  { id: "logs", label: "Logs", icon: "📋" },
  { id: "voice", label: "Voz", icon: "🎙️" },
  { id: "config", label: "Configuración", icon: "⚙️" },
];

export default function AgentAdminModule() {
  const [tab, setTab] = useState("kb");
  const hasToken = typeof import.meta !== "undefined"
    ? !!(import.meta.env?.VITE_API_AUTH_TOKEN || "")
    : false;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg, fontFamily: C.ff }}>
      <BmcModuleNav />
      <div style={{ flex: 1, display: "flex", maxWidth: 1300, margin: "0 auto", width: "100%", padding: "0 0 40px" }}>
        {/* Sidebar */}
        <aside style={{ width: 220, flexShrink: 0, background: C.sidebar, display: "flex", flexDirection: "column", paddingTop: 20 }}>
          <div style={{ padding: "0 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 }}>
              Agente Panelin
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Admin &amp; KB</div>
          </div>
          <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
            {TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: tab === id ? C.sidebarActive : "transparent",
                  color: tab === id ? "#fff" : C.sidebarText,
                  fontSize: 13,
                  fontWeight: tab === id ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  fontFamily: C.ff,
                  transition: "background 0.1s",
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
                {label}
              </button>
            ))}
          </nav>
          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <Link
              to="/hub"
              style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", textDecoration: "none", fontFamily: C.ff }}
            >
              ← Wolfboard
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, padding: 24, overflowY: "auto", minWidth: 0 }}>
          {/* Auth warning */}
          {!hasToken && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: `${C.warn}18`, border: `1px solid ${C.warn}`, borderRadius: 8, fontSize: 12, color: C.warn, fontFamily: C.ff }}>
              <b>VITE_API_AUTH_TOKEN no configurado.</b> Las llamadas a la API pueden fallar con 401. Agregá esta variable en tu <code>.env</code> para habilitar el acceso.
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.navy, fontFamily: C.ff }}>
              {TABS.find((t) => t.id === tab)?.icon} {TABS.find((t) => t.id === tab)?.label}
            </h1>
          </div>

          {tab === "kb" && <KBTab />}
          {tab === "prompt" && <PromptTab />}
          {tab === "conversations" && <ConversationsTab />}
          {tab === "stats" && <StatsTab />}
          {tab === "analytics" && <AnalyticsTab />}
          {tab === "feedback" && <FeedbackTab />}
          {tab === "health" && <HealthTab />}
          {tab === "autolearn" && <AutoLearnTab />}
          {tab === "conflicts" && <ConflictsTab />}
          {tab === "logs" && <LogsTab />}
          {tab === "voice" && <VoiceTab />}
          {tab === "config" && <ConfigTab />}
        </main>
      </div>
    </div>
  );
}
