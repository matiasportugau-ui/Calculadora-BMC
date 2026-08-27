/**
 * In-memory pg stand-in for transportista ensure + live + roster tests.
 * Interprets the shipped CREATE/SELECT/INSERT/UPDATE strings; not a second live loader.
 */
import crypto from "node:crypto";

function uuid() {
  return crypto.randomUUID();
}

function tableFromCreate(sql) {
  const m = String(sql).match(/create table if not exists\s+([a-z0-9_]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function missing(name) {
  const err = new Error(`relation "${name}" does not exist`);
  err.code = "42P01";
  return err;
}

function colsFromInsert(sql) {
  const m = String(sql).match(/insert into\s+[a-z0-9_]+\s*\(([^)]+)\)/i);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim().replace(/"/g, "").toLowerCase());
}

function tableFromInsert(sql) {
  const m = String(sql).match(/insert into\s+([a-z0-9_]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function tableFromUpdate(sql) {
  const m = String(sql).match(/update\s+([a-z0-9_]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function tableFromSelect(sql) {
  const m = String(sql).match(/from\s+([a-z0-9_]+)/i);
  return m ? m[1].toLowerCase() : null;
}

export function createTransportistaMemoryPool() {
  const tables = new Set();
  const rows = {
    trips: [],
    trip_events: [],
    driver_sessions: [],
    outbox_notifications: [],
    customer_track_tokens: [],
    chofer_roster: [],
    chofer_sessions: [],
  };

  return {
    tables,
    rows,
    async query(sql, params = []) {
      const raw = String(sql);
      const n = raw.replace(/\s+/g, " ").trim();
      const low = n.toLowerCase();

      if (low.startsWith("create extension")) return { rows: [] };
      if (low.startsWith("create unique index") || low.startsWith("create index")) return { rows: [] };
      if (low.startsWith("create or replace view") || low.startsWith("create view")) return { rows: [] };

      if (low.startsWith("create table")) {
        const t = tableFromCreate(raw);
        if (t) tables.add(t);
        return { rows: [] };
      }

      if (low.startsWith("insert into")) {
        const t = tableFromInsert(raw);
        if (!t) return { rows: [] };
        if (!tables.has(t)) throw missing(t);
        const cols = colsFromInsert(raw);
        const rec = {};
        cols.forEach((c, i) => {
          rec[c] = params[i];
        });
        if (t === "trips" && !rec.trip_id) rec.trip_id = uuid();
        if (t === "chofer_roster" && !rec.chofer_id) rec.chofer_id = uuid();
        if (t === "chofer_sessions" && !rec.session_id) rec.session_id = uuid();
        if (t === "customer_track_tokens" && !rec.token_id) rec.token_id = uuid();
        if (t === "trips") {
          rec.status = rec.status || "draft";
          rec.plan_snapshot =
            typeof rec.plan_snapshot === "string" ? JSON.parse(rec.plan_snapshot) : rec.plan_snapshot || {};
          rec.closed_at = rec.closed_at || null;
          rec.updated_at = rec.updated_at || new Date().toISOString();
        }
        if (t === "customer_track_tokens" && typeof rec.public_snapshot === "string") {
          rec.public_snapshot = JSON.parse(rec.public_snapshot);
        }
        if (!rows[t]) rows[t] = [];
        rows[t].push(rec);
        return { rows: [rec] };
      }

      if (low.startsWith("update")) {
        const t = tableFromUpdate(raw);
        if (!tables.has(t)) throw missing(t);
        const list = rows[t] || [];
        let rowCount = 0;
        if (t === "trips" && /assigned_driver_id/i.test(raw)) {
          const tripId = params[0];
          const driverId = params[1];
          const phone = params[2];
          for (const r of list) {
            if (String(r.trip_id) === String(tripId)) {
              r.assigned_driver_id = driverId;
              if (phone !== undefined) r.assigned_phone_e164 = phone;
              r.status = r.status === "draft" ? "assigned" : r.status;
              r.updated_at = new Date().toISOString();
              rowCount += 1;
            }
          }
        }
        return { rows: [], rowCount };
      }

      if (low.startsWith("select")) {
        const t = tableFromSelect(raw);
        if (t && !tables.has(t)) throw missing(t);
        const list = (t && rows[t]) || [];

        if (t === "trips" && /closed_at is null/i.test(raw)) {
          return {
            rows: list.filter(
              (r) => !r.closed_at && ["draft", "assigned", "confirmed"].includes(String(r.status || "draft")),
            ),
          };
        }
        if (t === "trip_events") {
          const ids = params[0];
          if (Array.isArray(ids)) {
            return { rows: list.filter((r) => ids.map(String).includes(String(r.trip_id))) };
          }
          if (params[0]) {
            return { rows: list.filter((r) => String(r.trip_id) === String(params[0])) };
          }
          return { rows: list };
        }
        if (t === "chofer_roster") {
          if (/lower\(email\)/i.test(raw) || /email = \$/i.test(raw)) {
            const email = String(params[0] || "").toLowerCase();
            return { rows: list.filter((r) => String(r.email || "").toLowerCase() === email) };
          }
          if (/phone_e164/i.test(raw)) {
            return { rows: list.filter((r) => String(r.phone_e164 || "") === String(params[0] || "")) };
          }
          if (/chofer_id = \$/i.test(raw)) {
            return { rows: list.filter((r) => String(r.chofer_id) === String(params[0])) };
          }
          return { rows: list };
        }
        if (t === "trips" && /assigned_driver_id/i.test(raw) && !/closed_at is null/i.test(raw)) {
          return { rows: list.filter((r) => String(r.assigned_driver_id) === String(params[0])) };
        }
        if (t === "trips" && /trip_id = \$/i.test(raw) && params[0]) {
          return { rows: list.filter((r) => String(r.trip_id) === String(params[0])) };
        }
        if (t === "customer_track_tokens") {
          if (/quote_ref/i.test(raw)) {
            const ref = String(params[0] || "");
            const hit = list
              .filter((r) => String(r.quote_ref || "") === ref && !r.revoked_at)
              .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
            return { rows: hit.slice(0, 1) };
          }
          if (/token_hash/i.test(raw)) {
            return { rows: list.filter((r) => r.token_hash === params[0] && !r.revoked_at) };
          }
        }
        if (t === "chofer_sessions" && /token_hash/i.test(raw)) {
          return { rows: list.filter((r) => r.token_hash === params[0] && !r.revoked_at) };
        }
        return { rows: list };
      }

      return { rows: [] };
    },
  };
}
