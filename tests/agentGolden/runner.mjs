#!/usr/bin/env node
/**
 * Panelin agent golden runner — épica D (enterprise-ready program).
 *
 * Drives /api/agent/chat with versioned fixtures and asserts on the SSE
 * trajectory: tool calls, verified_quote payload, kb_match surface, text
 * predicates. Zero dependencies; the dataset stays portable to Promptfoo
 * (or any other harness) if/when we adopt one.
 *
 * Usage:
 *   API_BASE=http://127.0.0.1:3001 node tests/agentGolden/runner.mjs
 *   API_BASE=http://127.0.0.1:3001 node tests/agentGolden/runner.mjs 01-quote-techo
 *
 * Skip discipline: when prerequisites are missing (API not reachable,
 * no Anthropic key on the server) the runner exits 0 with a clear note —
 * CI without secrets never breaks. Set GOLDEN_REQUIRED=1 to flip skip
 * into failure (pre-release gate).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CASES_DIR = path.join(__dirname, "cases");
const FIXTURES_DIR = path.join(__dirname, "fixtures");

const API_BASE = (process.env.API_BASE || "http://127.0.0.1:3001").replace(/\/$/, "");
const REQUIRED = process.env.GOLDEN_REQUIRED === "1";
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const COLOR = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};
const c = (k, s) => `${COLOR[k] || ""}${s}${COLOR.reset}`;

function loadFixture(name) {
  if (!name) return undefined;
  const p = path.join(FIXTURES_DIR, "calc-states", `${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadCases() {
  const all = fs
    .readdirSync(CASES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const raw = JSON.parse(fs.readFileSync(path.join(CASES_DIR, f), "utf8"));
      return { ...raw, _file: f };
    });
  if (ONLY.length === 0) return all;
  return all.filter((c) => ONLY.some((o) => c.id === o || c._file.includes(o)));
}

async function ping(url) {
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(3000) });
    return res.status >= 200 && res.status < 600;
  } catch {
    return false;
  }
}

/**
 * POST /api/agent/chat with the case's request body and consume the SSE
 * stream until either `done` event arrives or timeout. Returns a
 * structured trace consumable by asserts.
 */
async function runCase(caseDef) {
  const calcState = caseDef.calcState
    ? loadFixture(caseDef.calcState)
    : (caseDef.request?.calcState ?? {});
  const surface = caseDef.surface || caseDef.request?.surface;
  const body = {
    messages: caseDef.request.messages,
    calcState,
    aiProvider: caseDef.request.aiProvider ?? "auto",
    aiModel: caseDef.request.aiModel ?? "",
    devMode: false,
    ...(surface ? { surface } : {}),
  };

  const tStart = Date.now();
  const trace = {
    events: [],
    text: "",
    toolCalls: [],
    verifiedQuotes: [],
    kbMatch: null,
    actions: [],
    suggestions: [],
    elapsedMs: 0,
    httpStatus: null,
    error: null,
  };

  const controller = new AbortController();
  const timeout = caseDef.timeoutMs ?? 60000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API_BASE}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    trace.httpStatus = res.status;
    if (!res.ok) {
      trace.error = `HTTP ${res.status}`;
      return trace;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let done = false;
    while (!done) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop();
      for (const p of parts) {
        const dataLine = p.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        let evt;
        try { evt = JSON.parse(dataLine.slice(6)); } catch { continue; }
        trace.events.push(evt);
        switch (evt.type) {
          case "text":
            trace.text += String(evt.delta || "");
            break;
          case "tool_call":
            trace.toolCalls.push({ tool: evt.tool, input: evt.input, blocked: evt.blocked || null });
            break;
          case "verified_quote":
            trace.verifiedQuotes.push(evt.payload);
            break;
          case "kb_match":
            trace.kbMatch = { count: evt.count ?? 0, surface: evt.surface ?? null };
            break;
          case "action":
            trace.actions.push(evt.action);
            break;
          case "suggestions":
            trace.suggestions.push(evt.suggestions);
            break;
          case "done":
            done = true;
            break;
          case "error":
            trace.error = evt.message || "stream error";
            done = true;
            break;
          default:
            break;
        }
        if (done) break;
      }
    }
    reader.cancel().catch(() => {});
  } catch (err) {
    if (err.name === "AbortError") trace.error = `timeout after ${timeout}ms`;
    else trace.error = err.message || String(err);
  } finally {
    clearTimeout(timer);
    trace.elapsedMs = Date.now() - tStart;
  }
  return trace;
}

// ── Asserts ──────────────────────────────────────────────────────────────────

