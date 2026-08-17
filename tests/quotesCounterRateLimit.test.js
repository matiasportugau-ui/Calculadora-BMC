/**
 * Bug EF — POST /api/quotes/counter/next must be rate-limited (public, no auth).
 * Calculator "Confirmar presupuesto" is anonymous, so we cannot require JWT;
 * we must still bound anonymous burns of BMC-YYYY-NNNN.
 *
 * Run: node tests/quotesCounterRateLimit.test.js
 */
import assert from "node:assert/strict";
import { QUOTE_COUNTER_NEXT_RATE, createQuotesRouter } from "../server/routes/quotes.js";

assert.ok(QUOTE_COUNTER_NEXT_RATE.windowMs >= 60_000, "window at least 1 min");
assert.ok(QUOTE_COUNTER_NEXT_RATE.max <= 20, "tight max so scripted burns are blocked");
assert.ok(QUOTE_COUNTER_NEXT_RATE.max >= 5, "room for legitimate confirm retries");

const router = createQuotesRouter({ databaseUrl: null });
const layer = router.stack.find(
  (l) => l.route?.path === "/quotes/counter/next" && l.route?.methods?.post,
);
assert.ok(layer, "POST /quotes/counter/next registered");
// express.Route stacks: [limiter?, handler]. Limiter is a non-route layer with handle.length >= 3
// or named; count handlers on the route.
const handlers = layer.route.stack.map((s) => s.handle);
assert.ok(handlers.length >= 2, "rate limiter + handler must both be mounted");
assert.equal(typeof handlers[0], "function");
assert.equal(typeof handlers[handlers.length - 1], "function");

console.log("quotesCounterRateLimit.test.js: ok");
