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

const BASE = (process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");
const BASE_HOST = new URL(BASE).hostname;
const COOKIE_RAW = (process.env.TOUR_SESSION_COOKIE || "").trim();
const COOKIE = COOKIE_RAW.match(/[a-f0-9]{96}/i)?.[0] ?? "";
const HAS_SESSION = /^[a-f0-9]{96}$/i.test(COOKIE);
const COOKIE_INVALID = Boolean(COOKIE_RAW) && !HAS_SESSION;

const BENIGN_CONSOLE = [
  /favicon\.ico/i,
  /ResizeObserver loop/i,
  /Download the React DevTools/i,
  /Failed to load resource/i,
  /\[GSI_LOGGER\]/i,
  /Outdated Optimize Dep/i,
  /Canvas2D:/i,
  /willReadFrequently/i,
  /getImageData are faster/i,
  // Optional BMC chat (:3000) — widget may CORS-fail when chat server is down or misconfigured
  /localhost:3000/i,
  /127\.0\.0\.1:3000/i,
  /CORS policy/i,
  /Access-Control-Allow-Headers/i,
  /authorization is not allowed/i,
];

function isBenignConsole(text: string) {
  return BENIGN_CONSOLE.some((re) => re.test(text));
}

function isOptionalChatRequest(url: string) {
  return /:\/\/(localhost|127\.0\.0\.1):3000\//i.test(url);
}

let context: BrowserContext;
let page: Page;
let accessToken = "";
const consoleErrors: string[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  if (COOKIE_INVALID) {
    throw new Error(
      `TOUR_SESSION_COOKIE inválida — esperaba 96 hex chars, recibió: ${COOKIE_RAW.slice(0, 32)}…`,
    );
  }
  context = await browser.newContext();
  if (HAS_SESSION) {
    // Cookie must exist before the first navigation — BmcAuthProvider bootstraps once on mount.
    await context.addCookies([
      {
        name: "bmc_sess",
        value: COOKIE,
        domain: BASE_HOST,
        path: "/",
        httpOnly: true,
        secure: BASE.startsWith("https"),
        sameSite: "Lax",
      },
    ]);
  }
  // Floating BMC chat widget (:3000) is unrelated to /panelin/live — block to avoid CORS noise.
  await context.route("**/*", async (route) => {
    if (isOptionalChatRequest(route.request().url())) return route.abort();
    return route.continue();
  });

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
    const text = m.text();
    if (isBenignConsole(text)) return;
    if (m.type() === "error" || m.type() === "warning") {
      consoleErrors.push(text);
    }
  });
  page.on("pageerror", (e) => {
    if (!isBenignConsole(e.message)) consoleErrors.push(e.message);
  });
});

test.afterAll(async () => {
  await context?.close();
});

/** Mint JWT via the browser cookie jar (updates bmc_sess after rotation). */
async function refreshAccessTokenInBrowser(p: Page) {
  const token = await p.evaluate(async () => {
    const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    if (!res.ok) return "";
    const body = await res.json().catch(() => null);
    return body?.accessToken || "";
  });
  if (token) accessToken = token;
  return token;
}

async function ensureAccessToken(p: Page, timeoutMs = 45_000) {
  await expect
    .poll(async () => {
      if (accessToken) return accessToken;
      await refreshAccessTokenInBrowser(p);
      return accessToken;
    }, { message: "could not mint access JWT from bmc_sess cookie", timeout: timeoutMs })
    .not.toEqual("");
}

/** Wait until SPA leaves loading/anonymous and exposes a session JWT. */
async function bootstrapAuthenticatedSession(p: Page) {
  const authResponse = p.waitForResponse(
    (res) => {
      const path = new URL(res.url()).pathname;
      return /\/api\/auth\/(refresh|me)$/.test(path) && res.status() === 200;
    },
    { timeout: 45_000 },
  );

  await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await authResponse.catch(() => null);
  await ensureAccessToken(p);

  if (!accessToken) {
    await p.reload({ waitUntil: "domcontentloaded" });
    await ensureAccessToken(p);
  }

  await expect(p.getByRole("button", { name: /Iniciar sesión/i })).toBeHidden({ timeout: 20_000 });
}

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

  await bootstrapAuthenticatedSession(page);

  // Home (/) may log optional chat-widget noise; assert only on /panelin/live.
  consoleErrors.length = 0;

  await page.goto(`${BASE}/panelin/live`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Iniciá sesión/i })).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText(/Volver a la calculadora/i)).toBeVisible({ timeout: 15_000 });

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  expect(consoleErrors, `console errors before canvas probe: ${consoleErrors.join("; ")}`).toHaveLength(0);

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const c = document.querySelector("canvas");
        if (!c) return 0;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return 0;
        const { data } = ctx.getImageData(0, 0, Math.min(c.width, 200), Math.min(c.height, 200));
        let nonZero = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonZero++;
        return nonZero;
      });
    }, { timeout: 25_000, message: "canvas should have painted sprite pixels" })
    .toBeGreaterThan(50);

  await expect(page.getByText(/Tocá en cualquier lugar para empezar/i)).toBeVisible();
});

test("L2 — voice session mint (API layer, same auth as page)", async () => {
  test.skip(!HAS_SESSION, "requires TOUR_SESSION_COOKIE");

  if (!accessToken) {
    await bootstrapAuthenticatedSession(page);
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