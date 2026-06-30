/**
 * cockpit-e2e — Interactive E2E for the WA Cockpit (/hub/wa) against PROD, with a
 * single configurable AGGRESSIVENESS knob that escalates through 3 fail-closed levels.
 * ─────────────────────────────────────────────────────────────────────────────
 * Why prod (and why "local" is no safer): dev:full's DATABASE_URL is the same
 * Supabase Postgres and the cockpit reads/writes the same shared CRM_Operativo
 * Sheet as prod. The safety lever is *which endpoints we call*, not *where*.
 *
 *   COCKPIT_E2E_LEVEL=0  (default, CI)  read-only: load /hub/wa, exercise queue
 *                                       reads, assert no 401/403/5xx + no console
 *                                       errors. ZERO writes.
 *   COCKPIT_E2E_LEVEL=1  + writes:       approval / quote-link / mark-sent against
 *                                       ONE reserved sentinel row; snapshot→restore.
 *                                       NEVER send-approved / sync-*.
 *   COCKPIT_E2E_LEVEL=2  + guarded send: send-approved, but only after verifying the
 *                                       row's destination == COCKPIT_E2E_TEST_TARGET.
 *
 * Auth model (the subtle bit): the cockpit API wants `Authorization: Bearer <JWT>`
 * (see server/middleware/requireCrmCockpitAuth.js + src/utils/cockpitOperatorFetch.js).
 * `bmc_sess` is only the *refresh* cookie; the SPA trades it ONCE at /auth/refresh
 * for a short-lived access JWT held in React memory. We inject bmc_sess, let the SPA
 * do its single refresh on load, and capture the access token from that response —
 * then issue authed in-page fetches with it. We NEVER refresh twice (rotation +
 * reuse-detection would kill the session).
 *
 * Usage:
 *   TOUR_SESSION_COOKIE="$(node scripts/mint-tour-session.mjs)" \
 *   COCKPIT_E2E_LEVEL=0 \
 *   npx playwright test -c playwright.cockpit.config.ts scripts/cockpit-e2e.spec.ts
 *
 * Levels 1-2 also require (else the run ABORTS before any mutation):
 *   COCKPIT_E2E_TEST_ROW=<n>=4>            reserved sentinel row in CRM_Operativo
 *   GOOGLE_APPLICATION_CREDENTIALS=<path>  service-account JSON (for snapshot/restore)
 *   COCKPIT_E2E_TEST_TARGET=<dest>         (L2 only) controlled phone / Q:id / email
 *   BMC_SHEET_ID=<id>                      the CRM spreadsheet id
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { isSi, extractMlQuestionId } from "../server/lib/crmRowParse.js";
import { loadSheets, captureTail, restoreTail } from "./lib/cockpit-sentinel-restore.mjs";

const BASE = (process.env.PLAYWRIGHT_BASE_URL || "https://calculadora-bmc.vercel.app").replace(/\/+$/, "");
const COOKIE = process.env.TOUR_SESSION_COOKIE || "";
const COOKIE_DOMAIN = new URL(BASE).hostname;
const LEVEL = Number.parseInt(process.env.COCKPIT_E2E_LEVEL || "0", 10) || 0;
const TEST_ROW = Number.parseInt(process.env.COCKPIT_E2E_TEST_ROW || "", 10);
const TEST_TARGET = (process.env.COCKPIT_E2E_TEST_TARGET || "").trim();
const GAC = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
const SENTINEL_MARKER = "[E2E-SENTINEL]";

// Console noise that is NOT a cockpit defect. We can't observe prod from here, and
// real pages emit ambient console.error (3rd-party assets, analytics, CSP reports).
// Genuine breakage still surfaces: uncaught exceptions arrive via `pageerror` (never
// benign), and auth/API failures are asserted separately via the read-status checks.
const BENIGN_CONSOLE = [
  /favicon\.ico/i,
  /ResizeObserver loop/i,
  /Download the React DevTools/i,
  /Failed to load resource/i, // network 4xx/5xx for assets / 3rd-party (cockpit API checked separately)
  /\[GSI_LOGGER\]/i, // Google Identity Services
  /Content Security Policy|CSP/i,
  /sentry/i,
];

type ApiResult = { status: number; ok: boolean; json: any };

// ── Shared single-session state (one context/page for the whole file) ─────────
let context: BrowserContext;
let page: Page;
let token = "";
let snapshotTail: string[] | null = null; // AH..AK FORMULA-rendered, captured at L1+ setup
let sheets: Awaited<ReturnType<typeof loadSheets>> | null = null;
const consoleErrors: string[] = [];

const skipAll = !COOKIE;

/** Authenticated same-origin fetch from inside the loaded SPA (Bearer access JWT). */
async function api(path: string, init?: { method?: string; body?: unknown }): Promise<ApiResult> {
  return page.evaluate(
    async ({ path, init, token }) => {
      const hasBody = init?.body !== undefined && init?.body !== null;
      const res = await fetch(path, {
        method: init?.method || "GET",
        headers: {
          ...(hasBody ? { "content-type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: hasBody ? JSON.stringify(init!.body) : undefined,
        credentials: "include",
      });
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        /* non-JSON */
      }
      return { status: res.status, ok: res.ok, json };
    },
    { path, init: init ?? null, token },
  );
}

/** GET the parsed CRM row (A→AN) via the cockpit read endpoint. */
async function getRow(row: number): Promise<ApiResult> {
  return api(`/api/crm/cockpit/row/${row}`);
}

/** Normalize a destination for comparison (phones: digits only; else lowercase). */
function normTarget(s: string): string {
  const t = String(s || "").trim();
  return /^[+\d ()-]+$/.test(t) ? t.replace(/\D/g, "") : t.toLowerCase();
}

// ──────────────────────────────────────────────────────────────────────────────
test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  if (skipAll) return; // no session → every test will test.skip()

  // Fail-closed config gates BEFORE creating a browser / touching anything.
  if (LEVEL >= 1) {
    if (!Number.isInteger(TEST_ROW) || TEST_ROW < 4) {
      throw new Error(`COCKPIT_E2E_LEVEL=${LEVEL} requires COCKPIT_E2E_TEST_ROW (>=4); got "${process.env.COCKPIT_E2E_TEST_ROW}"`);
    }
    if (!GAC) {
      throw new Error(`COCKPIT_E2E_LEVEL=${LEVEL} requires GOOGLE_APPLICATION_CREDENTIALS (snapshot/restore cannot run without it)`);
    }
  }
  if (LEVEL >= 2 && !TEST_TARGET) {
    throw new Error("COCKPIT_E2E_LEVEL=2 requires COCKPIT_E2E_TEST_TARGET (the controlled send destination)");
  }

  context = await browser.newContext({ ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === "1" });
  await context.addCookies([
    { name: "bmc_sess", value: COOKIE, domain: COOKIE_DOMAIN, path: "/", httpOnly: true, secure: true, sameSite: "Strict" },
  ]);
  page = await context.newPage();

  // Capture the access JWT from the SPA's single refresh-on-load (never refresh twice).
  page.on("response", async (res) => {
    try {
      if (/\/auth\/refresh$/.test(new URL(res.url()).pathname) && res.ok()) {
        const body = await res.json().catch(() => null);
        if (body?.accessToken) token = body.accessToken;
      }
    } catch {
      /* ignore */
    }
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !BENIGN_CONSOLE.some((re) => re.test(m.text()))) consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => {
    if (!BENIGN_CONSOLE.some((re) => re.test(e.message))) consoleErrors.push(e.message);
  });

  // One real navigation → one /auth/refresh. Then client-side nav to the cockpit.
  await page.goto(`${BASE}/hub`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect
    .poll(() => token, { message: "SPA did not return an access token from /auth/refresh", timeout: 30_000 })
    .not.toEqual("");

  if (LEVEL >= 1) {
    sheets = await loadSheets();
    // Snapshot the gate tail (AH..AK) FORMULA-rendered BEFORE any write — this is what
    // teardown restores. (GET row parses AH to null for a HYPERLINK formula, so the SA
    // FORMULA read is the only faithful capture.)
    snapshotTail = await captureTail(sheets, TEST_ROW);
    // Drift guard: refuse to mutate unless the row is the reserved sentinel.
    const r = await getRow(TEST_ROW);
    expect(r.ok, `GET row ${TEST_ROW} failed (${r.status})`).toBeTruthy();
    const cliente = String(r.json?.parsed?.cliente || "");
    expect(
      cliente.includes(SENTINEL_MARKER),
      `Row ${TEST_ROW} is not a sentinel row — cliente="${cliente}" lacks "${SENTINEL_MARKER}". Refusing to mutate a possible real customer.`,
    ).toBeTruthy();
  }
});

test.afterAll(async () => {
  // Restore the sentinel row's gate cells regardless of test outcome (SA-based,
  // independent of the browser session — survives a mid-run write failure).
  try {
    if (sheets && snapshotTail && Number.isInteger(TEST_ROW)) {
      await restoreTail(sheets, TEST_ROW, snapshotTail);
    }
  } finally {
    await context?.close();
  }
});

// ── Level 0 — read-only (always runs when a session is present) ───────────────
test("L0 — cockpit loads and queues read with no auth/server errors", async () => {
  test.skip(skipAll, "no TOUR_SESSION_COOKIE — nothing to authenticate");

  // Client-side nav (no reload → no extra /auth/refresh).
  await page.evaluate(() => {
    window.history.pushState({}, "", "/hub/wa");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  // Not gated: a valid session must not bounce us to the login wall.
  const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 4000);
  expect(
    /iniciar sesi[oó]n|inicia con google|acceso restringido/i.test(bodyText),
    "SPA shows the login wall — bmc_sess is invalid/expired/rotated",
  ).toBeFalsy();

  // Exercise the read endpoints the cockpit depends on.
  const reads = [
    "/api/crm/cockpit/ml-queue",
    "/api/crm/cockpit/wa-queue",
    "/api/crm/cockpit/unified-queue",
    "/api/consultations",
  ];
  for (const path of reads) {
    const r = await api(path);
    // 503 = Sheets unavailable (environmental, repo never-500 rule) → tolerate, don't pass it off as a 200.
    expect([200, 503].includes(r.status), `${path} → ${r.status} (expected 200 or 503)`).toBeTruthy();
    expect([401, 403].includes(r.status), `${path} → ${r.status}: auth rejected — token/grant problem`).toBeFalsy();
    if (r.status === 200) expect(r.json?.ok, `${path} returned 200 but ok!=true`).toBeTruthy();
  }

  expect(consoleErrors, `console errors on /hub/wa: ${consoleErrors.join(" | ")}`).toEqual([]);
});

// ── Level 1 — sentinel-row writes (approval, quote-link, mark-sent) ───────────
test("L1 — writes to the sentinel row, then teardown restores it", async () => {
  test.skip(skipAll, "no session");
  test.skip(LEVEL < 1, "COCKPIT_E2E_LEVEL < 1 — write level not requested");

  const quoteUrl = `https://calculadora-bmc.vercel.app/?e2e=${SENTINEL_MARKER}`;

  // approval=true
  const ap = await api("/api/crm/cockpit/approval", { method: "POST", body: { row: TEST_ROW, approved: true } });
  expect(ap.ok, `approval → ${ap.status}: ${JSON.stringify(ap.json)}`).toBeTruthy();
  expect(ap.json?.aprobadoEnviar).toBe("Sí");

  // quote-link
  const ql = await api("/api/crm/cockpit/quote-link", { method: "POST", body: { row: TEST_ROW, url: quoteUrl } });
  expect(ql.ok, `quote-link → ${ql.status}: ${JSON.stringify(ql.json)}`).toBeTruthy();

  // mark-sent (explicit timestamp so the assertion is deterministic)
  const sentAt = "2000-01-01T00:00:00.000Z";
  const ms = await api("/api/crm/cockpit/mark-sent", { method: "POST", body: { row: TEST_ROW, sentAt } });
  expect(ms.ok, `mark-sent → ${ms.status}: ${JSON.stringify(ms.json)}`).toBeTruthy();
  expect(ms.json?.enviadoEl).toBe(sentAt);

  // Verify the row reflects all three writes.
  const after = await getRow(TEST_ROW);
  expect(after.ok).toBeTruthy();
  expect(after.json?.parsed?.aprobadoEnviar).toBe("Sí");
  expect(after.json?.parsed?.enviadoEl).toBe(sentAt);

  // Interactive fidelity (best-effort, non-fatal): the cockpit UI is mounted and a
  // toggle exists for the operator. We don't depend on a fragile per-row click for
  // correctness — the authed fetches above are the source of truth.
  const toggle = page.getByRole("button", { name: /aprob/i }).first();
  if (await toggle.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await toggle.click({ force: true }).catch(() => {});
  }
});

// ── Level 2 — guarded real send (send-approved to a controlled target) ────────
test("L2 — send-approved fires only to the controlled test target", async () => {
  test.skip(skipAll, "no session");
  test.skip(LEVEL < 2, "COCKPIT_E2E_LEVEL < 2 — send level not requested");

  // Re-fetch fresh state and verify the row's actual destination matches the target.
  const r = await getRow(TEST_ROW);
  expect(r.ok, `GET row ${TEST_ROW} → ${r.status}`).toBeTruthy();
  const p = r.json?.parsed || {};
  const origen = String(p.origen || "");
  let actual = "";
  if (/ML/i.test(origen) || /Q:\d+/.test(String(p.observaciones || ""))) {
    const qid = extractMlQuestionId(p.observaciones);
    actual = qid ? `Q:${qid}` : "";
  } else if (/WA/i.test(origen) || /WhatsApp/i.test(origen)) {
    actual = String(p.telefono || "");
  } else if (/Email/i.test(origen)) {
    actual = String(p.telefono || p.observaciones || "");
  }
  expect(
    normTarget(actual) === normTarget(TEST_TARGET) && actual !== "",
    `Sentinel row destination "${actual}" (origen=${origen}) != COCKPIT_E2E_TEST_TARGET "${TEST_TARGET}". Refusing to send to an uncontrolled recipient.`,
  ).toBeTruthy();

  // send-approved preconditions (server enforces these too — assert here for a clear message).
  expect(isSi(p.aprobadoEnviar), "row needs aprobadoEnviar=Sí (run L1 first)").toBeTruthy();
  expect(String(p.enviadoEl || "").trim(), "row already marked sent — teardown will clear it; re-run").toBe("");
  expect(isSi(p.bloquearAuto), "row has bloquearAuto=Sí (locked)").toBeFalsy();

  const send = await api("/api/crm/cockpit/send-approved", { method: "POST", body: { row: TEST_ROW } });
  expect(send.ok, `send-approved → ${send.status}: ${JSON.stringify(send.json)}`).toBeTruthy();
  expect(["ml", "whatsapp", "email"]).toContain(send.json?.channel);
});
