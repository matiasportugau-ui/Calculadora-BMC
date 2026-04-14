#!/usr/bin/env node
/**
 * Exporta inventario maestro de variables/credenciales (metadatos; sin volcar secretos).
 * Cifrado opcional: AES-256-GCM + scrypt (contraseña).
 *
 * Uso:
 *   node scripts/credentials-master-registry.mjs
 *   node scripts/credentials-master-registry.mjs --probe-local
 *   node scripts/credentials-master-registry.mjs --encrypt
 *   node scripts/credentials-master-registry.mjs --encrypt-only
 *   node scripts/credentials-master-registry.mjs --decrypt path/to/file.enc --out -
 */

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const LOCAL_DIR = path.join(REPO_ROOT, "docs", "team", "credentials-registry", "local");
const DEFAULT_MD = path.join(LOCAL_DIR, "CREDENTIALS-MASTER-REGISTRY.md");
const DEFAULT_ENC = path.join(LOCAL_DIR, "CREDENTIALS-MASTER-REGISTRY.enc");
const MAGIC = Buffer.from("BMC-CRED-REG-v1\0", "utf8");
const SCRYPT_PARAMS = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".cursor",
  ".runtime",
  ".followup",
  ".channels",
  ".email-ingest",
  "coverage",
]);

const CODE_EXT = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

function parseArgs(argv) {
  const out = {
    probeLocal: false,
    encrypt: false,
    encryptOnly: false,
    decrypt: null,
    outPath: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--probe-local") out.probeLocal = true;
    else if (a === "--encrypt-only") out.encryptOnly = true;
    else if (a === "--encrypt") out.encrypt = true;
    else if (a === "--decrypt") {
      out.decrypt = argv[i + 1] || null;
      i += 1;
    } else if (a === "--out") {
      out.outPath = argv[i + 1] || null;
      i += 1;
    }
  }
  return out;
}

function createRl() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
}

/** Evita fallos por espacio final o pegado desde terminal (sin tocar espacios internos). */
function normalizePasswordInput(raw) {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n+$/, "")
    .trimEnd();
}

async function readPasswordTwice(rl, label) {
  const envPass = process.env.CREDENTIALS_REGISTRY_PASS;
  if (envPass != null && String(envPass).length > 0) {
    return normalizePasswordInput(envPass);
  }
  const p1 = normalizePasswordInput(await rl.question(`${label} contraseña: `));
  const p2 = normalizePasswordInput(await rl.question(`${label} contraseña (repetir): `));
  if (p1 !== p2) throw new Error("Las contraseñas no coinciden.");
  if (p1.length < 8) throw new Error("Usá al menos 8 caracteres.");
  return p1;
}

async function readPasswordOnce(rl, label) {
  const envPass = process.env.CREDENTIALS_REGISTRY_PASS;
  if (envPass != null && String(envPass).length > 0) {
    return normalizePasswordInput(envPass);
  }
  return normalizePasswordInput(await rl.question(`${label} contraseña: `));
}

function scryptKey(password, salt) {
  return crypto.scryptSync(password, salt, 32, SCRYPT_PARAMS);
}

function encryptBuffer(plainUtf8, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = scryptKey(password, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plainUtf8, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([salt, iv, tag, enc]);
  return Buffer.concat([MAGIC, payload]);
}

function decryptBuffer(fileBuf, password) {
  if (fileBuf.length < MAGIC.length + 16 + 12 + 16 + 1) {
    throw new Error("Archivo demasiado corto o corrupto.");
  }
  const head = fileBuf.subarray(0, MAGIC.length);
  if (!head.equals(MAGIC)) {
    throw new Error("Formato no reconocido (magic inválido).");
  }
  const b = fileBuf.subarray(MAGIC.length);
  const salt = b.subarray(0, 16);
  const iv = b.subarray(16, 28);
  const tag = b.subarray(28, 44);
  const data = b.subarray(44);
  const key = scryptKey(password, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    const out = Buffer.concat([decipher.update(data), decipher.final()]);
    return out.toString("utf8");
  } catch (e) {
    const code = e && e.code;
    const msg = e && e.message;
    const isAuth =
      code === "ERR_OSSL_WRONG_FINAL_BLOCK_LENGTH" ||
      (typeof msg === "string" &&
        (msg.includes("authenticate") || msg.includes("Unsupported state")));
    if (isAuth) {
      throw new Error(
        "Descifrado falló: contraseña incorrecta, archivo distinto al cifrado, o .enc corrupto/truncado. " +
          "Tenés que usar exactamente la misma contraseña (y el mismo archivo) que al ejecutar encrypt / encrypt:only. " +
          "Si no la recordás, generá un registro nuevo y cifrálo de nuevo.",
      );
    }
    throw e;
  }
}

function parseEnvExample(content) {
  /** @type {Map<string, { notes: string[] }>} */
  const map = new Map();
  const lines = content.split(/\r?\n/);
  let pendingComments = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed === "") {
      if (trimmed.startsWith("#")) pendingComments.push(trimmed.replace(/^#\s?/, ""));
      continue;
    }
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) {
      pendingComments = [];
      continue;
    }
    const key = m[1];
    const prev = map.get(key) || { notes: [] };
    prev.notes.push(...pendingComments);
    map.set(key, prev);
    pendingComments = [];
  }
  return map;
}

