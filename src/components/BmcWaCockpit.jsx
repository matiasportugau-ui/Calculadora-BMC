/**
 * WA Cockpit — F1 read-only scrape viewer
 *
 * Ruta: /wa  (separada de /hub/wa, que sigue siendo la vista legacy de Sheets).
 *
 * F1 — esta versión:
 *   - 3 columnas (lista chats / hilo / panel acción placeholder).
 *   - Lee /api/wa/conversations y /api/wa/messages (Bearer cockpit token).
 *   - Filtros: status (new|pending|quoted|stale_24h|closed) + buscador.
 *   - Sin AI, sin envío. Las tabs derechas son stubs F2-F5.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import CockpitTokenPanel from "./CockpitTokenPanel.jsx";

const STORAGE_KEY = "bmc_cockpit_token";

const STATUS_OPTIONS = [
  { id: "", label: "Todos" },
  { id: "new", label: "Nuevos" },
  { id: "pending", label: "Pendientes" },
  { id: "quoted", label: "Cotizados" },
  { id: "stale_24h", label: ">24h sin tocar" },
  { id: "closed", label: "Cerrados" },
];

const TABS = [
  { id: "ai", label: "Sugerencias AI", phase: "F2", enabled: true },
  { id: "quote", label: "Cotizar", phase: "F3", enabled: true },
  { id: "crm", label: "CRM", phase: "F3", enabled: true },
  { id: "followups", label: "Follow-ups", phase: "F4", enabled: false },
];

const TONE_LABELS = {
  corta: "Corta y directa",
  tecnica: "Técnica con datos",
  cierre: "Cierre comercial",
};

function toneBadgeColor(tone) {
  if (tone === "corta") return { bg: "#e6f0ff", fg: "#1a3a5c" };
  if (tone === "tecnica") return { bg: "#e6f7ec", fg: "#2a7a2a" };
  if (tone === "cierre") return { bg: "#fde7e7", fg: "#a4262c" };
  return { bg: "#f0f0f3", fg: "#3a3a3c" };
}

const wrap = {
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "#f5f5f7",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
};

const header = {
  padding: "10px 16px",
  borderBottom: "1px solid #e5e5ea",
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 8,
};

const grid = {
  flex: 1,
  display: "grid",
  gridTemplateColumns: "320px 1fr 360px",
  minHeight: 0,
};

const colLeft = {
  borderRight: "1px solid #e5e5ea",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
};

const colCenter = {
  background: "#f5f5f7",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
};

const colRight = {
  borderLeft: "1px solid #e5e5ea",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #e5e5ea",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const select = {
  ...inputStyle,
  width: "auto",
  background: "#fff",
};

const btnPrimary = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "none",
  background: "#0071e3",
  color: "#fff",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnGhost = {
  ...btnPrimary,
  background: "#fff",
  color: "#1d1d1f",
  border: "1px solid #e5e5ea",
};

const chatItem = (active) => ({
  padding: "10px 12px",
  borderBottom: "1px solid #f0f0f3",
  cursor: "pointer",
  background: active ? "#eaf2ff" : "transparent",
  borderLeft: active ? "3px solid #0071e3" : "3px solid transparent",
});

const msgIn = {
  alignSelf: "flex-start",
  background: "#fff",
  borderRadius: 12,
  padding: "8px 12px",
  margin: "4px 0",
  maxWidth: "75%",
  fontSize: 13,
  lineHeight: 1.4,
  border: "1px solid #ececef",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const msgOut = {
  ...msgIn,
  alignSelf: "flex-end",
  background: "#dcf8c6",
  border: "1px solid #cfe9b8",
};

const tabBtn = (active) => ({
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #e5e5ea",
  background: active ? "#0071e3" : "#fff",
  color: active ? "#fff" : "#1d1d1f",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
});

function fmtTs(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) return d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

function buildHeaders(token) {
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export default function BmcWaCockpit() {
  const apiBase = useMemo(() => getCalcApiBase(), []);

  // ── token bootstrap (mismo flujo que ML / Admin / Canales modules) ─────
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState("");
  const [, setTokenAutoLoaded] = useState(false);
  const [tokenLoadError, setTokenLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          if (cancelled) return;
          setToken(cached);
          setTokenAutoLoaded(true);
          return;
        }
        const r = await fetch(`${apiBase}/api/crm/cockpit-token`, { credentials: "include" });
        if (!r.ok) {
          setTokenLoadError(`HTTP ${r.status}`);
          return;
        }
        const j = await r.json();
        if (cancelled) return;
        if (j?.ok && j?.token) {
          setToken(j.token);
          setTokenAutoLoaded(true);
          localStorage.setItem(STORAGE_KEY, j.token);
        }
      } catch (e) {
        if (!cancelled) setTokenLoadError(e?.message || String(e));
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const onSaveToken = useCallback(() => {
    const t = (tokenInput || "").trim();
    if (!t) return;
    localStorage.setItem(STORAGE_KEY, t);
    setToken(t);
    setTokenAutoLoaded(true);
    setTokenInput("");
  }, [tokenInput]);

  const onClearToken = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken("");
    setTokenAutoLoaded(false);
  }, []);

  // ── conversations list ────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");
  const [health, setHealth] = useState(null);
  const debounceRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    setLoadingList(true);
    setListError("");
    try {
      const url = new URL(`${apiBase || window.location.origin}/api/wa/conversations`);
      if (statusFilter) url.searchParams.set("status", statusFilter);
      if (query.trim()) url.searchParams.set("q", query.trim());
      url.searchParams.set("limit", "200");
      const r = await fetch(url.toString().replace(window.location.origin, apiBase || ""), {
        headers: buildHeaders(token),
      });
      if (!r.ok) {
        const txt = await r.text();
        setListError(`HTTP ${r.status}: ${txt.slice(0, 120)}`);
        setConversations([]);
        return;
      }
      const j = await r.json();
      setConversations(Array.isArray(j?.items) ? j.items : []);
    } catch (e) {
      setListError(e?.message || String(e));
    } finally {
      setLoadingList(false);
    }
  }, [apiBase, token, statusFilter, query]);

  const fetchHealth = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${apiBase}/api/wa/health`, { headers: buildHeaders(token) });
      const j = await r.json().catch(() => null);
      setHealth(j);
    } catch (e) {
      setHealth({ ok: false, error: e?.message });
    }
  }, [apiBase, token]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchConversations();
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [fetchConversations]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // ── thread ────────────────────────────────────────────────────────────
  const [activeChatId, setActiveChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [activeTab, setActiveTab] = useState("ai");

  // ── F2 suggestions ───────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [generatingSugg, setGeneratingSugg] = useState(false);
  const [pasteStatus, setPasteStatus] = useState({});

  const fetchSuggestions = useCallback(
    async (chatId) => {
      if (!chatId || !token) return;
      setLoadingSugg(true);
      try {
        const r = await fetch(
          `${apiBase}/api/wa/suggestions?chat_id=${encodeURIComponent(chatId)}&limit=10`,
          { headers: buildHeaders(token) },
        );
        const j = await r.json().catch(() => ({}));
        if (r.ok && Array.isArray(j?.items)) {
          setSuggestions(j.items);
        } else {
          setSuggestions([]);
        }
      } finally {
        setLoadingSugg(false);
      }
    },
    [apiBase, token],
  );

  const runSuggestion = useCallback(async () => {
    if (!activeChatId || !token) return;
    setGeneratingSugg(true);
    try {
      const r = await fetch(`${apiBase}/api/wa/suggestions/run`, {
        method: "POST",
        headers: buildHeaders(token),
        body: JSON.stringify({ chat_id: activeChatId }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.suggestion) {
        setSuggestions((prev) => [j.suggestion, ...prev].slice(0, 10));
      }
    } finally {
      setGeneratingSugg(false);
    }
  }, [apiBase, token, activeChatId]);

  const markChosen = useCallback(
    async (suggestionId, chosenIdx) => {
      if (!suggestionId || !token) return;
      try {
        await fetch(`${apiBase}/api/wa/suggestions/${suggestionId}/chosen`, {
          method: "POST",
          headers: buildHeaders(token),
          body: JSON.stringify({ chosen_idx: chosenIdx }),
        });
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === suggestionId
              ? { ...s, chosen_idx: chosenIdx, chosen_at: new Date().toISOString() }
              : s,
          ),
        );
      } catch {
        /* ignore */
      }
    },
    [apiBase, token],
  );

  const copyAndOpenWa = useCallback(
    async (suggestionId, chosenIdx, text) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        /* ignore — fallback below */
      }
      // postMessage al content script de la extensión (si está cargado)
      try {
        window.postMessage({ kind: "wa_cockpit/pasteSuggestion", text }, "*");
      } catch {
        /* ignore */
      }
      setPasteStatus({ [suggestionId]: "ok" });
      setTimeout(() => setPasteStatus({}), 2000);
      markChosen(suggestionId, chosenIdx);
      // Abre WA Web en nueva pestaña si no está
      window.open("https://web.whatsapp.com/", "_blank");
    },
    [markChosen],
  );

  useEffect(() => {
    if (activeChatId && activeTab === "ai") fetchSuggestions(activeChatId);
  }, [activeChatId, activeTab, fetchSuggestions]);

  // Listen for paste-back result from extension
  useEffect(() => {
    const onMsg = (ev) => {
      if (!ev?.data || ev.data.kind !== "wa_cockpit/pasteResult") return;
      // could surface a toast; for now we leave the optimistic "ok" set above
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // ── F3 quotes per chat ───────────────────────────────────────────────
  const [quotes, setQuotes] = useState([]);
  const [quoteForm, setQuoteForm] = useState({ metros: "", espesor: "", familia: "", scope: "techo", color: "Blanco", lista: "web" });
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  const fetchQuotes = useCallback(
    async (chatId) => {
      if (!chatId || !token) return;
      try {
        const r = await fetch(
          `${apiBase}/api/wa/quotes?chat_id=${encodeURIComponent(chatId)}&limit=10`,
          { headers: buildHeaders(token) },
        );
        const j = await r.json().catch(() => ({}));
        setQuotes(Array.isArray(j?.items) ? j.items : []);
      } catch {
        setQuotes([]);
      }
    },
    [apiBase, token],
  );

  const runQuote = useCallback(async () => {
    if (!activeChatId || !token) return;
    setGeneratingQuote(true);
    setQuoteError("");
    try {
      const params = {
        metros: Number(quoteForm.metros),
        espesor: Number(quoteForm.espesor),
        familia: quoteForm.familia || null,
        scope: quoteForm.scope,
        color: quoteForm.color || "Blanco",
        lista: quoteForm.lista || "web",
      };
      const r = await fetch(`${apiBase}/api/wa/quotes/run`, {
        method: "POST",
        headers: buildHeaders(token),
        body: JSON.stringify({ chat_id: activeChatId, params }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        setQuoteError(j?.error || j?.reason || `HTTP ${r.status}`);
        return;
      }
      setQuotes((prev) => [j.quote, ...prev].slice(0, 10));
    } catch (e) {
      setQuoteError(e?.message || String(e));
    } finally {
      setGeneratingQuote(false);
    }
  }, [apiBase, token, activeChatId, quoteForm]);

  useEffect(() => {
    if (activeChatId && activeTab === "quote") fetchQuotes(activeChatId);
  }, [activeChatId, activeTab, fetchQuotes]);

  // ── F3 CRM lead linkage ────────────────────────────────────────────
  const [crmRow, setCrmRow] = useState("");
  const [crmOwner, setCrmOwner] = useState("");
  const [savingCrm, setSavingCrm] = useState(false);
  const [crmStatus, setCrmStatus] = useState("");

  const activeChat = useMemo(
    () => conversations.find((c) => c.chat_id === activeChatId) || null,
    [conversations, activeChatId],
  );

  useEffect(() => {
    if (!activeChat) return;
    setCrmRow(activeChat.lead_sheet_row != null ? String(activeChat.lead_sheet_row) : "");
    setCrmOwner(activeChat.owner_op || "");
    setCrmStatus("");
  }, [activeChat]);

  const saveCrm = useCallback(async () => {
    if (!activeChatId || !token) return;
    setSavingCrm(true);
    setCrmStatus("");
    try {
      const body = {};
      if (crmRow) body.sheet_row = Number(crmRow);
      if (crmOwner.trim()) body.owner_op = crmOwner.trim();
      const r = await fetch(
        `${apiBase}/api/wa/conversations/${encodeURIComponent(activeChatId)}/upsert-lead`,
        {
          method: "POST",
          headers: buildHeaders(token),
          body: JSON.stringify(body),
        },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        setCrmStatus(`error: ${j?.error || `HTTP ${r.status}`}`);
        return;
      }
      setCrmStatus("guardado");
      // Refrescar conversaciones para que la lista muestre lead_sheet_row
      fetchConversations();
    } finally {
      setSavingCrm(false);
    }
  }, [apiBase, token, activeChatId, crmRow, crmOwner, fetchConversations]);

  const pushQuoteLinkToSheet = useCallback(
    async (quote) => {
      if (!quote?.link || !crmRow || !token) {
        setCrmStatus("falta link o fila CRM");
        return;
      }
      try {
        const r = await fetch(`${apiBase}/api/crm/cockpit/quote-link`, {
          method: "POST",
          headers: buildHeaders(token),
          body: JSON.stringify({ row: Number(crmRow), url: quote.link }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.ok) {
          setCrmStatus(`sheet error: ${j?.error || `HTTP ${r.status}`}`);
          return;
        }
        setCrmStatus(`link grabado en col ${j.column} fila ${j.row}`);
      } catch (e) {
        setCrmStatus(`error: ${e?.message || String(e)}`);
      }
    },
    [apiBase, token, crmRow],
  );

  const fetchThread = useCallback(
    async (chatId) => {
      if (!chatId || !token) return;
      setLoadingThread(true);
      setThreadError("");
      try {
        const r = await fetch(
          `${apiBase}/api/wa/messages?chat_id=${encodeURIComponent(chatId)}&limit=200`,
          { headers: buildHeaders(token) },
        );
        if (!r.ok) {
          const txt = await r.text();
          setThreadError(`HTTP ${r.status}: ${txt.slice(0, 120)}`);
          setMessages([]);
          return;
        }
        const j = await r.json();
        setMessages(Array.isArray(j?.items) ? j.items : []);
      } catch (e) {
        setThreadError(e?.message || String(e));
      } finally {
        setLoadingThread(false);
      }
    },
    [apiBase, token],
  );

  useEffect(() => {
    if (activeChatId) fetchThread(activeChatId);
  }, [activeChatId, fetchThread]);

  // ── render ────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div style={{ ...wrap, padding: 24, height: "auto", maxWidth: 720, margin: "32px auto" }}>
        <h1 style={{ margin: 0, fontSize: 22, color: "#1a3a5c" }}>WA Cockpit</h1>
        <p style={{ color: "#6e6e73", fontSize: 13, marginTop: 6 }}>
          Configurá el token cockpit para ingresar (mismo token de ML / Admin / Canales).
        </p>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5ea",
            borderRadius: 12,
            padding: 16,
            marginTop: 16,
          }}
        >
          <CockpitTokenPanel
            tokenAutoLoaded={false}
            tokenLoadError={tokenLoadError}
            tokenInput={tokenInput}
            setTokenInput={setTokenInput}
            onSave={onSaveToken}
            onClear={onClearToken}
            inputStyle={inputStyle}
            btnPrimaryStyle={btnPrimary}
            btnGhostStyle={btnGhost}
          />
        </div>
        <div style={{ marginTop: 16, fontSize: 12 }}>
          <Link to="/" style={{ color: "#0071e3", textDecoration: "none" }}>
            ← Calculadora
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/" style={{ color: "#0071e3", textDecoration: "none", fontSize: 12 }}>
            ←
          </Link>
          <strong style={{ color: "#1a3a5c" }}>WA Cockpit</strong>
          <span style={{ fontSize: 11, color: "#8a8a8e" }}>F1 — read-only</span>
          {health && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                background: health?.ok ? "#e6f7ec" : "#fde7e7",
                color: health?.ok ? "#2a7a2a" : "#a4262c",
              }}
              title={`db: ${String(health?.db)} · 24h msgs: ${health?.count_msgs_24h ?? "?"}`}
            >
              {health?.ok ? `${health.count_chats ?? 0} chats` : "offline"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={fetchConversations} style={btnGhost} disabled={loadingList}>
            {loadingList ? "…" : "Refresh"}
          </button>
          <button type="button" onClick={onClearToken} style={btnGhost}>
            Cambiar token
          </button>
        </div>
      </div>

      <div style={grid}>
        <div style={colLeft}>
          <div style={{ padding: 10, borderBottom: "1px solid #f0f0f3", display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              type="text"
              placeholder="Buscar nombre / teléfono / chat_id"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={inputStyle}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={select}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.id || "all"} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {listError && (
              <div style={{ fontSize: 11, color: "#a4262c" }}>error: {listError}</div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {conversations.length === 0 && !loadingList && (
              <div style={{ padding: 24, color: "#8a8a8e", fontSize: 13, textAlign: "center" }}>
                {`Sin conversaciones. Instalá la extensión Chrome y dale "Sync histórico".`}
              </div>
            )}
            {conversations.map((c) => {
              const active = c.chat_id === activeChatId;
              const stale =
                c.last_msg_in_at &&
                c.last_msg_in_at > (c.last_msg_out_at || "1970") &&
                Date.now() - new Date(c.last_msg_in_at).getTime() > 24 * 3600 * 1000;
              return (
                <div
                  key={c.chat_id}
                  style={chatItem(active)}
                  onClick={() => setActiveChatId(c.chat_id)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong
                      style={{
                        fontSize: 13,
                        color: "#1d1d1f",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.contact_name || c.phone || c.chat_id}
                    </strong>
                    <span style={{ fontSize: 10, color: "#8a8a8e" }}>{fmtTs(c.last_msg_at)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <span
                      style={{
                        fontSize: 10,
                        color: "#6e6e73",
                        background: "#f0f0f3",
                        borderRadius: 4,
                        padding: "1px 6px",
                      }}
                    >
                      {c.status || "new"}
                    </span>
                    {stale && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "#a4262c",
                          background: "#fde7e7",
                          borderRadius: 4,
                          padding: "1px 6px",
                        }}
                      >
                        stale 24h
                      </span>
                    )}
                    {c.intent_last && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "#1a3a5c",
                          background: "#eaf2ff",
                          borderRadius: 4,
                          padding: "1px 6px",
                        }}
                      >
                        {c.intent_last}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={colCenter}>
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid #e5e5ea",
              background: "#fff",
              fontSize: 13,
              color: "#1d1d1f",
            }}
          >
            {activeChat ? (
              <>
                <strong>{activeChat.contact_name || activeChat.phone || activeChat.chat_id}</strong>
                {activeChat.phone && activeChat.contact_name ? (
                  <span style={{ marginLeft: 8, color: "#8a8a8e", fontSize: 12 }}>
                    {activeChat.phone}
                  </span>
                ) : null}
              </>
            ) : (
              <span style={{ color: "#8a8a8e" }}>Seleccioná un chat</span>
            )}
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 16,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {threadError && (
              <div style={{ color: "#a4262c", fontSize: 12 }}>error: {threadError}</div>
            )}
            {loadingThread && <div style={{ color: "#8a8a8e", fontSize: 12 }}>cargando…</div>}
            {messages.map((m) => (
              <div key={m.msg_id} style={m.direction === "out" ? msgOut : msgIn}>
                <div>{m.text || <em style={{ color: "#8a8a8e" }}>[{m.type}]</em>}</div>
                <div style={{ fontSize: 10, color: "#6e6e73", marginTop: 4, textAlign: "right" }}>
                  {fmtTs(m.ts)} · {m.source}
                </div>
              </div>
            ))}
            {!loadingThread && activeChat && messages.length === 0 && !threadError && (
              <div style={{ color: "#8a8a8e", fontSize: 12, textAlign: "center", marginTop: 32 }}>
                Sin mensajes para este chat.
              </div>
            )}
          </div>
        </div>

        <div style={colRight}>
          <div style={{ padding: 10, borderBottom: "1px solid #f0f0f3", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                style={{
                  ...tabBtn(activeTab === t.id),
                  opacity: t.enabled ? 1 : 0.5,
                  cursor: t.enabled ? "pointer" : "not-allowed",
                }}
                onClick={() => {
                  if (t.enabled) setActiveTab(t.id);
                }}
                title={t.enabled ? t.label : `${t.label} — disponible en ${t.phase}`}
              >
                {t.label}{" "}
                <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 4 }}>{t.phase}</span>
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16, fontSize: 13, color: "#3a3a3c" }}>
            {!activeChat ? (
              <div style={{ color: "#8a8a8e", fontSize: 12 }}>
                Seleccioná un chat para ver acciones.
              </div>
            ) : activeTab === "ai" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 12 }}>3 borradores AI por chat</strong>
                  <button
                    type="button"
                    style={btnPrimary}
                    onClick={runSuggestion}
                    disabled={generatingSugg}
                  >
                    {generatingSugg ? "generando…" : "Generar ahora"}
                  </button>
                </div>

                {loadingSugg && <div style={{ color: "#8a8a8e", fontSize: 12 }}>cargando…</div>}

                {!loadingSugg && suggestions.length === 0 && (
                  <div style={{ color: "#8a8a8e", fontSize: 12 }}>
                    Sin sugerencias todavía. Click en <strong>Generar ahora</strong> o esperá al
                    enricher (intervalo {`${8}s`}).
                  </div>
                )}

                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e5ea",
                      borderRadius: 10,
                      padding: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6e6e73" }}>
                      <span>
                        intent: <strong>{s.intent || "?"}</strong>
                        {s.meta?.confidence != null ? ` · conf: ${Number(s.meta.confidence).toFixed(2)}` : ""}
                      </span>
                      <span>
                        {s.provider || "?"} · {s.latency_ms ?? "?"}ms · {fmtTs(s.generated_at)}
                      </span>
                    </div>
                    {s.error && (
                      <div style={{ fontSize: 11, color: "#a4262c" }}>error: {s.error}</div>
                    )}
                    {Array.isArray(s.options) && s.options.length === 0 && !s.error && (
                      <div style={{ fontSize: 11, color: "#8a8a8e" }}>
                        Sin opciones (chatter o intent sin valor — el enricher decidió no responder).
                      </div>
                    )}
                    {Array.isArray(s.options) &&
                      s.options.map((opt, idx) => {
                        const colors = toneBadgeColor(opt.tone);
                        const isChosen = s.chosen_idx === idx;
                        return (
                          <div
                            key={idx}
                            style={{
                              border: isChosen ? "1.5px solid #0071e3" : "1px solid #f0f0f3",
                              borderRadius: 8,
                              padding: 8,
                              background: isChosen ? "#eaf2ff" : "#fafafc",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: colors.bg,
                                  color: colors.fg,
                                  borderRadius: 4,
                                  padding: "2px 6px",
                                }}
                              >
                                {TONE_LABELS[opt.tone] || opt.tone}
                              </span>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button
                                  type="button"
                                  style={{ ...btnGhost, fontSize: 11, padding: "4px 8px" }}
                                  onClick={() => navigator.clipboard?.writeText(opt.text)}
                                  title="Copiar al portapapeles"
                                >
                                  Copiar
                                </button>
                                <button
                                  type="button"
                                  style={{ ...btnPrimary, fontSize: 11, padding: "4px 8px" }}
                                  onClick={() => copyAndOpenWa(s.id, idx, opt.text)}
                                  title="Copia + paste-back en WA + abre pestaña"
                                >
                                  Copiar y abrir WA
                                </button>
                              </div>
                            </div>
                            <div style={{ fontSize: 12, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                              {opt.text}
                            </div>
                            {isChosen && (
                              <div style={{ fontSize: 10, color: "#2a7a2a", marginTop: 4 }}>
                                ✓ elegida {fmtTs(s.chosen_at)}
                              </div>
                            )}
                            {pasteStatus[s.id] === "ok" && isChosen && (
                              <div style={{ fontSize: 10, color: "#2a7a2a", marginTop: 4 }}>
                                ✓ pegado en WA Web (confirmá con Enter en la app)
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            ) : activeTab === "quote" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <strong style={{ fontSize: 12 }}>Generar cotización</strong>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <input
                    type="number"
                    placeholder="m²"
                    value={quoteForm.metros}
                    onChange={(e) => setQuoteForm({ ...quoteForm, metros: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    placeholder="espesor (mm)"
                    value={quoteForm.espesor}
                    onChange={(e) => setQuoteForm({ ...quoteForm, espesor: e.target.value })}
                    style={inputStyle}
                  />
                  <select
                    value={quoteForm.scope}
                    onChange={(e) => setQuoteForm({ ...quoteForm, scope: e.target.value })}
                    style={select}
                  >
                    <option value="techo">techo</option>
                    <option value="pared">pared/fachada</option>
                  </select>
                  <select
                    value={quoteForm.lista}
                    onChange={(e) => setQuoteForm({ ...quoteForm, lista: e.target.value })}
                    style={select}
                  >
                    <option value="web">web</option>
                    <option value="venta">venta</option>
                  </select>
                  <input
                    type="text"
                    placeholder="familia (isodec_eps, isoroof_3g, ...)"
                    value={quoteForm.familia}
                    onChange={(e) => setQuoteForm({ ...quoteForm, familia: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="color"
                    value={quoteForm.color}
                    onChange={(e) => setQuoteForm({ ...quoteForm, color: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <button type="button" style={btnPrimary} onClick={runQuote} disabled={generatingQuote}>
                  {generatingQuote ? "cotizando…" : "Cotizar y guardar"}
                </button>
                {quoteError && (
                  <div style={{ fontSize: 11, color: "#a4262c" }}>error: {quoteError}</div>
                )}

                <div style={{ height: 1, background: "#f0f0f3", margin: "4px 0" }} />
                <strong style={{ fontSize: 12 }}>Cotizaciones guardadas</strong>
                {quotes.length === 0 && (
                  <div style={{ color: "#8a8a8e", fontSize: 12 }}>aún no hay cotizaciones para este chat</div>
                )}
                {quotes.map((q) => (
                  <div
                    key={q.quote_id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e5ea",
                      borderRadius: 10,
                      padding: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6e6e73" }}>
                      <span>
                        USD {Number(q.total_usd || 0).toFixed(2)} sin IVA · {q.params?.scope || "?"} ·{" "}
                        {q.params?.familia || "?"} {q.params?.espesor || ""}mm · {q.params?.metros || "?"}m²
                      </span>
                      <span>{fmtTs(q.generated_at)}</span>
                    </div>
                    {q.link && (
                      <a
                        href={q.link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#0071e3", fontSize: 11, wordBreak: "break-all" }}
                      >
                        {q.link}
                      </a>
                    )}
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        style={{ ...btnGhost, fontSize: 11, padding: "4px 8px" }}
                        onClick={() => navigator.clipboard?.writeText(q.link || "")}
                        disabled={!q.link}
                      >
                        Copiar link
                      </button>
                      <button
                        type="button"
                        style={{ ...btnPrimary, fontSize: 11, padding: "4px 8px" }}
                        onClick={() => pushQuoteLinkToSheet(q)}
                        disabled={!q.link || !crmRow}
                        title={!crmRow ? "Asocia primero la fila CRM en la tab CRM" : ""}
                      >
                        Mandar a Sheet (col AH)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : activeTab === "crm" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <strong style={{ fontSize: 12 }}>Asociar con CRM_Operativo</strong>
                <div style={{ fontSize: 11, color: "#6e6e73" }}>
                  Indicá la fila del lead en la pestaña CRM_Operativo (la columna AH se sincroniza desde la tab Cotizar).
                </div>
                <input
                  type="number"
                  placeholder="fila CRM_Operativo"
                  value={crmRow}
                  onChange={(e) => setCrmRow(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="owner_op (matias, etc.)"
                  value={crmOwner}
                  onChange={(e) => setCrmOwner(e.target.value)}
                  style={inputStyle}
                />
                <button type="button" style={btnPrimary} onClick={saveCrm} disabled={savingCrm}>
                  {savingCrm ? "guardando…" : "Save"}
                </button>
                {crmStatus && <div style={{ fontSize: 11, color: "#2a7a2a" }}>{crmStatus}</div>}

                <div style={{ height: 1, background: "#f0f0f3", margin: "4px 0" }} />
                <div>
                  <strong style={{ fontSize: 12 }}>chat_id:</strong>{" "}
                  <code style={{ fontSize: 11 }}>{activeChat.chat_id}</code>
                </div>
                {activeChat.phone && (
                  <div>
                    <strong style={{ fontSize: 12 }}>teléfono:</strong> {activeChat.phone}
                  </div>
                )}
                {activeChat.contact_name && (
                  <div>
                    <strong style={{ fontSize: 12 }}>nombre:</strong> {activeChat.contact_name}
                  </div>
                )}
                {activeChat.intent_last && (
                  <div>
                    <strong style={{ fontSize: 12 }}>intent último:</strong> {activeChat.intent_last}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    background: "#fffbeb",
                    border: "1px solid #ffe066",
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 12,
                    color: "#5c4d00",
                  }}
                >
                  <strong>{TABS.find((t) => t.id === activeTab)?.phase || "?"}.</strong> Esta tab se
                  habilita en una fase posterior.
                </div>
                <div>
                  <strong style={{ fontSize: 12 }}>chat_id:</strong>{" "}
                  <code style={{ fontSize: 11 }}>{activeChat.chat_id}</code>
                </div>
                {activeChat.phone && (
                  <div>
                    <strong style={{ fontSize: 12 }}>teléfono:</strong> {activeChat.phone}
                  </div>
                )}
                {activeChat.lead_sheet_row != null && (
                  <div>
                    <strong style={{ fontSize: 12 }}>fila CRM:</strong> {activeChat.lead_sheet_row}
                  </div>
                )}
                <div>
                  <strong style={{ fontSize: 12 }}>último mensaje:</strong>{" "}
                  {fmtTs(activeChat.last_msg_at)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
