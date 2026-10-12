import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  inferQuoteIntentFromUserText,
  buildQuoteIntentConflict,
} from "../server/lib/quotePayloadValidator.js";

describe("buildQuote intent guard", () => {
  it("detects presupuesto libre from WA panel paste", () => {
    const text = "cotices 2 paneles de 2,45 de 100mm y súmame 9 metros de ángulo de aluminio";
    assert.equal(inferQuoteIntentFromUserText(text), "presupuesto_libre");
    const err = buildQuoteIntentConflict(
      { scenario: "camara_frig", pared: {}, camara: {} },
      text,
    );
    assert.match(err, /presupuesto libre/);
  });

  it("allows matching techo buildQuote", () => {
    assert.equal(
      buildQuoteIntentConflict(
        { scenario: "solo_techo" },
        "cotizame un techo ISODEC 100",
      ),
      null,
    );
  });

  it("rejects cámara when user asked for techo", () => {
    const err = buildQuoteIntentConflict(
      { scenario: "camara_frig" },
      "Necesito un techo ISODEC",
    );
    assert.match(err, /no coincide/);
  });
});
