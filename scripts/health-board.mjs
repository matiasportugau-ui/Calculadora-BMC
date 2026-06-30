#!/usr/bin/env node
/**
 * BMC API Health Board — un solo comando para cargar el entorno y ver el estado
 * de todas las superficies de la API (Cloud Run + Vercel + sub-APIs).
 *
 * Uso:
 *   npm run health                         # entorno por defecto (prod)
 *   npm run health -- --env=local          # contra localhost:3001
 *   npm run health -- --env=prod --json    # salida JSON (CI / scripting)
 *   npm run health -- --env=prod --watch=15 # refresca cada 15s
 *   npm run health -- --base=https://...    # base ad-hoc
 *   doppler run -- npm run health -- --env=prod   # carga secretos (dev pass)
 *
 * "Dev pass": las superficies protegidas (p. ej. /api/omni/admin/overview) sólo
 * devuelven datos con un Bearer JWT válido. El board lo toma de:
 *   - env  BMC_HEALTH_TOKEN   (ideal: vía Doppler, nunca hardcodeado)
 *   - flag --token=eyJ...     (ad-hoc)
 * Sin token, las superficies protegidas se reportan AUTH (montadas + gated, sano),
 * nunca FAIL. Con token válido se reportan OK y se valida el payload.
 *
 * Exit code: 0 si no hay FAIL; 1 si alguna superficie crítica falla.
 */

const TIMEOUT_MS = 25_000;

// ── Entornos ────────────────────────────────────────────────────────────────
// Base URLs canónicas. Cloud Run = API; Vercel = frontend (sólo liveness de /).
const ENVIRONMENTS = {
  local: {
    api: "http://localhost:3001",
    web: null,
  },
  prod: {
    api: "https://panelin-calc-642127786762.us-central1.run.app",
    web: "https://calculadora-bmc.vercel.app",
  },
};

// ── Superficies a chequear ───────────────────────────────────────────────────
// kind: "api" → contra base.api ; "web" → contra base.web
// auth: true → requiere dev pass (sin token: 401/403 ⇒ AUTH, no FAIL)
// critical: true → su FAIL marca el board como caído (exit 1)
// degradeIf(status, body, headers) → devuelve string de motivo si está DEGRADED
// note(status, body, headers) → texto corto informativo en la fila
const SURFACES = [
  {
    name: "/health",
    kind: "api",
    path: "/health",
    critical: true,
    note: (s, b) =>
      b && typeof b === "object"
        ? `sheets=${b.hasSheets ?? "?"} tokens=${b.hasTokens ?? "?"}`
        : "",
    degradeIf: (s, b) =>
      b && b.hasSheets === false ? "sheets unavailable" : null,
  },
  {
    name: "/capabilities",
    kind: "api",
    path: "/capabilities",
    critical: true,
    note: (s, b) => {
      // /capabilities anida el sha en build.gitSha (fallback a top-level gitSha).
      const raw = b?.build?.gitSha || b?.gitSha || "";
      const sha = raw ? String(raw).slice(0, 8) : "";
      return sha ? `git ${sha}` : "";
    },
  },
  {
    name: "MATRIZ csv",
    kind: "api",
    path: "/api/actualizar-precios-calculadora",
    critical: true,
    expectContentType: "text/csv",
    note: (s, b, h) => (h ? `${(h.get("content-type") || "").split(";")[0]}` : ""),
  },
  {
    name: "/calc/catalogo",
    kind: "api",
    path: "/calc/catalogo",
    critical: false,
  },
  {
    name: "/api/wa/health",
    kind: "api",
    path: "/api/wa/health",
    critical: false,
  },
  {
    name: "/auth/ml/status",
    kind: "api",
    path: "/auth/ml/status",
    critical: false,
    okStatuses: [200, 404],
    note: (s, b) => {
      if (!b || typeof b !== "object") return "";
      const conn = b.connected ?? b.ok ?? b.status;
      return conn !== undefined ? `connected=${conn}` : "";
    },
    degradeIf: (s, b) =>
      b && (b.connected === false || b.expired === true) ? "ml token dormant" : null,
  },
  {
    name: "/api/omni/admin/overview",
    kind: "api",
    path: "/api/omni/admin/overview",
    auth: true,
    critical: false,
    note: (s, b) => {
      if (s !== 200 || !b || typeof b !== "object") return "";
      const d = b.data || b;
      const accts = Array.isArray(d.accounts) ? d.accounts.length : (d.mailboxes?.length ?? "");
      return accts !== "" ? `mailboxes=${accts}` : "ok";
    },
  },
  {
    name: "web /",
    kind: "web",
    path: "/",
    critical: false,
    okStatuses: [200, 301, 302],
  },
];

