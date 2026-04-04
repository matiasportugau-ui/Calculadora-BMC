import { useMemo, useState } from "react";

const BORDER = "#e5e5ea";
const TEXT = "#1d1d1f";
const SUBTEXT = "#6e6e73";
const SURFACE = "#f5f5f7";
const PRIMARY = "#0071e3";

function tabButton(active) {
  return {
    border: "none",
    borderBottom: active ? `2px solid ${PRIMARY}` : "2px solid transparent",
    background: "transparent",
    color: active ? PRIMARY : SUBTEXT,
    fontSize: 12,
    fontWeight: 600,
    padding: "8px 10px",
    cursor: "pointer",
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
}) {
  const PRIMARY_COLOR = skinTokens?.primary || PRIMARY;
  const SURFACE_COLOR = skinTokens?.surface || SURFACE;
  const BORDER_COLOR = skinTokens?.border || BORDER;
  const TEXT_COLOR = skinTokens?.text || TEXT;
  const SUBTEXT_COLOR = skinTokens?.subtext || SUBTEXT;
  const [activeTab, setActiveTab] = useState("train");
  const [trainExpanded, setTrainExpanded] = useState(false);
  const [category, setCategory] = useState("conversational");
  const [correction, setCorrection] = useState("");
  const [context, setContext] = useState("");
  const [section, setSection] = useState("WORKFLOW");
  const [sectionDraft, setSectionDraft] = useState("");

  const lastUser = useMemo(
    () => [...messages].reverse().find((m) => m.role === "user")?.content || "",
    [messages]
  );
  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant")?.content || "",
    [messages]
  );

  const loadSectionIntoDraft = () => {
    setSectionDraft(promptSections?.[section] || "");
  };

  return (
    <div style={{ borderTop: `1px solid ${BORDER_COLOR}`, background: skinTokens?.drawerBg || "#fff", flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 4, padding: "0 8px", borderBottom: `1px solid ${BORDER_COLOR}` }}>
        <button type="button" style={{ ...tabButton(activeTab === "train"), color: activeTab === "train" ? PRIMARY_COLOR : SUBTEXT_COLOR, borderBottom: activeTab === "train" ? `2px solid ${PRIMARY_COLOR}` : "2px solid transparent" }} onClick={() => setActiveTab("train")}>
          Train
        </button>
        <button type="button" style={{ ...tabButton(activeTab === "kb"), color: activeTab === "kb" ? PRIMARY_COLOR : SUBTEXT_COLOR, borderBottom: activeTab === "kb" ? `2px solid ${PRIMARY_COLOR}` : "2px solid transparent" }} onClick={() => setActiveTab("kb")}>
          KB
        </button>
        <button type="button" style={{ ...tabButton(activeTab === "prompt"), color: activeTab === "prompt" ? PRIMARY_COLOR : SUBTEXT_COLOR, borderBottom: activeTab === "prompt" ? `2px solid ${PRIMARY_COLOR}` : "2px solid transparent" }} onClick={() => setActiveTab("prompt")}>
          Prompt
        </button>
      </div>

      <div
        style={{
          maxHeight: activeTab === "train" && trainExpanded ? 440 : 280,
          overflowY: "auto",
          padding: 10,
          transition: "max-height 160ms ease",
        }}
      >
        {activeTab === "train" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setTrainExpanded((v) => !v)}
                style={{
                  alignSelf: "flex-end",
                  border: `1px solid ${BORDER_COLOR}`,
                  borderRadius: 8,
                  background: SURFACE_COLOR,
                  padding: "6px 8px",
                  fontSize: 12,
                  cursor: "pointer",
                  color: TEXT_COLOR,
                }}
              >
                {trainExpanded ? "Compactar" : "Expandir"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: SUBTEXT_COLOR }}>
              KB match: <b>{devMeta?.kbMatches ?? 0}</b> · Calc check:{" "}
              <b>
                {devMeta?.calcValidation?.matches == null
                  ? "n/a"
                  : devMeta.calcValidation.matches
                    ? "ok"
                    : "mismatch"}
              </b>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ flex: 1, border: `1px solid ${BORDER_COLOR}`, borderRadius: 8, padding: "6px 8px", fontSize: 12, background: skinTokens?.drawerBg || "#fff", color: TEXT_COLOR }}
              >
                <option value="conversational">Conversational</option>
                <option value="sales">Sales</option>
                <option value="math">Math</option>
                <option value="product">Product</option>
              </select>
              <button
                type="button"
                onClick={() => onVerifyCalculation?.(lastAssistant)}
                style={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: 8, background: SURFACE_COLOR, padding: "6px 8px", fontSize: 12, cursor: "pointer", color: TEXT_COLOR }}
              >
                Verify calc
              </button>
            </div>
            <textarea
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              placeholder="Ideal response (correction)"
              rows={3}
              style={{
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: 8,
                padding: 8,
                fontSize: 12,
                color: TEXT_COLOR,
                resize: "vertical",
                minHeight: 78,
                maxHeight: 260,
                fontFamily: "inherit",
              }}
            />
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Optional context"
              rows={2}
              style={{
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: 8,
                padding: 8,
                fontSize: 12,
                color: TEXT_COLOR,
                resize: "vertical",
                minHeight: 62,
                maxHeight: 220,
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={() => {
                onSaveCorrection?.({
                  category,
                  question: lastUser,
                  badAnswer: lastAssistant,
                  goodAnswer: correction,
                  context,
                });
                setCorrection("");
                setContext("");
              }}
              disabled={!correction.trim() || !lastUser.trim()}
              style={{
                border: "none",
                borderRadius: 8,
                background: correction.trim() && lastUser.trim() ? PRIMARY_COLOR : BORDER_COLOR,
                color: "#fff",
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 600,
                cursor: correction.trim() && lastUser.trim() ? "pointer" : "not-allowed",
              }}
            >
              Save correction
            </button>
          </div>
        )}

        {activeTab === "kb" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: SUBTEXT_COLOR }}>
              Total entries: <b>{trainingStats?.total ?? 0}</b>
            </div>
            <button
              type="button"
              onClick={onReloadTrainingKB}
              style={{ alignSelf: "flex-start", border: `1px solid ${BORDER_COLOR}`, borderRadius: 8, background: SURFACE_COLOR, padding: "6px 8px", fontSize: 12, cursor: "pointer", color: TEXT_COLOR }}
            >
              Reload KB
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(trainingEntries || []).slice(0, 8).map((entry) => (
                <div key={entry.id} style={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: 8, padding: 8, background: SURFACE_COLOR }}>
                  <div style={{ fontSize: 10, color: SUBTEXT_COLOR, marginBottom: 4 }}>{entry.category}</div>
                  <div style={{ fontSize: 12, color: TEXT_COLOR }}>{entry.question}</div>
                </div>
              ))}
              {(!trainingEntries || trainingEntries.length === 0) && (
                <div style={{ fontSize: 12, color: SUBTEXT_COLOR }}>No entries yet.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "prompt" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                style={{ flex: 1, border: `1px solid ${BORDER_COLOR}`, borderRadius: 8, padding: "6px 8px", fontSize: 12, background: skinTokens?.drawerBg || "#fff", color: TEXT_COLOR }}
              >
                <option value="IDENTITY">IDENTITY</option>
                <option value="CATALOG">CATALOG</option>
                <option value="WORKFLOW">WORKFLOW</option>
                <option value="ACTIONS_DOC">ACTIONS_DOC</option>
              </select>
              <button type="button" onClick={onReloadPromptSections} style={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: 8, background: SURFACE_COLOR, padding: "6px 8px", fontSize: 12, cursor: "pointer", color: TEXT_COLOR }}>
                Reload
              </button>
              <button type="button" onClick={loadSectionIntoDraft} style={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: 8, background: SURFACE_COLOR, padding: "6px 8px", fontSize: 12, cursor: "pointer", color: TEXT_COLOR }}>
                Load
              </button>
            </div>
            <textarea
              value={sectionDraft}
              onChange={(e) => setSectionDraft(e.target.value)}
              placeholder="Section content"
              rows={4}
              style={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: 8, padding: 8, fontSize: 12, background: skinTokens?.drawerBg || "#fff", color: TEXT_COLOR }}
            />
            <button
              type="button"
              onClick={() => onSavePromptSection?.({ section, content: sectionDraft })}
              disabled={!sectionDraft.trim()}
              style={{
                border: "none",
                borderRadius: 8,
                background: sectionDraft.trim() ? PRIMARY_COLOR : BORDER_COLOR,
                color: "#fff",
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 600,
                cursor: sectionDraft.trim() ? "pointer" : "not-allowed",
              }}
            >
              Save section
            </button>
            <button
              type="button"
              onClick={onReloadPromptPreview}
              style={{ alignSelf: "flex-start", border: `1px solid ${BORDER_COLOR}`, borderRadius: 8, background: SURFACE_COLOR, padding: "6px 8px", fontSize: 12, cursor: "pointer", color: TEXT_COLOR }}
            >
              Refresh preview
            </button>
            <div style={{ fontSize: 11, color: SUBTEXT_COLOR, whiteSpace: "pre-wrap", maxHeight: 90, overflowY: "auto" }}>
              {(promptPreview || "").slice(0, 1200)}
              {(promptPreview || "").length > 1200 ? "\n..." : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
