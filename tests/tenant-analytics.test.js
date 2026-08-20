import test from "node:test";
import assert from "node:assert/strict";
import {
  LIVE_ACTIONS,
  ONLINE_MS,
  getTenantAnalytics,
  getTenantFunnel,
  getTenantLive,
  getTenantSessions,
  pairSessions,
  presenceLight,
} from "../server/lib/tenantAnalytics.js";
import { displayPerson, memberInviteView } from "../src/utils/tenantInviteView.js";

test("presenceLight: paused beats last event", () => {
  assert.equal(presenceLight({ paused: true, lastAt: new Date() }).light, "paused");
});

test("presenceLight: online / recent / silent from lastAt", () => {
  const now = Date.parse("2026-08-19T20:00:00Z");
  assert.equal(presenceLight({ lastAt: now - 60_000, now }).light, "online");
  assert.equal(presenceLight({ lastAt: now - ONLINE_MS - 1, now }).light, "recent");
  assert.equal(presenceLight({ lastAt: now - 48 * 3600_000, now }).light, "silent");
  assert.equal(presenceLight({ lastAt: null, now }).light, "silent");
});

test("getTenantAnalytics SQL is scoped to one slug", async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (/percentile_cont/.test(sql)) return { rows: [{ median_ms: 120000, avg_ms: 180000, sessions: 2 }] };
      if (/outcome = 'failure'/.test(sql) && /as failures/.test(sql) && /as total/.test(sql)) {
        return { rows: [{ failures: 0, successes: 10, total: 10 }] };
      }
      if (/date_trunc/.test(sql)) return { rows: [] };
      if (/group by l.action/.test(sql)) return { rows: [] };
      return { rows: [{ events: 10, users: 2 }] };
    },
  };
  const a = await getTenantAnalytics(pool, {
    slug: "bc",
    from: "2026-08-01T00:00:00Z",
    to: "2026-08-19T00:00:00Z",
  });
  assert.equal(a.users, 2);
  assert.equal(a.time_in_app.estimated, true);
  assert.ok(calls.length >= 4);
  for (const c of calls) {
    assert.equal(c.params[0], "bc");
    assert.match(c.sql, /payload->>'tenant'/);
  }
});

test("getTenantFunnel only counts wizard.step of that slug", async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (/wizard.step/.test(sql)) {
        return { rows: [{ step: "1", label: "Proyecto", events: 4, users: 2 }, { step: "0", label: "Inicio", events: 8, users: 3 }] };
      }
      if (/export.pdf/.test(sql)) return { rows: [{ events: 1, users: 1 }] };
      return { rows: [{ users: 5 }] };
    },
  };
  const f = await getTenantFunnel(pool, { slug: "paneleslam", from: "a", to: "b" });
  assert.equal(f.steps[0].step, "0");
  assert.equal(f.pdf.users, 1);
  assert.equal(calls[0].params[0], "paneleslam");
  assert.match(calls[0].sql, /tenant.wizard.step/);
});

test("getTenantLive marks recent who as online and names visitors", async () => {
  const now = new Date("2026-08-19T20:00:00Z");
  const pool = {
    query: async (sql, params) => {
      assert.equal(params[0], "bc");
      if (/tenant_members/.test(sql)) {
        return { rows: [{ email: "a@b.com", name: "Ana Test", role: "user", claimed_at: "2026-08-18" }] };
      }
      assert.match(sql, /payload->>'tenant'/);
      assert.match(sql, /action = any/);
      if (Array.isArray(params[1])) {
        assert.equal(params[1].includes("tenant.session.ping"), true);
        assert.equal(params[1].includes("tenant.member.invite"), false);
      }
      return {
        rows: [
          { who: "a@b.com", email: "a@b.com", ip: null, last_at: "2026-08-19T19:58:00Z", last_action: "tenant.ui.click", path: "/", step: "Proyecto", last_click: "PDF", quote_code: "BC-1" },
          { who: "179.1.2.3", email: null, ip: "179.1.2.3", last_at: "2026-08-18T21:00:00Z", last_action: "tenant.nav.route", path: "/", step: null, last_click: null, quote_code: null },
        ],
      };
    },
  };
  const live = await getTenantLive(pool, { slug: "bc", now });
  assert.equal(live.online, 1);
  assert.equal(live.items[0].title, "Ana Test");
  assert.equal(live.items[0].light, "online");
  assert.equal(live.items[1].title, "Visitante no identificado");
  assert.match(live.items[1].subtitle, /179\.1\.2\.3/);
  assert.equal(live.items[1].light, "recent");
});

test("live counts ping; invite rows stay off the live feed", () => {
  assert.equal(LIVE_ACTIONS.includes("tenant.session.ping"), true);
  assert.equal(LIVE_ACTIONS.includes("tenant.member.invite"), false);
});

test("invite copy is accepted vs not", () => {
  const pending = memberInviteView({ invited_email: "bc.montajes@gmail.com", claimed_at: null, created_at: "2026-08-18", role: "owner" });
  assert.equal(pending.accepted, false);
  assert.equal(pending.label, "Invitación no aceptada");
  const ok = memberInviteView({ invited_email: "a@b.com", claimed_at: "2026-08-19", name: "Ana", role: "user" });
  assert.equal(ok.accepted, true);
  assert.equal(ok.name, "Ana");
});

test("displayPerson never titles an IP as the user", () => {
  const v = displayPerson({ who: "179.24.249.172", ip: "179.24.249.172" });
  assert.equal(v.title, "Visitante no identificado");
  assert.equal(displayPerson({ name: "Ramiro", email: "r@x.com" }).title, "Ramiro");
});

test("pairSessions matches start then end per user and keeps duration", () => {
  const rows = pairSessions([
    { who: "a@b.com", email: "a@b.com", action: "tenant.session.start", at: "2026-08-19T12:00:00Z" },
    { who: "a@b.com", email: "a@b.com", action: "tenant.session.end", at: "2026-08-19T12:10:00Z" },
    { who: "a@b.com", email: "a@b.com", action: "tenant.session.start", at: "2026-08-19T13:00:00Z" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].open, true);
  assert.equal(rows[1].duration_ms, 10 * 60 * 1000);
  assert.equal(rows[1].egreso, "2026-08-19T12:10:00Z");
});

test("getTenantSessions SQL stays on one slug", async () => {
  const pool = {
    query: async (sql, params) => {
      assert.equal(params[0], "bc");
      if (/tenant_members/.test(sql)) return { rows: [] };
      assert.match(sql, /payload->>'tenant'/);
      assert.equal(params[1].includes("tenant.session.start"), true);
      assert.equal(params[1].includes("tenant.session.ping"), false);
      return { rows: [] };
    },
  };
  const s = await getTenantSessions(pool, { slug: "bc", from: "a", to: "b" });
  assert.equal(s.sessions.length, 0);
});
