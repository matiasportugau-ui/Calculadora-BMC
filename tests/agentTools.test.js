// ═══════════════════════════════════════════════════════════════════════════
// Contract tests for server/lib/agentTools.js
// Run: node tests/agentTools.test.js
//
// Pure-function tools (calcular_cotizacion, obtener_precio_panel,
// listar_opciones_panel, get_calc_state, aplicar_estado_calc,
// formatear_resumen_crm) run directly against the imported executor.
//
// HTTP-backed tools (obtener_escenarios, obtener_catalogo,
// obtener_informe_completo, presupuesto_libre, listar_cotizaciones_recientes,
// obtener_cotizacion_por_id, generar_pdf) are exercised against a stubbed
// globalThis.fetch so the test runs offline.
//
// guardar_en_crm runs with BMC_SHEET_ID unset and asserts the configured
// error path (does not actually touch Sheets).
// ═══════════════════════════════════════════════════════════════════════════

// Force CRM tool down its "no sheet configured" path before agentTools loads.
process.env.BMC_SHEET_ID = "";
process.env.GOOGLE_APPLICATION_CREDENTIALS = "";
process.env.PUBLIC_BASE_URL = "http://localhost:3001";

const { AGENT_TOOLS, executeTool } = await import("../server/lib/agentTools.js");

let failures = 0;
let passed = 0;

