/**
 * Privacy-safe storefront conversation copy (besides Admin col J).
 * JSONL under data/storefront-turns/. Phone hashed; never PCM.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(__dirname, "../../../data/storefront-turns");

export function storefrontTurnsDir() {
  const override = String(process.env.STOREFRONT_TURNS_DIR || "").trim();
  return override || DEFAULT_DIR;
}

export function hashStorefrontPhone(raw) {
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  return crypto.createHash("sha256").update(digits).digest("hex").slice(0, 16);
}

export function appendStorefrontTurn(entry = {}) {
  try {
    const dir = storefrontTurnsDir();
    fs.mkdirSync(dir, { recursive: true });
    const adminN = Number(entry.adminRow);
    const rec = {
      ts: new Date().toISOString(),
      kind: String(entry.kind || "turn").slice(0, 40),
      adminRow: Number.isFinite(adminN) && adminN >= 2 ? adminN : null,
      phoneHash: hashStorefrontPhone(entry.telefono),
      pageUrl: String(entry.pageUrl || "").slice(0, 300) || null,
      transcript: String(entry.transcript || "").slice(0, 8000) || null,
    };
    const file = path.join(dir, `${rec.ts.slice(0, 10)}.jsonl`);
    fs.appendFileSync(file, `${JSON.stringify(rec)}\n`, "utf8");
    return { ok: true, file, record: rec };
  } catch (err) {
    return { ok: false, error: err?.message || "storefront turn write failed" };
  }
}
