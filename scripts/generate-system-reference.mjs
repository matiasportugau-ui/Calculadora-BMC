/**
 * generate-system-reference.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Genera docs/product/SYSTEM-REFERENCE.md a partir del CÓDIGO REAL del repo
 * (no prosa a mano). Por eso el documento es FIEL y puede regenerarse en CI:
 * cada vez que cambia el wiring (rutas, integraciones, migraciones…), el doc se
 * actualiza solo.
 *
 * Extrae:
 *   1. Superficie de API     ← server/index.js (mounts) + server/routes/**.js
 *   2. Rutas del frontend    ← src/App.jsx (<Route path element>)
 *   3. Integraciones / env   ← .env.example (agrupado por secciones de comentario)
 *   4. Persistencia / datos  ← migraciones .sql (CREATE TABLE) en varios paquetes
 *   5. Auth & seguridad      ← server/routes/auth*, server/middleware/**
 *   6. Scripts npm           ← package.json
 *   7. CI / workflows        ← .github/workflows/*.yml
 *   8. Agentes Claude        ← .claude/agents/*.md
 *
 * Uso:  node scripts/generate-system-reference.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "docs/product/SYSTEM-REFERENCE.md");

const read = (p) => {
  try {
    return readFileSync(join(ROOT, p), "utf8");
  } catch {
    return "";
  }
};
const exists = (p) => existsSync(join(ROOT, p));

/** Recorre un directorio devolviendo rutas relativas a ROOT que matchean `test`. */
function walk(rel, test, acc = []) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return acc;
  for (const name of readdirSync(abs)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const childRel = join(rel, name);
    const st = statSync(join(ROOT, childRel));
    if (st.isDirectory()) walk(childRel, test, acc);
    else if (test(childRel)) acc.push(childRel);
  }
  return acc;
}

function gitInfo() {
  const run = (c) => {
    try {
      return execSync(c, { cwd: ROOT }).toString().trim();
    } catch {
      return "";
    }
  };
  return { commit: run("git rev-parse --short HEAD"), branch: run("git rev-parse --abbrev-ref HEAD") };
}