// ── Args ─────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  let env = process.env.BMC_HEALTH_ENV || "prod";
  let json = false;
  let watch = 0;
  let base = null;
  let token = process.env.BMC_HEALTH_TOKEN || "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--env=")) env = a.slice("--env=".length);
    else if (a === "--env" && argv[i + 1]) env = argv[++i];
    else if (a === "--json") json = true;
    else if (a.startsWith("--watch=")) watch = Number(a.slice("--watch=".length)) || 0;
    else if (a === "--watch") watch = Number(argv[++i]) || 15;
    else if (a.startsWith("--base=")) base = a.slice("--base=".length);
    else if (a === "--base" && argv[i + 1]) base = argv[++i];
    else if (a.startsWith("--token=")) token = a.slice("--token=".length);
    else if (a === "--token" && argv[i + 1]) token = argv[++i];
  }
  return { env, json, watch, base, token };
}

// ── Colores ──────────────────────────────────────────────────────────────────
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const C = {
  reset: useColor ? "\x1b[0m" : "",
  dim: useColor ? "\x1b[2m" : "",
  green: useColor ? "\x1b[32m" : "",
  yellow: useColor ? "\x1b[33m" : "",
  red: useColor ? "\x1b[31m" : "",
  cyan: useColor ? "\x1b[36m" : "",
  bold: useColor ? "\x1b[1m" : "",
};
const STATUS_STYLE = {
  OK: C.green,
  DEGR: C.yellow,
  AUTH: C.cyan,
  FAIL: C.red,
  SKIP: C.dim,
};

// ── Fetch con timeout ────────────────────────────────────────────────────────
async function probe(url, { token, wantText } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const headers = { accept: "application/json, text/csv, */*" };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(url, { method: "GET", headers, signal: ctrl.signal });
    const ms = Date.now() - started;
    let body = null;
    const ct = res.headers.get("content-type") || "";
    if (!wantText && ct.includes("application/json")) {
      body = await res.json().catch(() => null);
    } else {
      const txt = await res.text().catch(() => "");
      body = wantText ? txt : null;
    }
    return { ok: true, status: res.status, ms, headers: res.headers, body };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - started, error: String(e.name === "AbortError" ? "timeout" : e.message) };
  } finally {
    clearTimeout(t);
  }
}

// ── Evaluar una superficie ───────────────────────────────────────────────────
function classify(surface, r, hasToken) {
  if (!r.ok || r.status === 0) {
    return { state: "FAIL", note: r.error || "unreachable" };
  }
  const okStatuses = surface.okStatuses || [200];
  // Superficie protegida sin token: 401/403 = sana (montada + gated).
  if (surface.auth && !hasToken && (r.status === 401 || r.status === 403)) {
    return { state: "AUTH", note: `gated (${r.status})` };
  }
  if (surface.auth && hasToken && (r.status === 401 || r.status === 403)) {
    return { state: "FAIL", note: `dev pass rejected (${r.status})` };
  }
  // Sheets-backed: 503 = upstream caído pero contrato sano → DEGRADED, no FAIL.
  if (r.status === 503) {
    return { state: "DEGR", note: "upstream 503" };
  }
  if (!okStatuses.includes(r.status)) {
    return { state: "FAIL", note: `status ${r.status}` };
  }
  if (surface.expectContentType) {
    const ct = (r.headers?.get("content-type") || "").toLowerCase();
    if (!ct.includes(surface.expectContentType)) {
      return { state: "FAIL", note: `content-type ${ct.split(";")[0] || "?"}` };
    }
  }
  const degr = surface.degradeIf?.(r.status, r.body, r.headers);
  if (degr) return { state: "DEGR", note: degr };
  const note = surface.note?.(r.status, r.body, r.headers) || "";
  return { state: "OK", note };
}

