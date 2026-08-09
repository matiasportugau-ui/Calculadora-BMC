/**
 * workspaceStore.js — pure domain persistence for Panelin Workspace.
 * Separates store CRUD from Express auth so tests hit real SQL without JWT.
 *
 * Tables (panelin_workspace): customers, quotes, files (+ projects/sessions links).
 */

function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function mapCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    rut: row.rut || undefined,
    phone: row.phone || undefined,
    email: row.email || undefined,
    address: row.address || undefined,
    tags: Array.isArray(row.tags) ? row.tags : row.tags || [],
    source: row.source || undefined,
    notes: row.notes || undefined,
    externalId: row.external_id || undefined,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapQuote(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    customerId: row.customer_id || undefined,
    projectId: row.project_id || undefined,
    code: row.code || undefined,
    title: row.title || "",
    scenario: row.scenario || undefined,
    lista: row.lista || undefined,
    currency: row.currency || "USD",
    subtotalSinIva: row.subtotal_sin_iva != null ? Number(row.subtotal_sin_iva) : undefined,
    totalConIva: row.total_con_iva != null ? Number(row.total_con_iva) : undefined,
    status: row.status || "draft",
    payloadJson: row.payload_json || {},
    pdfFileId: row.pdf_file_id || undefined,
    sessionId: row.session_id || undefined,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapFile(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id || undefined,
    sessionId: row.session_id || undefined,
    customerId: row.customer_id || undefined,
    quoteId: row.quote_id || undefined,
    name: row.name,
    path: row.path,
    mime: row.mime,
    size: Number(row.size) || 0,
    kind: row.kind || "other",
    storageUrl: row.storage_url || undefined,
    status: row.status || undefined,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

/**
 * @param {import("pg").Pool} pool
 * @param {object} input
 */
export async function createCustomer(pool, input = {}) {
  const workspaceId = trimOrNull(input.workspaceId) || "ws-1";
  const name = trimOrNull(input.name);
  if (!name) {
    const err = new Error("name_required");
    err.code = "VALIDATION";
    throw err;
  }
  const id = trimOrNull(input.id) || newId("cust");
  const tags = Array.isArray(input.tags) ? input.tags : [];
  await pool.query(
    `INSERT INTO panelin_workspace.customers
       (id, workspace_id, name, rut, phone, email, address, tags, source, notes, external_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)`,
    [
      id,
      workspaceId,
      name,
      trimOrNull(input.rut),
      trimOrNull(input.phone),
      trimOrNull(input.email),
      trimOrNull(input.address),
      JSON.stringify(tags),
      trimOrNull(input.source),
      trimOrNull(input.notes),
      trimOrNull(input.externalId),
    ],
  );
  return getCustomer(pool, id);
}

/** @param {import("pg").Pool} pool */
export async function getCustomer(pool, id) {
  const { rows } = await pool.query(
    `SELECT * FROM panelin_workspace.customers WHERE id = $1`,
    [id],
  );
  return mapCustomer(rows[0] || null);
}

/** @param {import("pg").Pool} pool */
export async function listCustomers(pool, { workspaceId = "ws-1", q } = {}) {
  const ws = trimOrNull(workspaceId) || "ws-1";
  const query = trimOrNull(q);
  if (query) {
    const { rows } = await pool.query(
      `SELECT * FROM panelin_workspace.customers
        WHERE workspace_id = $1
          AND (name ILIKE $2 OR COALESCE(rut,'') ILIKE $2 OR COALESCE(email,'') ILIKE $2)
        ORDER BY name`,
      [ws, `%${query}%`],
    );
    return rows.map(mapCustomer);
  }
  const { rows } = await pool.query(
    `SELECT * FROM panelin_workspace.customers WHERE workspace_id = $1 ORDER BY name`,
    [ws],
  );
  return rows.map(mapCustomer);
}

/**
 * @param {import("pg").Pool} pool
 * @param {object} input
 */
export async function createQuote(pool, input = {}) {
  const workspaceId = trimOrNull(input.workspaceId) || "ws-1";
  const title = trimOrNull(input.title) || "Cotización";
  const id = trimOrNull(input.id) || newId("quote");
  const status = trimOrNull(input.status) || "draft";
  const currency = trimOrNull(input.currency) || "USD";
  const payload = input.payloadJson && typeof input.payloadJson === "object" ? input.payloadJson : {};
  await pool.query(
    `INSERT INTO panelin_workspace.quotes
       (id, workspace_id, customer_id, project_id, code, title, scenario, lista,
        currency, subtotal_sin_iva, total_con_iva, status, payload_json, pdf_file_id, session_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15)`,
    [
      id,
      workspaceId,
      trimOrNull(input.customerId),
      trimOrNull(input.projectId),
      trimOrNull(input.code),
      title,
      trimOrNull(input.scenario),
      trimOrNull(input.lista),
      currency,
      input.subtotalSinIva != null ? Number(input.subtotalSinIva) : null,
      input.totalConIva != null ? Number(input.totalConIva) : null,
      status,
      JSON.stringify(payload),
      trimOrNull(input.pdfFileId),
      trimOrNull(input.sessionId),
    ],
  );
  return getQuote(pool, id);
}

/** @param {import("pg").Pool} pool */
export async function getQuote(pool, id) {
  const { rows } = await pool.query(
    `SELECT * FROM panelin_workspace.quotes WHERE id = $1`,
    [id],
  );
  return mapQuote(rows[0] || null);
}

/** @param {import("pg").Pool} pool */
export async function listQuotes(pool, { workspaceId = "ws-1", customerId, status } = {}) {
  const ws = trimOrNull(workspaceId) || "ws-1";
  const params = [ws];
  let sql = `SELECT * FROM panelin_workspace.quotes WHERE workspace_id = $1`;
  if (trimOrNull(customerId)) {
    params.push(trimOrNull(customerId));
    sql += ` AND customer_id = $${params.length}`;
  }
  if (trimOrNull(status)) {
    params.push(trimOrNull(status));
    sql += ` AND status = $${params.length}`;
  }
  sql += ` ORDER BY created_at DESC`;
  const { rows } = await pool.query(sql, params);
  return rows.map(mapQuote);
}

/**
 * @param {import("pg").Pool} pool
 * @param {object} input
 */
export async function createFile(pool, input = {}) {
  const workspaceId = trimOrNull(input.workspaceId) || "ws-1";
  const name = trimOrNull(input.name);
  const filePath = trimOrNull(input.path);
  if (!name || !filePath) {
    const err = new Error("name_and_path_required");
    err.code = "VALIDATION";
    throw err;
  }
  const id = trimOrNull(input.id) || newId("file");
  const mime = trimOrNull(input.mime) || "application/octet-stream";
  const size = Number(input.size) || 0;
  const kind = trimOrNull(input.kind) || "other";
  await pool.query(
    `INSERT INTO panelin_workspace.files
       (id, workspace_id, project_id, session_id, customer_id, quote_id,
        name, path, mime, size, status, kind, storage_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      workspaceId,
      trimOrNull(input.projectId),
      trimOrNull(input.sessionId),
      trimOrNull(input.customerId),
      trimOrNull(input.quoteId),
      name,
      filePath,
      mime,
      size,
      trimOrNull(input.status),
      kind,
      trimOrNull(input.storageUrl),
    ],
  );
  return getFile(pool, id);
}

/** @param {import("pg").Pool} pool */
export async function getFile(pool, id) {
  const { rows } = await pool.query(
    `SELECT * FROM panelin_workspace.files WHERE id = $1`,
    [id],
  );
  return mapFile(rows[0] || null);
}

/** @param {import("pg").Pool} pool */
export async function listFiles(pool, { workspaceId = "ws-1", customerId, quoteId } = {}) {
  const ws = trimOrNull(workspaceId) || "ws-1";
  const params = [ws];
  let sql = `SELECT * FROM panelin_workspace.files WHERE workspace_id = $1`;
  if (trimOrNull(customerId)) {
    params.push(trimOrNull(customerId));
    sql += ` AND customer_id = $${params.length}`;
  }
  if (trimOrNull(quoteId)) {
    params.push(trimOrNull(quoteId));
    sql += ` AND quote_id = $${params.length}`;
  }
  sql += ` ORDER BY created_at DESC`;
  const { rows } = await pool.query(sql, params);
  return rows.map(mapFile);
}

/**
 * End-to-end store path used by tests: customer → quote → file linked to both.
 * @param {import("pg").Pool} pool
 */
export async function createCustomerQuoteFileChain(pool, {
  workspaceId = "ws-1",
  customerName = "Cliente Test",
  quoteTitle = "Cotización test",
  fileName = "cotizacion.pdf",
} = {}) {
  const customer = await createCustomer(pool, {
    workspaceId,
    name: customerName,
    source: "workspace_store_test",
  });
  const quote = await createQuote(pool, {
    workspaceId,
    customerId: customer.id,
    title: quoteTitle,
    status: "draft",
    currency: "USD",
    totalConIva: 1000,
    payloadJson: { scenario: "techo" },
  });
  const file = await createFile(pool, {
    workspaceId,
    customerId: customer.id,
    quoteId: quote.id,
    name: fileName,
    path: `quotes/${quote.id}/${fileName}`,
    mime: "application/pdf",
    kind: "quote_pdf",
    size: 1024,
    storageUrl: `gs://example/quotes/${quote.id}/${fileName}`,
  });
  return { customer, quote, file };
}
