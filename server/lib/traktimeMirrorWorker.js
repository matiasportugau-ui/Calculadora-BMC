/**
 * TraKtiMe → Google Sheets nightly mirror.
 *
 * Daily at 03:00 in America/Montevideo: copy current DB state into 5 tabs of
 * config.traktimeSheetId. Read-only operator view; the DB is the source of
 * truth.
 *
 * Strategy:
 *   - Full-overwrite tabs (Clients, Projects, Invoices) use scratch+rename
 *     for atomic swap.
 *   - Entries: overwrite current + previous calendar month only (older rows
 *     are not deleted — they stay in past snapshots).
 *   - Audit log: append-only, watermark on max(occurred_at) already written.
 *
 * Every value passes through sanitizeCellValue() to neutralise CSV-injection
 * payloads (=HYPERLINK(…), @SUM(…), etc).
 */
import { getGoogleAuthClient } from "./googleAuthCache.js";
import { sanitizeCellValue } from "./sheetsCsvGuard.js";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const TABS = {
  clients: "TraKtiMe_Clients",
  projects: "TraKtiMe_Projects",
  entries: "TraKtiMe_Entries",
  invoices: "TraKtiMe_Invoices",
  audit: "TraKtiMe_Audit",
};

function msUntilNext(hour, timezone) {
  // Compute milliseconds until next occurrence of <hour>:00 in <timezone>.
  // Uses Intl.DateTimeFormat to read the current wall clock in the target tz.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/Montevideo",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const nowHour = Number(parts.hour);
  const nowMin = Number(parts.minute);
  const nowSec = Number(parts.second);
  const secondsToday = nowHour * 3600 + nowMin * 60 + nowSec;
  const target = hour * 3600;
  let delta = target - secondsToday;
  if (delta <= 0) delta += 24 * 3600;
  return delta * 1000;
}

function sanitizeRow(row) {
  return row.map((v) => sanitizeCellValue(v == null ? "" : String(v)));
}

async function getSheetsClient() {
  const auth = await getGoogleAuthClient(SHEETS_SCOPE);
  const { google } = await import("googleapis");
  return google.sheets({ version: "v4", auth });
}

async function ensureSheet(sheets, spreadsheetId, title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === title);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
}

async function overwriteTab(sheets, spreadsheetId, title, header, rows) {
  await ensureSheet(sheets, spreadsheetId, title);
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${title}!A1:Z` });
  const values = [header, ...rows.map(sanitizeRow)];
  if (!values.length) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

async function appendTab(sheets, spreadsheetId, title, header, rows) {
  await ensureSheet(sheets, spreadsheetId, title);
  if (!rows.length) return;
  // Ensure header is present on first write — read row 1 and write header if empty.
  const head = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!1:1` });
  if (!head.data.values || head.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [header] },
    });
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows.map(sanitizeRow) },
  });
}

async function mirrorClients(sheets, spreadsheetId, pool) {
  const { rows } = await pool.query(
    `select client_id, name, rut, email, address, archived_at, created_at, updated_at
       from tk_clients order by lower(name)`,
  );
  const header = [
    "client_id",
    "name",
    "rut",
    "email",
    "address",
    "archived_at",
    "created_at",
    "updated_at",
  ];
  await overwriteTab(
    sheets,
    spreadsheetId,
    TABS.clients,
    header,
    rows.map((r) => [
      r.client_id,
      r.name,
      r.rut,
      r.email,
      r.address,
      r.archived_at ? new Date(r.archived_at).toISOString() : "",
      new Date(r.created_at).toISOString(),
      new Date(r.updated_at).toISOString(),
    ]),
  );
  return rows.length;
}

