/**
 * E2E browser test — Calculadora BMC (prod)
 * Tests "Solo Techo → 1 Agua → ISOROOF 3G" quoting flow end-to-end.
 */
import { chromium } from 'playwright';

const BASE = 'https://calculadora-bmc.vercel.app/calculadora/';
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const results = [];

function log(ok, label, detail = '') {
  const icon = ok ? PASS : FAIL;
  console.log(`  ${icon}  ${label}${detail ? '  →  ' + detail : ''}`);
  results.push({ ok, label });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(err.message));

console.log('\nE2E browser test — Calculadora BMC (prod)');
console.log('  Flow: Solo Techo → 1 Agua → Precio BMC → ISOROOF 3G → 40mm → quote\n');

// ── 1. Page load ─────────────────────────────────────────────────────────────
try {
  const res = await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  log(res.status() === 200, 'Page load', `HTTP ${res.status()}`);
} catch (e) { log(false, 'Page load', e.message); await browser.close(); process.exit(1); }
await page.waitForTimeout(2000);

// ── 2. No TDZ crash ──────────────────────────────────────────────────────────
const crashErrors = consoleErrors.filter(e =>
  e.includes('ReferenceError') || e.includes('Cannot access') || e.includes("'hr'")
);
log(crashErrors.length === 0, 'No ReferenceError/TDZ crash', crashErrors[0]?.slice(0,80) || 'clean');

// ── 3. Step 1: scenario selector visible ─────────────────────────────────────
const s1 = await page.evaluate(() => document.body.innerText);
log(s1.includes('PASO 1') && s1.includes('Escenario'), 'Step 1 — Escenario de obra visible');

// ── 4. Step 1 → select Solo Techo, advance ───────────────────────────────────
await page.locator('text=Solo Techo').first().click(); await page.waitForTimeout(400);
await page.locator('button:has-text("Siguiente")').click(); await page.waitForTimeout(700);
const s2 = await page.evaluate(() => document.body.innerText);
log(s2.includes('PASO 2') && s2.includes('Caída'), 'Step 1 → Solo Techo → advanced to Step 2');

// ── 5. Step 2: Caída del techo → 1 Agua (Pendiente única) ────────────────────
await page.locator('text=Pendiente única').first().click(); await page.waitForTimeout(400);
await page.locator('button:has-text("Siguiente")').click(); await page.waitForTimeout(700);
const s3 = await page.evaluate(() => document.body.innerText);
log(s3.includes('PASO 3') && s3.includes('Lista de precios'), 'Step 2 → 1 Agua → advanced to Step 3');

// ── 6. Step 3: Lista de precios → Precio BMC ─────────────────────────────────
await page.locator('text=Precio BMC').first().click(); await page.waitForTimeout(400);
await page.locator('button:has-text("Siguiente")').click(); await page.waitForTimeout(700);
const s4 = await page.evaluate(() => document.body.innerText);
log(s4.includes('PASO 4') && s4.includes('Familia'), 'Step 3 → Precio BMC → advanced to Step 4');

// ── 7. Step 4: Familia panel → ISOROOF 3G ────────────────────────────────────
await page.locator('button:has-text("Seleccionar")').click(); await page.waitForTimeout(500);
await page.locator('text=ISOROOF 3G').first().click(); await page.waitForTimeout(500);
await page.locator('button:has-text("Siguiente")').click(); await page.waitForTimeout(700);
const s5 = await page.evaluate(() => document.body.innerText);
log(s5.includes('PASO 5') || s5.includes('espesor') || s5.includes('Espesor'),
  'Step 4 → ISOROOF 3G selected → advanced', s5.slice(0,80).replace(/\n+/g,' | '));

// ── 8. Walk remaining steps automatically ─────────────────────────────────────
let stepsWalked = 0;
let foundTotal = false;
const stepTrace = [];

for (let i = 0; i < 15; i++) {
  const body = await page.evaluate(() => document.body.innerText);
  const stepMatch = body.match(/PASO (\d+)/);
  const stepNum = stepMatch?.[1] || '?';

  // Check if a price/total appeared
  if (/\$[\d\.,]{4,}|\d{1,3}[.,]\d{3}/.test(body)) {
    foundTotal = true;
    break;
  }

  // Click first custom dropdown button if visible
  const openedDropdown = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const sel = btns.find(b => b.innerText.trim() === 'Seleccionar…' && b.offsetParent);
    if (sel) { sel.click(); return true; }
    return false;
  });
  if (openedDropdown) {
    await page.waitForTimeout(400);
    // Pick first non-placeholder option
    const picked = await page.evaluate(() => {
      const options = [...document.querySelectorAll('button,li,div')]
        .filter(e => getComputedStyle(e).cursor === 'pointer' && e.offsetParent)
        .map(e => e.innerText.trim())
        .filter(t => t && t !== 'Seleccionar…' && t.length > 1)
        .filter(t => !['Vendedor','Cliente','Config','Drive','Presupuestos','Limpiar','Imprimir','Anterior','Siguiente'].includes(t));
      if (options[0]) {
        const el = [...document.querySelectorAll('button,li,div')]
          .find(e => e.innerText.trim() === options[0] && e.offsetParent && getComputedStyle(e).cursor === 'pointer');
        if (el) { el.click(); return options[0]; }
      }
      return null;
    });
    await page.waitForTimeout(400);
    stepTrace.push(`Step ${stepNum}: dropdown → "${picked}"`);
  }

  // Fill number inputs
  const inputs = await page.$$('input[type="number"]');
  let filledInputs = 0;
  for (const inp of inputs.slice(0, 3)) {
    const val = await inp.evaluate(el => el.value);
    if (!val || val === '0') { await inp.fill('8'); filledInputs++; }
  }
  if (filledInputs) await page.waitForTimeout(400);

  // Click Siguiente
  const advanced = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Siguiente' && !b.disabled);
    if (b) { b.click(); return true; }
    return false;
  });
  await page.waitForTimeout(700);

  if (!openedDropdown && !filledInputs && !advanced) break;
  if (advanced) { stepsWalked++; stepTrace.push(`Step ${stepNum}: advanced`); }
}

log(stepsWalked > 0 || foundTotal, `Wizard auto-walk (${stepsWalked} more steps)`,
  foundTotal ? 'reached price/total' : stepTrace.slice(-1)[0] || '—');

// ── 9. Price visible ──────────────────────────────────────────────────────────
const finalBody = await page.evaluate(() => document.body.innerText);
const priceMatch = finalBody.match(/\$[\d\.,]{4,}|[\d]{1,3}(?:[.,]\d{3})+/);
log(!!priceMatch, 'Price / total visible in UI', priceMatch?.[0] || 'not found');

// ── 10. Console errors ────────────────────────────────────────────────────────
const realErrors = consoleErrors.filter(e =>
  !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('ERR_BLOCKED')
);
log(realErrors.length === 0, `Console errors: ${realErrors.length}`,
  realErrors[0]?.slice(0,120) || 'none');

// ── Step trace ────────────────────────────────────────────────────────────────
if (stepTrace.length) {
  console.log('\n  Step trace:');
  stepTrace.forEach(s => console.log('    ' + s));
}

// ── Summary ───────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${failed === 0 ? '\x1b[32m' : '\x1b[33m'}RESULTADO: ${passed}/${results.length} checks passed${failed ? ` — ${failed} failed` : ''}\x1b[0m\n`);

await browser.close();
process.exit(failed > 0 ? 1 : 0);