function assert(cond, label) {
  if (cond) {
    passed++;
  } else {
    failures++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

async function run(name, input, calcState = {}, opts = {}) {
  const raw = await executeTool(name, input, calcState, opts);
  return { raw, parsed: JSON.parse(raw) };
}

// ── Stub fetch for HTTP-backed tools ─────────────────────────────────────────

const fetchHistory = [];
let fetchHandler = async (_url, _init) => ({ ok: false, error: "no handler set" });

globalThis.fetch = async (url, init) => {
  fetchHistory.push({ url: String(url), init });
  const body = await fetchHandler(String(url), init || {});
  return {
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
};

function setFetch(handler) {
  fetchHandler = handler;
  fetchHistory.length = 0;
}

// ── 1. AGENT_TOOLS surface ───────────────────────────────────────────────────

group("AGENT_TOOLS surface", () => {
  const expected = [
    "calcular_cotizacion",
    "obtener_precio_panel",
    "listar_opciones_panel",
    "get_calc_state",
    "generar_pdf",
    "obtener_escenarios",
    "obtener_catalogo",
    "obtener_informe_completo",
    "presupuesto_libre",
    "listar_cotizaciones_recientes",
    "obtener_cotizacion_por_id",
    "aplicar_estado_calc",
    "formatear_resumen_crm",
    "guardar_en_crm",
    "comparar_listas",
    "buscar_cliente_crm",
    "enviar_whatsapp_link",
    "comparar_escenarios",
    "cancelar_cotizacion",
    "obtener_pdf_html",
    "programar_seguimiento",
    "historial_cliente",
  ];
  for (const name of expected) {
    const tool = AGENT_TOOLS.find((t) => t.name === name);
    assert(!!tool, `tool ${name} exists in AGENT_TOOLS`);
    if (tool) {
      assert(typeof tool.description === "string" && tool.description.length > 20, `${name}: description present`);
      assert(tool.input_schema && tool.input_schema.type === "object", `${name}: input_schema is an object schema`);
    }
  }
  assert(AGENT_TOOLS.length === expected.length, `AGENT_TOOLS has exactly ${expected.length} tools (got ${AGENT_TOOLS.length})`);
});

// ── 2. Pure-function tools (no HTTP) ─────────────────────────────────────────

await group("get_calc_state", async () => {
  const { parsed } = await run("get_calc_state", {}, {
    scenario: "solo_techo",
    listaPrecios: "web",
    techo: { familia: "ISODEC_EPS", espesor: 100, zonas: [{ largo: 10, ancho: 5 }] },
  });
  assert(parsed && typeof parsed === "object", "returns JSON object");
  assert(parsed.calcState?.scenario === "solo_techo", "echoes calcState.scenario");
  assert(parsed.liveResult !== undefined, "liveResult key present");
});

await group("obtener_precio_panel", async () => {
  const { parsed: ok } = await run("obtener_precio_panel", { familia: "ISODEC_EPS", espesor: 100, lista: "web" });
  assert(ok && !ok.error, "happy path returns no error");
  assert(typeof ok.precio_usd_m2_sin_iva === "number", "returns precio_usd_m2_sin_iva number");
  assert(ok.familia === "ISODEC_EPS", "echoes familia");

  const { parsed: badFam } = await run("obtener_precio_panel", { familia: "NOPE_999", espesor: 100, lista: "web" });
  assert(badFam.error && Array.isArray(badFam.familias_disponibles), "unknown familia returns error + familias_disponibles");

  const { parsed: badEsp } = await run("obtener_precio_panel", { familia: "ISODEC_EPS", espesor: 999, lista: "web" });
  assert(badEsp.error && Array.isArray(badEsp.espesores_disponibles), "unknown espesor returns error + espesores_disponibles");
});

await group("listar_opciones_panel", async () => {
  const { parsed: techo } = await run("listar_opciones_panel", { tipo: "techo", lista: "web" });
  assert(Array.isArray(techo.techo) && techo.techo.length > 0, "tipo=techo returns non-empty techo[]");
  assert(techo.lista === "web", "echoes lista");

  const { parsed: pared } = await run("listar_opciones_panel", { tipo: "pared" });
  assert(Array.isArray(pared.pared) && pared.pared.length > 0, "tipo=pared returns non-empty pared[]");

  const { parsed: todos } = await run("listar_opciones_panel", { tipo: "todos" });
  assert(Array.isArray(todos.techo) && Array.isArray(todos.pared), "tipo=todos returns both arrays");
});

await group("calcular_cotizacion", async () => {
  const { parsed: techoOk } = await run("calcular_cotizacion", {
    scenario: "solo_techo",
    listaPrecios: "web",
    techo: { familia: "ISODEC_EPS", espesor: 100, zonas: [{ largo: 10, ancho: 5 }] },
  });
  assert(techoOk.scenario === "solo_techo", "techo scenario echoed");
  assert(typeof techoOk.subtotalSinIVA === "number" && techoOk.subtotalSinIVA > 0, "subtotalSinIVA > 0");
  assert(typeof techoOk.totalConIVA === "number" && techoOk.totalConIVA > techoOk.subtotalSinIVA, "totalConIVA > subtotalSinIVA");

  const { parsed: missing } = await run("calcular_cotizacion", { scenario: "solo_techo", listaPrecios: "web" });
  assert(missing.error, "missing techo data → error");

  const { parsed: bad } = await run("calcular_cotizacion", { scenario: "no_existe" });
  assert(bad.error, "unknown scenario → error");
});

await group("aplicar_estado_calc — emits actions", async () => {
  const emitted = [];
  const { parsed } = await run(
    "aplicar_estado_calc",
    {
      scenario: "solo_techo",
      listaPrecios: "web",
      techo: {
        familia: "isodec_eps", // lower-case, must be normalized
        espesor: 100,
        color: "Blanco",
        zonas: [{ largo: 10, ancho: 5 }],
      },
      proyecto: { nombre: "Test SRL", telefono: "099000000" },
    },
    {},
    { emitAction: (a) => emitted.push(a) },
  );
  assert(parsed.ok === true, "ok true");
  assert(parsed.count >= 4, "applied at least 4 actions (scenario, lp, techo, zonas, proyecto)");
  assert(emitted.some((a) => a.type === "setScenario"), "emits setScenario");
  assert(emitted.some((a) => a.type === "setLP"), "emits setLP");
  const techoAct = emitted.find((a) => a.type === "setTecho");
  assert(techoAct && techoAct.payload.familia === "ISODEC_EPS", "setTecho normalizes familia to upper");
  assert(typeof techoAct.payload.espesor === "string", "setTecho coerces espesor to string");
  const zonasAct = emitted.find((a) => a.type === "setTechoZonas");
  assert(zonasAct && zonasAct.payload[0].largo === 10, "setTechoZonas zonas coerced to numbers");
  assert(emitted.some((a) => a.type === "setProyecto"), "emits setProyecto");
});

await group("aplicar_estado_calc — empty input", async () => {
  const { parsed } = await run("aplicar_estado_calc", {}, {}, { emitAction: () => {} });
  assert(parsed.ok === false, "empty input → ok false");
  assert(typeof parsed.error === "string", "carries error message");
});

await group("formatear_resumen_crm", async () => {
  const { parsed } = await run("formatear_resumen_crm", {
    cliente: "Juan Pérez",
    scenario: "solo_techo",
    total: 1234.56,
    lista: "web",
    pdf_url: "https://example.com/p.html",
    drive_url: "https://drive.google.com/file/d/abc",
    code: "ABC12345",
  });
  assert(parsed.ok === true, "ok true");
  assert(typeof parsed.crm_text === "string" && parsed.crm_text.includes("Juan Pérez"), "crm_text contains cliente");
  assert(parsed.crm_text.includes("USD 1234.56"), "crm_text contains total c/IVA");
  assert(parsed.crm_text.includes("https://example.com/p.html"), "crm_text contains PDF URL");
  assert(parsed.crm_text.includes("Drive:"), "crm_text contains Drive line");
});

// ── 3. HTTP-backed tools (stubbed fetch) ─────────────────────────────────────

await group("obtener_escenarios — happy path", async () => {
  setFetch(async (url) => {
    assert(url.endsWith("/calc/escenarios"), "calls /calc/escenarios");
    return { ok: true, escenarios: [{ id: "solo_techo", campos_requeridos: ["techo.familia"] }] };
  });
  const { parsed } = await run("obtener_escenarios", {});
  assert(parsed.ok === true && Array.isArray(parsed.escenarios), "returns escenarios array");
});

await group("obtener_escenarios — upstream error", async () => {
  setFetch(async () => ({ ok: false, error: "upstream down" }));
  const { parsed } = await run("obtener_escenarios", {});
  assert(parsed.error === "upstream down", "propagates upstream error");
});

await group("obtener_catalogo", async () => {
  setFetch(async (url) => {
    assert(url.includes("lista=venta"), "passes lista query param");
    return { ok: true, lista: "venta", paneles_techo: {}, paneles_pared: {}, bordes_techo: [], tipos_estructura: [], escenarios: [] };
  });
  const { parsed } = await run("obtener_catalogo", { lista: "venta" });
  assert(parsed.ok === true && parsed.lista === "venta", "echoes lista");
});

await group("obtener_informe_completo", async () => {
  setFetch(async (url) => {
    assert(url.includes("/calc/informe"), "calls /calc/informe");
    return {
      ok: true,
      meta: { lista: "web" },
      paneles_techo: {}, paneles_pared: {},
      fijaciones: {}, selladores: {}, servicios: {},
      matriz_precios: { techo: [], pared: [] },
      bordes_techo: [], reglas_asesoria: {}, formulas_calculo: {},
    };
  });
  const { parsed } = await run("obtener_informe_completo", {});
  assert(parsed.ok === true, "ok true");
  assert(parsed.lista === "web", "carries lista from meta");
  assert(parsed.matriz_precios?.techo !== undefined, "carries matriz_precios.techo");
});

await group("presupuesto_libre", async () => {
  setFetch(async (url, init) => {
    assert(url.endsWith("/calc/cotizar/presupuesto-libre"), "calls libre endpoint");
    assert(init.method === "POST", "uses POST");
    return { ok: true, resumen: { total_usd: 500 }, bom: [], advertencias: [], texto_resumen: "x" };
  });
  const { parsed } = await run("presupuesto_libre", { lista: "web", librePanelLines: [] });
  assert(parsed.ok === true && parsed.resumen?.total_usd === 500, "carries resumen.total_usd");
});

await group("listar_cotizaciones_recientes — filters by client", async () => {
  setFetch(async () => ({
    ok: true,
    cotizaciones: [
      { id: "1", client: "Juan Pérez", scenario: "solo_techo", total: 100 },
      { id: "2", client: "María López", scenario: "solo_fachada", total: 200 },
      { id: "3", client: "JUAN G", scenario: "techo_fachada", total: 300 },
    ],
  }));
  const { parsed } = await run("listar_cotizaciones_recientes", { cliente: "juan" });
  assert(parsed.ok === true, "ok true");
  assert(parsed.count === 2, "filters case-insensitively to 2 matches");
  assert(parsed.cotizaciones.every((c) => c.client.toLowerCase().includes("juan")), "all matches contain juan");
});

await group("obtener_cotizacion_por_id", async () => {
  setFetch(async () => ({
    ok: true,
    cotizaciones: [{ id: "abc-123", client: "X", scenario: "solo_techo", total: 100, lista: "web", pdfUrl: "https://x/p.html", code: "X1", timestamp: "t" }],
  }));
  const { parsed: hit } = await run("obtener_cotizacion_por_id", { pdf_id: "abc-123" });
  assert(hit.ok === true, "ok true on hit");
  assert(hit.viewer_url.includes("/calc/pdf/abc-123"), "viewer_url built from id");
  assert(hit.pdf_url === "https://x/p.html", "pdf_url carried over");

  const { parsed: miss } = await run("obtener_cotizacion_por_id", { pdf_id: "does-not-exist" });
  assert(miss.error && miss.error.includes("no encontrada"), "miss returns not-found error");

  const { parsed: noId } = await run("obtener_cotizacion_por_id", {});
  assert(noId.error === "pdf_id requerido", "missing pdf_id → required error");
});

await group("generar_pdf — propagates urls", async () => {
  setFetch(async (url, init) => {
    assert(url.endsWith("/calc/cotizar/pdf"), "hits cotizar/pdf");
    assert(init.method === "POST", "uses POST");
    return {
      ok: true,
      pdf_id: "xyz-1",
      pdf_url: "https://gcs/p.html",
      gcs_url: "https://gcs/p.html",
      drive_url: "https://drive/p",
      expires_in_hours: null,
      resumen: { total_usd: 999 },
    };
  });
  const { parsed } = await run("generar_pdf", {
    scenario: "solo_techo",
    techo: { familia: "ISODEC_EPS", espesor: 100, zonas: [{ largo: 10, ancho: 5 }] },
  });
  assert(parsed.ok === true, "ok true");
  assert(parsed.pdf_id === "xyz-1", "pdf_id present");
  assert(parsed.gcs_url && parsed.drive_url, "both gcs_url and drive_url present");
});

await group("comparar_listas", async () => {
  const { parsed } = await run("comparar_listas", {
    scenario: "solo_techo",
    techo: { familia: "ISODEC_EPS", espesor: 100, zonas: [{ largo: 10, ancho: 5 }] },
  });
  assert(parsed.ok === true, "ok true");
  assert(typeof parsed.web?.totalConIVA === "number" && parsed.web.totalConIVA > 0, "web total present and positive");
  assert(typeof parsed.venta?.totalConIVA === "number" && parsed.venta.totalConIVA > 0, "venta total present and positive");
  assert(typeof parsed.delta_usd === "number", "delta_usd is a number");
  assert(typeof parsed.delta_pct === "number", "delta_pct is a number");
  assert(typeof parsed.nota === "string", "nota is a string");

  const { parsed: bad } = await run("comparar_listas", {});
  assert(bad.error === "scenario requerido", "missing scenario → error");

  const { parsed: badSc } = await run("comparar_listas", { scenario: "no_existe" });
  assert(typeof badSc.error === "string" && badSc.error.startsWith("Lista web:"), "unknown scenario surfaces upstream error");
});

await group("guardar_en_crm — requires user_confirmed", async () => {
  const { parsed } = await run("guardar_en_crm", {
    cliente: "Juan",
    pdf_url: "https://x/p.html",
    total: 100,
    scenario: "solo_techo",
    lista: "web",
  });
  assert(parsed.ok === false, "ok false without user_confirmed");
  assert(typeof parsed.error === "string" && parsed.error.includes("user_confirmed"), "error mentions user_confirmed");
});

await group("guardar_en_crm — no sheet configured (with user_confirmed)", async () => {
  // BMC_SHEET_ID is "" so this hits the guard in appendQuoteToCrm.
  const { parsed } = await run("guardar_en_crm", {
    cliente: "Juan",
    pdf_url: "https://x/p.html",
    total: 100,
    scenario: "solo_techo",
    lista: "web",
    user_confirmed: true,
  });
  assert(parsed.ok === false, "ok false when BMC_SHEET_ID unset");
  assert(typeof parsed.error === "string" && parsed.error.includes("BMC_SHEET_ID"), "error mentions BMC_SHEET_ID");
});

await group("buscar_cliente_crm — no sheet configured", async () => {
  const { parsed } = await run("buscar_cliente_crm", { query: "Juan" });
  assert(parsed.ok === false, "ok false when BMC_SHEET_ID unset");
  assert(typeof parsed.error === "string" && parsed.error.includes("BMC_SHEET_ID"), "error mentions BMC_SHEET_ID");
});

await group("buscar_cliente_crm — empty query", async () => {
  // BMC_SHEET_ID guard fires first, but with that unset we just verify the tool runs.
  // Empty query path is exercised when BMC_SHEET_ID is set; here we assert the tool doesn't throw.
  const { parsed } = await run("buscar_cliente_crm", {});
  assert(parsed.ok === false, "missing query → ok false");
});

await group("enviar_whatsapp_link — requires user_confirmed", async () => {
  const { parsed } = await run("enviar_whatsapp_link", {
    to: "59899123456",
    pdf_url: "https://x/p.html",
  });
  assert(parsed.ok === false, "ok false without user_confirmed");
  assert(typeof parsed.error === "string" && parsed.error.includes("user_confirmed"), "error mentions user_confirmed");
});

await group("enviar_whatsapp_link — no whatsapp configured", async () => {
  // WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID are unset in test env.
  const { parsed } = await run("enviar_whatsapp_link", {
    to: "59899123456",
    pdf_url: "https://x/p.html",
    cliente: "Juan",
    total: 100,
    user_confirmed: true,
  });
  assert(parsed.ok === false, "ok false when WhatsApp creds unset");
  assert(typeof parsed.error === "string" && parsed.error.includes("WhatsApp no configurado"), "error mentions WhatsApp not configured");
});

await group("enviar_whatsapp_link — missing to", async () => {
  const { parsed } = await run("enviar_whatsapp_link", { user_confirmed: true });
  assert(parsed.ok === false, "missing to → ok false");
  assert(typeof parsed.error === "string" && parsed.error.includes("to"), "error mentions to");
});

await group("comparar_escenarios — happy path", async () => {
  const { parsed } = await run("comparar_escenarios", {
    scenario_a: "solo_techo",
    scenario_b: "solo_techo", // same on both sides → delta should be 0
    listaPrecios: "web",
    techo: { familia: "ISODEC_EPS", espesor: 100, zonas: [{ largo: 10, ancho: 5 }] },
  });
  assert(parsed.ok === true, "ok true");
  assert(typeof parsed.a?.totalConIVA === "number" && parsed.a.totalConIVA > 0, "a total present");
  assert(typeof parsed.b?.totalConIVA === "number" && parsed.b.totalConIVA > 0, "b total present");
  assert(parsed.delta_usd === 0, "same scenario on both sides → delta_usd 0");
  assert(typeof parsed.nota === "string", "nota is a string");
});

await group("comparar_escenarios — missing scenario", async () => {
  const { parsed } = await run("comparar_escenarios", { scenario_a: "solo_techo" });
  assert(parsed.error === "scenario_a y scenario_b requeridos", "missing scenario_b → error");
});

await group("cancelar_cotizacion — requires user_confirmed", async () => {
  const { parsed } = await run("cancelar_cotizacion", { pdf_id: "abc-123" });
  assert(parsed.ok === false, "ok false without user_confirmed");
  assert(typeof parsed.error === "string" && parsed.error.includes("user_confirmed"), "error mentions user_confirmed");
});

await group("cancelar_cotizacion — missing pdf_id", async () => {
  const { parsed } = await run("cancelar_cotizacion", { user_confirmed: true });
  assert(parsed.ok === false, "ok false when pdf_id missing");
  assert(typeof parsed.error === "string" && parsed.error.includes("pdf_id"), "error mentions pdf_id");
});

await group("cancelar_cotizacion — happy path", async () => {
  setFetch(async (url, init) => {
    assert(url.endsWith("/calc/cotizaciones/abc-123/cancelar"), "hits cancelar endpoint with id");
    assert(init.method === "POST", "uses POST");
    const body = JSON.parse(init.body || "{}");
    assert(body.motivo === "cliente declinó", "motivo passed through");
    return {
      ok: true,
      entry: {
        id: "abc-123",
        status: "cancelled",
        cancelledAt: "2026-05-02T12:00:00Z",
        cancelReason: "cliente declinó",
      },
    };
  });
  const { parsed } = await run("cancelar_cotizacion", {
    pdf_id: "abc-123",
    motivo: "cliente declinó",
    user_confirmed: true,
  });
  assert(parsed.ok === true, "ok true on cancel");
  assert(parsed.status === "cancelled", "status=cancelled");
  assert(parsed.cancelReason === "cliente declinó", "cancelReason carried over");
});

// ── 4. Unknown tool name ─────────────────────────────────────────────────────

await group("obtener_pdf_html — happy path", async () => {
  // The stubbed fetch returns the body via .text() which JSON.stringifies the body.
  // For HTML retrieval the executor calls resp.text() and we want the HTML string back,
  // so the stub returns a string body via the special branch.
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({
    ok: true,
    status: 200,
    text: async () => "<html><body>Test PDF</body></html>",
    json: async () => ({}),
  });
  const { parsed } = await run("obtener_pdf_html", { pdf_id: "abc-123" });
  globalThis.fetch = realFetch;
  assert(parsed.ok === true, "ok true");
  assert(parsed.html === "<html><body>Test PDF</body></html>", "html body returned");
  assert(parsed.viewer_url.includes("/calc/pdf/abc-123"), "viewer_url built from id");
});

await group("obtener_pdf_html — 404", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    text: async () => "not found",
    json: async () => ({}),
  });
  const { parsed } = await run("obtener_pdf_html", { pdf_id: "missing" });
  globalThis.fetch = realFetch;
  assert(parsed.ok === false, "ok false on 404");
  assert(typeof parsed.error === "string" && parsed.error.includes("no encontrada"), "error mentions not found");
});

