/**
 * Billable window for tercerizado trips: quote starts at factory arrival,
 * not at BMC depot positioning.
 */

/**
 * @param {object|null|undefined} info
 * @returns {"factory"|"base"}
 */
export function quoteStartForTrip(info = {}) {
  if (info?.quoteStart === "factory" || info?.quoteStart === "base") return info.quoteStart;
  if (info?.tercerizado === true) return "factory";
  return "base";
}

/**
 * Slice operational legs so the first billed point is the first factory pickup.
 * The positioning leg into that plant is excluded (km of the anchor = 0).
 *
 * @param {{ orderedLegs?: object[], totalKm?: number|null, suggestionSource?: string }} route
 * @param {{ quoteStart?: "factory"|"base", info?: object }} [opts]
 * @returns {{
 *   quoteStart: "factory"|"base",
 *   orderedLegs: object[],
 *   totalKm: number|null,
 *   excludedLegs: object[],
 *   suggestionSource?: string,
 * }}
 */
export function billableRoute(route, opts = {}) {
  const start = opts.quoteStart || quoteStartForTrip(opts.info || {});
  const legs = Array.isArray(route?.orderedLegs) ? route.orderedLegs : [];
  if (start !== "factory") {
    return {
      quoteStart: "base",
      orderedLegs: legs,
      totalKm: route?.totalKm ?? sumKm(legs),
      excludedLegs: [],
      suggestionSource: route?.suggestionSource,
    };
  }
  const i = legs.findIndex((l) => l?.type === "pickup");
  if (i < 0) {
    return {
      quoteStart: "factory",
      orderedLegs: legs,
      totalKm: route?.totalKm ?? sumKm(legs),
      excludedLegs: [],
      suggestionSource: route?.suggestionSource,
    };
  }
  const excludedLegs = legs.slice(0, i);
  const orderedLegs = legs.slice(i).map((leg, idx) =>
    idx === 0 ? { ...leg, legKmFromPrev: 0, quoteAnchor: true } : { ...leg },
  );
  return {
    quoteStart: "factory",
    orderedLegs,
    totalKm: sumKm(orderedLegs),
    excludedLegs,
    suggestionSource: route?.suggestionSource,
  };
}

function sumKm(legs) {
  let total = 0;
  let n = 0;
  for (const leg of legs || []) {
    const d = Number(leg?.legKmFromPrev);
    if (!Number.isFinite(d) || d <= 0) continue;
    total += d;
    n += 1;
  }
  return n ? total : null;
}
