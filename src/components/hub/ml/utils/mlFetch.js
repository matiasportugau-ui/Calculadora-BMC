const BASE = import.meta.env.VITE_ML_CONNECTOR_URL ?? 'http://localhost:3001';
const KEY = import.meta.env.VITE_ML_CONNECTOR_API_KEY ?? '';

export async function mlFetch(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const err = new Error(`ML connector ${res.status}`);
    err.status = res.status;
    try {
      err.payload = await res.json();
    } catch {}
    throw err;
  }

  return res.json();
}