function parseDotEnvKeys(content) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    map.set(m[1], m[2]);
  }
  return map;
}

function extractProcessEnvKeysFromConfig(configSource) {
  const keys = new Set();
  const re = /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g;
  let m;
  while ((m = re.exec(configSource))) keys.add(m[1]);
  return keys;
}

const ENV_IN_CODE_RE =
  /(?:process\.env|import\.meta\.env)(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\])/g;

async function walkCodeFiles(dir, acc) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      await walkCodeFiles(full, acc);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name);
      if (!CODE_EXT.has(ext)) continue;
      acc.push(full);
    }
  }
}

async function scanCodeForEnvKeys(rootDirs) {
  const files = [];
  for (const d of rootDirs) {
    await walkCodeFiles(path.join(REPO_ROOT, d), files);
  }
  const keys = new Set();
  for (const file of files) {
    let src;
    try {
      src = await fsp.readFile(file, "utf8");
    } catch {
      continue;
    }
    let m;
    const rel = path.relative(REPO_ROOT, file);
    ENV_IN_CODE_RE.lastIndex = 0;
    while ((m = ENV_IN_CODE_RE.exec(src))) {
      const k = m[1] || m[2];
      if (k) keys.add(`${k}\t${rel}`);
    }
  }
  /** @type {Map<string, Set<string>>} */
  const byKey = new Map();
  for (const row of keys) {
    const [k, rel] = row.split("\t");
    if (!byKey.has(k)) byKey.set(k, new Set());
    byKey.get(k).add(rel);
  }
  return byKey;
}

function localEnvStatus(key, dotEnv) {
  if (!dotEnv) return "sin .env";
  if (!dotEnv.has(key)) return "ausente";
  const v = dotEnv.get(key);
  if (v == null) return "ausente";
  const t = String(v).trim();
  if (t === "") return "definida vacía";
  return "definida (valor oculto)";
}

