/**
 * Cross-window timer sync for TraKtiMe.
 *
 * When the timer starts/stops in any view (main module or the detached
 * floating widget), broadcast a "changed" ping so the other view refreshes.
 * Uses BroadcastChannel when available (same-origin windows/tabs/PiP), with a
 * no-op fallback so SSR / unsupported environments don't throw.
 */
const CHANNEL = "traktime-timer";

function makeChannel() {
  try {
    if (typeof BroadcastChannel !== "undefined") return new BroadcastChannel(CHANNEL);
  } catch {
    /* ignore */
  }
  return null;
}

let channel = makeChannel();

export function postTimerChanged() {
  try {
    channel?.postMessage({ type: "changed", at: Date.now() });
  } catch {
    /* ignore */
  }
}

/** Subscribe to timer-changed pings. Returns an unsubscribe function. */
export function onTimerChanged(cb) {
  if (!channel) return () => {};
  const handler = (ev) => {
    if (ev?.data?.type === "changed") cb();
  };
  channel.addEventListener("message", handler);
  return () => channel.removeEventListener("message", handler);
}
