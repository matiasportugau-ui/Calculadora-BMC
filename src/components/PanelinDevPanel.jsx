import { useMemo, useState, useCallback, useEffect } from "react";

const BORDER = "#e5e5ea";
const TEXT = "#1d1d1f";
const SUBTEXT = "#6e6e73";
const SURFACE = "#f5f5f7";
const PRIMARY = "#0071e3";
const DANGER = "#ff3b30";

function tabButton(active, color, subtext) {
  return {
    border: "none",
    borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
    background: "transparent",
    color: active ? color : subtext,
    fontSize: 12,
    fontWeight: 600,
    padding: "8px 10px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function btn(opts = {}) {
  return {
    border: `1px solid ${opts.border || BORDER}`,
    borderRadius: 8,
    background: opts.bg || SURFACE,
    color: opts.color || TEXT,
    padding: "6px 8px",
    fontSize: 12,
    cursor: opts.disabled ? "not-allowed" : "pointer",
    opacity: opts.disabled ? 0.5 : 1,
    fontWeight: opts.bold ? 600 : 400,
  };
}

export default function PanelinDevPanel({
  skinTokens,
  messages,
  trainingEntries,
  trainingStats,
  devMeta,
  promptPreview,
  promptSections,
  onSaveCorrection,
  onReloadTrainingKB,
  onReloadPromptPreview,
  onReloadPromptSections,
  onSavePromptSection,
  onVerifyCalculation,
  onBulkDeleteKB,
  onBulkArchiveKB,
  onLoadConversations,
  onLoadConversationAnalysis,
}) {
  const P = skinTokens?.primary || PRIMARY;
  const SF = skinTokens?.surface || SURFACE;
  const BD = skinTokens?.border || BORDER;
  const TX = skinTokens?.text || TEXT;
  const ST = skinTokens?.subtext || SUBTEXT;
  const BG = skinTokens?.drawerBg || "#fff";

  const [activeTab, setActiveTab] = useState("train");

  // ── Train tab ──────────────────────────────────────────────────────────────
  const [trainExpanded, setTrainExpanded] = useState(false);
  const [category, setCategory] = useState("conversational");
  const [correction, setCorrection] = useState("");
  const [context, setContext] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [saving, setSaving] = useState(false);

  // ── KB tab ─────────────────────────────────────────────────────────────────
  const [kbQuery, setKbQuery] = useState("");
  const [kbCategoryFilter, setKbCategoryFilter] = useState("");
  const [kbPage, setKbPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const KB_PAGE_SIZE = 20;

  // ── Prompt tab ─────────────────────────────────────────────────────────────
  const [section, setSection] = useState("WORKFLOW");
  const [sectionDraft, setSectionDraft] = useState("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // ── Sessions tab ───────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [expandedConvId, setExpandedConvId] = useState(null);
  const [convAnalysis, setConvAnalysis] = useState({});
  const [loadingAnalysis, setLoadingAnalysis] = useState(null);

  const lastUser = useMemo(
    () => [...messages].reverse().find((m) => m.role === "user")?.content || "",
    [messages]
  );
  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant")?.content || "",
    [messages]
  );

  // Auto-load section into draft when section selector changes
  useEffect(() => {
    setSectionDraft(promptSections?.[section] || "");
  }, [section, promptSections]);

  // ── KB filtering ───────────────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    const entries = trainingEntries || [];
    return entries.filter((e) => {
      if (e.archived) return false;
      const matchesQuery = !kbQuery ||
        e.question.toLowerCase().includes(kbQuery.toLowerCase()) ||
        (e.goodAnswer || "").toLowerCase().includes(kbQuery.toLowerCase());
      const matchesCat = !kbCategoryFilter || e.category === kbCategoryFilter;
      return matchesQuery && matchesCat;
    });
  }, [trainingEntries, kbQuery, kbCategoryFilter]);

  const visibleEntries = filteredEntries.slice(0, kbPage * KB_PAGE_SIZE);
  const hasMore = visibleEntries.length < filteredEntries.length;

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (!selectedIds.size || !onBulkDeleteKB) return;
    await onBulkDeleteKB([...selectedIds]);
    clearSelection();
  };

  const handleBulkArchive = async () => {
    if (!selectedIds.size || !onBulkArchiveKB) return;
    await onBulkArchiveKB([...selectedIds]);
    clearSelection();
  };

  // ── Save correction ────────────────────────────────────────────────────────
  const handleSaveCorrection = async ({ allowDuplicate = false } = {}) => {
    if (!correction.trim() || !lastUser.trim() || saving) return;
    setSaving(true);
    setDuplicateWarning(null);
    try {
      const result = await onSaveCorrection?.({
        category,
        question: lastUser,
        badAnswer: lastAssistant,
        goodAnswer: correction,
        context,
        allowDuplicate,
      });
      if (result?.duplicate) {
        setDuplicateWarning(result.existingId);
      } else {
        setCorrection("");
        setContext("");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Sessions loading ───────────────────────────────────────────────────────
  const loadSessions = useCallback(async (page = 1) => {
    if (!onLoadConversations) return;
    setLoadingSessions(true);
    try {
      const data = await onLoadConversations({ days: 30, page, limit: 15 });
      if (data?.ok) {
        const incoming = data.conversations || [];
        setSessions((prev) => {
          if (page === 1) return incoming;
          // Append and de-dup by conversationId
          const existingIds = new Set(prev.map((c) => c.conversationId));
          return [...prev, ...incoming.filter((c) => !existingIds.has(c.conversationId))];
        });
        setSessionsTotal(data.total || 0);
        setSessionsPage(page);
      }
    } finally {
      setLoadingSessions(false);
    }
  }, [onLoadConversations]);

  useEffect(() => {
    if (activeTab === "sessions" && sessions.length === 0) {
      loadSessions(1);
    }
  }, [activeTab, loadSessions, sessions.length]);

  const copyPromptToClipboard = async () => {
    const text = promptPreview || "";
    if (!navigator?.clipboard?.writeText) {
      window.alert("El portapapeles no está disponible en este contexto.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.alert("No se pudo copiar al portapapeles.");
    }
  };

  const loadAnalysis = async (convId) => {
    if (!onLoadConversationAnalysis || loadingAnalysis === convId) return;
    setLoadingAnalysis(convId);
    try {
      const data = await onLoadConversationAnalysis(convId);
      if (data?.ok) setConvAnalysis((prev) => ({ ...prev, [convId]: data.analysis }));
    } finally {
      setLoadingAnalysis(null);
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inputStyle = {
    border: `1px solid ${BD}`, borderRadius: 8, padding: "6px 8px",
    fontSize: 12, background: BG, color: TX, width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ borderTop: `1px solid ${BD}`, background: BG, flexShrink: 0 }}>
      {/* ── Tab bar ── */}
      <div style={{ display: "flex", gap: 2, padding: "0 8px", borderBottom: `1px solid ${BD}`, overflowX: "auto" }}>
        {["train", "kb", "prompt", "sessions"].map((tab) => (
          <button
            key={tab}
            type="button"
            style={tabButton(activeTab === tab, P, ST)}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "train" ? "Train" : tab === "kb" ? "KB" : tab === "prompt" ? "Prompt" : "Sessions"}
            {tab === "kb" && trainingStats?.total ? ` (${trainingStats.total})` : ""}
          </button>
        ))}
      </div>

      <div style={{
        maxHeight: trainExpanded && activeTab === "train" ? 440 : 320,
        overflowY: "auto",
        padding: 10,
        transition: "max-height 160ms ease",
      }}>

        {/* ── TRAIN TAB ── */}
        {activeTab === "train" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 11, color: ST }}>
                KB match: <b>{devMeta?.kbMatches ?? 0}</b> · Calc:{" "}
                <b>
                  {devMeta?.calcValidation?.matches == null ? "n/a"
                    : devMeta.calcValidation.matches ? "ok" : "mismatch"}
                </b>
              </div>
              <button type="button" onClick={() => setTrainExpanded((v) => !v)} style={btn()}>
                {trainExpanded ? "Compactar" : "Expandir"}
              </button>
            </div>

            {duplicateWarning && (
              <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#856404" }}>
                Ya existe una entrada con esta pregunta (id: {String(duplicateWarning).slice(0, 8)}…).
                <button
                  type="button"
                  onClick={() => handleSaveCorrection({ allowDuplicate: true })}
                  style={{ marginLeft: 8, fontSize: 11, cursor: "pointer", background: "transparent", border: "none", textDecoration: "underline", color: "#856404" }}
                >
                  Guardar igual
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: 6 }}>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                <option value="conversational">Conversational</option>
                <option value="sales">Sales</option>
                <option value="math">Math</option>
                <option value="product">Product</option>
              </select>
              <button type="button" onClick={() => onVerifyCalculation?.(lastAssistant)} style={btn()}>
                Verify calc
              </button>
            </div>

            <textarea
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              placeholder="Ideal response (correction)"
              rows={3}
              style={{ ...inputStyle, resize: "vertical", minHeight: 78, maxHeight: 260, fontFamily: "inherit" }}
            />
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Optional context"
              rows={2}
              style={{ ...inputStyle, resize: "vertical", minHeight: 62, maxHeight: 200, fontFamily: "inherit" }}
            />
            <button
              type="button"
              onClick={handleSaveCorrection}
              disabled={!correction.trim() || !lastUser.trim() || saving}
              style={{
                border: "none", borderRadius: 8,
                background: correction.trim() && lastUser.trim() && !saving ? P : BD,
                color: "#fff", padding: "8px 10px", fontSize: 12, fontWeight: 600,
                cursor: correction.trim() && lastUser.trim() && !saving ? "pointer" : "not-allowed",
              }}
            >
              {saving ? "Guardando…" : "Save correction"}
            </button>
          </div>
        )}

        {/* ── KB TAB ── */}
        {activeTab === "kb" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                value={kbQuery}
                onChange={(e) => { setKbQuery(e.target.value); setKbPage(1); setSelectedIds(new Set()); }}
                placeholder="Buscar en KB…"
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                value={kbCategoryFilter}
                onChange={(e) => { setKbCategoryFilter(e.target.value); setKbPage(1); }}
                style={{ ...inputStyle, width: "auto" }}
              >
                <option value="">Todas</option>
                <option value="conversational">Conv.</option>
                <option value="sales">Sales</option>
                <option value="math">Math</option>
                <option value="product">Product</option>
              </select>
              <button type="button" onClick={onReloadTrainingKB} style={btn()}>↺</button>
            </div>

            <div style={{ fontSize: 11, color: ST }}>
              {filteredEntries.length} de {trainingStats?.total ?? 0} entradas
              {selectedIds.size > 0 && ` · ${selectedIds.size} seleccionadas`}
            </div>

            {selectedIds.size > 0 && (
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={handleBulkDelete} style={btn({ bg: DANGER, color: "#fff", border: DANGER })}>
                  Eliminar ({selectedIds.size})
                </button>
                <button type="button" onClick={handleBulkArchive} style={btn()}>
                  Archivar ({selectedIds.size})
                </button>
                <button type="button" onClick={clearSelection} style={btn()}>Limpiar</button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {visibleEntries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    border: `1px solid ${selectedIds.has(entry.id) ? P : BD}`,
                    borderRadius: 8,
                    padding: 8,
                    background: selectedIds.has(entry.id) ? `${P}18` : SF,
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(entry.id)}
                    onChange={() => toggleSelect(entry.id)}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: ST, marginBottom: 3 }}>{entry.category}</div>
                    <div style={{ fontSize: 12, color: TX, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.question}
                    </div>
                  </div>
                </div>
              ))}
              {filteredEntries.length === 0 && (
                <div style={{ fontSize: 12, color: ST }}>Sin entradas.</div>
              )}
            </div>

            {hasMore && (
              <button type="button" onClick={() => setKbPage((p) => p + 1)} style={btn()}>
                Cargar más ({filteredEntries.length - visibleEntries.length} restantes)
              </button>
            )}
          </div>
        )}

        {/* ── PROMPT TAB ── */}
        {activeTab === "prompt" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <select value={section} onChange={(e) => setSection(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                <option value="IDENTITY">IDENTITY</option>
                <option value="CATALOG">CATALOG</option>
                <option value="WORKFLOW">WORKFLOW</option>
                <option value="ACTIONS_DOC">ACTIONS_DOC</option>
              </select>
              <button type="button" onClick={onReloadPromptSections} style={btn()}>↺</button>
            </div>
            <textarea
              value={sectionDraft}
              onChange={(e) => setSectionDraft(e.target.value)}
              placeholder="Section content"
              rows={5}
              style={{ ...inputStyle, resize: "vertical", minHeight: 100, maxHeight: 260, fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => onSavePromptSection?.({ section, content: sectionDraft })}
                disabled={!sectionDraft.trim()}
                style={{
                  flex: 1, border: "none", borderRadius: 8,
                  background: sectionDraft.trim() ? P : BD,
                  color: "#fff", padding: "8px 10px", fontSize: 12, fontWeight: 600,
                  cursor: sectionDraft.trim() ? "pointer" : "not-allowed",
                }}
              >
                Save section
              </button>
              <button type="button" onClick={onReloadPromptPreview} style={btn()}>
                Refresh preview
              </button>
              <button type="button" onClick={() => setShowPreviewModal(true)} disabled={!promptPreview} style={btn({ disabled: !promptPreview })}>
                Ver todo
              </button>
            </div>

            <div style={{ fontSize: 11, color: ST, whiteSpace: "pre-wrap", maxHeight: 80, overflowY: "auto", background: SF, borderRadius: 6, padding: 6 }}>
              {(promptPreview || "").slice(0, 400)}
              {(promptPreview || "").length > 400 ? "\n…" : ""}
            </div>
          </div>
        )}

        {/* ── SESSIONS TAB ── */}
        {activeTab === "sessions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 11, color: ST }}>
                {sessionsTotal} conversaciones (últimos 30 días)
              </div>
              <button type="button" onClick={() => loadSessions(1)} style={btn()}>
                {loadingSessions ? "…" : "↺ Recargar"}
              </button>
            </div>

            {loadingSessions && <div style={{ fontSize: 12, color: ST }}>Cargando…</div>}

            {sessions.map((conv) => (
              <div key={conv.conversationId} style={{ border: `1px solid ${BD}`, borderRadius: 8, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setExpandedConvId((prev) => prev === conv.conversationId ? null : conv.conversationId)}
                  style={{ width: "100%", textAlign: "left", background: SF, border: "none", padding: "8px 10px", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: ST }}>{conv.startedAt?.slice(0, 16).replace("T", " ")}</span>
                    <span style={{ color: ST }}>{conv.provider} · {conv.turnCount} turnos · {conv.hedgeCount ?? 0} hedges</span>
                  </div>
                  <div style={{ fontSize: 12, color: TX, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {conv.firstUserMessage || "(sin mensaje)"}
                  </div>
                </button>

                {expandedConvId === conv.conversationId && (
                  <div style={{ padding: "8px 10px", borderTop: `1px solid ${BD}`, background: BG }}>
                    <div style={{ fontSize: 11, color: ST, marginBottom: 6 }}>
                      Acciones: {(conv.actionsEmitted || []).join(", ") || "ninguna"}
                    </div>
                    {!convAnalysis[conv.conversationId] && (
                      <button
                        type="button"
                        onClick={() => loadAnalysis(conv.conversationId)}
                        disabled={loadingAnalysis === conv.conversationId}
                        style={btn({ disabled: loadingAnalysis === conv.conversationId })}
                      >
                        {loadingAnalysis === conv.conversationId ? "Analizando…" : "Analizar con IA"}
                      </button>
                    )}
                    {convAnalysis[conv.conversationId] && (() => {
                      const a = convAnalysis[conv.conversationId];
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
                          {a.parseError ? (
                            <div style={{ color: ST, whiteSpace: "pre-wrap" }}>{a.raw?.slice(0, 400)}</div>
                          ) : (
                            <>
                              {a.pros?.length > 0 && <div><b style={{ color: "#34c759" }}>✓ Pros:</b> {a.pros.join(" · ")}</div>}
                              {a.cons?.length > 0 && <div><b style={{ color: DANGER }}>✗ Cons:</b> {a.cons.join(" · ")}</div>}
                              {a.kbSuggestions?.length > 0 && (
                                <div>
                                  <b>KB sugeridas:</b>
                                  {a.kbSuggestions.map((s, i) => (
                                    <div key={i} style={{ marginLeft: 8, marginTop: 2, color: ST }}>{s.question}</div>
                                  ))}
                                </div>
                              )}
                              {a.improvementSuggestions?.length > 0 && (
                                <div><b>Mejoras:</b> {a.improvementSuggestions.join(" · ")}</div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}

            {sessions.length === 0 && !loadingSessions && (
              <div style={{ fontSize: 12, color: ST }}>Sin conversaciones registradas.</div>
            )}

            {sessionsTotal > sessions.length && (
              <button type="button" onClick={() => loadSessions(sessionsPage + 1)} style={btn()}>
                Cargar más
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Full prompt preview modal ── */}
      {showPreviewModal && (
        <div
          onClick={() => setShowPreviewModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: BG, borderRadius: 12, padding: 20, maxWidth: 760, width: "100%",
              maxHeight: "80vh", display: "flex", flexDirection: "column", gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: TX }}>System Prompt completo</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={copyPromptToClipboard}
                  style={btn()}
                >
                  Copiar
                </button>
                <button type="button" onClick={() => setShowPreviewModal(false)} style={btn()}>✕</button>
              </div>
            </div>
            <pre style={{
              flex: 1, overflowY: "auto", fontSize: 11, color: TX, whiteSpace: "pre-wrap",
              background: SF, borderRadius: 8, padding: 12, margin: 0, lineHeight: 1.5,
            }}>
              {promptPreview || ""}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