await group("obtener_pdf_html — missing pdf_id", async () => {
  const { parsed } = await run("obtener_pdf_html", {});
  assert(parsed.ok === false, "ok false");
  assert(parsed.error === "pdf_id requerido", "error mentions pdf_id");
});

await group("programar_seguimiento — requires user_confirmed", async () => {
  const { parsed } = await run("programar_seguimiento", { title: "Llamar a Juan", daysUntil: 3 });
  assert(parsed.ok === false, "ok false without user_confirmed");
  assert(typeof parsed.error === "string" && parsed.error.includes("user_confirmed"), "error mentions user_confirmed");
});

await group("programar_seguimiento — missing title", async () => {
  const { parsed } = await run("programar_seguimiento", { user_confirmed: true });
  assert(parsed.ok === false, "ok false");
  assert(parsed.error === "title requerido", "error mentions title");
});

await group("programar_seguimiento — happy path", async () => {
  const { parsed } = await run("programar_seguimiento", {
    title: "Llamar a Juan Pérez",
    detail: "Cotización ABC123 vence en 3 días",
    daysUntil: 3,
    tags: ["cotizacion", "cliente-juan"],
    user_confirmed: true,
  });
  assert(parsed.ok === true, "ok true");
  assert(typeof parsed.id === "string" && parsed.id.length > 0, "id present");
  assert(parsed.title === "Llamar a Juan Pérez", "title carried");
  assert(parsed.status === "open", "status defaults to open");
  assert(Array.isArray(parsed.tags) && parsed.tags.includes("cotizacion"), "tags carried");
});

