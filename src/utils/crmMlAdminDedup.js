/** Question ids already stored on an Admin row (id `ML-<qid>` or consulta trailer `Q:<qid>`). */
export function mlQuestionIdsOnAdminRows(adminRows) {
  const ids = new Set();
  for (const row of adminRows || []) {
    const id = String(row?.id || "").trim();
    if (id.startsWith("ML-") && id.length > 3) ids.add(id.slice(3));
    const q = String(row?.consulta || "").match(/Q\s*:\s*(\d{6,})/i);
    if (q) ids.add(q[1]);
  }
  return ids;
}

/**
 * Hide a read-only CRM Mercado Libre card when the Admin sheet already has that question.
 * The CRM sync itself is unchanged.
 */
export function filterCrmMlRowsCoveredByAdmin(adminRows, mlRows) {
  const adminIds = new Set(
    (adminRows || []).map((row) => String(row?.id || "").trim()).filter(Boolean),
  );
  const questionIds = mlQuestionIdsOnAdminRows(adminRows);
  return (mlRows || []).filter((row) => {
    const id = String(row?.id || "").trim();
    if (id && adminIds.has(id)) return false;
    const qid = String(row?.mlQuestionId || "").trim();
    if (qid && questionIds.has(qid)) return false;
    return true;
  });
}
