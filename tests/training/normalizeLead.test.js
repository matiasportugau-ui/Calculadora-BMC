/**
 * tests/training/normalizeLead.test.js
 *
 * Tests unitarios del módulo normalizeLead.js.
 * Usa inputs sintéticos — no requiere acceso a archivos .ods reales.
 *
 * Ejecutar: node tests/training/normalizeLead.test.js
 */

import assert from 'assert';
import { normalizeLead, parseFilename, parseFechaDDMMYYYY, parseNumeroUY } from '../../scripts/training/normalizeLead.js';

// ---------------------------------------------------------------------------
// Helpers de test
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Tests de parseFechaDDMMYYYY
// ---------------------------------------------------------------------------

console.log('\n--- parseFechaDDMMYYYY ---');

test('parsea fecha válida DDMMYYYY', () => {
  assert.strictEqual(parseFechaDDMMYYYY('01122025'), '2025-12-01');
});

test('parsea fecha con año de 4 dígitos', () => {
  assert.strictEqual(parseFechaDDMMYYYY('06012025'), '2025-01-06');
});

test('devuelve null para string vacío', () => {
  assert.strictEqual(parseFechaDDMMYYYY(''), null);
});

test('devuelve null para formato incorrecto (mes 13)', () => {
  assert.strictEqual(parseFechaDDMMYYYY('01132025'), null);
});

test('devuelve null para null input', () => {
  assert.strictEqual(parseFechaDDMMYYYY(null), null);
});

// ---------------------------------------------------------------------------
// Tests de parseNumeroUY
// ---------------------------------------------------------------------------

console.log('\n--- parseNumeroUY ---');

test('parsea número formato uruguayo con punto y coma', () => {
  assert.strictEqual(parseNumeroUY('1.234,56'), 1234.56);
});

test('parsea número estándar sin separadores', () => {
  assert.strictEqual(parseNumeroUY('12345.67'), 12345.67);
});

test('parsea número con coma decimal simple', () => {
  assert.strictEqual(parseNumeroUY('8500,00'), 8500.00);
});

test('devuelve null para string vacío', () => {
  assert.strictEqual(parseNumeroUY(''), null);
});

test('devuelve null para "-"', () => {
  assert.strictEqual(parseNumeroUY('-'), null);
});

test('parsea número con prefijo USD', () => {
  const result = parseNumeroUY('USD 9800');
  assert.ok(result === 9800, `Esperaba 9800, obtuve ${result}`);
});

// ---------------------------------------------------------------------------
// Tests de parseFilename
// ---------------------------------------------------------------------------

console.log('\n--- parseFilename ---');

test('extrae cliente, fecha, familia y espesor de nombre canónico', () => {
  const r = parseFilename('Cotización 01122025 Javier Plada - Isodec EPS 100mm -4H Maldonado.ods');
  assert.strictEqual(r.fecha, '2025-12-01');
  assert.strictEqual(r.panel_familia, 'ISODEC_EPS');
  assert.strictEqual(r.panel_espesor, 100);
  assert.ok(r.cliente_nombre && r.cliente_nombre.includes('Javier'));
});

test('extrae familia ISOROOF_COLONIAL', () => {
  const r = parseFilename('Cotización 01122025 Base - Isoroof COLONIAL 40 mm - desc - WA.ods');
  assert.strictEqual(r.panel_familia, 'ISOROOF_COLONIAL');
  assert.strictEqual(r.panel_espesor, 40);
  assert.strictEqual(r.es_desc, true);
  assert.strictEqual(r.canal_wa, true);
});

test('detecta cámara frigorífica', () => {
  const r = parseFilename('Cotización 01122025 BASE - CÁMARA FRIGORÍFICA EPS - Pared xx mm - Techo xx mm.ods');
  assert.strictEqual(r.es_camara_frig, true);
});

test('devuelve objeto vacío para filename null', () => {
  const r = parseFilename(null);
  assert.deepStrictEqual(r, {});
});

test('extrae ISOWALL_PIR correctamente', () => {
  const r = parseFilename('Cotización 01122025 Base Isowall 50 mm WA.ods');
  assert.strictEqual(r.panel_familia, 'ISOWALL_PIR');
  assert.strictEqual(r.panel_espesor, 50);
});

// ---------------------------------------------------------------------------
// Tests de normalizeLead
// ---------------------------------------------------------------------------

console.log('\n--- normalizeLead ---');

// Test 1: Input bien formado (filename + sheetData completo)
test('normaliza lead con input completo', () => {
  const raw = {
    filename: 'Cotización 06012025 Hámilton Rodriguez - Isodec EPS 150 mm - Interbalnearia- WA.ods',
    filepath: '/dropbox/2025 Bromyros/Cotización 06012025 Hámilton Rodriguez - Isodec EPS 150 mm - Interbalnearia- WA.ods',
    sheetData: {
      cliente_nombre: 'Hámilton Rodriguez',
      telefono: '099123456',
      ubicacion: 'Interbalnearia km 102',
      total_final_str: '12.500,00',
      area_m2_str: '280',
    },
  };
  const lead = normalizeLead(raw);
  assert.ok(lead !== null, 'Lead no debe ser null');
  assert.strictEqual(lead.canal_origen, 'dropbox_ods_historic');
  assert.strictEqual(lead.fuente, 'dropbox_ods');
  assert.strictEqual(lead.panel_familia, 'ISODEC_EPS');
  assert.strictEqual(lead.panel_espesor, 150);
  assert.strictEqual(lead.cliente_nombre, 'Hámilton Rodriguez');
  assert.strictEqual(lead.telefono, '099123456');
  assert.strictEqual(lead.total_con_iva_usd, 12500.00);
  assert.strictEqual(lead.area_m2, 280);
  assert.ok(lead.lead_id && lead.lead_id.length === 16, 'lead_id debe tener 16 chars');
});

