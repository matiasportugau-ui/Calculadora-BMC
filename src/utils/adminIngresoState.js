export function ensureAdminIngresoSuccess(result, fallbackMessage) {
  if (!result?.ok || result?.data?.success === false) {
    throw new Error(result?.data?.error || fallbackMessage);
  }
  return result.data;
}