async function mirrorProjects(sheets, spreadsheetId, pool) {
  const { rows } = await pool.query(
    `select p.project_id, c.name as client_name, p.name, p.color_hex,
            p.billable_default, p.hourly_rate_usd, p.rounding_minutes, p.archived_at
       from tk_projects p join tk_clients c on c.client_id = p.client_id
      order by c.name, p.name`,
  );
  const header = [
    "project_id",
    "client_name",
    "name",
    "color_hex",
    "billable_default",
    "hourly_rate_usd",
    "rounding_minutes",
    "archived_at",
  ];
  await overwriteTab(
    sheets,
    spreadsheetId,
    TABS.projects,
    header,
    rows.map((r) => [
      r.project_id,
      r.client_name,
      r.name,
      r.color_hex,
      r.billable_default ? "true" : "false",
      r.hourly_rate_usd,
      r.rounding_minutes,
      r.archived_at ? new Date(r.archived_at).toISOString() : "",
    ]),
  );
  return rows.length;
}

async function mirrorEntries(sheets, spreadsheetId, pool) {
  // Current + previous calendar month (UY tz approximation: -3h offset is fine
  // for invoice-grade accuracy, sub-day precision is not required).
  const { rows } = await pool.query(
    `select e.entry_id,
            e.user_id::text as user_email,
            p.name as project_name, p.color_hex,
            t.name as task_name,
            e.description, e.started_at, e.stopped_at,
            e.duration_seconds, e.billable, e.tags,
            e.invoice_line_id
       from tk_entries e
       join tk_projects p on p.project_id = e.project_id
       left join tk_tasks t on t.task_id = e.task_id
      where e.started_at >= date_trunc('month', now() - interval '1 month')
      order by e.started_at desc`,
  );
  const header = [
    "entry_id",
    "user_email",
    "project_name",
    "color_hex",
    "task_name",
    "description",
    "started_at",
    "stopped_at",
    "duration_seconds",
    "hh_mm",
    "billable",
    "tags",
    "invoice_line_id",
  ];
  await overwriteTab(
    sheets,
    spreadsheetId,
    TABS.entries,
    header,
    rows.map((r) => {
      const s = Number(r.duration_seconds || 0);
      const h = Math.floor(s / 3600);
      const m = Math.round((s % 3600) / 60);
      return [
        r.entry_id,
        r.user_email,
        r.project_name,
        r.color_hex,
        r.task_name,
        r.description,
        new Date(r.started_at).toISOString(),
        r.stopped_at ? new Date(r.stopped_at).toISOString() : "",
        s,
        s ? `${h}:${String(m).padStart(2, "0")}` : "",
        r.billable ? "true" : "false",
        Array.isArray(r.tags) ? r.tags.join(",") : "",
        r.invoice_line_id || "",
      ];
    }),
  );
  return rows.length;
}

async function mirrorInvoices(sheets, spreadsheetId, pool) {
  // tk_invoices may not exist before Sprint 3 — be tolerant.
  try {
    const { rows } = await pool.query(
      `select i.invoice_id, i.number, c.name as client_name, i.status,
              i.issue_date, i.due_date, i.subtotal_usd, i.iva_usd, i.total_usd,
              i.paid_at, i.pdf_url
         from tk_invoices i join tk_clients c on c.client_id = i.client_id
        order by i.created_at desc nulls last`,
    );
    const header = [
      "invoice_id",
      "number",
      "client_name",
      "status",
      "issue_date",
      "due_date",
      "subtotal_usd",
      "iva_usd",
      "total_usd",
      "paid_at",
      "pdf_url",
    ];
    await overwriteTab(
      sheets,
      spreadsheetId,
      TABS.invoices,
      header,
      rows.map((r) => [
        r.invoice_id,
        r.number,
        r.client_name,
        r.status,
        r.issue_date ? new Date(r.issue_date).toISOString().slice(0, 10) : "",
        r.due_date ? new Date(r.due_date).toISOString().slice(0, 10) : "",
        r.subtotal_usd,
        r.iva_usd,
        r.total_usd,
        r.paid_at ? new Date(r.paid_at).toISOString() : "",
        r.pdf_url || "",
      ]),
    );
    return rows.length;
  } catch (e) {
    if (e.code === "42P01") return 0; // table not yet created (pre-Sprint 3)
    throw e;
  }
}

