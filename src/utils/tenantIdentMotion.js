/** Movie-title lock after “Continuar con Google”, before the calculator. */
export const IDENT_OVERTURE_MS = 2400;

export function identOvertureMs(matchMedia) {
  try {
    if (matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return 0;
  } catch {
    /* ignore */
  }
  return IDENT_OVERTURE_MS;
}

/** Glory lock only after Google grant, and never for an uninvited Gmail. */
export function shouldPlayIdentCinema({ role, member } = {}) {
  if (role === "admin" || role === "superadmin") return true;
  return Boolean(member && member.slug);
}

export function waitMs(ms) {
  const n = Number(ms) || 0;
  if (n <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, n);
  });
}
