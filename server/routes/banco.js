/**
 * Banco (METALOG) — libro de movimientos bancarios bajo /api/banco/*.
 * Mount: app.use(createBancoRouter(config, logger))
 *
 * Import de extractos BROU (XLS "Saldos y Movimientos" o CSV legado) con
 * dedup idempotente, clasificación por categoría + entidad
 * (bmc | expreso_este | personal | mixta) y agregados mensuales para la
 * conciliación DGI ↔ facturación ↔ banco (columna C del modelo de tres
 * columnas, docs/team/fiscal/DGI-CLAUDE-INGESTA.md).
 *
 * Auth: requireUser() de server/lib/identityAuth.js; mutaciones con
 * requireUser({ role: "admin" }). Slug "banco" registrado en ALL_MODULES.
 *
 * Error semantics (convención del proyecto):
 *   400 bad input · 401 no auth · 403 forbidden · 404 not found
 *   503 si DB no disponible · nunca 500 por fallas transitorias de infra
 */
import { Router } from "express";
import { getBancoPool, isDbConnectionError } from "../lib/bancoDb.js";
import { requireUser } from "../lib/identityAuth.js";
import {
  ENTIDADES,
  matchRule,
  parseBankStatement,
} from "../lib/bancoStatementParser.js";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CASH_FLOW_TAXONOMY = [
  { key: "ingreso_venta", label: "Ingreso venta", kind: "inflow" },
  { key: "ingreso_otro", label: "Otro ingreso", kind: "inflow" },
  { key: "aporte_socio", label: "Aporte socio", kind: "inflow" },
  { key: "egreso_proveedor", label: "Proveedores", kind: "outflow" },
  { key: "egreso_sueldo", label: "Sueldos", kind: "outflow" },
  { key: "egreso_operativo", label: "Operativo", kind: "outflow" },
  { key: "egreso_financiero", label: "Financiero", kind: "outflow" },
  { key: "egreso_impuesto", label: "Impuestos", kind: "outflow" },
  { key: "transferencia_interna", label: "Transferencia interna", kind: "neutral" },
  { key: "retiro_socio", label: "Retiro socio", kind: "outflow" },
];

const TAXONOMY_BY_KEY = Object.fromEntries(CASH_FLOW_TAXONOMY.map((t) => [t.key, t]));

