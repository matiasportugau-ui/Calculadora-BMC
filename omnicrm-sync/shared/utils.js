/**
 * OmniCRM Sync — Shared Utilities
 * No dependencies. Must load first in content script chain.
 */

const OmniCRM = window.OmniCRM || {};
window.OmniCRM = OmniCRM;

// ── Logging ──────────────────────────────────────────────────────
OmniCRM.LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 };
OmniCRM.logLevel = OmniCRM.LOG_LEVELS.INFO;

class OmniLog {
  constructor(platform = 'core') {
    this.prefix = `[OmniCRM][${platform}]`;
  }

  debug(...args) {
    if (OmniCRM.logLevel <= OmniCRM.LOG_LEVELS.DEBUG) console.debug(this.prefix, ...args);
  }

  info(...args) {
    if (OmniCRM.logLevel <= OmniCRM.LOG_LEVELS.INFO) console.info(this.prefix, ...args);
  }

  warn(...args) {
    if (OmniCRM.logLevel <= OmniCRM.LOG_LEVELS.WARN) console.warn(this.prefix, ...args);
  }

  error(...args) {
    if (OmniCRM.logLevel <= OmniCRM.LOG_LEVELS.ERROR) console.error(this.prefix, ...args);
  }
}

OmniCRM.OmniLog = OmniLog;

// ── Debounce ─────────────────────────────────────────────────────
OmniCRM.debounce = function debounce(fn, delayMs = 100) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delayMs);
  };
};

// ── Throttle ─────────────────────────────────────────────────────
OmniCRM.throttle = function throttle(fn, limitMs = 200) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= limitMs) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
};

// ── Content Hash (djb2) ──────────────────────────────────────────
OmniCRM.contentHash = function contentHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(36);
};

// ── UUID v4 ──────────────────────────────────────────────────────
OmniCRM.generateUUID = function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

// ── Port Connection with Auto-Reconnect ──────────────────────────
OmniCRM.connectPort = function connectPort(name, onMessage) {
  const log = new OmniLog(name);
  let port = null;
  let messageQueue = [];

  function connect() {
    try {
      port = chrome.runtime.connect({ name });
      log.info('Port connected');

      // Flush queued messages
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        port.postMessage(msg);
      }

      port.onMessage.addListener((msg) => {
        if (onMessage) onMessage(msg);
      });

      port.onDisconnect.addListener(() => {
        log.warn('Port disconnected — reconnecting in 1s');
        port = null;
        setTimeout(connect, 1000);
      });
    } catch (err) {
      log.error('Port connection failed:', err.message);
      port = null;
      setTimeout(connect, 2000);
    }
  }

  connect();

  return {
    postMessage(msg) {
      if (port) {
        try {
          port.postMessage(msg);
        } catch (e) {
          messageQueue.push(msg);
        }
      } else {
        messageQueue.push(msg);
      }
    },
    get connected() {
      return port !== null;
    }
  };
};

// ── Timestamp Helpers ────────────────────────────────────────────
OmniCRM.toISO = function toISO(date) {
  if (date instanceof Date) return date.toISOString();
  if (typeof date === 'number') return new Date(date).toISOString();
  return new Date().toISOString();
};

// ── Safe Query Selector ──────────────────────────────────────────
OmniCRM.qs = function qs(selector, root = document) {
  try {
    return root.querySelector(selector);
  } catch (e) {
    return null;
  }
};

OmniCRM.qsa = function qsa(selector, root = document) {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch (e) {
    return [];
  }
};
