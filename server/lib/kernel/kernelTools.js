/**
 * Kernel Realtime function-tool definitions (xAI session.update shape).
 * file_search is omitted unless KERNEL_COLLECTION_ID is set.
 */

function fn(name, description, properties, required = []) {
  return {
    type: "function",
    name,
    description,
    parameters: {
      type: "object",
      properties,
      required,
    },
  };
}

export const KERNEL_TOOL_DEFS = Object.freeze([
  fn(
    "ingest_conversation_turn",
    "Silently persist one conversation turn (operator, other agent, or Kernel). Call on EVERY parsed utterance before doing anything else. Never requires confirmation. Never speak because you called this.",
    {
      speaker: { type: "string", description: "Who spoke. Use operator | kernel | agent:<id> | unknown" },
      role: {
        type: "string",
        enum: ["operator", "other_agent", "kernel", "bystander"],
        description: "Role in the loop",
      },
      text: { type: "string", description: "Verbatim or best-effort transcript" },
      addressed_to: { type: "string", description: "kernel | other_agent | room | unknown" },
      timestamp: { type: "string", description: "ISO-8601 if known" },
    },
    ["speaker", "role", "text", "addressed_to"],
  ),
  fn(
    "ingest_app_event",
    "Silently persist one internal Calculadora event (UI action, calc evaluate, error, agent tool call, etc.). Call for every event the host delivers. Read-only ingest, no confirmation, no speech.",
    {
      type: { type: "string", description: "Event type, e.g. calc.evaluate, runtime.error, agent.turn" },
      source: { type: "string", description: "Subsystem: ui | engine | router | agent | runtime" },
      severity: { type: "string", enum: ["debug", "info", "warn", "error", "critical"] },
      payload: { type: "string", description: "JSON-encoded payload. Keep it compact." },
    },
    ["type", "source", "severity", "payload"],
  ),
  fn(
    "read_event_log",
    "Read Calculadora's internal event log. Call proactively before any report or diagnosis. Do not ask confirmation.",
    {
      since: { type: "string", description: "ISO-8601 lower bound" },
      types: { type: "string", description: "Comma-separated event types to include" },
      severity: { type: "string", description: "Minimum severity: debug|info|warn|error|critical" },
      limit: { type: "integer", description: "Max events, default 50, max 200" },
    },
  ),
  fn(
    "read_conversation_log",
    "Read the stored conversation between the operator and other agents (and Kernel). Call proactively before reports about 'what just happened'.",
    {
      since: { type: "string" },
      speaker: { type: "string" },
      limit: { type: "integer" },
    },
  ),
  fn(
    "read_project_snapshot",
    "Read the live interior of Calculadora: current route, relevant store/state, last errors, open view, Kernel mode, other-agent id. Always call before a snapshot report. No confirmation.",
    {},
  ),
  fn(
    "search_code",
    "Search the Calculadora repo. Use before blaming a file or proposing a patch. No confirmation.",
    {
      query: { type: "string", description: "Literal or regex-ish query" },
      path_glob: { type: "string", description: "Optional glob, e.g. src/**/*.ts" },
    },
    ["query"],
  ),
  fn(
    "read_source_file",
    "Read a source file from the Calculadora working tree. Path is repo-relative. No confirmation.",
    {
      path: { type: "string", description: "Repo-relative path" },
    },
    ["path"],
  ),
  fn(
    "read_playbook",
    "Read the living instructions of another agent on this project. Call before apply_playbook_patch and when diagnosing agent mistakes.",
    {
      agent_id: {
        type: "string",
        description: "Other agent id. Use 'current' if only one is attached.",
      },
    },
    ["agent_id"],
  ),
  fn(
    "read_improvement_log",
    "Read prior diagnoses and patches so you do not repeat yourself.",
    {
      status: { type: "string", enum: ["open", "queued", "applied", "rejected", "all"] },
      limit: { type: "integer" },
    },
  ),
  fn(
    "set_mode",
    "Set Kernel's operating mode. Confirm first unless the operator explicitly named the mode in this turn. observe=silence, report=speak when asked, intervene=may interrupt on critical, patch=diagnosis+apply loop.",
    {
      mode: { type: "string", enum: ["observe", "report", "intervene", "patch"] },
    },
    ["mode"],
  ),
  fn(
    "append_improvement",
    "Write a structured improvement record. Call after every diagnosis, even if you will not apply a patch. This is the log. Confirmation not required for the log itself.",
    {
      title: { type: "string" },
      symptom: { type: "string", description: "What the operator or user experienced" },
      internal_cause: { type: "string", description: "What actually happened inside the app or the other agent" },
      evidence: { type: "string", description: "Event ids, file:line, playbook quotes, turn ids" },
      proposed_fix: { type: "string" },
      target: { type: "string", enum: ["agent", "app", "process"] },
      agent_id: { type: "string" },
      files: { type: "string", description: "Comma-separated repo paths if target is app" },
    },
    ["title", "symptom", "internal_cause", "evidence", "proposed_fix", "target"],
  ),
  fn(
    "apply_playbook_patch",
    "Incorporate a behavior fix into another agent's living playbook. ALWAYS confirm with the operator in one sentence before calling. After success the other agent reloads this playbook.",
    {
      agent_id: { type: "string" },
      patch: {
        type: "string",
        description: "The exact instruction text to add or replace. Write it as playbook Markdown the other agent will follow.",
      },
      reason: { type: "string" },
    },
    ["agent_id", "patch", "reason"],
  ),
  fn(
    "propose_code_change",
    "Stage a bounded code change in Calculadora. Does not apply. ALWAYS follow with a one-sentence confirmation asking whether to apply. Then call apply_code_change only on yes.",
    {
      title: { type: "string" },
      files: { type: "string", description: "Comma-separated repo-relative paths" },
      diff: { type: "string", description: "Unified diff or full replacement for small files" },
      reason: { type: "string" },
    },
    ["title", "files", "diff", "reason"],
  ),
  fn(
    "apply_code_change",
    "Apply a previously proposed code change. ALWAYS confirm first. Only for bounded, evidenced fixes. Host may refuse unless KERNEL_ALLOW_CODE_APPLY=1.",
    {
      proposal_id: { type: "string", description: "Id returned by propose_code_change" },
    },
    ["proposal_id"],
  ),
  fn(
    "deliver_report",
    "Persist the report you are about to speak so the app has the same artifact. Call once per spoken report, then speak. kind: snapshot | incident | improvement | session.",
    {
      kind: { type: "string", enum: ["snapshot", "incident", "improvement", "session"] },
      audience: { type: "string", description: "operator | team", default: "operator" },
      summary: { type: "string", description: "The spoken report in Spanish, compact" },
    },
    ["kind", "summary"],
  ),
]);

export const KERNEL_TOOL_NAMES = Object.freeze(
  KERNEL_TOOL_DEFS.map((t) => t.name),
);

export const KERNEL_PATCH_ONLY_TOOLS = Object.freeze([
  "apply_playbook_patch",
  "apply_code_change",
]);

export function kernelToolDefsForSession(mode = "observe") {
  let tools = KERNEL_TOOL_DEFS.slice();
  if (mode !== "patch") {
    tools = tools.filter((t) => !KERNEL_PATCH_ONLY_TOOLS.includes(t.name));
  }
  const collectionId = String(process.env.KERNEL_COLLECTION_ID || process.env.XAI_COLLECTION_ID || "").trim();
  if (collectionId) {
    tools.unshift({
      type: "file_search",
      vector_store_ids: [collectionId],
      max_num_results: 8,
    });
  }
  return tools;
}
