import assert from "node:assert/strict";
import test from "node:test";

import { classifySeedMovement } from "../server/lib/bancoSeedClassification.js";

const directionCases = [
  {
    name: "generic e-BROU transfer received is sale income",
    movement: { descripcion: "TRF E-BROU OTROS", debito: null, credito: 25_000 },
    expected: "ingreso_venta",
  },
  {
    name: "generic e-BROU transfer sent is operating expense",
    movement: { descripcion: "TRF E-BROU OTROS", debito: 25_000, credito: null },
    expected: "egreso_operativo",
  },
  {
    name: "provider-labelled transfer received does not become supplier expense",
    movement: { descripcion: "trf spi pago prov.", debito: 0, credito: 9_500 },
    expected: "ingreso_venta",
  },
  {
    name: "provider-labelled transfer sent is supplier expense",
    movement: { descripcion: "TRF SPI PAGO PROV.", debito: 9_500, credito: 0 },
    expected: "egreso_proveedor",
  },
  {
    name: "partner transfer received is a contribution",
    movement: { descripcion: "Transferencia", asunto: "Matías Portugau Pons", credito: 40_000 },
    expected: "aporte_socio",
  },
  {
    name: "partner transfer sent is a withdrawal",
    movement: { descripcion: "Transferencia", asunto: "MATIAS PORTUGAU PONS", debito: 40_000 },
    expected: "retiro_socio",
  },
];

for (const { name, movement, expected } of directionCases) {
  test(name, () => {
    assert.deepEqual(classifySeedMovement(movement), {
      categoria: expected,
      entidad: null,
    });
  });
}

test("description direction takes precedence over a counterparty label", () => {
  const result = classifySeedMovement({
    descripcion: "TRF E-BROU OTROS",
    asunto: "MATIAS",
    credito: 12_000,
  });

  assert.equal(result?.categoria, "ingreso_venta");
});

test("falls back to seeded database rules after direction-aware checks", () => {
  const fallbackRule = {
    pattern: "SPI - COMISION",
    categoria: "egreso_financiero",
    entidad: "BROU",
    priority: 70,
  };

  assert.strictEqual(
    classifySeedMovement(
      { descripcion: "SPI - COMISIÓN BROU", debito: 120, credito: null },
      [fallbackRule],
    ),
    fallbackRule,
  );
});

test("leaves unmatched movements unclassified", () => {
  assert.equal(
    classifySeedMovement(
      { descripcion: "MOVIMIENTO SIN REGLA", asunto: "", debito: 100, credito: null },
      [],
    ),
    null,
  );
});
