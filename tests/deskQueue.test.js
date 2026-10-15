// Desk queue — Hito 1 D1/D6/D10/D11. Run: node --test tests/deskQueue.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEditCause,
  buildWaLink,
  EDIT_CAUSES,
  __test__,
  listQueue,
  getReview,
  createReview,
  saveEditCause,
  approveSend,
  markStatus,
} from "../server/lib/deskQueue.js";

function memPool() {
  const rows = [];
  let n = 0;
  return {
    rows,
    async query(text, params = []) {
      if (text.includes("insert into desk_reviews")) {
        const r = {
          id: `r-${++n}`,
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _full: {
            id: `r-${n}`,
            quote_id: params[0],
            conversation_id: params[1],
            contact_id: params[2],
            channel: params[3],
            matriz_version: params[4],
            payload: JSON.parse(params[5]),
            interp: JSON.parse(params[6]),
            faltantes: JSON.parse(params[7]),
            causa: {},
            status: "pending",
            wa_link: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        };
        rows.push(r._full);
        return { rows: [{ id: r.id, status: "pending", created_at: r.created_at, updated_at: r.updated_at }] };
      }
      if (text.includes("from desk_reviews\n      where status in")) {
        return { rows: rows.filter((r) => ["pending", "approved"].includes(r.status)) };
      }
      if (text.includes("from desk_reviews where id = $1")) {
        return { rows: rows.filter((r) => r.id === params[0]) };
      }
      if (text.includes("set causa = causa || $2::jsonb")) {
        assert.match(text, /status = any\(\$4::text\[\]\)/, "edit-cause SQL must guard status");
        const r = rows.find((x) => x.id === params[0]);
        if (!r || !params[3].includes(r.status)) return { rows: [] };
        r.causa = { ...r.causa, ...JSON.parse(params[1]) };
        if (params[2]) r.payload = { ...r.payload, ...JSON.parse(params[2]) };
        r.status = "pending";
        r.updated_at = new Date().toISOString();
        return { rows: [{ id: r.id, causa: r.causa, status: r.status, updated_at: r.updated_at }] };
      }
      if (text.includes("set status = 'approved'")) {
        const r = rows.find((x) => x.id === params[0]);
        if (!r || !["pending", "approved"].includes(r.status)) return { rows: [] };
        r.status = "approved";
        r.wa_link = params[1];
        r.updated_at = new Date().toISOString();
        return { rows: [{ id: r.id, status: r.status, wa_link: r.wa_link, updated_at: r.updated_at }] };
      }
      if (text.includes("set status = $2")) {
        assert.match(text, /status = any\(\$4::text\[\]\)/, "markStatus SQL must guard status");
        const r = rows.find((x) => x.id === params[0]);
        if (!r || !params[3].includes(r.status)) return { rows: [] };
        r.status = params[1];
        r.causa = { ...r.causa, ...JSON.parse(params[2]) };
        r.updated_at = new Date().toISOString();
        return { rows: [{ id: r.id, status: r.status, updated_at: r.updated_at }] };
      }
      throw new Error(`unmocked: ${text.slice(0, 80)}`);
    },
  };
}

describe("desk pure helpers (D10/D13)", () => {
  it("causa desconocida cae a otro, nunca tira", () => {
    assert.equal(normalizeEditCause({ causa: "invento" }).causa, "otro");
    assert.ok(EDIT_CAUSES.includes("precio"));
  });
  it("wa.me solo dígitos, 1 clic sin auto-envío", () => {
    assert.equal(buildWaLink("+598 99 123 456", "hola").startsWith("https://wa.me/59899123456"), true);
    assert.throws(() => buildWaLink("abc", "x"), /invalid_phone/);
  });
});

describe("desk queue flow (D1/D6/D11)", () => {
  it("bloquea borrador sin matriz_version (D6)", async () => {
    await assert.rejects(() => createReview({ payload: {} }, memPool()), /matriz_snapshot_required/);
  });
  it("crea → edita con causa → aprueba → vende", async () => {
    const p = memPool();
    const c = await createReview({ matrizVersion: "2026-10-13-v1", payload: { total: 100 } }, p);
    assert.equal(c.status, "pending");
    const q = await listQueue({}, p);
    assert.equal(q.length, 1);
    const e = await saveEditCause({ id: q[0].id, causa: "precio", detalle: "ajuste", payloadPatch: { total: 110 } }, p);
    assert.equal(e.causa.causa, "precio");
    const a = await approveSend({ id: q[0].id, phoneE164: "+59899123456", text: "presupuesto" }, p);
    assert.equal(a.status, "approved");
    assert.ok(a.wa_link.includes("wa.me"));
    const s = await markStatus({ id: q[0].id, status: "sold", extra: { monto: 110 } }, p);
    assert.equal(s.status, "sold");
    const gone = await listQueue({}, p);
    assert.equal(gone.length, 0);
  });
  it("getReview 404-friendly", async () => {
    assert.equal(await getReview({ id: "nope" }, memPool()), null);
  });
  it("edit-cause conserva datos de venta y no reabre reviews finales (D14)", async () => {
    const p = memPool();
    const c = await createReview({ matrizVersion: "v1", payload: {} }, p);
    await approveSend({ id: c.id, phoneE164: "+59899123456", text: "x" }, p);
    await markStatus({ id: c.id, status: "sold", extra: { monto: 110, causa: "forjada" } }, p);
    assert.equal(p.rows[0].causa.monto, 110);
    assert.notEqual(p.rows[0].causa.causa, "forjada", "extra cannot overwrite edit-cause keys");
    await assert.rejects(
      () => saveEditCause({ id: c.id, causa: "precio" }, p),
      (e) => e.status === 409 && e.message === "review_not_editable",
    );
    await assert.rejects(
      () => approveSend({ id: c.id, phoneE164: "+59899123456", text: "x" }, p),
      (e) => e.status === 409 && e.message === "review_not_approvable",
    );
    assert.equal(p.rows[0].status, "sold");
  });
  it("markStatus exige transición válida (409) y distingue 404", async () => {
    const p = memPool();
    const c = await createReview({ matrizVersion: "v1", payload: {} }, p);
    await assert.rejects(() => markStatus({ id: c.id, status: "sent" }, p), (e) => e.status === 409);
    await assert.rejects(() => markStatus({ id: c.id, status: "pending" }, p), (e) => e.status === 400);
    await assert.rejects(() => markStatus({ id: "nope", status: "sold" }, p), (e) => e.status === 404);
    const d = await markStatus({ id: c.id, status: "discarded" }, p);
    assert.equal(d.status, "discarded");
  });
  it("markStatus rechaza estado inválido", async () => {
    await assert.rejects(() => markStatus({ id: "x", status: "hack" }, memPool()), /invalid_status/);
  });
});
