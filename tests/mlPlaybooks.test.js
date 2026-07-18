import assert from "node:assert/strict";
import { buildMlPlaybooks } from "../server/lib/mlPlaybooks.js";

const result = buildMlPlaybooks();
assert.ok(Array.isArray(result.items));
assert.ok(result.items.length >= 2, "expected playbooks from ml_pulse + price gaps");
assert.ok(result.summary);
assert.equal(typeof result.generated_at, "string");
assert.ok(result.items.every((i) => i.id && i.action && i.priority));

const priorityRank = { alta: 0, media: 1, baja: 2 };
const ranks = result.items.map((item) => priorityRank[item.priority]);
assert.ok(
  ranks.every((rank, index) => index === 0 || ranks[index - 1] <= rank),
  "operator queue must keep alta before media before baja",
);

const unansweredQuestions = result.items.find(
  (item) =>
    item.source === "ml_pulse" &&
    item.title === "preguntas sin respuesta",
);
assert.equal(
  unansweredQuestions?.tab_hint,
  "questions",
  "question playbook must navigate to the questions tab",
);

const priceGapItems = result.items.filter(
  (item) => item.source === "product_matrix",
);
assert.ok(priceGapItems.length > 0, "expected actionable product price gaps");
assert.ok(priceGapItems.length <= 4, "price-gap playbooks must stay capped");
assert.ok(
  priceGapItems.every(
    (item) =>
      Math.abs(item.meta.delta_pct) >= 8 &&
      item.tab_hint === "listings",
  ),
  "price-gap playbooks must meet the materiality threshold and route to listings",
);
assert.match(
  result.summary,
  /47 preguntas sin responder/,
  "summary must preserve the ML pulse backlog count",
);
assert.deepEqual(result.sources, ["ml_pulse", "product_matrix"]);

console.log("mlPlaybooks tests passed");
