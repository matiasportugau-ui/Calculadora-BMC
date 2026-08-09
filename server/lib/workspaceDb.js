import pg from "pg";

let pool = null;

/** @param {string} databaseUrl */
export function getWorkspacePool(databaseUrl) {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (err) => {
      console.error("[workspaceDb] idle client error:", err?.message);
    });
  }
  return pool;
}

const DB_CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "57P01",
  "57P02",
  "57P03",
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "53300",
]);

/** @param {unknown} err */
export function isDbConnectionError(err) {
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  return DB_CONNECTION_CODES.has(code);
}