// ── 1. Superficie de API ─────────────────────────────────────────────────────
function apiSurface() {
  const index = read("server/index.js");
  // importMap: identificador → archivo de ruta
  const importMap = {};
  for (const m of index.matchAll(/import\s+(?:\{?\s*([\w,\s]+?)\s*\}?)\s+from\s+["']\.\/routes\/([\w./-]+)["']/g)) {
    const names = m[1].split(",").map((s) => s.trim());
    for (const n of names) if (n) importMap[n] = "server/routes/" + m[2];
  }
  // mounts: app.use([prefix,] <identificador|factory(...)>)
  const mounts = [];
  for (const m of index.matchAll(/app\.use\(\s*(?:["'`]([^"'`]+)["'`]\s*,\s*)?([A-Za-z_]\w*)/g)) {
    mounts.push({ prefix: m[1] || "", ident: m[2] });
  }
  // routes declaradas por archivo
  const routeFiles = walk("server/routes", (p) => p.endsWith(".js"));
  const fileRoutes = {};
  for (const f of routeFiles) {
    const src = read(f);
    const routes = [];
    for (const r of src.matchAll(/\brouter\.(get|post|put|patch|delete|all)\(\s*["'`]([^"'`]+)["'`]/g)) {
      routes.push({ method: r[1].toUpperCase(), path: r[2] });
    }
    if (routes.length) fileRoutes[f] = routes;
  }
  // resolver prefijo por archivo (vía importMap + mounts)
  const filePrefix = {};
  for (const mo of mounts) {
    const file = importMap[mo.ident];
    if (file) (filePrefix[file] ??= new Set()).add(mo.prefix);
  }
  // emitir tabla agrupada por archivo
  let out = "";
  let total = 0;
  for (const f of Object.keys(fileRoutes).sort()) {
    const prefixes = filePrefix[f] ? [...filePrefix[f]] : [""];
    const label = relative("server/routes", f);
    out += `\n**\`${label}\`** — montado en \`${prefixes.map((p) => p || "(raíz)").join("`, `")}\`\n\n`;
    out += "| Método | Ruta |\n|---|---|\n";
    for (const r of fileRoutes[f]) {
      const full = prefixes[0] && !r.path.startsWith(prefixes[0]) ? prefixes[0].replace(/\/$/, "") + r.path : r.path;
      out += `| ${r.method} | \`${full}\` |\n`;
      total++;
    }
  }
  return { md: out, count: total, fileCount: Object.keys(fileRoutes).length };
}

// ── 2. Rutas del frontend (SPA) ──────────────────────────────────────────────
function frontendRoutes() {
  const app = read("src/App.jsx");
  const WRAPPERS = new Set(["Shell", "RequireGrant", "Suspense", "Navigate", "Fragment", "React", "ErrorBoundary", "BmcAuthProvider", "Route", "Routes"]);
  const rows = [];
  // Cada bloque <Route> es multilínea con wrappers anidados; tomamos el path y,
  // dentro de la ventana hasta el próximo path=, el primer componente NO-wrapper
  // (el page real, que aparece tras los wrappers en orden de fuente).
  const pathMatches = [...app.matchAll(/path=["']([^"']+)["']/g)];
  for (let i = 0; i < pathMatches.length; i++) {
    const path = pathMatches[i][1];
    const start = pathMatches[i].index;
    const end = i + 1 < pathMatches.length ? pathMatches[i + 1].index : start + 600;
    const win = app.slice(start, end);
    const comps = [...win.matchAll(/<([A-Z]\w+)/g)].map((m) => m[1]);
    const page = comps.find((c) => !WRAPPERS.has(c));
    const isRedirect = /element=\{<Navigate/.test(win);
    rows.push({ path, el: page || (isRedirect ? "→ redirect" : comps[0] || "—") });
  }
  let md = "| Ruta | Componente / página |\n|---|---|\n";
  for (const r of rows.sort((a, b) => a.path.localeCompare(b.path))) {
    md += `| \`${r.path}\` | ${r.el.startsWith("→") ? r.el : r.el === "—" ? "—" : "`" + r.el + "`"} |\n`;
  }
  return { md, count: rows.length };
}

// ── 3. Integraciones / variables de entorno ──────────────────────────────────
// Agrupadas por prefijo del nombre (BMC_, ML_, WA_, GOOGLE_…) — determinista y
// limpio, en vez de depender de los comentarios libres de .env.example.
function envGroups() {
  const env = read(".env.example");
  if (!env) return { md: "_(.env.example no encontrado)_\n", count: 0 };
  const vars = [...new Set([...env.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]))];
  const groups = {};
  for (const v of vars) {
    const prefix = v.includes("_") ? v.slice(0, v.indexOf("_")) : v;
    (groups[prefix] ??= []).push(v);
  }
  const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  let md = "| Prefijo | Variables |\n|---|---|\n";
  for (const [prefix, vs] of sorted) {
    md += `| \`${prefix}_*\` | ${vs.sort().map((v) => "`" + v + "`").join(" · ")} |\n`;
  }
  return { md, count: vars.length };
}

// ── 4. Persistencia / datos ──────────────────────────────────────────────────
function dataStores() {
  const dirs = walk(".", (p) => /migrations\/.+\.sql$/.test(p) && !p.includes("node_modules")).reduce((acc, f) => {
    const d = dirname(f);
    (acc[d] ??= []).push(f);
    return acc;
  }, {});
  let md = "";
  let tableCount = 0;
  for (const d of Object.keys(dirs).sort()) {
    const tables = new Set();
    for (const f of dirs[d]) {
      for (const m of read(f).matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi)) tables.add(m[1]);
    }
    md += `\n**\`${d}/\`** — ${dirs[d].length} migración(es)`;
    if (tables.size) {
      md += `, tablas: ${[...tables].map((t) => "`" + t + "`").join(", ")}`;
      tableCount += tables.size;
    }
    md += "\n";
  }
  return { md, tableCount };
}

// ── 5. Auth & seguridad ──────────────────────────────────────────────────────
function authSecurity() {
  const items = [];
  const note = (cond, text) => cond && items.push(text);
  note(exists("server/routes/authGoogle.js"), "**Google OAuth** — `POST /api/auth/google` emite sesión (`server/routes/authGoogle.js`).");
  note(exists("server/routes/authMfa.js"), "**TOTP 2FA** — `POST /api/auth/mfa/challenge` (`server/routes/authMfa.js` + `server/lib/mfaTotp.js`).");
  note(exists("server/lib/identityAuth.js"), "**Tokens JWT + refresh** — rotación obligatoria + reuse-detection (`server/lib/identityAuth.js`). Cookie `bmc_sess` (httpOnly, SameSite=Strict) sólo para `/api/auth/refresh`.");
  note(exists("server/middleware/requireAuth.js"), "**requireAuth** — valida el access-JWT (`server/middleware/requireAuth.js`).");
  note(exists("server/middleware/requireGrant.js"), "**RBAC por módulo** — grants `read`/`write`/`admin` (`server/middleware/requireGrant.js`).");
  const mw = walk("server/middleware", (p) => p.endsWith(".js")).map((p) => "`" + basename(p) + "`");
  if (mw.length) items.push("**Middleware:** " + mw.join(", ") + ".");
  return items.map((i) => "- " + i).join("\n") + "\n";
}

// ── 6. Scripts npm ───────────────────────────────────────────────────────────
function npmScripts() {
  let pkg;
  try {
    pkg = JSON.parse(read("package.json"));
  } catch {
    return { md: "", count: 0 };
  }
  const s = pkg.scripts || {};
  let md = "| Script | Comando |\n|---|---|\n";
  for (const k of Object.keys(s)) md += `| \`${k}\` | \`${s[k].slice(0, 90).replace(/\|/g, "\\|")}\` |\n`;
  return { md, count: Object.keys(s).length };
}

// ── 7. CI / workflows ────────────────────────────────────────────────────────
function workflows() {
  const files = walk(".github/workflows", (p) => /\.ya?ml$/.test(p));
  let md = "| Workflow | Nombre | Disparadores |\n|---|---|---|\n";
  for (const f of files.sort()) {
    const src = read(f);
    const name = (src.match(/^name:\s*(.+)$/m) || [])[1]?.trim() || basename(f);
    const onBlock = src.match(/^on:\s*([\s\S]*?)^\w/m)?.[1] || src.match(/^on:\s*(.+)$/m)?.[1] || "";
    const triggers = [...onBlock.matchAll(/\b(push|pull_request|schedule|workflow_dispatch|workflow_call|repository_dispatch)\b/g)]
      .map((m) => m[1]);
    md += `| \`${basename(f)}\` | ${name} | ${[...new Set(triggers)].join(", ") || "—"} |\n`;
  }
  return { md, count: files.length };
}

// ── 8. Agentes Claude ────────────────────────────────────────────────────────
function agents() {
  const files = walk(".claude/agents", (p) => p.endsWith(".md"));
  let md = "";
  for (const f of files.sort()) {
    const src = read(f);
    const name = (src.match(/^name:\s*(.+)$/m) || [])[1]?.trim() || basename(f, ".md");
    const desc = (src.match(/^description:\s*(.+)$/m) || [])[1]?.trim() || "";
    md += `- **\`${name}\`** — ${desc.slice(0, 160)}\n`;
  }
  return { md, count: files.length };
}

// ── Ensamblar ────────────────────────────────────────────────────────────────
const { commit, branch } = gitInfo();
let version = "";
try {
  version = JSON.parse(read("package.json")).version;
} catch {
  /* ignore */
}

const api = apiSurface();
const fe = frontendRoutes();
const env = envGroups();
const data = dataStores();
const auth = authSecurity();
const scripts = npmScripts();
const ci = workflows();
const ag = agents();

const doc = `# Calculadora BMC / Wolfboard — Referencia técnica del sistema

> **Documento auto-generado** por \`scripts/generate-system-reference.mjs\` a partir
> del código real del repo. **No editar a mano** — se regenera (ver workflow
> \`product-docs\`). Es la representación *fiel y cableada* de cómo está construido el
> sistema; el recorrido visual de la UI está en \`PRODUCT-OVERVIEW.md\`.

| | |
|---|---|
| **Generado** | ${new Date().toISOString()} |
| **Versión** | \`calculadora-bmc\` v${version} |
| **Commit** | \`${commit}\` (\`${branch}\`) |

## Arquitectura (resumen)

- **Frontend:** React 18 + Vite (SPA, \`:5173\` en dev). Entry \`src/App.jsx\` (router con
  ${fe.count} rutas).
- **API:** Express 5 sobre Node (ES modules, \`:3001\`). Entry \`server/index.js\`; expone
  ${api.count} rutas en ${api.fileCount} módulos de \`server/routes/\`.
- **Datos:** PostgreSQL (\`pg\`) + pgvector; Google Sheets (service account); integraciones
  MercadoLibre, WhatsApp Cloud, GCS, OpenAI/Anthropic. Ver §Integraciones.
- **Deploy:** Frontend en Vercel; API en Google Cloud Run (\`panelin-calc\`).

## 1. Superficie de API (${api.count} rutas en ${api.fileCount} módulos)
${api.md}
## 2. Rutas del frontend / SPA (${fe.count})
${fe.md}
## 3. Integraciones y variables de entorno (${env.count})

_Extraído de \`.env.example\` (sólo nombres; nunca valores)._
${env.md}
## 4. Persistencia / migraciones${data.tableCount ? ` (${data.tableCount} tablas)` : ""}
${data.md}
## 5. Auth & seguridad

${auth}
## 6. Scripts npm (${scripts.count})
${scripts.md}
## 7. CI / workflows (${ci.count})
${ci.md}
## 8. Agentes Claude (${ag.count})
${ag.md}
---

_Regenerar:_ \`node scripts/generate-system-reference.mjs\`.
`;

writeFileSync(OUT, doc);
console.log(`SYSTEM-REFERENCE.md generado: ${api.count} rutas API, ${fe.count} rutas SPA, ${env.count} env vars, ${data.tableCount} tablas, ${scripts.count} scripts, ${ci.count} workflows, ${ag.count} agentes.`);