async function fetchLocalHealth() {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4000);
    const res = await fetch("http://127.0.0.1:3001/health", {
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false, status: res.status, body: await res.text().catch(() => "") };
    const json = await res.json();
    return { ok: true, json };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

function buildMarkdown({
  generatedAt,
  exampleMeta,
  configKeys,
  codeRefs,
  dotEnv,
  health,
}) {
  const allKeys = new Set([
    ...exampleMeta.keys(),
    ...configKeys,
    ...codeRefs.keys(),
    ...(dotEnv ? dotEnv.keys() : []),
  ]);
  const sorted = [...allKeys].sort((a, b) => a.localeCompare(b));

  const lines = [];
  lines.push("# CREDENTIALS-MASTER-REGISTRY (generado localmente)");
  lines.push("");
  lines.push(`> Generado: ${generatedAt} (UTC) — **No commitear** la versión en claro si incluye datos sensibles pegados a mano.`);
  lines.push("");
  lines.push("## Health agregado (opcional)");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(health, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Completá a mano las columnas **fecha implementación** y **health por flujo** en la tabla siguiente.");
  lines.push("");
  lines.push("| Variable | Funcionalidad (notas .env.example / código) | Fecha impl. / rotación | Local .env | En config.js | Referencias código | Health (manual) |");
  lines.push("|----------|-----------------------------------------------|-------------------------|------------|--------------|---------------------|-----------------|");

  for (const key of sorted) {
    const ex = exampleMeta.get(key);
    const note = ex?.notes?.length ? ex.notes.join(" ").replace(/\|/g, "\\|").slice(0, 500) : "—";
    const inCfg = configKeys.has(key) ? "sí" : "—";
    const refs = codeRefs.has(key) ? [...codeRefs.get(key)].slice(0, 4).join("<br>") : "—";
    const more = codeRefs.has(key) && codeRefs.get(key).size > 4 ? "<br>…" : "";
    const loc = localEnvStatus(key, dotEnv);
    lines.push(
      `| \`${key}\` | ${note} | — | ${loc} | ${inCfg} | ${refs}${more} | — |`,
    );
  }

  lines.push("");
  lines.push("## Enriquecimiento manual (Run / Vercel / consolas proveedor)");
  lines.push("");
  lines.push(
    "Debajo podés pegar **solo metadatos** exportados (nombres de vars, fechas, URLs públicas). **No** pegues client_secret, refresh_token ni SA JSON en claro.",
  );
  lines.push("");
  lines.push("_(vacío)_");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`credentials-master-registry.mjs

  (sin flags)     Genera Markdown bajo docs/team/credentials-registry/local/
  --probe-local   Añade bloque JSON de GET http://127.0.0.1:3001/health si responde
  --encrypt       Regenera .md y luego cifra a .enc (sobrescribe el Markdown)
  --encrypt-only  Cifra el .md existente (no regenerar; usá tras editar a mano)
  --decrypt FILE  Descifra a stdout o --out ruta
  --out PATH      Salida explícita (.md generado o destino decrypt)

Env:
  CREDENTIALS_REGISTRY_PASS   Contraseña (evitar en shells compartidos)
  CREDENTIALS_REGISTRY_OUT  Ruta del .md a generar / cifrar
`);
    process.exit(0);
  }

  if (args.encryptOnly) {
    await fsp.mkdir(LOCAL_DIR, { recursive: true });
    const outMd = process.env.CREDENTIALS_REGISTRY_OUT || args.outPath || DEFAULT_MD;
    try {
      await fsp.access(outMd, fs.constants.R_OK);
    } catch {
      throw new Error(`No existe ${outMd}. Generá primero: npm run credentials:registry`);
    }
    const rl = createRl();
    const pass = await readPasswordTwice(rl, "Cifrado");
    rl.close();
    const plain = await fsp.readFile(outMd);
    const enc = encryptBuffer(plain, pass);
    const encPath =
      outMd === DEFAULT_MD ? DEFAULT_ENC : `${String(outMd).replace(/\.md$/i, "")}.enc`;
    await fsp.writeFile(encPath, enc);
    console.error(`Cifrado escrito: ${encPath}`);
    return;
  }

  if (args.decrypt) {
    if (!args.decrypt || args.decrypt.startsWith("-")) {
      throw new Error("Uso: --decrypt <ruta-al-archivo.enc> [--out ruta|-]");
    }
    const encPath = path.isAbsolute(args.decrypt)
      ? args.decrypt
      : path.join(REPO_ROOT, args.decrypt);
    const buf = await fsp.readFile(encPath);
    const rl = createRl();
    const pass = await readPasswordOnce(rl, "Descifrado");
    rl.close();
    const md = decryptBuffer(buf, pass);
    const dest = args.outPath;
    if (dest && dest !== "-") {
      await fsp.mkdir(path.dirname(path.resolve(dest)), { recursive: true });
      await fsp.writeFile(path.resolve(dest), md, "utf8");
      console.error(`Escrito: ${path.resolve(dest)}`);
    } else {
      process.stdout.write(md);
    }
    return;
  }

  await fsp.mkdir(LOCAL_DIR, { recursive: true });

  const examplePath = path.join(REPO_ROOT, ".env.example");
  const configPath = path.join(REPO_ROOT, "server", "config.js");
  const dotEnvPath = path.join(REPO_ROOT, ".env");

  const exampleRaw = await fsp.readFile(examplePath, "utf8");
  const exampleMeta = parseEnvExample(exampleRaw);
  const configRaw = await fsp.readFile(configPath, "utf8");
  const configKeys = extractProcessEnvKeysFromConfig(configRaw);
  const codeRefs = await scanCodeForEnvKeys(["server", "src"]);

  let dotEnv = null;
  try {
    const raw = await fsp.readFile(dotEnvPath, "utf8");
    dotEnv = parseDotEnvKeys(raw);
  } catch {
    dotEnv = null;
  }

  let health = { skipped: !args.probeLocal };
  if (args.probeLocal) {
    health = await fetchLocalHealth();
  }

  const md = buildMarkdown({
    generatedAt: new Date().toISOString(),
    exampleMeta,
    configKeys,
    codeRefs,
    dotEnv,
    health,
  });

  const outMd = process.env.CREDENTIALS_REGISTRY_OUT || args.outPath || DEFAULT_MD;
  await fsp.mkdir(path.dirname(outMd), { recursive: true });
  await fsp.writeFile(outMd, md, "utf8");
  console.error(`Markdown generado: ${outMd}`);

  if (args.encrypt) {
    const rl = createRl();
    const pass = await readPasswordTwice(rl, "Cifrado");
    rl.close();
    const plain = await fsp.readFile(outMd);
    const enc = encryptBuffer(plain, pass);
    const encPath =
      outMd === DEFAULT_MD ? DEFAULT_ENC : `${outMd.replace(/\.md$/i, "")}.enc`;
    await fsp.writeFile(encPath, enc);
    console.error(`Cifrado escrito: ${encPath}`);
    console.error("Podés borrar el .md en claro cuando ya no lo necesites.");
  }
}

main().catch((e) => {
  console.error(e?.stack || e);
  process.exit(1);
});
