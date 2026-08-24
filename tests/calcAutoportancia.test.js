/**
 * calcAutoportancia: `ap` is max span between support lines; lmin/lmax are
 * commercial fabrication length. Do not treat lmin/lmax as structural span.
 * Injected panel — no live catalog USD / ap pins.
 * Run: node tests/calcAutoportancia.test.js
 */
import { calcAutoportancia } from "../src/utils/calculations.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  fn();
}

/** Colonial-shaped: ap 3.0 m < lmin 3.5 m < lmax 8.5 m */
const colonialLike = {
  lmin: 3.5,
  lmax: 8.5,
  esp: { 40: { ap: 3.0 } },
};

group("supports use ap, not lmin/lmax", () => {
  const atAp = calcAutoportancia(colonialLike, 40, 3.0);
  assert(atAp.ok === true, "largo === ap → ok");
  assert(atAp.maxSpan === 3.0, "maxSpan is ap");
  assert(atAp.apoyos === 2, "apoyos = ceil(3/3 + 1) = 2");
  assert(atAp.largoMinOK === false, "3.0 m < lmin 3.5 → fabrication short");
  assert(atAp.largoMaxOK === true, "3.0 m ≤ lmax");

  const inFabOverAp = calcAutoportancia(colonialLike, 40, 6.0);
  assert(inFabOverAp.ok === false, "6 m > ap 3 m → not self-supporting");
  assert(inFabOverAp.apoyos === 3, "apoyos = ceil(6/3 + 1) = 3");
  assert(inFabOverAp.largoMinOK === true && inFabOverAp.largoMaxOK === true, "6 m is inside lmin/lmax");
});

group("lmin/lmax must not be used as span", () => {
  const overLmax = calcAutoportancia(colonialLike, 40, 9.0);
  assert(overLmax.ok === false, "9 m > ap → ok false (even if someone used lmax as span)");
  assert(overLmax.largoMaxOK === false, "9 m > lmax 8.5");
  assert(overLmax.apoyos === 4, "apoyos = ceil(9/3 + 1) = 4");

  const belowLminWithinAp = calcAutoportancia(colonialLike, 40, 2.5);
  assert(belowLminWithinAp.ok === true, "2.5 m ≤ ap → structurally ok");
  assert(belowLminWithinAp.largoMinOK === false, "2.5 m < lmin");
  assert(belowLminWithinAp.apoyos === 2, "apoyos = ceil(2.5/3 + 1) = 2");
});

group("missing ap / unknown espesor is fail-open (existing contract)", () => {
  const noAp = calcAutoportancia({ lmin: 3, lmax: 12, esp: { 100: {} } }, 100, 20);
  assert(noAp.ok === true && noAp.apoyos === null && noAp.maxSpan === null, "missing ap → ok, apoyos null");
  assert(noAp.largoMinOK === true && noAp.largoMaxOK === true, "missing ap does not evaluate lmin/lmax");

  const missingEsp = calcAutoportancia(colonialLike, 80, 6);
  assert(missingEsp.ok === true && missingEsp.apoyos === null, "unknown espesor → same fail-open");
});

console.log(`\ncalcAutoportancia: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
