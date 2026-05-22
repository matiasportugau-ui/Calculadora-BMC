import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");

export function loadCase(caseId) {
  const file = path.join(FIXTURES_DIR, `${caseId}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Fixture no encontrada: ${file}`);
  }
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  if (!data.case_id) data.case_id = caseId;
  return data;
}

export function listCases() {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}
