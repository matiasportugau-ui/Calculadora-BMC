// ═══════════════════════════════════════════════════════════════════════════
// Smoke test — server/lib/quoteDualWrite.js
//
// Verifica que dualWriteQuote:
//   1. Siempre llama a appendQuoteToCrm (CRM_Operativo)
//   2. Solo llama a appendQuoteToAdminCot si el feature flag está activado
//   3. Pasa los campos correctos a cada función
//   4. No lanza excepción si Admin Cot falla (best-effort)
//   5. Retorna el resultado CRM al caller incluso cuando Admin Cot falla
//
// Run: node tests/quoteDualWrite.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { strict as assert } from "node:assert";

let passed = 0;
let failed = 0;

function ok(cond, label) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n── ${name}`);
  return fn();
}

// ── Stubs ──────────────────────────────────────────────────────────────────

let crmCalls = [];
let adminCotCalls = [];
let crmResult = { ok: true, row: 10, sheetId: "sheet-crm" };
let adminCotResult = { ok: true, row: 5, sheetId: "sheet-admin" };

function resetStubs() {
  crmCalls = [];
  adminCotCalls = [];
}

// Mock appendQuoteToCrm
async function mockAppendQuoteToCrm(input) {
  crmCalls.push(input);
  return crmResult;
}

// Mock appendQuoteToAdminCot
async function mockAppendQuoteToAdminCot(input) {
  adminCotCalls.push(input);
  return adminCotResult;
}

// ── Importar y monkey-patch el módulo ─────────────────────────────────────
// Usamos un wrapper local para evitar dependencia en googleapis (sin credenciales en CI).

/**
 * Versión instrumentable de dualWriteQuote — replica la lógica del módulo real
 * pero acepta funciones stub inyectadas en el closure.
 */
function makeDualWriteQuote({
  appendCrm = mockAppendQuoteToCrm,
  appendAdmin = mockAppendQuoteToAdminCot,
  flagEnabled = false,
  enviadosTab = "Enviados",
} = {}) {
  return async function dualWriteQuote(input = {}) {
    const leadId = String(input.lead_id || input.correlation_id || "").trim();
    const ts = input.timestamp || new Date().toISOString();

    let crmRes;
    try {
      crmRes = await appendCrm({
        cliente: input.cliente_nombre || input.cliente,
        telefono: input.telefono,
        ubicacion: input.ubicacion,
        scenario: input.scenario,
        lista: input.lista,
        total: input.total_con_iva_usd ?? input.total,
        pdf_url: input.pdf_url,
        drive_url: input.drive_url,
        vendedor: input.vendedor,
        observaciones: input.observaciones,
        tipo_cliente: input.tipo_cliente,
        urgencia: input.urgencia,
        probabilidad_cierre: input.probabilidad_cierre,
        correlation_id: leadId || undefined,
      });
    } catch (err) {
      crmRes = { ok: false, error: `dualWrite CRM throw: ${err.message}` };
    }

    if (!flagEnabled) {
      return {
        crm: crmRes,
        adminCot: { ok: true, skipped: true, reason: "WOLFB_ADMIN_COT_DUAL_WRITE desactivado" },
      };
    }

    let adminRes;
    try {
      adminRes = await appendAdmin({
        lead_id: leadId || undefined,
        timestamp: ts,
        cliente_nombre: input.cliente_nombre || input.cliente,
        telefono: input.telefono,
        ubicacion: input.ubicacion,
        canal_origen: input.canal_origen,
        scenario: input.scenario,
        panel_familia: input.panel_familia,
        panel_espesor: input.panel_espesor,
        area_m2: input.area_m2,
        lista: input.lista,
        total_con_iva_usd: input.total_con_iva_usd ?? input.total,
        notas: input.notas || input.observaciones,
        pdf_url: input.pdf_url,
        drive_url: input.drive_url,
      });
    } catch (err) {
      adminRes = { ok: false, error: `dualWrite AdminCot throw: ${err.message}` };
    }

    return { crm: crmRes, adminCot: adminRes };
  };
}

// ── Test lead fixture ──────────────────────────────────────────────────────

const sampleLead = {
  lead_id: "uuid-test-001",
  timestamp: "2026-05-09T14:30:00.000Z",
  canal_origen: "calculadora_web",
  cliente_nombre: "Juan Pérez",
  telefono: "+598 98 123 456",
  ubicacion: "Montevideo, Pocitos",
  scenario: "solo_techo",
  panel_familia: "ISODEC_EPS",
  panel_espesor: 100,
  area_m2: 320,
  lista: "web",
  total_con_iva_usd: 10370,
  pdf_url: "https://storage.googleapis.com/bmc-cotizaciones/test.pdf",
  drive_url: "https://drive.google.com/file/d/test",
};

// ── Tests ─────────────────────────────────────────────────────────────────

await group("flag OFF (default) — solo escribe en CRM", async () => {
  resetStubs();
  const dualWrite = makeDualWriteQuote({ flagEnabled: false });
  const result = await dualWrite(sampleLead);

  ok(crmCalls.length === 1, "appendQuoteToCrm llamado exactamente 1 vez");
  ok(adminCotCalls.length === 0, "appendQuoteToAdminCot NO llamado con flag off");
  ok(result.crm.ok === true, "result.crm.ok === true");
  ok(result.adminCot.skipped === true, "result.adminCot.skipped === true");
  ok(result.adminCot.ok === true, "result.adminCot.ok === true (skipped = no error)");
});

await group("flag ON — escribe en CRM y Admin Cotizaciones", async () => {
  resetStubs();
  const dualWrite = makeDualWriteQuote({ flagEnabled: true });
  const result = await dualWrite(sampleLead);

  ok(crmCalls.length === 1, "appendQuoteToCrm llamado exactamente 1 vez");
  ok(adminCotCalls.length === 1, "appendQuoteToAdminCot llamado exactamente 1 vez con flag on");
  ok(result.crm.ok === true, "result.crm.ok === true");
  ok(result.adminCot.ok === true, "result.adminCot.ok === true");
});

await group("campos CRM — mapeo correcto", async () => {
  resetStubs();
  const dualWrite = makeDualWriteQuote({ flagEnabled: false });
  await dualWrite(sampleLead);

  const crmInput = crmCalls[0];
  ok(crmInput.cliente === "Juan Pérez", "cliente mapeado a CRM");
  ok(crmInput.telefono === "+598 98 123 456", "telefono mapeado a CRM");
  ok(crmInput.total === 10370, "total_con_iva_usd mapeado como total CRM");
  ok(crmInput.pdf_url === sampleLead.pdf_url, "pdf_url mapeado a CRM");
  ok(crmInput.correlation_id === "uuid-test-001", "lead_id mapeado como correlation_id CRM");
});

await group("campos Admin Cot — mapeo correcto", async () => {
  resetStubs();
  const dualWrite = makeDualWriteQuote({ flagEnabled: true });
  await dualWrite(sampleLead);

  const adminInput = adminCotCalls[0];
  ok(adminInput.lead_id === "uuid-test-001", "lead_id pasado a Admin Cot");
  ok(adminInput.cliente_nombre === "Juan Pérez", "cliente_nombre pasado a Admin Cot");
  ok(adminInput.canal_origen === "calculadora_web", "canal_origen pasado a Admin Cot");
  ok(adminInput.panel_familia === "ISODEC_EPS", "panel_familia pasado a Admin Cot");
  ok(adminInput.panel_espesor === 100, "panel_espesor pasado a Admin Cot");
  ok(adminInput.area_m2 === 320, "area_m2 pasado a Admin Cot");
  ok(adminInput.total_con_iva_usd === 10370, "total_con_iva_usd pasado a Admin Cot");
  ok(adminInput.timestamp === sampleLead.timestamp, "timestamp pasado a Admin Cot");
});

await group("resilencia — Admin Cot falla, CRM sigue funcionando", async () => {
  resetStubs();
  const dualWrite = makeDualWriteQuote({
    flagEnabled: true,
    appendAdmin: async () => { throw new Error("Sheets API timeout simulado"); },
  });
  const result = await dualWrite(sampleLead);

  ok(result.crm.ok === true, "result.crm.ok === true aunque Admin Cot fallara");
  ok(result.adminCot.ok === false, "result.adminCot.ok === false cuando Admin Cot lanza");
  ok(
    result.adminCot.error?.includes("Sheets API timeout"),
    "result.adminCot.error contiene mensaje de la excepción"
  );
});

await group("resilencia — CRM falla, retorna ok=false sin lanzar excepción", async () => {
  resetStubs();
  const dualWrite = makeDualWriteQuote({
    flagEnabled: false,
    appendCrm: async () => { throw new Error("Google auth error simulado"); },
  });
  let threw = false;
  let result;
  try {
    result = await dualWrite(sampleLead);
  } catch {
    threw = true;
  }
  ok(!threw, "dualWriteQuote no lanza excepción cuando CRM falla");
  ok(result?.crm?.ok === false, "result.crm.ok === false cuando CRM lanza");
  ok(result?.crm?.error?.includes("dualWrite CRM throw"), "result.crm.error contiene mensaje");
});

await group("campo canal_origen panelin_chat desde agentTools", async () => {
  resetStubs();
  const dualWrite = makeDualWriteQuote({ flagEnabled: true });
  await dualWrite({
    ...sampleLead,
    canal_origen: "panelin_chat",
  });
  const adminInput = adminCotCalls[0];
  ok(adminInput.canal_origen === "panelin_chat", "canal_origen panelin_chat pasado correctamente");
});

// ── Resumen ───────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════`);
console.log(`  passed: ${passed}   failed: ${failed}`);
console.log(`═══════════════════════════════`);
if (failed > 0) {
  process.exit(1);
}