// ── Una corrida del board ────────────────────────────────────────────────────
async function runOnce({ env, base, token }) {
  const cfg = ENVIRONMENTS[env];
  if (!cfg && !base) {
    throw new Error(`entorno desconocido: ${env} (usá: ${Object.keys(ENVIRONMENTS).join(", ")} o --base=)`);
  }
  const apiBase = base || cfg.api;
  const webBase = cfg?.web || null;
  const hasToken = !!token;

  const rows = [];
  await Promise.all(
    SURFACES.map(async (s) => {
      if (s.kind === "web" && !webBase) {
        rows.push({ surface: s, state: "SKIP", note: "no web base", ms: 0, status: null });
        return;
      }
      const target = (s.kind === "web" ? webBase : apiBase) + s.path;
      const wantText = s.expectContentType === "text/csv" || s.kind === "web";
      let r = await probe(target, { token: s.auth ? token : "", wantText });
      // Cold-start guard: un timeout en superficie crítica reintenta una vez
      // (Cloud Run despierta la instancia en el primer hit).
      if (s.critical && r.error === "timeout") {
        r = await probe(target, { token: s.auth ? token : "", wantText });
      }
      const { state, note } = classify(s, r, hasToken);
      rows.push({ surface: s, state, note, ms: r.ms, status: r.status });
    })
  );
  // Mantener orden de SURFACES
  rows.sort((a, b) => SURFACES.indexOf(a.surface) - SURFACES.indexOf(b.surface));

  const counts = rows.reduce((m, r) => ((m[r.state] = (m[r.state] || 0) + 1), m), {});
  const failedCritical = rows.some((r) => r.state === "FAIL" && r.surface.critical);
  return { env, apiBase, webBase, hasToken, rows, counts, failedCritical };
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderText(result) {
  const { env, apiBase, hasToken, rows, counts } = result;
  const capNote = rows.find((r) => r.surface.name === "/capabilities")?.note || "";
  const sha = capNote.startsWith("git ") ? capNote.slice(4) : "";
  const lines = [];
  lines.push("");
  lines.push(
    `${C.bold}BMC API HEALTH${C.reset}  ${C.cyan}${env}${C.reset}  ${C.dim}${apiBase}${C.reset}` +
      (sha ? `  ${C.dim}${sha}${C.reset}` : "") +
      (hasToken ? `  ${C.green}[dev pass loaded]${C.reset}` : `  ${C.dim}[no dev pass]${C.reset}`)
  );
  lines.push(C.dim + "─".repeat(60) + C.reset);
  for (const r of rows) {
    const style = STATUS_STYLE[r.state] || "";
    const tag = `${style}${r.state.padEnd(4)}${C.reset}`;
    const name = r.surface.name.padEnd(26);
    const code = r.status != null ? String(r.status).padStart(3) : "  -";
    const ms = r.ms ? `${C.dim}${String(r.ms).padStart(5)}ms${C.reset}` : "        ";
    const note = r.note ? `  ${C.dim}${r.note}${C.reset}` : "";
    lines.push(`${tag}  ${name} ${code}  ${ms}${note}`);
  }
  lines.push(C.dim + "─".repeat(60) + C.reset);
  const summary = ["OK", "DEGR", "AUTH", "FAIL", "SKIP"]
    .filter((k) => counts[k])
    .map((k) => `${STATUS_STYLE[k]}${counts[k]} ${k.toLowerCase()}${C.reset}`)
    .join(" · ");
  lines.push(summary);
  return lines.join("\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));

  const runAndReport = async () => {
    const result = await runOnce(args);
    if (args.json) {
      const out = {
        env: result.env,
        apiBase: result.apiBase,
        webBase: result.webBase,
        devPass: result.hasToken,
        counts: result.counts,
        ok: !result.failedCritical,
        surfaces: result.rows.map((r) => ({
          name: r.surface.name,
          state: r.state,
          status: r.status,
          ms: r.ms,
          note: r.note,
          critical: !!r.surface.critical,
          auth: !!r.surface.auth,
        })),
      };
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(renderText(result));
    }
    return result;
  };

  if (args.watch > 0 && !args.json) {
    // Modo watch: refresca y limpia pantalla.
    for (;;) {
      process.stdout.write("\x1b[2J\x1b[H");
      const result = await runAndReport();
      process.stdout.write(
        `\n${C.dim}refresh ${args.watch}s · Ctrl-C para salir${C.reset}\n`
      );
      if (result.failedCritical) process.exitCode = 1;
      else process.exitCode = 0;
      await new Promise((res) => setTimeout(res, args.watch * 1000));
    }
  } else {
    const result = await runAndReport();
    process.exit(result.failedCritical ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(`${C.red}health-board error:${C.reset} ${e.message}`);
  process.exit(2);
});
