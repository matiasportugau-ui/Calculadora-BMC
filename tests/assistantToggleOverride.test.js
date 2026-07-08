import assert from "node:assert/strict";
import {
  primeWaConfig,
  getSetting,
  setAssistantOverride,
  _resetWaConfigForTests,
} from "../server/lib/waConfig.js";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createFakePool() {
  const settings = new Map();
  const audits = [];

  const settingKey = (key, scope = "tenant", scopeId = "tenant") => `${key}|${scope}|${scopeId}`;

  return {
    audits,
    async connect() {
      throw new Error("LISTEN not available in fake pool");
    },
    async query(sql, params = []) {
      const text = String(sql);

      if (text.includes("select key, value from wa_settings where scope='tenant'")) {
        const rows = [];
        for (const [compound, value] of settings.entries()) {
          const [key, scope, scopeId] = compound.split("|");
          if (scope === "tenant" && scopeId === "tenant") rows.push({ key, value });
        }
        return { rows };
      }

      if (text.includes("select key, enabled, rollout_percent, owner, expires_at, description from wa_flags")) {
        return { rows: [] };
      }

      if (text.includes("select key, scope_id, value from wa_settings where scope='operator'")) {
        return { rows: [] };
      }

      if (text.includes("insert into wa_settings") && text.includes("jsonb_set")) {
        const [assistantKey, enabled] = params;
        // Force interleaving: the second toggle commits first, then the delayed
        // first toggle must merge into the latest stored JSON rather than
        // overwriting it with its stale pre-query snapshot.
        if (assistantKey === "panelin") await delay(20);
        const compound = settingKey("assistants");
        const current = settings.get(compound);
        const base = current && typeof current === "object" && !Array.isArray(current) ? current : {};
        const next = { ...base, [assistantKey]: enabled };
        settings.set(compound, next);
        return { rows: [{ value: next }] };
      }

      if (text.includes("insert into wa_audit_log")) {
        audits.push(params);
        return { rows: [] };
      }

      throw new Error(`Unexpected fake query: ${text.slice(0, 120)}`);
    },
  };
}

try {
  const pool = createFakePool();
  const logger = { info() {}, warn() {}, error() {}, debug() {} };

  await primeWaConfig({ pool, logger });
  await Promise.all([
    setAssistantOverride("panelin", true, { actor: "test_admin" }),
    setAssistantOverride("ml", false, { actor: "test_admin" }),
  ]);

  assert.deepEqual(getSetting("assistants"), {
    ml: false,
    panelin: true,
  });
  assert.equal(pool.audits.length, 2, "each toggle is audited");

  console.log("✅ assistantToggleOverride: concurrent toggles preserve both overrides");
} finally {
  _resetWaConfigForTests();
}
