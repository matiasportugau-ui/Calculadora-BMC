/**
 * E2E — IAlfred Voice Dock cross-app (local-only).
 *
 * Valida el dock compartido servido por el Enviar Desk (:8787) dentro de las 3 apps locales
 * (:8787 Enviar Desk, :5173 Calculadora, :3857 IAlfred Desk): sesión única, SSE multi-pestaña,
 * PTT, barge-in, TTS con fallback, selector de voces, prefs compartidas, deep-link a la Calculadora,
 * cierre por voz y carry-over por inactividad.
 *
 * STT simulado con IAlfredDock.__test.simulateUtterance() (mismo pipeline que el resultado final de Web Speech).
 * LLM real (xAI vía /api/voice/turn). NINGUNA escritura en la planilla: el único "guardar" se cancela.
 *
 * Prereqs: stack local arriba (`./scripts/local-stack.sh start`). Para el escenario 14 conviene arrancar el desk con
 * BMC_VOICE_TEST_ROUTES=1 (ruta /api/voice/_test/close-idle); si no está, se usa voice-memory.closeIdle() directo
 * desde BMC_PIPELINE_DIR (default ~/bmc-sheet-quote-pipeline).
 *
 * Run: npm run test:playwright:ialfred-dock   [--headed]
 * Env: IALFRED_DESK_BASE (default http://127.0.0.1:8787) · IALFRED_E2E_ROW (default 5)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const DESK = (process.env.IALFRED_DESK_BASE || "http://127.0.0.1:8787").replace(/\/+$/, "");
const ROW = Number(process.env.IALFRED_E2E_ROW || 5);
const HEADED = process.argv.includes("--headed");
const SHOTS = process.env.IALFRED_E2E_SHOTS || path.join(os.tmpdir(), "ialfred-dock-e2e");
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
async function scenario(n, name, fn) {
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ n, name, ok: true, ms: Date.now() - t0, note: note || "" });
    console.log(`✅ ${n}. ${name}${note ? ` — ${note}` : ""} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    results.push({ n, name, ok: false, ms: Date.now() - t0, note: String(e?.message || e) });
    console.log(`❌ ${n}. ${name} — ${e?.message || e}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const getJson = async (url, init) => {
  const r = await fetch(url, init);
  return { status: r.status, headers: r.headers, body: await r.json().catch(() => null) };
};

async function dockReady(page, { timeout = 20000 } = {}) {
  await page.waitForFunction(() => {
    const d = window.IAlfredDock;
    return d && document.getElementById("ialfred-voice-dock")?.shadowRoot && d.getState().sse === "open";
  }, null, { timeout });
}
async function say(page, text, { timeout = 120000 } = {}) {
  const res = await Promise.race([
    page.evaluate((t) => window.IAlfredDock.__test.simulateUtterance(t), text),
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout esperando respuesta a "${text}"`)), timeout)),
  ]);
  assert(res && typeof res.replyText === "string", `sin respuesta para "${text}": ${JSON.stringify(res)?.slice(0, 200)}`);
  return res;
}
const state = (page) => page.evaluate(() => window.IAlfredDock.getState());

// ------------------------------------------------------------------ preflight
const health = await getJson(`${DESK}/api/voice/health`).catch(() => null);
if (!health?.body?.ok) {
  console.error(`Enviar Desk no responde en ${DESK}. Levantá el stack: ./scripts/local-stack.sh start`);
  process.exit(2);
}
const URLS = health.body.urls;
const prefsBackup = (await getJson(`${DESK}/api/voice/prefs`)).body?.prefs;
const row0 = (await getJson(`${DESK}/api/row/${ROW}`)).body;
assert(row0?.ok, `no pude leer la fila ${ROW}`);

const browser = await chromium.launch({
  channel: "chrome",
  headless: !HEADED,
  args: ["--autoplay-policy=no-user-gesture-required", "--disable-popup-blocking"],
}).catch(() => chromium.launch({ headless: !HEADED, args: ["--autoplay-policy=no-user-gesture-required", "--disable-popup-blocking"] }));
const context = await browser.newContext({ viewport: { width: 1360, height: 860 } });
await context.addInitScript(() => {
  window.__IALFRED_FAKE_STT = true;
  try { sessionStorage.removeItem("ialfred.dock.v1"); } catch { /* noop */ }
});
const pageErrors = [];
context.on("page", (p) => p.on("pageerror", (e) => pageErrors.push(`${p.url()}: ${e.message}`)));

