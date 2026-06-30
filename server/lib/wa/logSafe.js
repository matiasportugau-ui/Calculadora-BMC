/**
 * Sanitize a value before embedding it in a log MESSAGE string. WhatsApp webhook
 * fields (chat_id, profile name) are user-controlled, so interpolating them raw
 * lets an attacker inject CR/LF and forge log lines (CWE-117). Strip control
 * characters and cap length. Structured log fields (pino's merge object) don't
 * need this — only template/concatenated message strings do.
 * @param {*} v
 * @returns {string}
 */
export function logSafe(v) {
  return String(v == null ? "" : v).replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 256);
}
