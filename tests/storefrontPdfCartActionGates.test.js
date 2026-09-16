// PDF tool result → Shopify cart action + /chat empty-turn gate.
// Complementary to storefrontQuoteCart / storefrontChatHistoryGates / storefrontVoicePack.
// Run: node tests/storefrontPdfCartActionGates.test.js

import assert from "node:assert/strict";
import {
  cartActionFromPdfToolResult,
  parseStorefrontToolArgs,
  runStorefrontTextTurn,
} from "../server/lib/voice/storefrontChat.js";

{
  const obj = { variant_id: 9, quantity: 2 };
  assert.equal(parseStorefrontToolArgs(obj), obj, "object args pass through");
  assert.deepEqual(parseStorefrontToolArgs('{"handle":"isodec"}'), { handle: "isodec" });
  assert.deepEqual(parseStorefrontToolArgs("not-json"), {}, "invalid JSON → {}");
  assert.deepEqual(parseStorefrontToolArgs(""), {});
  assert.deepEqual(parseStorefrontToolArgs(null), {});
}

assert.equal(cartActionFromPdfToolResult("not-json", "c1"), null);
assert.equal(cartActionFromPdfToolResult('{"ok":true}', "c1"), null);
assert.equal(cartActionFromPdfToolResult('{"cart_lines":"nope"}', "c1"), null);
assert.equal(cartActionFromPdfToolResult('{"cart_lines":[]}', "c1"), null);

{
  const action = cartActionFromPdfToolResult(
    JSON.stringify({
      ok: true,
      cart_lines: [{ handle: "isopanel-isodec-eps-cubiertas-bmc-reloaded", quantity: 90 }],
      pdf_url: "https://files.example/p.pdf",
      code: "P-88",
    }),
    "call_9",
  );
  assert.deepEqual(action, {
    id: "call_9-cart",
    name: "add_quote_to_cart",
    payload: {
      lines: [{ handle: "isopanel-isodec-eps-cubiertas-bmc-reloaded", quantity: 90 }],
      pdf_url: "https://files.example/p.pdf",
      code: "P-88",
    },
  });
}

{
  const viaAlias = cartActionFromPdfToolResult(
    JSON.stringify({
      cart_lines: [{ handle: "cinta-butilo", quantity: 1 }],
      pdf_file_url: "https://files.example/alias.pdf",
    }),
    "pdf1",
  );
  assert.equal(viaAlias.payload.pdf_url, "https://files.example/alias.pdf");
  assert.equal(viaAlias.payload.code, "");
}

{
  const both = cartActionFromPdfToolResult(
    JSON.stringify({
      cart_lines: [{ handle: "cinta-butilo", quantity: 1 }],
      pdf_url: "https://files.example/wins.pdf",
      pdf_file_url: "https://files.example/alias.pdf",
    }),
    "pdf2",
  );
  assert.equal(both.payload.pdf_url, "https://files.example/wins.pdf", "pdf_url wins over pdf_file_url");
}

{
  const stillEmits = cartActionFromPdfToolResult(
    JSON.stringify({
      ok: false,
      error: "pdf failed",
      cart_lines: [{ handle: "cinta-butilo", quantity: 1 }],
    }),
    "pdf3",
  );
  assert.equal(stillEmits.name, "add_quote_to_cart", "current: cart_lines still emit even if ok:false — pin, do not drop");
}

{
  let threw = false;
  try {
    await runStorefrontTextTurn({
      message: "   ",
      history: [],
      pack: { tools: [], instructions: "shopper" },
      runServerTool: async () => {
        throw new Error("must not call tools on empty chat");
      },
    });
  } catch (err) {
    threw = true;
    assert.equal(err.status, 400);
    assert.match(err.message, /Escribí una consulta/);
  }
  assert.equal(threw, true);
}

console.log("storefrontPdfCartActionGates.test.js: ok");