// Sesión limpia para la corrida: no mezclar con una sesión real abierta.
const cur0 = (await getJson(`${DESK}/api/voice/session/current`)).body;
if (cur0?.sessionId) {
  await getJson(`${DESK}/api/voice/session/close`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: cur0.sessionId, reason: "e2e-reset" }) });
}
// Turnos con voz del navegador (sin costo xAI) salvo los escenarios de TTS.
await getJson(`${DESK}/api/voice/prefs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine: "browser" }) });

const desk = await context.newPage();
desk.on("pageerror", (e) => pageErrors.push(`desk: ${e.message}`));
let calc = null;
let ialfred = null;
let sessionId = null;

try {
  await scenario(1, "El dock renderiza en :8787, :5173 y :3857 (Shadow DOM, idle)", async () => {
    await desk.goto(`${URLS.enviarDesk}/`, { waitUntil: "domcontentloaded" });
    await dockReady(desk);
    ialfred = await context.newPage();
    await ialfred.goto(`${URLS.ialfredDesk}/`, { waitUntil: "domcontentloaded" });
    await dockReady(ialfred, { timeout: 30000 });
    calc = await context.newPage();
    await calc.goto(`${URLS.calculadora}/`, { waitUntil: "domcontentloaded" });
    await dockReady(calc, { timeout: 60000 });
    const hosts = [];
    for (const p of [desk, calc, ialfred]) {
      const s = await state(p);
      assert(s.state === "idle", `${s.host} no está idle (${s.state})`);
      hosts.push(s.host);
    }
    assert(hosts.join(",") === "enviar-desk,calculadora,ialfred", `hosts inesperados ${hosts}`);
    await desk.bringToFront();
    return hosts.join(" · ");
  });

  await scenario(2, `"leeme la fila ${ROW}" → respuesta + drawer abre R${ROW}`, async () => {
    const r = await say(desk, `leeme la fila ${ROW}`);
    sessionId = r.sessionId;
    assert(r.toolCalls.some((t) => t.name === "desk_leer_fila" && t.ok), `no leyó la fila: ${JSON.stringify(r.toolCalls)}`);
    await desk.waitForFunction((row) => document.getElementById("drawerBg")?.classList.contains("open") && current?.adminRow === row, ROW, { timeout: 15000 });
    const s = await state(desk);
    assert(s.transcript.some((t) => /fila/i.test(t.user) && t.assistant), "transcript sin el turno");
    return r.replyText.slice(0, 80);
  });

  await scenario(3, `"cotizá isodec eps 100 de 10 por 8" → quoteBox con total > 0`, async () => {
    const r = await say(desk, `cotizá isodec eps de 100 milímetros, 10 de largo por 8 de ancho, para la fila ${ROW}`);
    assert(r.toolCalls.some((t) => t.name === "desk_cotizar" && t.ok), `no cotizó: ${JSON.stringify(r.toolCalls)}`);
    await desk.waitForFunction(() => /TOTAL USD [1-9]/.test(document.getElementById("quoteBox")?.textContent || ""), null, { timeout: 15000 });
    const txt = await desk.evaluate(() => document.getElementById("quoteBox").textContent);
    return txt.split("\n")[1];
  });

  await scenario(4, `"abrila en la calculadora" → :5173 con el proyecto aplicado`, async () => {
    const popupP = context.waitForEvent("page", { timeout: 60000 }).catch(() => null);
    const r = await say(desk, "abrila en la calculadora");
    const nav = r.ui?.navigation;
    assert(nav?.destino === "calculadora", `sin navegación a calculadora: ${JSON.stringify(r.ui)}`);
    assert(/ialfredQuote=latest/.test(nav.url), `deep-link sin ialfredQuote: ${nav.url}`);
    let popup = await popupP;
    if (!popup) {
      // Popup bloqueado → chip "Abrir calculadora ↗" en el dock.
      const chipP = context.waitForEvent("page", { timeout: 15000 });
      await desk.evaluate(() => document.getElementById("ialfred-voice-dock").shadowRoot.querySelector(".navchip a").click());
      popup = await chipP;
    }
    await popup.waitForFunction(() => window.__ialfredCalcState?.techo?.familia === "ISODEC_EPS" && String(window.__ialfredCalcState?.techo?.espesor) === "100", null, { timeout: 60000 });
    await popup.screenshot({ path: path.join(SHOTS, "04-calculadora-deeplink.png") });
    const cleaned = !/ialfredQuote/.test(popup.url());
    assert(cleaned, `la query no se limpió: ${popup.url()}`);
    calc = popup;
    return "ISODEC_EPS 100 mm aplicado";
  });

  await scenario(5, "El dock de :5173 muestra el mismo transcript (misma sesión, SSE)", async () => {
    await dockReady(calc, { timeout: 30000 });
    await calc.waitForFunction((sid) => window.IAlfredDock.getState().sessionId === sid && window.IAlfredDock.getState().turns >= 3, sessionId, { timeout: 15000 });
    const s = await state(calc);
    assert(s.transcript.some((t) => /leeme la fila/i.test(t.user)), "falta el turno 'leeme la fila'");
    const si = await state(ialfred);
    assert(si.sessionId === sessionId, `IAlfred Desk en otra sesión (${si.sessionId})`);
    return `${s.turns} turnos en :5173 · :3857 en la misma sesión`;
  });

  await scenario(6, "Edito K a mano → \"guardá\" → pendiente con MI texto → \"no\" → planilla sin cambios", async () => {
    await desk.bringToFront();
    const mark = ` [E2E ${Date.now().toString(36)}]`;
    await desk.waitForFunction((row) => current?.adminRow === row && document.getElementById("fResp"), ROW, { timeout: 10000 });
    const edited = (await desk.inputValue("#fResp")) + mark;
    await desk.fill("#fResp", edited);
    await desk.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); // sacar el foco del textarea
    const r = await say(desk, `guardá la fila ${ROW} en la planilla`);
    const pend = r.ui?.pendingActions || [];
    assert(pend.some((p) => p.type === "guardar_fila" && p.adminRow === ROW), `sin pendiente de guardado: ${JSON.stringify(pend)} · ${r.replyText}`);
    const file = path.join(health.body.memory.sessions, `active-${r.sessionId}.json`);
    const sess = JSON.parse(fs.readFileSync(file, "utf8"));
    const p = sess.slots.pendingActions.find((x) => x.type === "guardar_fila");
    assert(p?.snapshot?.respuesta === edited, "el snapshot pendiente NO tiene la edición del operador");
    assert(sess.slots.drafts[ROW]?.source === "operator" || sess.slots.drafts[ROW]?.respuesta === edited, "el borrador no quedó como del operador");
    const vis = await desk.evaluate(() => document.getElementById("ialfred-voice-dock").shadowRoot.querySelector(".pend").classList.contains("on"));
    assert(vis, "no se ve la barra de confirmación Sí/No");
    await desk.evaluate(() => [...document.getElementById("ialfred-voice-dock").shadowRoot.querySelectorAll(".pend .btn.no")][0].click());
    await desk.waitForFunction(() => window.IAlfredDock.getState().pending.length === 0 && /cancelado/i.test(window.IAlfredDock.getState().lastReply), null, { timeout: 30000 });
    const row1 = (await getJson(`${DESK}/api/row/${ROW}`)).body;
    assert(row1.respuesta === row0.respuesta && row1.interp === row0.interp, "¡la planilla cambió!");
    return "operador gana · cancelado · planilla intacta";
  });

  const settle = async (page) => {
    // Esperar a que termine de hablar (voz del navegador); si tarda, Esc corta la voz.
    const idle = await page.waitForFunction(() => window.IAlfredDock.getState().state === "idle", null, { timeout: 15000 }).then(() => true).catch(() => false);
    if (!idle) await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.IAlfredDock.getState().state === "idle", null, { timeout: 5000 });
  };

  await scenario(7, "Espacio en textarea escribe; hold fuera de inputs entra en listening", async () => {
    await settle(desk);
    await desk.click("#fFalt");
    const before = await desk.inputValue("#fFalt");
    await desk.keyboard.down("Space");
    await desk.waitForTimeout(350);
    await desk.keyboard.up("Space");
    const after = await desk.inputValue("#fFalt");
    assert(after.length === before.length + 1 && after.endsWith(" "), "el espacio no se escribió en el textarea");
    assert((await state(desk)).state === "idle", "el PTT se activó dentro del textarea");
    await desk.fill("#fFalt", before);
    await desk.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await desk.keyboard.down("Space");
    await desk.waitForTimeout(120);
    assert((await state(desk)).state === "idle", "un tap (<200 ms) no debe activar");
    await desk.waitForTimeout(250);
    const s = await state(desk);
    await desk.keyboard.up("Space");
    assert(s.state === "listening", `hold ≥200 ms no entró en listening (${s.state})`);
    await desk.waitForFunction(() => window.IAlfredDock.getState().state === "idle", null, { timeout: 5000 });
    return "textarea OK · hold → listening · vacío → idle";
  });

  await scenario(8, "Barge-in: hablando + Espacio → corta audio y escucha", async () => {
    await settle(desk);
    await desk.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    const b0 = (await state(desk)).bargeIns;
    await desk.evaluate(() => window.IAlfredDock.__test.forceState("speaking"));
    await desk.keyboard.down("Space");
    await desk.waitForTimeout(320);
    const s = await state(desk);
    await desk.keyboard.up("Space");
    assert(s.state === "listening", `no pasó a listening (${s.state})`);
    assert(s.bargeIns === b0 + 1 && s.audioPaused, "no registró el barge-in / audio no pausado");
    await desk.waitForFunction(() => window.IAlfredDock.getState().state === "idle", null, { timeout: 5000 });
    return "speaking → listening";
  });

  await scenario(9, "Recargar la página → transcript restaurado", async () => {
    const n = (await state(desk)).turns;
    await desk.reload({ waitUntil: "domcontentloaded" });
    await dockReady(desk);
    await desk.waitForFunction((min) => window.IAlfredDock.getState().turns >= min, Math.min(n, 8), { timeout: 10000 });
    const s = await state(desk);
    assert(s.sessionId === sessionId, "otra sesión tras recargar");
    return `${s.turns} turnos restaurados`;
  });

  await scenario(10, "TTS: /api/voice/tts → audio/mpeg; con TTS caído el dock usa el navegador sin errores", async () => {
    const r = await fetch(`${DESK}/api/voice/tts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Hola Matías, prueba de voz." }) });
    assert(r.status === 200 && /audio\/mpeg/.test(r.headers.get("content-type") || ""), `TTS ${r.status} ${r.headers.get("content-type")}`);
    const bytes = (await r.arrayBuffer()).byteLength;
    assert(bytes > 1000, "audio vacío");
    await getJson(`${DESK}/api/voice/prefs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine: "xai" }) });
    await desk.waitForFunction(() => window.IAlfredDock.getState().prefs.engine === "xai", null, { timeout: 5000 });
    await desk.route("**/api/voice/tts", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "tts_disabled", error: "TTS apagado", fallback: "browser" }) }));
    const errs0 = pageErrors.length;
    const t = await say(desk, "decime sólo hola");
    await desk.waitForFunction(() => window.IAlfredDock.getState().state === "idle", null, { timeout: 20000 });
    await desk.unroute("**/api/voice/tts");
    await getJson(`${DESK}/api/voice/prefs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine: "browser" }) });
    assert(pageErrors.length === errs0, `errores de página: ${pageErrors.slice(errs0).join(" | ")}`);
    return `mp3 ${bytes} B · fallback OK (“${t.replyText.slice(0, 40)}”)`;
  });

  await scenario(12, "Voces: ⚙︎ lista 28 xAI + sección navegador; ▶ rex 2ª vez sale de cache", async () => {
    await desk.evaluate(() => window.IAlfredDock.showSettings());
    await desk.waitForFunction(() => document.getElementById("ialfred-voice-dock").shadowRoot.querySelectorAll(".vrow[data-voice]").length >= 28, null, { timeout: 15000 });
    const counts = await desk.evaluate(() => {
      const r = document.getElementById("ialfred-voice-dock").shadowRoot;
      return { xai: r.querySelectorAll(".vrow[data-voice]").length, groups: [...r.querySelectorAll(".vgroup")].map((g) => g.textContent) };
    });
    assert(counts.xai === 28, `voces xAI: ${counts.xai}`);
    assert(counts.groups.some((g) => /Navegador/.test(g)), "falta la sección de voces del navegador");
    const p1 = await fetch(`${DESK}/api/voice/tts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "__preview__", voice: "rex" }) });
    await p1.arrayBuffer();
    const p2 = await fetch(`${DESK}/api/voice/tts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "__preview__", voice: "rex" }) });
    assert(/audio\/mpeg/.test(p2.headers.get("content-type") || ""), "preview no es audio/mpeg");
    assert(p2.headers.get("x-cache") === "hit", `2º preview X-Cache=${p2.headers.get("x-cache")}`);
    await desk.screenshot({ path: path.join(SHOTS, "12-voces.png") });
    return `${counts.xai} xAI · ${counts.groups.find((g) => /Navegador/.test(g))} · cache hit`;
  });

  await scenario(13, "Prefs compartidas: aurora en :8787 → ★ en :5173 sin recargar; \"cambiá la voz a Leo\"", async () => {
    await desk.evaluate(() => document.getElementById("ialfred-voice-dock").shadowRoot.querySelector('.vrow[data-voice="aurora"]').click());
    await calc.waitForFunction(() => window.IAlfredDock.getState().prefs.xaiVoice === "aurora", null, { timeout: 10000 });
    const r = await say(desk, "cambiá la voz a Leo");
    assert(r.fastPath && r.ui?.prefs?.xaiVoice === "leo", `fast-path de voz falló: ${r.replyText}`);
    const pr = (await getJson(`${DESK}/api/voice/prefs`)).body.prefs;
    assert(pr.xaiVoice === "leo", `prefs en servidor: ${pr.xaiVoice}`);
    const bad = await say(desk, "cambiá la voz a Pepito");
    assert(/no tengo la voz/i.test(bad.replyText), "aceptó una voz inexistente");
    await getJson(`${DESK}/api/voice/prefs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine: "browser" }) });
    await desk.evaluate(() => window.IAlfredDock.showSettings && document.getElementById("ialfred-voice-dock").shadowRoot.querySelector(".gear").click());
    return "aurora vía SSE · leo por voz · Pepito rechazada";
  });

  let closedId = null;
  await scenario(11, "\"cerramos por hoy\" → auditoría en disco y sesión nueva en el próximo turno", async () => {
    const r = await say(desk, "cerramos por hoy");
    assert(r.closeRequested && r.closed?.auditFile, `no cerró: ${JSON.stringify(r.closed)}`);
    assert(fs.existsSync(r.closed.auditFile), `no existe ${r.closed.auditFile}`);
    closedId = r.sessionId;
    const r2 = await say(desk, `cotizá isodec eps de 100 milímetros, 10 por 8, para la fila ${ROW}`);
    assert(r2.sessionId && r2.sessionId !== closedId, "no abrió sesión nueva");
    sessionId = r2.sessionId;
    assert(!r2.carriedFrom, "un cierre explícito NO debe sembrar la sesión siguiente");
    assert(r2.toolCalls.some((t) => t.name === "desk_cotizar" && t.ok), "no cotizó en la sesión nueva");
    sessionId = r2.sessionId;
    return `${path.basename(r.closed.auditFile)} · nueva ${r2.sessionId}`;
  });

  await scenario(14, "Carry-over: cierre por inactividad → \"¿en qué estábamos?\" retoma fila y cotización, sin pendientes", async () => {
    // Dejar un pendiente para verificar que NO se hereda.
    const g = await say(desk, `guardá la fila ${ROW}`);
    const hadPending = (g.ui?.pendingActions || []).length > 0;
    let closed;
    const t = await getJson(`${DESK}/api/voice/_test/close-idle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idleMin: 0 }) });
    if (t.status === 200) closed = t.body.closed;
    else {
      const dir = process.env.BMC_PIPELINE_DIR || path.join(os.homedir(), "bmc-sheet-quote-pipeline");
      const { createSessionStore } = await import(pathToFileURL(path.join(dir, "scripts", "voice-memory.mjs")).href);
      closed = await createSessionStore({ logger: { warn() {}, info() {} } }).closeIdle({ idleMin: 0 });
    }
    assert(closed.some((c) => c.sessionId === sessionId && !c.discarded), `no se cerró por inactividad ${sessionId}: ${JSON.stringify(closed)}`);
    const r = await say(desk, "¿en qué estábamos?");
    assert(r.sessionId !== sessionId, "siguió en la sesión cerrada");
    assert(r.carriedFrom === sessionId, `carriedFrom=${r.carriedFrom} (esperado ${sessionId})`);
    const slots = r.sessionState?.slots || {};
    assert(slots.filaActiva === ROW, `fila activa ${slots.filaActiva}`);
    assert(slots.ultimaCotizacion?.total_usd > 0, "sin cotización heredada");
    assert((slots.accionesPendientes || []).length === 0, "¡heredó acciones pendientes!");
    await desk.waitForFunction(() => window.IAlfredDock.getState().carriedFrom, null, { timeout: 10000 });
    await desk.evaluate(() => window.IAlfredDock.open());
    await desk.screenshot({ path: path.join(SHOTS, "14-carryover.png") });
    sessionId = r.sessionId;
    return `${hadPending ? "pendiente descartado · " : ""}retomado de ${r.carriedFrom} · “${r.replyText.slice(0, 60)}”`;
  });
} finally {
  // Limpieza: cerrar la sesión de prueba y restaurar las preferencias de voz.
  if (sessionId) {
    await getJson(`${DESK}/api/voice/session/close`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, reason: "e2e-end" }) }).catch(() => {});
  }
  if (prefsBackup) {
    await getJson(`${DESK}/api/voice/prefs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prefsBackup) }).catch(() => {});
  }
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\nIAlfred dock E2E: ${ok}/${results.length} OK · capturas en ${SHOTS}`);
if (pageErrors.length) console.log("pageerrors:", pageErrors.slice(0, 5));
process.exit(ok === results.length ? 0 : 1);