// Test 2: Input con campos faltantes (sheetData vacío)
test('normaliza lead con sheetData vacío (solo filename)', () => {
  const raw = {
    filename: 'Cotización 03012025 Mathias Moreno - Isodec EPS 100mm - WA.ods',
    filepath: '/dropbox/2025/Cotización 03012025 Mathias Moreno - Isodec EPS 100mm - WA.ods',
    sheetData: {},
  };
  const lead = normalizeLead(raw);
  assert.ok(lead !== null);
  assert.strictEqual(lead.panel_familia, 'ISODEC_EPS');
  assert.strictEqual(lead.panel_espesor, 100);
  assert.strictEqual(lead.total_con_iva_usd, null);
  assert.strictEqual(lead.area_m2, null);
  assert.ok(lead.fecha, 'Debe haber fecha extraída del filename');
});

// Test 3: Input con basura (campos con strings inválidos)
test('normaliza lead con basura en campos numéricos', () => {
  const raw = {
    filename: 'Cotización 15062024 Cliente Prueba - ISOROOF 3G 80mm.ods',
    filepath: '/dropbox/test/archivo.ods',
    sheetData: {
      total_final_str: 'N/A',
      area_m2_str: 'pendiente',
      lista_precios: 'xxx',
      telefono: '',
    },
  };
  const lead = normalizeLead(raw);
  assert.ok(lead !== null);
  assert.strictEqual(lead.total_con_iva_usd, null);
  assert.strictEqual(lead.area_m2, null);
  assert.strictEqual(lead.lista_precios, null);
  assert.strictEqual(lead.telefono, null);
});

// Test 4: Input vacío → debe devolver null
test('devuelve null para input vacío', () => {
  assert.strictEqual(normalizeLead({}), null);
  assert.strictEqual(normalizeLead(null), null);
  assert.strictEqual(normalizeLead(undefined), null);
});

// Test 5: Input con valores en formato uruguayo "1.234,56"
test('parsea correctamente valores en formato uruguayo', () => {
  const raw = {
    filename: 'Cotización 10032025 Empresa SRL - Isopanel EPS 100mm.ods',
    filepath: '/dropbox/2025/archivo.ods',
    sheetData: {
      total_final_str: '15.780,50',
      total_materiales_str: '12.934,84',
      area_m2_str: '450',
      lista_precios: 'lista web',
    },
  };
  const lead = normalizeLead(raw);
  assert.ok(lead !== null);
  assert.strictEqual(lead.total_con_iva_usd, 15780.50);
  assert.strictEqual(lead.total_sin_iva_usd, 12934.84);
  assert.strictEqual(lead.area_m2, 450);
  assert.strictEqual(lead.lista_precios, 'web');
  assert.strictEqual(lead.panel_familia, 'ISOPANEL_EPS');
});

// Test 6: Filename sin cliente legible
test('devuelve null si filename no contiene cliente ni fecha', () => {
  const raw = {
    filename: 'presupuesto.ods',
    filepath: '/dropbox/test/presupuesto.ods',
    sheetData: {},
  };
  const lead = normalizeLead(raw);
  assert.strictEqual(lead, null);
});

// Test 7: sheetData con cliente override sobre filename
test('sheetData.cliente_nombre tiene prioridad sobre el filename', () => {
  const raw = {
    filename: 'Cotización 05022025 NombreEnFilename - Isoroof 3G 50mm.ods',
    filepath: '/dropbox/test/archivo.ods',
    sheetData: {
      cliente_nombre: 'Nombre Real Desde Sheet',
    },
  };
  const lead = normalizeLead(raw);
  assert.ok(lead !== null);
  assert.strictEqual(lead.cliente_nombre, 'Nombre Real Desde Sheet');
});

// Test 8: Idempotencia — mismo filepath genera mismo lead_id
test('lead_id es estable para el mismo filepath', () => {
  const raw = {
    filename: 'Cotización 01012025 Cliente - ISODEC EPS 100mm.ods',
    filepath: '/dropbox/2025/cliente/archivo.ods',
    sheetData: {},
  };
  const lead1 = normalizeLead(raw);
  const lead2 = normalizeLead(raw);
  assert.strictEqual(lead1.lead_id, lead2.lead_id);
});

// Test 9: Detección de cámara frigorífica desde filename
test('detecta scenario camara_frig desde filename', () => {
  const raw = {
    filename: 'Cotización 01122025 BASE - CÁMARA FRIGORÍFICA EPS - Pared 100 mm.ods',
    filepath: '/dropbox/test/camara.ods',
    sheetData: {},
  };
  const lead = normalizeLead(raw);
  assert.ok(lead !== null);
  assert.strictEqual(lead.scenario, 'camara_frig');
});

// Test 10: lista_precios "venta" normalizado
test('normaliza lista_precios "lista venta" a "venta"', () => {
  const raw = {
    filename: 'Cotización 10102025 Cliente - Isodec EPS 200mm.ods',
    filepath: '/dropbox/test/lv.ods',
    sheetData: {
      lista_precios: 'lista venta',
    },
  };
  const lead = normalizeLead(raw);
  assert.strictEqual(lead.lista_precios, 'venta');
});

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
