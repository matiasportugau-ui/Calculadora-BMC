// Locale-aware number/date parsing for the finanzas dashboard — offline.
// Regression for the 6.1–6.3 UAT data layer: the Pagos workbook writes US-format
// numbers ("3,654.00") while Ventas writes EU-format ("1.860,70"); the old
// parseNum assumed EU always (3,654.00 → 3.654). Dates are D/M/YYYY (es-UY);
// the old parseDate fed them to `new Date()` (invalid or silent M/D swap).
// node tests/finanzasLocaleParsing.test.js
import { parseNum, parseDate } from "../server/routes/bmcDashboard.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

// ── parseNum: US format (Pagos_ workbook reality) ──────────────────────────
assert('US "3,654.00" → 3654', parseNum("3,654.00") === 3654);
assert('US "-2,918.00" → -2918', parseNum("-2,918.00") === -2918);
assert('US "22,735.81" → 22735.81', parseNum("22,735.81") === 22735.81);
assert('US "1,000,000.50" → 1000000.5', parseNum("1,000,000.50") === 1000000.5);
assert('US "0.00" → 0', parseNum("0.00") === 0);
assert('US "-500.00" → -500', parseNum("-500.00") === -500);

// ── parseNum: EU format (Ventas workbook reality) ───────────────────────────
assert('EU "1.860,70" → 1860.7', parseNum("1.860,70") === 1860.7);
assert('EU "2995,2" → 2995.2', parseNum("2995,2") === 2995.2);
assert('EU "1.000" (grouped) → 1000', parseNum("1.000") === 1000);
assert('EU "12.345.678" → 12345678', parseNum("12.345.678") === 12345678);

// ── parseNum: plain / edge ──────────────────────────────────────────────────
assert('plain "3654" → 3654', parseNum("3654") === 3654);
assert('decimal "36.5" stays 36.5', parseNum("36.5") === 36.5);
assert('decimal "3.14" stays 3.14', parseNum("3.14") === 3.14);
assert("currency noise \"U$S 3,654.00\" → 3654", parseNum("U$S 3,654.00") === 3654);
assert('percent "82,10%" → 82.1', parseNum("82,10%") === 82.1);
assert("empty → 0", parseNum("") === 0);
assert("null → 0", parseNum(null) === 0);
assert('text "ACOPIO - STOCK" → 0', parseNum("ACOPIO - STOCK") === 0);
assert('lone "-" → 0', parseNum("-") === 0);

// ── parseDate: D/M/YYYY (es-UY sheets) ─────────────────────────────────────
const d1 = parseDate("14/7/2025");
assert('"14/7/2025" → Jul 14 2025', d1 && d1.getFullYear() === 2025 && d1.getMonth() === 6 && d1.getDate() === 14);
const d2 = parseDate("7/4/2025");
assert('"7/4/2025" → Apr 7 2025 (D/M, not M/D)', d2 && d2.getMonth() === 3 && d2.getDate() === 7);
const d3 = parseDate("12/11/2022");
assert('"12/11/2022" → Nov 12 2022', d3 && d3.getMonth() === 10 && d3.getDate() === 12);
const d4 = parseDate("01-02-2026");
assert('"01-02-2026" (dashes) → Feb 1 2026', d4 && d4.getMonth() === 1 && d4.getDate() === 1);
assert('ISO "2026-07-04" still parses', parseDate("2026-07-04") instanceof Date);
assert('impossible "31/2/2025" → null (no overflow normalize)', parseDate("31/2/2025") === null);
assert('impossible "14/13/2025" → null (month 13)', parseDate("14/13/2025") === null);
assert('leap "29/2/2024" → Feb 29 2024', (() => { const d = parseDate("29/2/2024"); return d && d.getMonth() === 1 && d.getDate() === 29; })());
assert('non-leap "29/2/2025" → null', parseDate("29/2/2025") === null);
assert("Date instance passthrough", parseDate(d1) === d1);
assert("garbage → null", parseDate("ACOPIO - STOCK") === null);
assert("empty → null", parseDate("") === null);

console.log(`\nfinanzasLocaleParsing: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
