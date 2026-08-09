/**
 * Axle count for BMC logistics truck visual (and any length badge).
 * Contract: length ≤ 6 m → 2 axles; length > 6 m → 3 axles (duals under bed).
 * Pure helper — safe to unit-test without R3F.
 *
 * @param {number} length truck bed length in meters (truckL)
 * @returns {2 | 3}
 */
export function axleCount(length) {
  return length <= 6 ? 2 : 3;
}
