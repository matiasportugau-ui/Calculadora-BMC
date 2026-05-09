import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { saveFeedback } from "../server/lib/responseFeedback.js";
import { loadTrainingKB } from "../server/lib/trainingKB.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const kbPath = path.join(dataDir, "training-kb.json");
const feedbackDir = path.join(dataDir, "response-feedback");
const feedbackPath = path.join(feedbackDir, `FEEDBACK-${new Date().toISOString().slice(0, 10)}.jsonl`);

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

function restoreFile(filePath, before) {
  if (before == null) {
    fs.rmSync(filePath, { force: true });
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, before, "utf8");
}

const kbBefore = readIfExists(kbPath);
const feedbackBefore = readIfExists(feedbackPath);
const feedbackDirExisted = fs.existsSync(feedbackDir);

try {
  const publicResult = saveFeedback({
    channel: "ml",
    question: "Cuanto sale el panel?",
    generatedText: "Respuesta publica no confiable",
    rating: "good",
  });

  assert.equal(publicResult.ok, true);
  assert.equal(publicResult.promoted, false);
  assert.equal(publicResult.kbEntryId, null);
  assert.equal(readIfExists(kbPath), kbBefore);

  const trustedResult = saveFeedback({
    channel: "ml",
    question: "Precio confirmado por operador",
    generatedText: "Respuesta previa",
    correction: "Usar siempre el precio calculado por herramienta.",
    rating: "edit",
    promoteToKb: true,
  });

  assert.equal(trustedResult.ok, true);
  assert.equal(trustedResult.promoted, true);
  assert.ok(trustedResult.kbEntryId);
  assert.ok(loadTrainingKB().entries.some((entry) => entry.id === trustedResult.kbEntryId));

  console.log("responseFeedback tests passed");
} finally {
  restoreFile(kbPath, kbBefore);
  restoreFile(feedbackPath, feedbackBefore);
  if (!feedbackDirExisted) fs.rmSync(feedbackDir, { recursive: true, force: true });
}
