/**
 * PII denylist for PEA evidence paths (G-10 / SDD §9.1).
 */
const DENY_PATTERNS = [
  /\.env$/i,
  /\.env\./i,
  /credentials\.json$/i,
  /service-account.*\.json$/i,
  /secret/i,
  /token/i,
  /password/i,
  /refresh_token/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /mfa[_-]?/i,
  /jwt[_-]?secret/i,
];

/**
 * @param {string} filePath
 */
export function isDeniedEvidencePath(filePath) {
  if (!filePath || typeof filePath !== "string") return true;
  const normalized = filePath.replace(/\\/g, "/");
  return DENY_PATTERNS.some((re) => re.test(normalized));
}

/**
 * @param {string[]} paths
 */
export function filterEvidencePaths(paths) {
  if (!Array.isArray(paths)) return [];
  return paths.filter((p) => !isDeniedEvidencePath(p));
}

/**
 * Strip sensitive keys from gap metadata before persistence/display.
 * @param {object} metadata
 */
export function sanitizeGapMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};
  const out = { ...metadata };
  for (const key of Object.keys(out)) {
    if (/secret|token|password|key|credential/i.test(key)) {
      out[key] = "[redacted]";
    }
  }
  if (out.evidence_paths) {
    out.evidence_paths = filterEvidencePaths(out.evidence_paths);
  }
  return out;
}
