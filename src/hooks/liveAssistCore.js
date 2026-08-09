/**
 * Pure Live Assist contract helpers (no DOM, no React).
 * Spec: docs/team/SDD-PANELIN-COWORK.md — D3, ADR-003, §10.1–10.3
 *
 * ADR-003: buffer frames locally on an interval; attach only when the operator
 * sends a chat message. Autosend is OFF unless explicitly enabled.
 */

/** Default Live assist capture interval (ms). */
export const LIVE_ASSIST_DEFAULT_INTERVAL_MS = 4000;

/**
 * Resolve Live assist interval from env-like values.
 * @param {unknown} raw — e.g. import.meta.env.VITE_COWORK_LIVE_INTERVAL_MS
 * @returns {number}
 */
export function resolveLiveIntervalMs(raw) {
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 500 && n <= 60_000) return Math.floor(n);
  return LIVE_ASSIST_DEFAULT_INTERVAL_MS;
}

/**
 * Autosend of buffered frames without a user message — OFF by default (ADR-003).
 * @param {unknown} raw — e.g. VITE_COWORK_LIVE_AUTOSEND / COWORK_LIVE_AUTOSEND
 */
export function isLiveAutosendEnabled(raw) {
  const v = String(raw ?? "0").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Build the attachment payload consumed by useChat / agentChat.
 * When Live assist is ON, source is always tagged `live_assist`.
 *
 * @param {object|null|undefined} frame
 * @param {{ liveAssist?: boolean }} [opts]
 * @returns {object|null}
 */
export function buildLiveAssistAttachment(frame, opts = {}) {
  if (!frame || !frame.data) return null;
  const live = !!opts.liveAssist;
  const source = live
    ? "live_assist"
    : (["live_assist", "oneshot", "paste", "upload"].includes(frame.source)
      ? frame.source
      : "oneshot");
  return {
    type: "image",
    mime: frame.mime || "image/jpeg",
    data: frame.data,
    source,
    capturedAt: frame.capturedAt || frame.captured_at || null,
    ...(typeof frame.bytes === "number" ? { bytes: frame.bytes } : {}),
  };
}

/**
 * Pure outbound chat turn builder for Co-Work / Live assist.
 * Does not call fetch — returns the body shape useChat posts to /api/agent/chat.
 *
 * @param {{
 *   text: string,
 *   frame?: object|null,
 *   liveAssist?: boolean,
 *   surface?: string,
 *   selectedRow?: number|null,
 *   workbook?: string,
 *   messages?: Array<{role:string, content:string}>,
 *   calcState?: object,
 *   conversationId?: string|null,
 *   aiProvider?: string,
 *   aiModel?: string,
 *   devMode?: boolean,
 * }} opts
 */
export function buildLiveAssistChatRequest(opts = {}) {
  const text = String(opts.text || "").trim();
  const liveAssist = !!opts.liveAssist;
  const attachment = buildLiveAssistAttachment(opts.frame, { liveAssist });
  const attachments = attachment ? [attachment] : [];

  const history = Array.isArray(opts.messages) ? opts.messages : [];
  const userMsg = {
    role: "user",
    content: text,
    ...(attachments.length ? { attachments } : {}),
  };

  const apiMessages = [...history, userMsg].map((m, idx, arr) => {
    const base = { role: m.role, content: m.content };
    if (idx === arr.length - 1 && m.role === "user" && attachments.length) {
      base.attachments = attachments.map((a) => ({
        type: "image",
        mime: a.mime || "image/jpeg",
        data: a.data,
        source: a.source || "oneshot",
        capturedAt: a.capturedAt || null,
      }));
    }
    return base;
  });

  const operatorContext = {
    surface: opts.surface || "panelin_chat",
    liveAssist,
    workbook: opts.workbook || "admin",
    ...(opts.selectedRow != null ? { selectedRow: opts.selectedRow } : {}),
  };

  return {
    body: {
      messages: apiMessages,
      calcState: opts.calcState || {},
      devMode: !!opts.devMode,
      aiProvider: opts.aiProvider || "auto",
      ...(opts.aiProvider && opts.aiProvider !== "auto" && opts.aiModel
        ? { aiModel: opts.aiModel }
        : {}),
      ...(opts.conversationId ? { conversationId: opts.conversationId } : {}),
      surface: operatorContext.surface,
      operatorContext,
    },
    attachments,
    operatorContext,
    /** True only when a frame is attached because Live was ON or oneshot buffer had data */
    hasAttachment: attachments.length > 0,
    /** ADR-003: autosend must not invent a request without user text */
    requiresUserText: true,
  };
}

/**
 * In-memory frame buffer used by Live assist (process-local singleton + pure class).
 * Interval capture writes here; send path reads without clearing while Live is ON.
 */
export class LiveFrameBuffer {
  constructor() {
    /** @type {object|null} */
    this._frame = null;
    this._liveOn = false;
    this._tickCount = 0;
  }

  get liveOn() {
    return this._liveOn;
  }

  get tickCount() {
    return this._tickCount;
  }

  get lastFrame() {
    return this._frame;
  }

  setLiveOn(on) {
    this._liveOn = !!on;
    if (!this._liveOn) {
      // Turning Live OFF does not require wiping the last oneshot/thumb;
      // caller may clear explicitly.
    }
  }

  /** Periodic buffer write (Live assist tick). Always tags source live_assist. */
  writeLiveFrame(frame) {
    if (!frame || !frame.data) return false;
    this._tickCount += 1;
    this._frame = {
      type: "image",
      mime: frame.mime || "image/jpeg",
      data: frame.data,
      source: "live_assist",
      capturedAt: frame.capturedAt || new Date().toISOString(),
      bytes: frame.bytes,
    };
    return true;
  }

  /** One-shot / paste write. */
  writeFrame(frame, source = "oneshot") {
    if (!frame || !frame.data) return false;
    this._frame = {
      type: "image",
      mime: frame.mime || "image/jpeg",
      data: frame.data,
      source: source === "live_assist" ? "live_assist" : (source || "oneshot"),
      capturedAt: frame.capturedAt || new Date().toISOString(),
      bytes: frame.bytes,
    };
    return true;
  }

  /**
   * Consume for chat send. Does not clear buffer while Live is ON (next send gets
   * a fresher frame from the next tick; same frame is OK until then).
   * @returns {object|null}
   */
  consumeForSend() {
    return buildLiveAssistAttachment(this._frame, { liveAssist: this._liveOn });
  }

  clear() {
    this._frame = null;
  }

  /** Full stop: Live off + clear interval responsibility is caller's */
  stop() {
    this._liveOn = false;
  }
}

/** Shared buffer so Admin Ingreso toolbar and Panelin chat share the same Live frames (D2). */
export const sharedLiveFrameBuffer = new LiveFrameBuffer();
