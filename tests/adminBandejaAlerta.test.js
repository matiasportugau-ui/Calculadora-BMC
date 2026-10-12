#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  alertaLabel,
  alertaLevel,
  antiguedadLabel,
  isWaCanal,
  parseAdminFecha,
  prioridadFromRow,
} from "../src/utils/adminBandejaCriteria.js";

const now = new Date(2026, 8, 11);

assert.equal(alertaLevel("11/09/2026", "Pendiente", now), "ok");
assert.equal(alertaLabel("ok"), "En plazo");
assert.equal(antiguedadLabel("11/09/2026", now), "hoy");
assert.equal(alertaLevel("01/09/2026", "Pendiente", now), "warn");
assert.equal(alertaLabel("warn"), "7+ días");
assert.equal(alertaLevel("20/08/2026", "Pendiente", now), "late");
assert.equal(alertaLabel("late"), "14+ días");
assert.equal(alertaLevel("01/08/2026", "Enviado", now), "ok");

assert.equal(prioridadFromRow({ fecha: "20/08/2026", estado: "Pendiente" }, now), "Alta");
assert.equal(prioridadFromRow({ fecha: "20/08/2026", estado: "Pendiente", urgencia: "Hoy" }, now), "Hoy");

assert.equal(isWaCanal("WA"), true);
assert.equal(isWaCanal("WA-Auto"), true);
assert.equal(isWaCanal("EM"), false);
assert.equal(isWaCanal("ML"), false);

const oct = new Date(2026, 9, 9);
assert.equal(parseAdminFecha("09-10", oct).getDate(), 9);
assert.equal(parseAdminFecha("09-10", oct).getMonth(), 9);
assert.equal(antiguedadLabel("09-10", oct), "hoy");
assert.equal(parseAdminFecha("08-01", oct).getFullYear(), 2026);
assert.equal(parseAdminFecha("08-01", oct).getMonth(), 0);
assert.equal(alertaLevel("01-09", "Pendiente", new Date(2026, 8, 11)), "warn");
assert.equal(alertaLevel("26-08", "Falta info", oct), "late");

console.log("adminBandejaAlerta.test.js ok");
