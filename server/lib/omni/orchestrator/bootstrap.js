/**
 * Wire omni event bus subscribers (WAVE 3).
 */
import { config } from "../../../config.js";
import { subscribe } from "../eventBus.js";
import { getOmniPool } from "../omniDb.js";
import { enqueueIngestAiJobs } from "./aiWorker.js";
import { runAutomationForEvent } from "./automationEngine.js";

let wired = false;

export function wireOmniOrchestration({ config: cfg, logger } = {}) {
  if (wired) return;
  wired = true;

  subscribe("message.ingested", async (payload) => {
    const pool = getOmniPool(cfg?.databaseUrl);
    if (!pool) return;

    const eventPayload = {
      ...payload,
      message: payload.message || { sender: "customer", body: payload.body },
    };

    if (cfg?.omniAiOrchestratorEnabled) {
      try {
        await enqueueIngestAiJobs(pool, eventPayload);
      } catch (e) {
        logger?.warn?.({ err: e.message }, "omni enqueue ai jobs failed");
      }
    }

    if (cfg?.omniAutomationEnabled) {
      try {
        await runAutomationForEvent(pool, eventPayload);
      } catch (e) {
        logger?.warn?.({ err: e.message }, "omni automation failed");
      }
    }
  });
}

export function resetOmniOrchestrationForTests() {
  wired = false;
}
