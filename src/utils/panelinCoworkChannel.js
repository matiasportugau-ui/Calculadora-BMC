/**
 * Cross-window bus for Panelin Co-Work desk (parent calculadora ↔ /panelin/cowork).
 * SDD-PANELIN-COWORK §10.4.4 — BroadcastChannel('bmc-panelin-cowork-v1').
 */

export const PANELIN_COWORK_CHANNEL = "bmc-panelin-cowork-v1";

export const COWORK_MSG = {
  CALC_STATE: "calcState",
  CHAT_ACTION: "chatAction",
  FOCUS: "focus",
  CLOSE: "close",
  HELLO: "hello",
};

function makeChannel() {
  try {
    // Browser only — Node's BroadcastChannel keeps the event loop alive in tests.
    if (typeof window === "undefined") return null;
    if (typeof BroadcastChannel !== "undefined") {
      return new BroadcastChannel(PANELIN_COWORK_CHANNEL);
    }
  } catch {
    /* ignore */
  }
  return null;
}

let channel = null;

/** @returns {BroadcastChannel | null} */
export function getPanelinCoworkChannel() {
  if (!channel) channel = makeChannel();
  return channel;
}

/**
 * @param {{ type: string, payload?: unknown, at?: number }} msg
 */
export function postPanelinCoworkMessage(msg) {
  try {
    getPanelinCoworkChannel()?.postMessage({
      ...msg,
      at: typeof msg.at === "number" ? msg.at : Date.now(),
    });
  } catch {
    /* ignore */
  }
}

export function postCalcState(payload) {
  postPanelinCoworkMessage({ type: COWORK_MSG.CALC_STATE, payload });
}

export function postChatAction(payload) {
  postPanelinCoworkMessage({ type: COWORK_MSG.CHAT_ACTION, payload });
}

/**
 * Subscribe to channel messages. Returns unsubscribe.
 * @param {(msg: { type?: string, payload?: unknown, at?: number }) => void} cb
 */
export function onPanelinCoworkMessage(cb) {
  const ch = getPanelinCoworkChannel();
  if (!ch) return () => {};
  const handler = (ev) => {
    const data = ev?.data;
    if (data && typeof data === "object") cb(data);
  };
  ch.addEventListener("message", handler);
  return () => ch.removeEventListener("message", handler);
}