function categoryMeta(key) {
  if (!key) return { label: "Sin clasificar", kind: "unknown" };
  return TAXONOMY_BY_KEY[key] || { label: key, kind: "unknown" };
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function isoDateOrNull(v) {
  const s = trimOrNull(v);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** entidad: undefined = no tocar · null = limpiar · string validado. */
function entidadOrInvalid(v) {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const s = String(v).trim().toLowerCase();
  return ENTIDADES.includes(s) ? s : "__invalid__";
}

/**
 * @param {import("../config.js").config} config
 * @param {import("pino").Logger} [logger]
 */
export default function createBancoRouter(config, logger) {
  const router = Router();
  const pool = getBancoPool(config.databaseUrl);
  const log = logger || console;

  function requireDb(_req, res, next) {
    if (!pool) {
      return res.status(503).json({ ok: false, error: "DATABASE_URL not configured" });
    }
    return next();
  }

  async function fetchActiveRules() {
    const { rows } = await pool.query(
      `select rule_id, pattern, categoria, entidad, priority
         from banco_rules where archived_at is null
        order by priority asc, created_at asc`,
    );
    return rows;
  }

  // ─── Health (sin auth) ───────────────────────────────────────────────
  router.get(
    "/api/banco/health",
    asyncHandler(async (_req, res) => {
      if (!pool) return res.status(503).json({ ok: false, error: "no_db" });
      try {
        await pool.query("select 1");
        res.json({ ok: true });
      } catch (e) {
        log.warn?.({ err: e }, "[banco] health db ping failed");
        res.status(503).json({ ok: false, error: "db_unreachable" });
      }
    }),
  );

  // ─── Cuentas ─────────────────────────────────────────────────────────
  router.get(
    "/api/banco/accounts",
    requireUser({ module: "banco" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const includeArchived = req.query.include_archived === "1";
      const { rows } = await pool.query(
        `select a.*, count(m.movement_id)::int as movement_count,
                min(m.fecha) as fecha_min, max(m.fecha) as fecha_max
           from banco_accounts a
           left join banco_movements m on m.account_id = a.account_id
          ${includeArchived ? "" : "where a.archived_at is null"}
          group by a.account_id
          order by a.created_at`,
      );
      res.json({ ok: true, accounts: rows });
    }),
  );

  router.post(
    "/api/banco/accounts",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const name = trimOrNull(req.body?.name);
      if (!name) return res.status(400).json({ ok: false, error: "name_required" });
      const bank = trimOrNull(req.body?.bank) || "BROU";
      const currency = (trimOrNull(req.body?.currency) || "UYU").toUpperCase();
      const accountNumber = trimOrNull(req.body?.account_number);
      const entity = trimOrNull(req.body?.entity) || "metalog";
      const { rows } = await pool.query(
        `insert into banco_accounts (bank, name, account_number, currency, entity)
         values ($1, $2, $3, $4, $5) returning *`,
        [bank, name, accountNumber, currency, entity],
      );
      res.status(201).json({ ok: true, account: rows[0] });
    }),
  );

  router.patch(
    "/api/banco/accounts/:id",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, error: "invalid_id" });
      const sets = [];
      const params = [];
      if (req.body?.name !== undefined) {
        const name = trimOrNull(req.body.name);
        if (!name) return res.status(400).json({ ok: false, error: "name_required" });
        params.push(name);
        sets.push(`name = $${params.length}`);
      }
      if (req.body?.account_number !== undefined) {
        params.push(trimOrNull(req.body.account_number));
        sets.push(`account_number = $${params.length}`);
      }
      if (req.body?.archived !== undefined) {
        sets.push(req.body.archived ? "archived_at = now()" : "archived_at = null");
      }
      if (!sets.length) return res.status(400).json({ ok: false, error: "nothing_to_update" });
      params.push(id);
      const { rows } = await pool.query(
        `update banco_accounts set ${sets.join(", ")} where account_id = $${params.length} returning *`,
        params,
      );
      if (!rows.length) return res.status(404).json({ ok: false, error: "not_found" });
      res.json({ ok: true, account: rows[0] });
    }),
  );

  // ─── Import de extracto ──────────────────────────────────────────────
  router.post(
    "/api/banco/import",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const fileBase64 = trimOrNull(req.body?.file_base64);
      const csvText = typeof req.body?.csv === "string" && req.body.csv.trim() ? req.body.csv : null;
      if (!fileBase64 && !csvText) {
        return res.status(400).json({ ok: false, error: "file_required" });
      }
      let buffer = null;
      if (fileBase64) {
        // Buffer.from(x, "base64") nunca lanza: valida charset/padding antes.
        const compact = fileBase64.replace(/[\s\r\n]+/g, "");
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact) || compact.length % 4 !== 0) {
          return res.status(400).json({ ok: false, error: "base64_invalido" });
        }
        buffer = Buffer.from(compact, "base64");
        if (!buffer.length) return res.status(400).json({ ok: false, error: "archivo_vacio" });
        if (buffer.length > MAX_FILE_BYTES) {
          return res.status(400).json({ ok: false, error: "archivo_muy_grande", max_bytes: MAX_FILE_BYTES });
        }
      }

      const parsed = parseBankStatement({ buffer, csvText });
      if (!parsed.headerFound) {
        return res.status(400).json({
          ok: false,
          error: "formato_no_reconocido",
          detail: "No se encontró el header Fecha/Débito/Crédito (export XLS 'Saldos y Movimientos' de e-BROU o CSV equivalente).",
          errors: parsed.errors,
        });
      }

      // Resolver cuenta: account_id explícito > match por número detectado > alta automática.
      const warnings = [];
      let account = null;
      const accountId = trimOrNull(req.body?.account_id);
      if (accountId) {
        if (!UUID_RE.test(accountId)) return res.status(400).json({ ok: false, error: "invalid_account_id" });
        const { rows } = await pool.query("select * from banco_accounts where account_id = $1", [accountId]);
        if (!rows.length) return res.status(404).json({ ok: false, error: "account_not_found" });
        account = rows[0];
        if (
          parsed.meta.accountNumber &&
          account.account_number &&
          parsed.meta.accountNumber !== account.account_number
        ) {
          warnings.push(
            `El extracto es de la cuenta ${parsed.meta.accountNumber} pero se importó a ${account.account_number}.`,
          );
        }
      } else if (parsed.meta.accountNumber) {
        const { rows } = await pool.query(
          "select * from banco_accounts where account_number = $1 and archived_at is null",
          [parsed.meta.accountNumber],
        );
        account = rows[0] || null;
      }
      const dryRun = req.body?.dry_run === true || req.body?.dry_run === "1";
      if (!account && !parsed.meta.accountNumber) {
        return res.status(400).json({
          ok: false,
          error: "account_required",
          detail: "El extracto no trae número de cuenta detectable; indicá account_id.",
        });
      }

      if (dryRun) {
        return res.json({
          ok: true,
          dry_run: true,
          account: account || { detected: parsed.meta },
          meta: parsed.meta,
          total: parsed.movements.length,
          sample: parsed.movements.slice(0, 20),
          errors: parsed.errors,
          warnings,
        });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (!account) {
          const label = parsed.meta.accountLabel || `Cuenta ${parsed.meta.accountNumber}`;
          const { rows } = await client.query(
            `insert into banco_accounts (bank, name, account_number, currency)
             values ('BROU', $1, $2, $3) returning *`,
            [label, parsed.meta.accountNumber, parsed.meta.currency || "UYU"],
          );
          account = rows[0];
        }
        const { rows: batchRows } = await client.query(
          `insert into banco_import_batches (account_id, filename, rows_total, rows_errored, created_by)
           values ($1, $2, $3, $4, $5) returning *`,
          [
            account.account_id,
            trimOrNull(req.body?.filename),
            parsed.movements.length,
            parsed.errors.length,
            req.user?.email || null,
          ],
        );
        const batch = batchRows[0];

        const rules = await fetchActiveRules();
        let imported = 0;
        let rulesApplied = 0;
        for (const m of parsed.movements) {
          const rule = matchRule(m, rules);
          const { rows } = await client.query(
            `insert into banco_movements
               (account_id, batch_id, fecha, descripcion, numero_documento, asunto,
                dependencia, debito, credito, categoria, entidad, dedup_hash)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             on conflict (account_id, dedup_hash) do nothing
             returning movement_id`,
            [
              account.account_id,
              batch.batch_id,
              m.fecha,
              m.descripcion,
              m.numeroDocumento,
              m.asunto,
              m.dependencia,
              m.debito,
              m.credito,
              rule?.categoria || null,
              rule?.entidad || null,
              m.dedupHash,
            ],
          );
          if (rows.length) {
            imported += 1;
            if (rule) rulesApplied += 1;
          }
        }
        const duplicates = parsed.movements.length - imported;
        await client.query(
          "update banco_import_batches set rows_imported = $1, rows_duplicated = $2 where batch_id = $3",
          [imported, duplicates, batch.batch_id],
        );
        await client.query("COMMIT");
        log.info?.(
          { account: account.account_id, imported, duplicates, errors: parsed.errors.length },
          "[banco] import",
        );
        res.status(201).json({
          ok: true,
          account,
          batch_id: batch.batch_id,
          total: parsed.movements.length,
          imported,
          duplicates,
          rules_applied: rulesApplied,
          errors: parsed.errors,
          warnings,
          meta: parsed.meta,
        });
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }),
  );

  /**
   * Filtros de movimientos compartidos por /movements y /summary — la UI manda
   * el mismo query string a ambos, así los agregados nunca divergen de la
   * tabla. Devuelve { error } (→ 400) o { where, params }.
   */
  function parseMovementFilters(query) {
    const where = [];
    const params = [];
    const accountId = trimOrNull(query.account_id);
    if (accountId) {
      if (!UUID_RE.test(accountId)) return { error: "invalid_account_id" };
      params.push(accountId);
      where.push(`m.account_id = $${params.length}`);
    }
    const from = isoDateOrNull(query.from);
    if (from) {
      params.push(from);
      where.push(`m.fecha >= $${params.length}`);
    }
    const to = isoDateOrNull(query.to);
    if (to) {
      params.push(to);
      where.push(`m.fecha <= $${params.length}`);
    }
    const q = trimOrNull(query.q);
    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(m.descripcion ilike $${params.length} or m.asunto ilike $${params.length} or m.numero_documento ilike $${params.length})`,
      );
    }
    const categoria = trimOrNull(query.categoria);
    if (categoria) {
      params.push(categoria);
      where.push(`m.categoria = $${params.length}`);
    }
    const entidad = entidadOrInvalid(trimOrNull(query.entidad) ?? undefined);
    if (entidad === "__invalid__") return { error: "invalid_entidad" };
    if (entidad) {
      params.push(entidad);
      where.push(`m.entidad = $${params.length}`);
    }
    const tipo = trimOrNull(query.tipo);
    if (tipo === "debito") where.push("m.debito is not null");
    else if (tipo === "credito") where.push("m.credito is not null");
    else if (tipo) return { error: "invalid_tipo" };
    if (query.sin_clasificar === "1") {
      where.push("m.categoria is null and m.entidad is null");
    }
    return { where, params };
  }

  // ─── Movimientos ─────────────────────────────────────────────────────
  router.get(
    "/api/banco/movements",
    requireUser({ module: "banco" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const filters = parseMovementFilters(req.query);
      if (filters.error) return res.status(400).json({ ok: false, error: filters.error });
      const { where, params } = filters;
      const whereSql = where.length ? `where ${where.join(" and ")}` : "";

      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

      // round(sum(numeric), 2)::float8: la suma es exacta en numeric; el cast
      // final a float de un valor ya redondeado nunca mueve el centavo.
      const totals = await pool.query(
        `select count(*)::int as total,
                round(coalesce(sum(m.debito), 0), 2)::float8 as debito,
                round(coalesce(sum(m.credito), 0), 2)::float8 as credito
           from banco_movements m ${whereSql}`,
        params,
      );
      const { rows } = await pool.query(
        `select m.*, a.name as account_name, a.currency as account_currency
           from banco_movements m
           join banco_accounts a on a.account_id = m.account_id
          ${whereSql}
          order by m.fecha desc, m.created_at desc
          limit ${limit} offset ${offset}`,
        params,
      );
      res.json({
        ok: true,
        movements: rows,
        total: totals.rows[0].total,
        sums: { debito: totals.rows[0].debito, credito: totals.rows[0].credito },
        limit,
        offset,
      });
    }),
  );

  router.patch(
    "/api/banco/movements/:id",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, error: "invalid_id" });
      const sets = [];
      const params = [];
      if (req.body?.categoria !== undefined) {
        const categoria = trimOrNull(req.body.categoria);
        if (categoria && categoria.length > 80) {
          return res.status(400).json({ ok: false, error: "categoria_muy_larga" });
        }
        params.push(categoria);
        sets.push(`categoria = $${params.length}`);
      }
      const entidad = entidadOrInvalid(req.body?.entidad);
      if (entidad === "__invalid__") return res.status(400).json({ ok: false, error: "invalid_entidad" });
      if (entidad !== undefined) {
        params.push(entidad);
        sets.push(`entidad = $${params.length}`);
      }
      if (req.body?.notas !== undefined) {
        params.push(trimOrNull(req.body.notas));
        sets.push(`notas = $${params.length}`);
      }
      if (!sets.length) return res.status(400).json({ ok: false, error: "nothing_to_update" });
      params.push(id);
      const { rows } = await pool.query(
        `update banco_movements set ${sets.join(", ")} where movement_id = $${params.length} returning *`,
        params,
      );
      if (!rows.length) return res.status(404).json({ ok: false, error: "not_found" });
      res.json({ ok: true, movement: rows[0] });
    }),
  );

  // ─── Resumen (conciliación) ──────────────────────────────────────────
  router.get(
    "/api/banco/summary",
    requireUser({ module: "banco" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const groupKey = trimOrNull(req.query.group) || "mes";
      const groupExpr = {
        mes: "to_char(m.fecha, 'YYYY-MM')",
        categoria: "coalesce(m.categoria, '(sin clasificar)')",
        entidad: "coalesce(m.entidad, '(sin clasificar)')",
      }[groupKey];
      if (!groupExpr) return res.status(400).json({ ok: false, error: "invalid_group" });
      // Mismos filtros que /movements (q, tipo, entidad, sin_clasificar, …):
      // la UI manda el mismo query string y los agregados deben calzar 1:1.
      const filters = parseMovementFilters(req.query);
      if (filters.error) return res.status(400).json({ ok: false, error: filters.error });
      const { where, params } = filters;
      const whereSql = where.length ? `where ${where.join(" and ")}` : "";
      const { rows } = await pool.query(
        `select ${groupExpr} as grupo,
                count(*)::int as movimientos,
                round(coalesce(sum(m.debito), 0), 2)::float8 as debito,
                round(coalesce(sum(m.credito), 0), 2)::float8 as credito,
                round(coalesce(sum(m.credito), 0) - coalesce(sum(m.debito), 0), 2)::float8 as neto
           from banco_movements m ${whereSql}
          group by 1 order by 1`,
        params,
      );
      res.json({ ok: true, group: groupKey, rows });
    }),
  );

  // ─── Cash flow (aggregates) ───────────────────────────────────────────
  router.get(
    "/api/banco/cash-flow",
    requireUser({ module: "banco" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const filters = parseMovementFilters(req.query);
      if (filters.error) return res.status(400).json({ ok: false, error: filters.error });
      const { where, params } = filters;
      const whereSql = where.length ? `where ${where.join(" and ")}` : "";

      const accountId = trimOrNull(req.query.account_id);
      if (!accountId) {
        const { rows: curRows } = await pool.query(
          `select distinct a.currency
             from banco_movements m
             join banco_accounts a on a.account_id = m.account_id
            ${whereSql}`,
          params,
        );
        if (curRows.length > 1) {
          return res.status(400).json({
            ok: false,
            error: "account_id_required",
            detail: "Hay cuentas en distintas monedas; indicá account_id para agregados de cash flow.",
          });
        }
      }

      let currency = "UYU";
      if (accountId) {
        const { rows } = await pool.query(
          "select currency from banco_accounts where account_id = $1",
          [accountId],
        );
        currency = rows[0]?.currency || "UYU";
      } else {
        const { rows: curRows } = await pool.query(
          `select distinct a.currency
             from banco_movements m
             join banco_accounts a on a.account_id = m.account_id
            ${whereSql}`,
          params,
        );
        currency = curRows[0]?.currency || "UYU";
      }

      const totalsQ = await pool.query(
        `select round(coalesce(sum(m.credito), 0), 2)::float8 as inflow,
                round(coalesce(sum(m.debito), 0), 2)::float8 as outflow,
                round(coalesce(sum(m.credito), 0) - coalesce(sum(m.debito), 0), 2)::float8 as net
           from banco_movements m ${whereSql}`,
        params,
      );
      const totals = totalsQ.rows[0] || { inflow: 0, outflow: 0, net: 0 };

      const unclassifiedQ = await pool.query(
        `select count(*)::int as unclassified_count
           from banco_movements m ${whereSql}${whereSql ? " and" : " where"} m.categoria is null`,
        params,
      );

      const monthlyQ = await pool.query(
        `select to_char(m.fecha, 'YYYY-MM') as month,
                round(coalesce(sum(m.credito), 0), 2)::float8 as inflow,
                round(coalesce(sum(m.debito), 0), 2)::float8 as outflow,
                round(coalesce(sum(m.credito), 0) - coalesce(sum(m.debito), 0), 2)::float8 as net
           from banco_movements m ${whereSql}
          group by 1 order by 1`,
        params,
      );
      let cumulative = 0;
      const monthly = monthlyQ.rows.map((r) => {
        cumulative = Math.round((cumulative + Number(r.net)) * 100) / 100;
        return { ...r, cumulative };
      });

      const byCatQ = await pool.query(
        `select m.categoria as category,
                round(coalesce(sum(m.credito), 0) - coalesce(sum(m.debito), 0), 2)::float8 as total
           from banco_movements m ${whereSql}
          group by m.categoria
          order by abs(round(coalesce(sum(m.credito), 0) - coalesce(sum(m.debito), 0), 2)) desc`,
        params,
      );
      const by_category = byCatQ.rows.map((r) => {
        const meta = categoryMeta(r.category);
        return {
          category: r.category,
          label: meta.label,
          total: r.total,
          kind: meta.kind,
        };
      });

      res.json({
        ok: true,
        currency,
        totals,
        unclassified_count: unclassifiedQ.rows[0]?.unclassified_count ?? 0,
        monthly,
        by_category,
      });
    }),
  );

  // ─── Reglas de clasificación ─────────────────────────────────────────
  router.get(
    "/api/banco/rules",
    requireUser({ module: "banco" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const includeArchived = req.query.include_archived === "1";
      const { rows } = await pool.query(
        `select * from banco_rules ${includeArchived ? "" : "where archived_at is null"}
          order by priority asc, created_at asc`,
      );
      res.json({ ok: true, rules: rows });
    }),
  );

  router.post(
    "/api/banco/rules",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const pattern = trimOrNull(req.body?.pattern);
      if (!pattern || pattern.length < 3) {
        return res.status(400).json({ ok: false, error: "pattern_min_3_chars" });
      }
      const categoria = trimOrNull(req.body?.categoria);
      const entidad = entidadOrInvalid(req.body?.entidad);
      if (entidad === "__invalid__") return res.status(400).json({ ok: false, error: "invalid_entidad" });
      if (!categoria && !entidad) {
        return res.status(400).json({ ok: false, error: "categoria_o_entidad_requerida" });
      }
      const priority = Number.isInteger(req.body?.priority) ? req.body.priority : 100;
      const { rows } = await pool.query(
        `insert into banco_rules (pattern, categoria, entidad, priority)
         values ($1, $2, $3, $4) returning *`,
        [pattern, categoria, entidad ?? null, priority],
      );
      res.status(201).json({ ok: true, rule: rows[0] });
    }),
  );

  router.patch(
    "/api/banco/rules/:id",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, error: "invalid_id" });
      const sets = [];
      const params = [];
      if (req.body?.pattern !== undefined) {
        const pattern = trimOrNull(req.body.pattern);
        if (!pattern || pattern.length < 3) {
          return res.status(400).json({ ok: false, error: "pattern_min_3_chars" });
        }
        params.push(pattern);
        sets.push(`pattern = $${params.length}`);
      }
      if (req.body?.categoria !== undefined) {
        params.push(trimOrNull(req.body.categoria));
        sets.push(`categoria = $${params.length}`);
      }
      const entidad = entidadOrInvalid(req.body?.entidad);
      if (entidad === "__invalid__") return res.status(400).json({ ok: false, error: "invalid_entidad" });
      if (entidad !== undefined) {
        params.push(entidad);
        sets.push(`entidad = $${params.length}`);
      }
      if (Number.isInteger(req.body?.priority)) {
        params.push(req.body.priority);
        sets.push(`priority = $${params.length}`);
      }
      if (req.body?.archived !== undefined) {
        sets.push(req.body.archived ? "archived_at = now()" : "archived_at = null");
      }
      if (!sets.length) return res.status(400).json({ ok: false, error: "nothing_to_update" });
      params.push(id);
      const { rows } = await pool.query(
        `update banco_rules set ${sets.join(", ")} where rule_id = $${params.length} returning *`,
        params,
      );
      if (!rows.length) return res.status(404).json({ ok: false, error: "not_found" });
      res.json({ ok: true, rule: rows[0] });
    }),
  );

  router.post(
    "/api/banco/rules/apply",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const where = ["m.categoria is null", "m.entidad is null"];
      const params = [];
      const accountId = trimOrNull(req.body?.account_id);
      if (accountId) {
        if (!UUID_RE.test(accountId)) return res.status(400).json({ ok: false, error: "invalid_account_id" });
        params.push(accountId);
        where.push(`m.account_id = $${params.length}`);
      }
      const from = isoDateOrNull(req.body?.from);
      if (from) {
        params.push(from);
        where.push(`m.fecha >= $${params.length}`);
      }
      const to = isoDateOrNull(req.body?.to);
      if (to) {
        params.push(to);
        where.push(`m.fecha <= $${params.length}`);
      }
      const rules = await fetchActiveRules();
      if (!rules.length) return res.json({ ok: true, updated: 0, detail: "sin reglas activas" });
      const { rows } = await pool.query(
        `select m.movement_id, m.descripcion, m.asunto
           from banco_movements m where ${where.join(" and ")}`,
        params,
      );
      let updated = 0;
      for (const m of rows) {
        const rule = matchRule(m, rules);
        if (!rule) continue;
        await pool.query(
          "update banco_movements set categoria = $1, entidad = $2 where movement_id = $3",
          [rule.categoria, rule.entidad, m.movement_id],
        );
        updated += 1;
      }
      res.json({ ok: true, scanned: rows.length, updated });
    }),
  );

  // Semántica del proyecto: fallas transitorias de conexión a la DB → 503,
  // nunca 500. Los errores de programación siguen al handler global.
  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    if (res.headersSent || !isDbConnectionError(err)) return next(err);
    log.warn?.({ err: err?.message, path: req.path }, "[banco] DB no disponible");
    return res.status(503).json({ ok: false, error: "db_unavailable" });
  });

  return router;
}