await group("historial_cliente — composes both sources", async () => {
  // Stub returns CRM no-config + listar_cotizaciones_recientes match.
  setFetch(async (url) => {
    if (url.endsWith("/calc/cotizaciones")) {
      return {
        ok: true,
        cotizaciones: [
          { id: "q1", client: "Juan Pérez", scenario: "solo_techo", total: 100, lista: "web", pdfUrl: "https://x/p1" },
        ],
      };
    }
    return { ok: false, error: "unexpected url" };
  });
  const { parsed } = await run("historial_cliente", { cliente: "Juan Pérez" });
  assert(parsed.ok === true, "ok true");
  assert(parsed.cliente === "Juan Pérez", "cliente echoed");
  // CRM read fails (no BMC_SHEET_ID in test env) — historial reports it as unavailable
  assert(parsed.crm.available === false, "crm marked unavailable");
  // Quotes branch returned via stub
  assert(parsed.cotizaciones.available === true, "cotizaciones available");
  assert(parsed.cotizaciones.count === 1, "1 quote returned");
  assert(parsed.cotizaciones.items[0].id === "q1", "quote id carried");
});

await group("historial_cliente — missing cliente", async () => {
  const { parsed } = await run("historial_cliente", {});
  assert(parsed.ok === false, "ok false");
  assert(parsed.error === "cliente requerido", "error mentions cliente");
});

await group("unknown tool", async () => {
  const { parsed } = await run("does_not_exist", {});
  assert(parsed.error && parsed.error.includes("no implementada"), "unknown tool returns no-implementada error");
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`agentTools contract tests — passed: ${passed}, failed: ${failures}`);
console.log("═".repeat(60));
if (failures > 0) {
  process.exit(1);
}
