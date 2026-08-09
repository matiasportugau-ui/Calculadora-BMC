/**
 * BMC Envíos Setup Wizard — pickup / base place catalog (pure + localStorage).
 * Seed suppliers + user custom; merge never clobbers user places.
 */

import { safeHttpUrl } from "./safeExternalUrl.js";

export const CATALOG_STORAGE_KEY = "bmc-envios-catalog-v1";
export const CATALOG_SCHEMA = "bmc-envios-catalog-v1";

/** Stable seed pickups (SDD-ENVIO-WIZARD). */
export const SEED_PICKUPS = Object.freeze([
  {
    id: "pickup-kingspan-bromyros",
    kind: "pickup",
    label: "Kingspan (Bromyros)",
    mapUrl: "https://share.google/hB23bPU3TqKfwWqgj",
    // Pedro Cosio / Malvín area (approx plant) — share.google short links have no lat/lng
    addressText: "Pedro Cosio, Malvín, Montevideo, Uruguay",
    geo: { lat: -34.8776, lng: -56.1033, source: "seed-approx" },
    aliases: ["kingspan", "bromyros", "bromi"],
    transportistaId: null,
    source: "seed",
    active: true,
  },
  {
    id: "pickup-montfrio",
    kind: "pickup",
    label: "Montfrío",
    mapUrl: "https://share.google/PXF4UgHj9JDvvPZ9v",
    addressText: "Montfrío, Uruguay",
    geo: null,
    aliases: ["montfrio", "montfrío"],
    transportistaId: null,
    source: "seed",
    active: true,
  },
  {
    id: "pickup-ecopaneles",
    kind: "pickup",
    label: "Ecopaneles",
    mapUrl: "https://share.google/mgM01AGG77M6Cgbxr",
    addressText: "Ecopaneles, Uruguay",
    geo: null,
    aliases: ["ecopaneles", "eco panel"],
    transportistaId: null,
    source: "seed",
    active: true,
  },
]);

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix = "place") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalize a place record.
 * @param {object} raw
 * @param {{ source?: "seed"|"user" }} [opts]
 */
export function normalizePlace(raw, opts = {}) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  const label = String(raw.label || "").trim();
  if (!id || !label) return null;
  const kind = raw.kind === "base" ? "base" : "pickup";
  const source = opts.source || (raw.source === "seed" ? "seed" : "user");
  let geo = null;
  if (raw.geo && Number.isFinite(Number(raw.geo.lat)) && Number.isFinite(Number(raw.geo.lng))) {
    geo = {
      lat: Number(raw.geo.lat),
      lng: Number(raw.geo.lng),
      source: String(raw.geo.source || "manual"),
    };
  }
  return {
    id,
    kind,
    label,
    // Persist only http(s); strip javascript:/data:/etc so catalog cannot re-poison UI hrefs.
    mapUrl: safeHttpUrl(raw.mapUrl) || "",
    addressText: String(raw.addressText || "").trim(),
    geo,
    aliases: Array.isArray(raw.aliases) ? raw.aliases.map((a) => String(a).toLowerCase()) : [],
    transportistaId: raw.transportistaId ? String(raw.transportistaId) : null,
    source,
    active: raw.active !== false,
    updatedAt: raw.updatedAt || nowIso(),
  };
}

/**
 * Seed places with updatedAt.
 */
export function buildSeedPlaces() {
  const t = nowIso();
  return SEED_PICKUPS.map((p) => normalizePlace({ ...p, updatedAt: t }, { source: "seed" }));
}

/**
 * Merge seed ∪ stored. Seed fills missing keys only; user places never deleted by seed.
 * @param {object[]} [storedPlaces]
 * @returns {object[]}
 */
export function mergeCatalogPlaces(storedPlaces = []) {
  const byId = new Map();
  for (const s of buildSeedPlaces()) {
    byId.set(s.id, s);
  }
  for (const raw of storedPlaces || []) {
    const p = normalizePlace(raw, { source: raw?.source === "seed" ? "seed" : "user" });
    if (!p) continue;
    const existing = byId.get(p.id);
    if (!existing) {
      byId.set(p.id, p);
      continue;
    }
    // User custom same id wins over seed for label/url/geo
    if (p.source === "user") {
      byId.set(p.id, { ...existing, ...p, source: "user", id: existing.id });
    } else if (existing.source === "seed") {
      // keep seed; allow geo fill from stored seed copy
      byId.set(p.id, {
        ...existing,
        geo: existing.geo || p.geo,
        addressText: existing.addressText || p.addressText,
        mapUrl: existing.mapUrl || p.mapUrl,
      });
    }
  }
  return [...byId.values()].filter((p) => p.active !== false);
}

/**
 * @param {object[]} places
 * @param {"pickup"|"base"|null} [kind]
 */
export function listPlaces(places, kind = null) {
  const list = Array.isArray(places) ? places : [];
  return list.filter((p) => p && p.active !== false && (kind == null || p.kind === kind));
}

/**
 * @param {object[]} places
 * @param {string} id
 */
export function getPlaceById(places, id) {
  const key = String(id || "").trim();
  if (!key) return null;
  return (places || []).find((p) => p.id === key) || null;
}

/**
 * Create user place.
 * @param {object[]} places
 * @param {{ label: string, kind?: "pickup"|"base", mapUrl?: string, addressText?: string, transportistaId?: string, geo?: object }} input
 */
export function addUserPlace(places, input) {
  const label = String(input?.label || "").trim();
  if (!label) return { ok: false, error: "label_required", places };
  const kind = input.kind === "base" ? "base" : "pickup";
  const id = uid(kind === "base" ? "base" : "pickup");
  const place = normalizePlace(
    {
      id,
      kind,
      label,
      mapUrl: input.mapUrl || "",
      addressText: input.addressText || "",
      geo: input.geo || null,
      transportistaId: input.transportistaId || null,
      source: "user",
      active: true,
      updatedAt: nowIso(),
    },
    { source: "user" },
  );
  return { ok: true, place, places: [...(places || []), place] };
}

/**
 * Soft-delete user place (seed cannot be removed; deactivate only if user overwrote).
 */
export function removeUserPlace(places, id) {
  const key = String(id || "").trim();
  const next = (places || []).map((p) => {
    if (p.id !== key) return p;
    if (p.source === "seed") return { ...p, active: false, updatedAt: nowIso() };
    return { ...p, active: false, updatedAt: nowIso() };
  });
  return next;
}

/**
 * Serialize catalog for storage.
 */
export function serializeCatalog(places) {
  return {
    schema: CATALOG_SCHEMA,
    savedAt: nowIso(),
    places: (places || []).map((p) => normalizePlace(p)).filter(Boolean),
  };
}

/**
 * Parse catalog blob.
 * @param {unknown} raw
 */
export function parseCatalog(raw) {
  if (!raw || typeof raw !== "object") {
    return mergeCatalogPlaces([]);
  }
  const places = Array.isArray(raw.places) ? raw.places : Array.isArray(raw) ? raw : [];
  return mergeCatalogPlaces(places);
}

/**
 * Load from localStorage (browser only). Safe no-op in Node.
 */
export function loadCatalogFromStorage(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  if (!storage) return mergeCatalogPlaces([]);
  try {
    const raw = storage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return mergeCatalogPlaces([]);
    return parseCatalog(JSON.parse(raw));
  } catch {
    return mergeCatalogPlaces([]);
  }
}

/**
 * Persist catalog.
 */
export function saveCatalogToStorage(places, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  if (!storage) return false;
  try {
    storage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(serializeCatalog(places)));
    return true;
  } catch {
    return false;
  }
}
