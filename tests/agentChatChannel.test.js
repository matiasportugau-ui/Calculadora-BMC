// ═══════════════════════════════════════════════════════════════════════════
// /agent/chat channel param + renderExamplesBlock integration
// Run: node tests/agentChatChannel.test.js
//
// Pure unit tests on buildSystemPrompt — verifies that the channel option
// is forwarded to channelRenderer.renderExamplesBlock so goodAnswerML /
// goodAnswerWA overrides take precedence over goodAnswer.
// ═══════════════════════════════════════════════════════════════════════════

import { buildSystemPrompt } from "../server/lib/chatPrompts.js";

let passed = 0;
let failed = 0;

function assert(name, cond, details = "") {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed += 1;
    return;
  }
  console.log(`  ❌ ${name}${details ? `\n     ${details}` : ""}`);
  failed += 1;
}

function run() {
  console.log("\n═══ /agent/chat — channel + renderExamplesBlock ═══\n");

  const SAMPLE_LONG = "long answer with extensive markdown ".repeat(20);
  const ML_OVERRIDE = "Plazo entrega: 20-25 días hábiles. Saludos BMC URUGUAY!";
  const WA_OVERRIDE = "Hola! 👋 Plazo entrega ronda 20-25 días hábiles. Cualquier consulta, avisame.";

  const examples = [{
    id: "kb-1",
    question: "¿Cuál es el plazo de entrega de ISODEC EPS?",
    goodAnswer: SAMPLE_LONG,
    goodAnswerML: ML_OVERRIDE,
    goodAnswerWA: WA_OVERRIDE,
    category: "logistics",
  }];

  // ── default (chat) → uses goodAnswer raw ───────────────────────────────
  {
    const prompt = buildSystemPrompt({}, { trainingExamples: examples });
    assert(
      "default channel = chat → uses goodAnswer raw",
      prompt.includes(SAMPLE_LONG),
    );
    assert(
      "default channel header = (canal: chat)",
      prompt.includes("(canal: chat)"),
    );
    assert(
      "default channel does NOT use ML override",
      !prompt.includes(ML_OVERRIDE),
    );
  }

  // ── channel = ml → uses goodAnswerML, drops verbose goodAnswer ─────────
  {
    const prompt = buildSystemPrompt({}, { trainingExamples: examples, channel: "ml" });
    assert(
      "channel=ml → uses goodAnswerML override",
      prompt.includes(ML_OVERRIDE),
    );
    assert(
      "channel=ml header = (canal: ml)",
      prompt.includes("(canal: ml)"),
    );
    assert(
      "channel=ml drops verbose goodAnswer",
      !prompt.includes(SAMPLE_LONG),
    );
  }

  // ── channel = wa → uses goodAnswerWA ───────────────────────────────────
  {
    const prompt = buildSystemPrompt({}, { trainingExamples: examples, channel: "wa" });
    assert(
      "channel=wa → uses goodAnswerWA override",
      prompt.includes(WA_OVERRIDE),
    );
    assert(
      "channel=wa header = (canal: wa)",
      prompt.includes("(canal: wa)"),
    );
  }

  // ── empty examples → no block emitted ──────────────────────────────────
  {
    const prompt = buildSystemPrompt({}, { trainingExamples: [], channel: "ml" });
    assert(
      "empty trainingExamples → no examples block",
      !prompt.includes("EJEMPLOS DE RESPUESTAS"),
    );
  }

  // ── header migration: legacy "CORRECCIONES DE ENTRENAMIENTO" gone ──────
  {
    const prompt = buildSystemPrompt({}, { trainingExamples: examples });
    assert(
      "legacy header CORRECCIONES DE ENTRENAMIENTO is removed",
      !prompt.includes("CORRECCIONES DE ENTRENAMIENTO"),
    );
  }

  // ── ML cap: when override is missing, goodAnswer is truncated to 350 ──
  {
    const noOverride = [{
      id: "kb-2",
      question: "Q?",
      goodAnswer: "x".repeat(900),
      category: "general",
    }];
    const prompt = buildSystemPrompt({}, { trainingExamples: noOverride, channel: "ml" });
    const xCount = (prompt.match(/x{50,}/) || [""])[0].length;
    assert(
      `channel=ml without override caps fallback at 350 (got ${xCount})`,
      xCount > 0 && xCount <= 350,
      `xCount=${xCount}`,
    );
  }

  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
  if (failed > 0) process.exit(1);
}

run();
