import pg from "pg";

let pool = null;

/** @param {string} databaseUrl */
export function getBancoPool(databaseUrl) {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (err) => {
      console.error("[bancoDb] idle client error:", err?.message);
    });
  }
  return pool;
}

// Códigos de error de conexión/infra de Postgres y de socket. Los errores de
// programación (sintaxis, constraint) NO están acá — esos sí son 500 legítimos.
const DB_CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "53300", // too_many_connections
]);

/** ¿Es una falla transitoria de conexión a la DB? (→ 503, nunca 500) */
export function isDbConnectionError(err) {
  if (!err) return false;
  if (DB_CONNECTION_CODES.has(err.code)) return true;
  return /connection terminated|connection ended|timeout exceeded|pool is draining/i.test(
    err.message || "",
  );
}

/** Solo tests / reinicio manual */
export async function resetBancoPoolForTests() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
