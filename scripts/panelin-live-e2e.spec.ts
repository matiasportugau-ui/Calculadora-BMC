/**
 * panelin-live-e2e — /panelin/live character + voice readiness.
 *
 * L0 (no auth): login gate + assets load
 * L1 (TOUR_SESSION_COOKIE): canvas character + CTA
 * L2 (TOUR_SESSION_COOKIE): voice session mint via same JWT path as the page
 *
 * WebRTC / mic / speaker: manual only (headless cannot assert Realtime audio).
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const BASE = (process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");
const COOKIE = process.env.TOUR_SESSION_COOKIE || "";
const COOKIE_DOMAIN = new URL(BASE).hostname;
const HAS_SESSION = Boolean(COOKIE);

const BENIGN_CONSOLE = [
  /favicon\.ico/i,
  /ResizeObserver loop/i,
  /Download the React DevTools/i,
  /Failed to load resource/i,
  /\[GSI_LOGGER\]/i,
  /Outdated Optimize Dep/i,
];

let context: BrowserContext;
let page: Page;
let accessToken = "";
const consoleErrors: string[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  if (HAS_SESSION) {
    const secure = BASE.startsWith("https");
    await context.addCookies([
      {
        name: "bmc_sess",
        value: COOKIE,
        domain: COOKIE_DOMAIN,
        path: "/",
        httpOnly: true,
        secure,
        sameSite: "Strict",
      },
    ]);
  }
  page = await context.newPage();
  page.on("response", async (res) => {
    try {
      if (/\/auth\/refresh$/.test(new URL(res.url()).pathname) && res.ok()) {
        const body = await res.json().catch(() => null);
        if (body?.accessToken) accessToken = body.accessToken;
      }
    } catch {
      /* ignore */
    }
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !BENIGN_CONSOLE.some((re) => re.test(m.text()))) {
      consoleErrors.push(m.text());
    }
  });
  page.on("pageerror", (e) => {
    if (!BENIGN_CONSOLE.some((re) => re.test(e.message))) consoleErrors.push(e.message);
  });
});

test.afterAll(async () => {
  await context?.close();
});

test("L0 — unauthenticated gate shows login wall", async () => {
  test.skip(HAS_SESSION, "skipped when TOUR_SESSION_COOKIE is set (L0 needs anonymous context)");
  const anon = await context.browser()!.newContext();
  const p = await anon.newPage();
  try {
    await p.goto(`${BASE}/panelin/live`, { waitUntil: "domcontentloaded" });
    await expect(p.getByRole("heading", { name: /Iniciá sesión/i })).toBeVisible();
    await expect(p.getByRole("button", { name: /Iniciar sesión/i })).toBeVisible();
  } finally {
    await anon.close();
  }
});

test("L1 — authenticated page loads character canvas", async () => {
  test.skip(!HAS_SESSION, "requires TOUR_SESSION_COOKIE — run: BMC_API_BASE=... node scripts/mint-tour-session.mjs");

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await expect
    .poll(() => accessToken, { message: "SPA did not return accessToken from /auth/refresh", timeout: 30_000 })
    .not.toEqual("");

  await page.evaluate(() => {
    window.history.pushState({}, "", "/panelin/live");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(/iniciar sesi[oó]n/i.test(bodyText)).toBeFalsy();

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 20_000 });

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const c = document.querySelector("canvas");
        if (!c) return 0;
        const ctx = c.getContext("2d");
        if (!ctx) return 0;
        const { data } = ctx.getImageData(0, 0, Math.min(c.width, 200), Math.min(c.height, 200));
        let nonZero = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonZero++;
        return nonZero;
      });
    }, { timeout: 25_000, message: "canvas should have painted sprite pixels" })
    .toBeGreaterThan(50);

  await expect(page.getByText(/Tocá en cualquier lugar para empezar/i)).toBeVisible();
  expect(consoleErrors, `console errors: ${consoleErrors.join("; ")}`).toHaveLength(0);
});

test("L2 — voice session mint (API layer, same auth as page)", async () => {
  test.skip(!HAS_SESSION, "requires TOUR_SESSION_COOKIE");

  if (!accessToken) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await expect.poll(() => accessToken, { timeout: 30_000 }).not.toEqual("");
  }

  const result = await page.evaluate(async (token) => {
    const res = await fetch("/api/agent/voice/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ calcState: {} }),
    });
    let json: Record<string, unknown> = {};
    try {
      json = await res.json();
    } catch {
      /* non-json */
    }
    return { status: res.status, json };
  }, accessToken);

  expect(result.status, `voice/session → ${result.status}`).toBe(200);
  const secret = (result.json?.client_secret as { value?: string } | string | undefined);
  const hasSecret = typeof secret === "string" ? secret : secret?.value;
  expect(hasSecret, "expected ephemeral client_secret").toBeTruthy();
  expect(result.json?.session_id, "expected session_id").toBeTruthy();
});