/**
 * AgentModelSelector — provider + model pick inside Panelin chat (SDD Phase 1).
 *
 * Uses setAiPick("auto" | `${provider}|` | `${provider}|${modelId}`).
 */

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";

/**
 * @param {object} props
 * @param {string} [props.aiProvider]
 * @param {string} [props.aiModel]
 * @param {object|null} [props.aiOptions]  — from GET /api/agent/ai-options
 * @param {function} [props.setAiPick]
 * @param {object|null} [props.readiness] — optional providers[] with light/state
 * @param {boolean} [props.disabled]
 * @param {string} [props.tone] — "light" | "dark" for header contrast
 */
export default function AgentModelSelector({
  aiProvider = "auto",
  aiModel = "",
  aiOptions = null,
  setAiPick,
  readiness = null,
  disabled = false,
  tone = "light",
}) {
  const providers = Array.isArray(aiOptions?.providers) ? aiOptions.providers : [];
  const byId = new Map(providers.map((p) => [p.id, p]));
  const readyById = new Map(
    (Array.isArray(readiness?.providers) ? readiness.providers : []).map((p) => [p.id, p]),
  );

  const isBlocked = (id) => {
    const row = readyById.get(id);
    if (!row) return false;
    // Prefer state from readiness when present
    if (row.state === "not_ready") return true;
    if (row.light === "red") return true;
    return false;
  };

  const pickValue =
    !aiProvider || aiProvider === "auto"
      ? "auto"
      : aiModel
        ? `${aiProvider}|${aiModel}`
        : `${aiProvider}|`;

  const currentProv = byId.get(aiProvider);
  const models = Array.isArray(currentProv?.models) ? currentProv.models : [];

  const fg = tone === "dark" ? "rgba(255,255,255,0.92)" : "#1d1d1f";
  const border =
    tone === "dark" ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(0,0,0,0.12)";
  const bg = tone === "dark" ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.9)";

  const selectStyle = {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 600,
    color: fg,
    background: bg,
    border,
    borderRadius: 8,
    padding: "3px 6px",
    maxWidth: 140,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };

  const onProviderChange = (e) => {
    if (!setAiPick || disabled) return;
    const v = e.target.value;
    if (v === "auto") {
      setAiPick("auto");
      return;
    }
    // provider default model
    setAiPick(`${v}|`);
  };

  const onModelChange = (e) => {
    if (!setAiPick || disabled) return;
    const m = e.target.value;
    const prov = aiProvider && aiProvider !== "auto" ? aiProvider : "auto";
    if (prov === "auto") return;
    setAiPick(m ? `${prov}|${m}` : `${prov}|`);
  };

  const voiceNote = (() => {
    const p = String(aiProvider || "auto").toLowerCase();
    if (p === "grok") return "Voz en chat: Grok (decí «Panelin» y hablá)";
    if (p === "openai") return "Voz en chat: OpenAI";
    if (p === "claude") return "Voz en chat: Claude";
    if (p === "gemini") return "Voz en chat: Gemini";
    return "Voz en chat: Auto (mejor motor listo)";
  })();

  return (
    <div
      data-no-drag
      className="agentModelSelector"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        marginTop: 4,
        fontFamily: FONT,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <label style={{ fontSize: 10, opacity: 0.85, color: fg }}>
          IA
          <select
            aria-label="Proveedor de IA"
            value={aiProvider === "auto" || !aiProvider ? "auto" : aiProvider}
            onChange={onProviderChange}
            disabled={disabled || !setAiPick}
            style={{ ...selectStyle, marginLeft: 4 }}
          >
            <option value="auto">Auto</option>
            {providers.map((p) => {
              const blocked = isBlocked(p.id);
              const light = readyById.get(p.id)?.light;
              const tag =
                light === "green" ? " ●" : light === "amber" ? " ◐" : light === "red" ? " ○" : "";
              return (
                <option key={p.id} value={p.id} disabled={blocked}>
                  {p.label || p.id}
                  {tag}
                  {blocked ? " (no listo)" : ""}
                </option>
              );
            })}
          </select>
        </label>

        {aiProvider && aiProvider !== "auto" && models.length > 0 ? (
          <label style={{ fontSize: 10, opacity: 0.85, color: fg }}>
            Modelo
            <select
              aria-label="Modelo de IA"
              value={aiModel || ""}
              onChange={onModelChange}
              disabled={disabled || !setAiPick || isBlocked(aiProvider)}
              style={{ ...selectStyle, marginLeft: 4, maxWidth: 180 }}
            >
              <option value="">
                {currentProv?.defaultModel
                  ? `Default (${currentProv.defaultModel})`
                  : "Default del servidor"}
              </option>
              {models.map((m) => {
                const id = typeof m === "string" ? m : m.id;
                const label = typeof m === "string" ? m : m.label || m.id;
                return (
                  <option key={id} value={id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>
        ) : null}
      </div>
      <div style={{ fontSize: 10, opacity: 0.75, color: fg, lineHeight: 1.2 }} title={voiceNote}>
        {voiceNote}
      </div>
      {/* debug value for tests */}
      <span data-testid="agent-model-pick" style={{ display: "none" }}>
        {pickValue}
      </span>
    </div>
  );
}
