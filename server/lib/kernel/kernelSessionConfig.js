/**
 * Kernel session.update payload (Grok Realtime).
 * Living playbook of the OTHER agent is NOT copied here.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kernelToolDefsForSession } from "./kernelTools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INSTRUCTIONS_PATH = path.join(__dirname, "kernelInstructions.md");

export const KERNEL_VOICE = "rigel";
export const KERNEL_LANGUAGE_HINT = "es-UY";
export const KERNEL_KEYTERMS = Object.freeze([
  "Kernel",
  "Núcleo",
  "Calculadora",
  "Matías",
  "playbook",
  "reporte",
  "informe",
  "patch",
  "snapshot",
  "ingest",
  "wake",
]);
export const KERNEL_REPLACE = Object.freeze({
  Kernel: "Kérnel",
  playbook: "pléibuk",
  snapshot: "snápshot",
  payload: "péiloud",
  stack: "stak",
});

export function loadKernelInstructions() {
  return fs.readFileSync(INSTRUCTIONS_PATH, "utf8");
}

export function kernelInstructionsFor(agentId) {
  const id = String(agentId || "panelin").trim() || "panelin";
  return loadKernelInstructions().replaceAll("{{agent_id}}", id);
}

export function buildKernelSessionBootstrap(agentId) {
  return {
    instructions: kernelInstructionsFor(agentId),
    voice: KERNEL_VOICE,
    reasoning: { effort: "high" },
    turn_detection: {
      type: "server_vad",
      threshold: 0.88,
      silence_duration_ms: 1400,
      prefix_padding_ms: 400,
      idle_timeout_ms: null,
    },
    resumption: { enabled: true },
    language_hint: KERNEL_LANGUAGE_HINT,
    keyterms: [...KERNEL_KEYTERMS],
    replace: { ...KERNEL_REPLACE },
    tools: kernelToolDefsForSession(),
    tool_choice: "auto",
    audio: {
      input: {
        format: { type: "audio/pcm", rate: 24000 },
      },
      output: {
        format: { type: "audio/pcm", rate: 24000 },
        speed: 1.05,
      },
    },
  };
}