const ASSERTS = {
  tool_called: (trace, a) =>
    trace.toolCalls.some((t) => t.tool === a.name)
      ? null
      : `expected tool '${a.name}' called; saw [${trace.toolCalls.map((t) => t.tool).join(", ") || "—"}]`,

  tool_not_called: (trace, a) =>
    !trace.toolCalls.some((t) => t.tool === a.name)
      ? null
      : `expected tool '${a.name}' NOT called; saw [${trace.toolCalls.map((t) => t.tool).join(", ")}]`,

  verified_quote_emitted: (trace) =>
    trace.verifiedQuotes.length > 0
      ? null
      : "expected at least one verified_quote event; saw 0",

  verified_quote_not_emitted: (trace) =>
    trace.verifiedQuotes.length === 0
      ? null
      : `expected no verified_quote events; saw ${trace.verifiedQuotes.length}`,

  verified_quote_field_eq: (trace, a) => {
    if (trace.verifiedQuotes.length === 0) return "no verified_quote to inspect";
    const v = trace.verifiedQuotes[0]?.[a.field];
    return v === a.value ? null : `verified_quote.${a.field} === ${JSON.stringify(a.value)} (got ${JSON.stringify(v)})`;
  },

  verified_quote_field_gt: (trace, a) => {
    if (trace.verifiedQuotes.length === 0) return "no verified_quote to inspect";
    const v = Number(trace.verifiedQuotes[0]?.[a.field]);
    return Number.isFinite(v) && v > a.value ? null : `verified_quote.${a.field} > ${a.value} (got ${JSON.stringify(v)})`;
  },

  verified_quote_field_gte: (trace, a) => {
    if (trace.verifiedQuotes.length === 0) return "no verified_quote to inspect";
    const v = Number(trace.verifiedQuotes[0]?.[a.field]);
    return Number.isFinite(v) && v >= a.value ? null : `verified_quote.${a.field} >= ${a.value} (got ${JSON.stringify(v)})`;
  },

  text_contains: (trace, a) => {
    const hay = (a.caseSensitive ? trace.text : trace.text.toLowerCase());
    const needle = (a.caseSensitive ? a.value : String(a.value).toLowerCase());
    return hay.includes(needle) ? null : `text expected to contain ${JSON.stringify(a.value)}`;
  },

  text_not_contains: (trace, a) => {
    const hay = (a.caseSensitive ? trace.text : trace.text.toLowerCase());
    const needle = (a.caseSensitive ? a.value : String(a.value).toLowerCase());
    return !hay.includes(needle) ? null : `text expected to NOT contain ${JSON.stringify(a.value)}`;
  },

  text_max_chars: (trace, a) =>
    trace.text.length <= a.value
      ? null
      : `text length ${trace.text.length} > max ${a.value}`,

  kb_match_surface: (trace, a) =>
    trace.kbMatch?.surface === a.value
      ? null
      : `kb_match.surface === ${JSON.stringify(a.value)} (got ${JSON.stringify(trace.kbMatch?.surface)})`,
};

function runAsserts(trace, asserts) {
  const failures = [];
  for (const a of asserts || []) {
    const fn = ASSERTS[a.type];
    if (!fn) {
      failures.push(`unknown assert type: ${a.type}`);
      continue;
    }
    const err = fn(trace, a);
    if (err) failures.push(err);
  }
  return failures;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(c("cyan", `Panelin agent golden runner · API_BASE=${API_BASE}`));

  // Preflight: API must be reachable
  const reachable = await ping(`${API_BASE}/api/agent/ai-options`);
  if (!reachable) {
    const msg = `API not reachable at ${API_BASE}/api/agent/ai-options — start the server (npm run start:api) or set API_BASE.`;
    if (REQUIRED) {
      console.error(c("red", `✗ ${msg}`));
      process.exit(1);
    }
    console.log(c("yellow", `↷ skipped: ${msg}`));
    process.exit(0);
  }

  // Preflight: must have at least one provider key the chain can use
  const opts = await fetch(`${API_BASE}/api/agent/ai-options`).then((r) => r.json()).catch(() => null);
  const hasProvider = Array.isArray(opts?.providers) && opts.providers.length > 0;
  if (!hasProvider) {
    const msg = "no AI provider keys configured on the server (no Anthropic / OpenAI / Grok / Gemini).";
    if (REQUIRED) {
      console.error(c("red", `✗ ${msg}`));
      process.exit(1);
    }
    console.log(c("yellow", `↷ skipped: ${msg}`));
    process.exit(0);
  }

  const cases = loadCases();
  if (cases.length === 0) {
    console.log(c("yellow", "↷ no cases matched."));
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const cdef of cases) {
    process.stdout.write(c("dim", `→ ${cdef.id} … `));
    const trace = await runCase(cdef);
    if (trace.error && trace.toolCalls.length === 0 && trace.verifiedQuotes.length === 0) {
      // Hard error before any useful trace — count as failure
      failed += 1;
      failures.push({ id: cdef.id, errors: [`runtime error: ${trace.error}`], trace });
      console.log(c("red", `✗ runtime error (${trace.error})`));
      continue;
    }
    const errors = runAsserts(trace, cdef.asserts);
    if (errors.length === 0) {
      passed += 1;
      console.log(c("green", `✓ pass`) + c("dim", ` (${trace.elapsedMs}ms, ${trace.toolCalls.length} tool calls, ${trace.verifiedQuotes.length} verified quotes)`));
    } else {
      failed += 1;
      failures.push({ id: cdef.id, errors, trace });
      console.log(c("red", `✗ ${errors.length} assertion(s) failed`));
    }
  }

  console.log("");
  console.log(c("cyan", "── Summary ──"));
  console.log(`Total:  ${cases.length}`);
  console.log(`Passed: ${c("green", passed)}`);
  console.log(`Failed: ${failed > 0 ? c("red", failed) : "0"}`);

  if (failures.length > 0) {
    console.log("");
    console.log(c("red", "── Failures ──"));
    for (const f of failures) {
      console.log(c("red", `\n✗ ${f.id}`));
      for (const e of f.errors) console.log(`  · ${e}`);
      console.log(c("dim", `  trace: tool_calls=${f.trace.toolCalls.map((t) => t.tool).join(", ") || "—"} | verified_quotes=${f.trace.verifiedQuotes.length} | text="${f.trace.text.slice(0, 80).replace(/\n/g, " ")}…"`));
    }
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(c("red", `runner crashed: ${err.stack || err.message}`));
  process.exit(2);
});
