import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sessionsDir = path.join(repoRoot, "data", "training-sessions");

if (!fs.existsSync(sessionsDir)) {
  console.log("No training sessions found yet.");
  process.exit(0);
}

const files = fs
  .readdirSync(sessionsDir)
  .filter((f) => /^SESSION-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
  .sort();

if (files.length === 0) {
  console.log("No training session files found.");
  process.exit(0);
}

const stats = {
  files: files.length,
  events: 0,
  trainEntryCreated: 0,
  trainEntryUpdated: 0,
  trainEntryDeleted: 0,
  promptSectionUpdated: 0,
  chatTurns: 0,
  calcValidation: { total: 0, matched: 0, mismatch: 0, unavailable: 0 },
  providers: {},
};

for (const file of files) {
  const filePath = path.join(sessionsDir, file);
  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  for (const line of lines) {
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    stats.events += 1;
    const t = evt.type;
    if (t === "train_entry_created") stats.trainEntryCreated += 1;
    if (t === "train_entry_updated") stats.trainEntryUpdated += 1;
    if (t === "train_entry_deleted") stats.trainEntryDeleted += 1;
    if (t === "prompt_section_updated") stats.promptSectionUpdated += 1;
    if (t === "chat_turn") {
      stats.chatTurns += 1;
      const provider = evt.provider || "unknown";
      stats.providers[provider] = (stats.providers[provider] || 0) + 1;
      const validation = evt.calcValidation;
      if (!validation || validation.available === false) {
        stats.calcValidation.unavailable += 1;
      } else {
        stats.calcValidation.total += 1;
        if (validation.matches === true) stats.calcValidation.matched += 1;
        if (validation.matches === false) stats.calcValidation.mismatch += 1;
      }
    }
  }
}

console.log("Panelin Developer Training Report");
console.log("================================");
console.log(`Session files: ${stats.files}`);
console.log(`Events: ${stats.events}`);
console.log(`Corrections created: ${stats.trainEntryCreated}`);
console.log(`Corrections updated: ${stats.trainEntryUpdated}`);
console.log(`Corrections deleted: ${stats.trainEntryDeleted}`);
console.log(`Prompt edits: ${stats.promptSectionUpdated}`);
console.log(`Chat turns (dev mode): ${stats.chatTurns}`);
console.log("");
console.log("Calc validation:");
console.log(`  validated: ${stats.calcValidation.total}`);
console.log(`  matched:   ${stats.calcValidation.matched}`);
console.log(`  mismatch:  ${stats.calcValidation.mismatch}`);
console.log(`  unavailable: ${stats.calcValidation.unavailable}`);
console.log("");
console.log("Providers:");
Object.entries(stats.providers)
  .sort((a, b) => b[1] - a[1])
  .forEach(([provider, count]) => {
    console.log(`  ${provider}: ${count}`);
  });
