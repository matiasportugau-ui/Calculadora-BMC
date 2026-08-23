/**
 * WA Cockpit — persistencia de números conectados por coexistencia (Embedded Signup).
 *
 * Tabla `wa_connections` (wa-package/migrations/019). El access token de negocio se
 * guarda CIFRADO (secretBox / TOKEN_ENCRYPTION_KEY); las funciones de listado NUNCA
 * devuelven el token — solo getActiveConnection() (uso interno del resolver de salida)
 * lo descifra.
 *
 * Todas reciben `pool` como primer argumento (pg.Pool) para ser testeables con un
 * fakePool offline, igual que server/lib/wa/waCrmSyncJob.js.
 */
import { encryptString, decryptString } from "../secretBox.js";
import { invalidateWaCredentialsCache } from "./waCredentialsCache.js";

/** Columnas seguras (sin el token) para respuestas de API. */
const PUBLIC_COLUMNS =
  "phone_number_id, waba_id, display_phone_number, verified_name, quality_rating, status, subscribed, connected_by, created_at, updated_at";

/** Mapea una fila a la forma pública (camelCase) que consume el frontend. */
function toPublic(row) {
  if (!row) return null;
  return {
    phoneNumberId: row.phone_number_id,
    wabaId: row.waba_id,
    displayNumber: row.display_phone_number,
    verifiedName: row.verified_name,
    qualityRating: row.quality_rating,
    status: row.status,
    subscribed: row.subscribed,
    connectedBy: row.connected_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Inserta o actualiza un número conectado. Cifra el access token con `encryptionKey`.
 * @returns {Promise<object>} la conexión en forma pública (sin token).
 */
export async function upsertConnection(pool, conn, { encryptionKey } = {}) {
  const {
    phoneNumberId,
    wabaId = null,
    displayNumber = null,
    verifiedName = null,
    qualityRating = null,
    accessToken,
    subscribed = false,
    connectedBy = null,
  } = conn || {};
  if (!phoneNumberId) throw new Error("phoneNumberId required");
  if (!accessToken) throw new Error("accessToken required");
  const tokenEnc = encryptString(accessToken, encryptionKey);
  const { rows } = await pool.query(
    `insert into wa_connections
       (phone_number_id, waba_id, display_phone_number, verified_name, quality_rating,
        access_token_enc, status, subscribed, connected_by, updated_at)
     values ($1, $2, $3, $4, $5, $6, 'active', $7, $8, now())
     on conflict (phone_number_id) do update set
       waba_id = excluded.waba_id,
       display_phone_number = excluded.display_phone_number,
       verified_name = excluded.verified_name,
       quality_rating = excluded.quality_rating,
       access_token_enc = excluded.access_token_enc,
       status = 'active',
       subscribed = excluded.subscribed,
       connected_by = excluded.connected_by,
       updated_at = now()
     returning ${PUBLIC_COLUMNS}`,
    [phoneNumberId, wabaId, displayNumber, verifiedName, qualityRating, tokenEnc, subscribed, connectedBy],
  );
  // Drop outbound credential cache so the new number is used immediately.
  invalidateWaCredentialsCache();
  return toPublic(rows[0]);
}

/** Lista conexiones (metadata, sin token). @returns {Promise<object[]>} */
export async function listConnections(pool) {
  const { rows } = await pool.query(
    `select ${PUBLIC_COLUMNS} from wa_connections order by updated_at desc`,
  );
  return rows.map(toPublic);
}

/**
 * Devuelve la conexión activa con el token DESCIFRADO (uso interno del resolver de
 * salida). Si se pasa phoneNumberId, exige que coincida; si no, toma la más reciente.
 * @returns {Promise<{phoneNumberId,wabaId,accessToken}|null>}
 */
export async function getActiveConnection(pool, { phoneNumberId, encryptionKey } = {}) {
  const params = [];
  let where = "status = 'active'";
  if (phoneNumberId) {
    params.push(phoneNumberId);
    where += ` and phone_number_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `select phone_number_id, waba_id, access_token_enc
       from wa_connections
      where ${where}
      order by updated_at desc
      limit 1`,
    params,
  );
  const row = rows[0];
  if (!row || !row.access_token_enc) return null;
  return {
    phoneNumberId: row.phone_number_id,
    wabaId: row.waba_id,
    accessToken: decryptString(row.access_token_enc, encryptionKey),
  };
}

/** Marca una conexión como inactiva. @returns {Promise<boolean>} true si existía. */
export async function disableConnection(pool, phoneNumberId) {
  const { rowCount } = await pool.query(
    `update wa_connections set status = 'inactive', updated_at = now()
      where phone_number_id = $1 and status = 'active'`,
    [phoneNumberId],
  );
  if (rowCount > 0) invalidateWaCredentialsCache();
  return rowCount > 0;
}
