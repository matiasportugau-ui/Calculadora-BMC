/**
 * OpenTelemetry hooks — lightweight no-op when OTEL_ENABLED=0 (WAVE 3 K3).
 */
import { config } from "../../config.js";

const activeSpans = new Map();

/**
 * @param {string} name
 * @param {object} [attrs]
 * @returns {{ end: Function }}
 */
export function startOmniSpan(name, attrs = {}) {
  if (!config.otelEnabled) {
    return { end() {} };
  }
  const id = `${name}:${Date.now()}`;
  activeSpans.set(id, { name, attrs, start: Date.now() });
  return {
    end(extra = {}) {
      const span = activeSpans.get(id);
      if (span) {
        activeSpans.delete(id);
        if (process.env.OMNI_OTEL_DEBUG === "1") {
          console.debug("[omni-otel]", span.name, Date.now() - span.start, "ms", { ...span.attrs, ...extra });
        }
      }
    },
  };
}

export function getActiveSpanCountForTests() {
  return activeSpans.size;
}

export function resetSpansForTests() {
  activeSpans.clear();
}
