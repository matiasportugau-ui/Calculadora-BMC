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
  const [activeTab, setActiveTab] = useState("train");
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
    <div style={{ borderTop: `1px solid ${BORDER}`, background: "#fff", flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 4, padding: "0 8px", borderBottom: `1px solid ${BORDER}` }}>
        <button type="button" style={tabButton(activeTab === "train")} onClick={() => setActiveTab("train")}>
          Train
        </button>
        <button type="button" style={tabButton(activeTab === "kb")} onClick={() => setActiveTab("kb")}>
          KB
        </button>
        <button type="button" style={tabButton(activeTab === "prompt")} onClick={() => setActiveTab("prompt")}>
          Prompt
        </button>
      </div>

      <div style={{ maxHeight: 210, overflowY: "auto", padding: 10 }}>
        {activeTab === "train" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: SUBTEXT }}>
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
                style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
              >
                <option value="conversational">Conversational</option>
                <option value="sales">Sales</option>
                <option value="math">Math</option>
                <option value="product">Product</option>
              </select>
              <button
                type="button"
                onClick={() => onVerifyCalculation?.(lastAssistant)}
                style={{ border: `1px solid ${BORDER}`, borderRadius: 8, background: SURFACE, padding: "6px 8px", fontSize: 12, cursor: "pointer" }}
              >
                Verify calc
              </button>
            </div>
            <textarea
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              placeholder="Ideal response (correction)"
              rows={3}
              style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8, fontSize: 12, color: TEXT }}
            />
            <input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Optional context"
              style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8, fontSize: 12 }}
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
                background: correction.trim() && lastUser.trim() ? PRIMARY : BORDER,
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
            <div style={{ fontSize: 11, color: SUBTEXT }}>
              Total entries: <b>{trainingStats?.total ?? 0}</b>
            </div>
            <button
              type="button"
              onClick={onReloadTrainingKB}
              style={{ alignSelf: "flex-start", border: `1px solid ${BORDER}`, borderRadius: 8, background: SURFACE, padding: "6px 8px", fontSize: 12, cursor: "pointer" }}
            >
              Reload KB
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(trainingEntries || []).slice(0, 8).map((entry) => (
                <div key={entry.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8, background: SURFACE }}>
                  <div style={{ fontSize: 10, color: SUBTEXT, marginBottom: 4 }}>{entry.category}</div>
                  <div style={{ fontSize: 12, color: TEXT }}>{entry.question}</div>
                </div>
              ))}
              {(!trainingEntries || trainingEntries.length === 0) && (
                <div style={{ fontSize: 12, color: SUBTEXT }}>No entries yet.</div>
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
                style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
              >
                <option value="IDENTITY">IDENTITY</option>
                <option value="CATALOG">CATALOG</option>
                <option value="WORKFLOW">WORKFLOW</option>
                <option value="ACTIONS_DOC">ACTIONS_DOC</option>
              </select>
              <button type="button" onClick={onReloadPromptSections} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, background: SURFACE, padding: "6px 8px", fontSize: 12, cursor: "pointer" }}>
                Reload
              </button>
              <button type="button" onClick={loadSectionIntoDraft} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, background: SURFACE, padding: "6px 8px", fontSize: 12, cursor: "pointer" }}>
                Load
              </button>
            </div>
            <textarea
              value={sectionDraft}
              onChange={(e) => setSectionDraft(e.target.value)}
              placeholder="Section content"
              rows={4}
              style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8, fontSize: 12 }}
            />
            <button
              type="button"
              onClick={() => onSavePromptSection?.({ section, content: sectionDraft })}
              disabled={!sectionDraft.trim()}
              style={{
                border: "none",
                borderRadius: 8,
                background: sectionDraft.trim() ? PRIMARY : BORDER,
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
              style={{ alignSelf: "flex-start", border: `1px solid ${BORDER}`, borderRadius: 8, background: SURFACE, padding: "6px 8px", fontSize: 12, cursor: "pointer" }}
            >
              Refresh preview
            </button>
            <div style={{ fontSize: 11, color: SUBTEXT, whiteSpace: "pre-wrap", maxHeight: 90, overflowY: "auto" }}>
              {(promptPreview || "").slice(0, 1200)}
              {(promptPreview || "").length > 1200 ? "\n..." : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
