import assert from "node:assert/strict";
import { isCurrentAdminIngresoRequest } from "../src/hooks/useAdminIngreso.js";

const row42FirstRequest = { id: 1, row: 42 };
const row57SecondRequest = { id: 2, row: 57 };

assert.equal(
  isCurrentAdminIngresoRequest(row42FirstRequest, row42FirstRequest),
  true,
  "the active request for the same row can update state",
);

assert.equal(
  isCurrentAdminIngresoRequest(row57SecondRequest, row42FirstRequest),
  false,
  "a stale request from a previously selected row cannot update state",
);

assert.equal(
  isCurrentAdminIngresoRequest({ id: 1, row: 57 }, row42FirstRequest),
  false,
  "matching request ids still require the same row",
);

assert.equal(
  isCurrentAdminIngresoRequest(null, row42FirstRequest),
  false,
  "missing active request is never current",
);

assert.equal(
  isCurrentAdminIngresoRequest(row42FirstRequest, null),
  false,
  "missing candidate request is never current",
);

console.log("adminIngresoRequestGuard: ok");
