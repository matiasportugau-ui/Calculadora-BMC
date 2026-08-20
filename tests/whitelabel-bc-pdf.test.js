// tests/whitelabel-bc-pdf.test.js
// Fija el contrato del deploy white-label BC:
//   - sin WHITELABEL la prod BMC no cambia y el layout 'bc' ni se ofrece
//   - con WHITELABEL=bc el socio ve un único layout y es el default
//   - ningún PDF del socio puede salir con branding BMC
//
// WHITELABEL se lee una sola vez, al cargar el módulo. Por eso cada modo corre
// en su propio proceso — igual que en producción — en vez de intentar recargar
// módulos dentro del mismo proceso. Este archivo se auto-invoca como sonda
// cuando recibe WL_PROBE.
//
// Ejecutar: node --test tests/whitelabel-bc-pdf.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);

const QUOTE = {
  ref: 'BC-2026-0148',
  fecha: '17/08/2026',
  escenario: 'Techo + Fachada',
  validez: '10 días',
  panelDescLine: 'ISODEC PIR 80mm · Blanco',
  areaTotalM2: 174.72,
  panelCount: 15,
  apoyoCount: 3,
  fijacionCount: 96,
  zoneRows: [
    { zona: 'Zona 1', desc: 'Nave', largo: '12.00 m', ancho: '10.08 m', paneles: 9, area: '120.96 m²', au: '1.12 m' },
  ],
  bomDetailGroups: [
    {
      groupName: 'PANELES TECHO',
      groupTotal: 8491.4,
      items: [{ desc: 'Panel ISODEC PIR 80mm', qty: 174.72, unit: 'm²', pu: 48.6, total: 8491.4, cantPaneles: 15, largoPanel: 12 }],
    },
    {
      groupName: 'FIJACIONES',
      groupTotal: 5.54,
      // Insumo sub-centavo: 260 × 0.0213 = 5.54. Con 2 decimales el P.U. se
      // mostraría 0.02 y la línea parecería mal sumada.
      items: [{ desc: 'Remache POP 5/32 × 1/2', qty: 260, unit: 'unid', pu: 0.0213, total: 5.54 }],
    },
  ],
  subtotalSinIva: 8496.94,
  ivaAmount: 1869.33,
  totalConIva: 10366.27,
  bmcExtra: { client: { nombre: 'Agroservicios del Norte S.R.L.', rut: '218904570018' } },
};

// ── Sonda ────────────────────────────────────────────────────────────────────
// Corre dentro del hijo: carga el dispatcher con el WHITELABEL del entorno y
// escupe el estado + los HTML pedidos.
if (process.env.WL_PROBE) {
  const m = await import('../src/pdf-templates/index.js');
  const quote = JSON.parse(process.env.WL_PROBE_QUOTE);
  const html = {};
  for (const id of JSON.parse(process.env.WL_PROBE_LAYOUTS || '[]')) {
    html[id] = await m.renderPdfLayout(id, quote);
  }
  process.stdout.write(JSON.stringify({
    defaultLayout: m.DEFAULT_LAYOUT,
    optionIds: m.LAYOUT_OPTIONS.map(o => o.id),
    brandMarca: m.ACTIVE_BRAND?.marca ?? null,
    allowed: Object.fromEntries(['bc', 'simple'].map(id => [id, m.isAllowedLayout(id)])),
    html,
  }));
  process.exit(0);
}

/** Corre la sonda en un proceso limpio con el WHITELABEL indicado. */
function probe({ whitelabel = null, layouts = [], quote = QUOTE } = {}) {
  const env = {
    ...process.env,
    WL_PROBE: '1',
    WL_PROBE_QUOTE: JSON.stringify(quote),
    WL_PROBE_LAYOUTS: JSON.stringify(layouts),
  };
  if (whitelabel) env.WHITELABEL = whitelabel;
  else delete env.WHITELABEL;

  return JSON.parse(execFileSync(process.execPath, [SELF], {
    env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  }));
}

// ── Prod BMC ─────────────────────────────────────────────────────────────────

test('prod BMC: el layout white-label no se ofrece y el default no cambia', () => {
  const r = probe();
  assert.equal(r.defaultLayout, 'simple');
  assert.ok(!r.optionIds.includes('bc'), "'bc' no debe aparecer en la prod BMC");
  assert.ok(r.optionIds.includes('simple'));
  assert.ok(r.optionIds.length > 5, 'la prod BMC conserva todo su catálogo');
  assert.equal(r.brandMarca, null);
  assert.equal(r.allowed.simple, true);
  assert.equal(r.allowed.bc, false);
});

test('prod BMC: renderPdfLayout respeta el layout pedido', () => {
  const r = probe({ layouts: ['simple'] });
  assert.match(r.html.simple, /BMC URUGUAY/);
});

