/**
 * Best-effort JSONL log for public storefront voice (identify / chat log).
 * Never throws — identify and /log must keep working if disk is full or RO.
 *
 * Files: data/conversations/STOREFRONT-YYYY-MM-DD.jsonl
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
export const STOREFRONT_CONV_DIR = path.join(repoRoot, "data", "conversations");

function dayFile(date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  return path.join(STOREFRONT_CONV_DIR, `STOREFRONT-${day}.jsonl`);
}

/**
 * @param {{
 *   kind?: string,
 *   adminRow?: number|null,
 *   telefono?: string|null,
 *   pageUrl?: string|null,
 *   transcript?: string|null,
 * }} entry
 */
export function appendStorefrontTurn(entry = {}) {
  try {
    if (!fs.existsSync(STOREFRONT_CONV_DIR)) {
      fs.mkdirSync(STOREFRONT_CONV_DIR, { recursive: true });
    }
    const row = {
      ts: new Date().toISOString(),
      kind: String(entry.kind || "turn"),
      adminRow: entry.adminRow == null ? null : Number(entry.adminRow) || null,
      telefono: entry.telefono != null ? String(entry.telefono).slice(0, 32) : null,
      pageUrl: entry.pageUrl != null ? String(entry.pageUrl).slice(0, 500) : null,
      transcript: entry.transcript != null ? String(entry.transcript).slice(0, 8000) : null,
    };
    fs.appendFileSync(dayFile(), `${JSON.stringify(row)}\n`, "utf8");
  } catch {
    /* swallow — observability only */
  }
}
