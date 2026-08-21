const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}

/** Stamp UUID ids on stops so driver events match the trip snapshot. */
export function withStopUuids(stops = []) {
  return (Array.isArray(stops) ? stops : []).map((s, i) => {
    if (isUuid(s?.id)) return s;
    const id =
      globalThis.crypto?.randomUUID?.() ||
      `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    return { ...s, id };
  });
}