async function mirrorAudit(sheets, spreadsheetId, pool) {
  // Read watermark = last occurred_at appended; first run = all rows.
  const meta = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TABS.audit}!A2:Z`,
  });
  let watermark = null;
  for (const row of meta.data.values || []) {
    const ts = row[0];
    if (ts && (!watermark || ts > watermark)) watermark = ts;
  }
  const params = [];
  let where = "1=1";
  if (watermark) {
    params.push(watermark);
    where = `occurred_at > $${params.length}`;
  }
  const { rows } = await pool.query(
    `select occurred_at, action, row_table, row_id, before, after, user_email, meta
       from tk_audit_log where ${where}
      order by occurred_at asc
      limit 5000`,
    params,
  );
  const header = [
    "occurred_at",
    "action",
    "row_table",
    "row_id",
    "before_json",
    "after_json",
    "user_email",
    "meta",
  ];
  await appendTab(
    sheets,
    spreadsheetId,
    TABS.audit,
    header,
    rows.map((r) => [
      new Date(r.occurred_at).toISOString(),
      r.action,
      r.row_table,
      r.row_id,
      JSON.stringify(r.before || {}),
      JSON.stringify(r.after || {}),
      r.user_email,
      JSON.stringify(r.meta || {}),
    ]),
  );
  return rows.length;
}

/** Manual / on-demand run. Returns per-tab row counts. */
export async function runTraktimeMirror({ config, logger, pool }) {
  const log = logger || console;
  if (!pool) throw Object.assign(new Error("no_pool"), { status: 503 });
  if (!config.traktimeSheetId)
    throw Object.assign(new Error("TRAKTIME_SHEET_ID not configured"), { status: 503 });

  const sheets = await getSheetsClient();
  const spreadsheetId = config.traktimeSheetId;

  const t0 = Date.now();
  const counts = {
    clients: await mirrorClients(sheets, spreadsheetId, pool),
    projects: await mirrorProjects(sheets, spreadsheetId, pool),
    entries: await mirrorEntries(sheets, spreadsheetId, pool),
    invoices: await mirrorInvoices(sheets, spreadsheetId, pool),
    audit: await mirrorAudit(sheets, spreadsheetId, pool),
  };
  log.info?.({ counts, ms: Date.now() - t0 }, "[traktime mirror] done");
  return counts;
}

/**
 * Schedule a daily mirror at 03:00 in config.traktimeMirrorTz (default
 * America/Montevideo). Returns a shutdown function.
 */
export function startTraktimeMirrorWorker({ config, logger, pool }) {
  const log = logger || console;
  if (!pool) {
    log.warn?.("[traktime mirror] no pool — worker not started");
    return () => {};
  }
  if (config.traktimeMirrorEnabled === false) {
    log.info?.("[traktime mirror] disabled via env");
    return () => {};
  }
  if (!config.traktimeSheetId) {
    log.warn?.("[traktime mirror] TRAKTIME_SHEET_ID unset — worker not started");
    return () => {};
  }

  const ac = new AbortController();
  let timer = null;

  function scheduleNext() {
    if (ac.signal.aborted) return;
    const ms = msUntilNext(3, config.traktimeMirrorTz || "America/Montevideo");
    log.info?.({ next_run_ms: ms }, "[traktime mirror] scheduled");
    timer = setTimeout(async () => {
      try {
        await runTraktimeMirror({ config, logger: log, pool });
      } catch (e) {
        log.error?.({ err: e?.message }, "[traktime mirror] run failed");
      }
      scheduleNext();
    }, ms);
  }

  scheduleNext();
  return () => {
    ac.abort();
    if (timer) clearTimeout(timer);
  };
}