// ── White-label BC ───────────────────────────────────────────────────────────

test('white-label bc: un único layout y es el default', () => {
  const r = probe({ whitelabel: 'bc' });
  assert.equal(r.defaultLayout, 'bc');
  assert.deepEqual(r.optionIds, ['bc']);
  assert.equal(r.brandMarca, 'BC');
  assert.equal(r.allowed.bc, true);
  assert.equal(r.allowed.simple, false, 'un layout ajeno no está permitido');
});

test('white-label bc: pedir otro layout cae igual en el de la marca', () => {
  // Un 'bmc.pdfLayout' viejo en localStorage o un body.template a mano no
  // pueden hacer salir un PDF con branding BMC desde la calculadora del socio.
  const intentos = ['simple', 'classic', 'bmc-pdf', 'no-existe'];
  const r = probe({ whitelabel: 'bc', layouts: intentos });
  for (const id of intentos) {
    assert.doesNotMatch(r.html[id], /BMC URUGUAY/, `layout "${id}" filtró branding BMC`);
    assert.match(r.html[id], /PRESUPUESTO/);
  }
});

test('white-label bc: el PDF no menciona a BMC por ningún lado', () => {
  const { html } = probe({ whitelabel: 'bc', layouts: ['bc'] });
  for (const token of ['BMC', 'Metalog', 'METALOG', 'bmcuruguay', '120403430012']) {
    assert.ok(!html.bc.includes(token), `el PDF del socio filtró "${token}"`);
  }
  // La condición comercial que nombra a BMC sale con la marca del socio.
  assert.match(html.bc, /BC no asume responsabilidad/);
});

test('white-label bc: la razón social y el RUT van sólo en el pie legal', () => {
  const { html } = probe({ whitelabel: 'bc', layouts: ['bc'] });
  assert.match(html.bc, /Jenerik Bentancor · RUT 150633750010 · Florencio Sánchez y Ruta 5 vieja, Progreso/);
  // El encabezado es la marca comercial, no la razón social.
  const header = html.bc.slice(html.bc.indexOf('bc-hdr'), html.bc.indexOf('Cliente y obra'));
  assert.ok(!header.includes('Jenerik'), 'la razón social no va en el encabezado');
});

test('white-label bc: el P.U. sub-centavo conserva decimales para que cierre', () => {
  const { html } = probe({ whitelabel: 'bc', layouts: ['bc'] });
  assert.match(html.bc, /0\.0213/, 'un P.U. de 0.0213 no puede mostrarse como 0.02');
  assert.match(html.bc, /48\.60/, 'un P.U. normal se mantiene con 2 decimales');
});

test('white-label bc: el branding no puede romper un atributo HTML', () => {
  // El branding lo carga el socio, y se interpola dentro de src/alt del logo.
  // Sin escapar comillas se sale del atributo (CodeQL #652/#653).
  const { html } = probe({
    whitelabel: 'bc',
    layouts: ['bc'],
    quote: { ...QUOTE, branding: { marca: '" onerror="alert(1)', razonSocial: "O'Brien & <hijos>" } },
  });
  assert.ok(!html.bc.includes('onerror="alert(1)"'), 'se rompió el atributo');
  assert.ok(!html.bc.includes('<hijos>'), 'no se escapó el markup del branding');
  assert.match(html.bc, /O&#39;Brien &amp; &lt;hijos&gt;/);
});

test('white-label bc: sólo se acepta un logo data: de imagen', () => {
  const casos = [
    ['javascript:alert(1)', false],
    ['data:text/html;base64,PHNjcmlwdD4=', false],
    ['https://tercero.example/logo.png', false],
    ['data:image/png;base64,iVBORw0KGgo=', true],
  ];
  for (const [logoDataUrl, deberiaUsarse] of casos) {
    const { html } = probe({
      whitelabel: 'bc',
      layouts: ['bc'],
      quote: { ...QUOTE, branding: { logoDataUrl } },
    });
    const usaImg = html.bc.includes('<img class="bc-logo-img"');
    assert.equal(usaImg, deberiaUsarse, `logo "${logoDataUrl.slice(0, 32)}" mal resuelto`);
    // Si se rechaza, cae al logo vectorial y nunca entra la URL al documento.
    if (!deberiaUsarse) assert.ok(!html.bc.includes(logoDataUrl));
  }
});

test('white-label bc: el branding del modelo pisa el default del deploy', () => {
  const { html } = probe({
    whitelabel: 'bc',
    layouts: ['bc'],
    quote: { ...QUOTE, branding: { marca: 'OTRA', rut: '999' } },
  });
  assert.match(html.bc, /Firma — OTRA/);
  assert.match(html.bc, /RUT 999/);
  // Un branding parcial no borra los campos que no trae.
  assert.match(html.bc, /Jenerik Bentancor/);
});
