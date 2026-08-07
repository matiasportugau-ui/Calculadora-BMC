/**
 * Free-Drag long-press guards (touch / trackpad).
 * Prevents beginDrag after the pointer was already released — a race when the
 * timer macrotask runs after pointerup cleared the timeout id too late.
 */

/**
 * @param {{
 *   armedPointerId: number|null|undefined,
 *   eventPointerId: number|null|undefined,
 *   alreadyDragging?: boolean,
 * }} opts
 * @returns {boolean}
 */
export function canFireLongPressDrag({
  armedPointerId,
  eventPointerId,
  alreadyDragging = false,
} = {}) {
  if (alreadyDragging) return false;
  if (armedPointerId == null || eventPointerId == null) return false;
  return armedPointerId === eventPointerId;
}

/**
 * Cancel pending long-press when the pointer slides (orbit/pan intent).
 * @param {number|null|undefined} startX
 * @param {number|null|undefined} startY
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} [thresholdPx]
 * @returns {boolean}
 */
export function shouldCancelLongPress(startX, startY, clientX, clientY, thresholdPx = 12) {
  if (startX == null || startY == null) return false;
  const t = Number(thresholdPx);
  const thr = Number.isFinite(t) && t >= 0 ? t : 12;
  return Math.abs(clientX - startX) > thr || Math.abs(clientY - startY) > thr;
}
