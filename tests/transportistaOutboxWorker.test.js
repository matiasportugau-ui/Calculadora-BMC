/**
 * transportista outbox worker — schema-missing soft-stop + helpers
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isOutboxSchemaMissingError,
  startTransportistaOutboxWorker,
} from "../server/lib/transportistaOutboxWorker.js";

describe("isOutboxSchemaMissingError", () => {
  it("detects Postgres 42P01", () => {
    assert.equal(isOutboxSchemaMissingError({ code: "42P01", message: "x" }), true);
  });
  it("detects message form from logs", () => {
    assert.equal(
      isOutboxSchemaMissingError({
        message: 'relation "outbox_notifications" does not exist',
      }),
      true,
    );
  });
  it("rejects unrelated errors", () => {
    assert.equal(isOutboxSchemaMissingError({ code: "57P01", message: "admin shutdown" }), false);
    assert.equal(isOutboxSchemaMissingError(null), false);
  });
});

describe("startTransportistaOutboxWorker schema missing", () => {
  it("stops after 42P01 and does not reconnect on later ticks", async () => {
    let connects = 0;
    const warns = [];
    const errors = [];
    const pool = {
      async connect() {
        connects += 1;
        const client = {
          on() {},
          async query() {
            const err = new Error('relation "outbox_notifications" does not exist');
            err.code = "42P01";
            throw err;
          },
          release() {},
        };
        return client;
      },
    };
    const logger = {
      info() {},
      warn(obj, msg) {
        warns.push({ obj, msg });
      },
      error(obj, msg) {
        errors.push({ obj, msg });
      },
    };
    const config = {
      transportistaOutboxDisabled: false,
      transportistaOutboxIntervalMs: 50,
      whatsappAccessToken: "tok",
      whatsappPhoneNumberId: "pid",
    };
    const stop = startTransportistaOutboxWorker({ config, logger, pool });
    // allow initial processBatch + a couple intervals
    await new Promise((r) => setTimeout(r, 180));
    stop();
    assert.ok(connects >= 1, "at least one connect");
    assert.ok(connects <= 2, `should not keep connecting every tick, got ${connects}`);
    assert.ok(
      warns.some((w) => String(w.msg || "").includes("schema missing")),
      "one schema-missing warn",
    );
    assert.equal(
      errors.filter((e) => String(e.msg || "").includes("outbox batch failed")).length,
      0,
      "no spam batch failed errors",
    );
  });

  it("does not start when TRANSPORTISTA_OUTBOX_DISABLED", () => {
    let connects = 0;
    const pool = {
      async connect() {
        connects += 1;
        return { on() {}, query: async () => ({ rows: [] }), release() {} };
      },
    };
    const stop = startTransportistaOutboxWorker({
      config: { transportistaOutboxDisabled: true, whatsappAccessToken: "t", whatsappPhoneNumberId: "p" },
      logger: { info() {}, warn() {}, error() {} },
      pool,
    });
    stop();
    assert.equal(connects, 0);
  });
});
