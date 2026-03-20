/**
 * OmniCRM Sync — Background Service Worker
 * Manifest V3 service worker: central hub for queue processing,
 * port management, alarm scheduling, and CRM dispatch.
 *
 * CRITICAL: MV3 service workers die after 30s of inactivity.
 * ALL state lives in chrome.storage / IndexedDB — never in globals.
 * Ports do NOT survive SW restarts; content scripts auto-reconnect.
 */

/* eslint-env serviceworker */
/* global QueueManager, DataMapper, CRMConnector, AIEngine, PLATFORMS */

// ── Import shared modules ──────────────────────────────────────────
// In SW context these expose classes on `self` (e.g. self.QueueManager).
importScripts(
  '../shared/utils.js',
  '../shared/storage-manager.js',
  '../shared/platform-registry.js',
  '../shared/queue-manager.js',
  '../shared/data-mapper.js',
  '../shared/crm-connector.js',
  '../shared/ai-engine.js'
);

// ── Logger (OmniCRM namespace may not be available in SW) ──────────
const log = {
  _fmt(level, ...args) {
    const ts = new Date().toISOString();
    console[level](`[OmniCRM][SW][${ts}]`, ...args);
  },
  debug(...args) { this._fmt('debug', ...args); },
  info(...args)  { this._fmt('info', ...args); },
  warn(...args)  { this._fmt('warn', ...args); },
  error(...args) { this._fmt('error', ...args); }
};

// ── Instance creation ──────────────────────────────────────────────
// These are re-created every time the SW spins up — they hold no state
// beyond what's in IndexedDB / chrome.storage.
const queueManager = new (self.QueueManager || QueueManager)();
const dataMapper   = new (self.DataMapper   || DataMapper)();
const crmConnector = new (self.CRMConnector || CRMConnector)();
const aiEngine     = new (self.AIEngine     || AIEngine)();

// ── Supported port names ───────────────────────────────────────────
const VALID_PORTS = new Set([
  'port-whatsapp',
  'port-mercadolibre',
  'port-facebook',
  'port-instagram'
]);

// Ephemeral map of connected ports — lost on SW restart, which is fine.
// Content scripts will reconnect automatically via OmniCRM.connectPort().
const activePorts = new Map();

// Track consecutive CRM failures for notification threshold.
let consecutiveFailures = 0;
const FAILURE_NOTIFICATION_THRESHOLD = 3;

// ── Rate-limit tracker (per-platform, in-memory only) ──────────────
const rateLimitState = new Map();

function isRateLimited(platform) {
  const state = rateLimitState.get(platform);
  if (!state) return false;
  if (Date.now() < state.blockedUntil) return true;
  rateLimitState.delete(platform);
  return false;
}

function setRateLimit(platform, retryAfterMs) {
  rateLimitState.set(platform, {
    blockedUntil: Date.now() + (retryAfterMs || 60000)
  });
}


// ═══════════════════════════════════════════════════════════════════
//  1. PORT MANAGEMENT  (chrome.runtime.onConnect)
// ═══════════════════════════════════════════════════════════════════

chrome.runtime.onConnect.addListener((port) => {
  if (!VALID_PORTS.has(port.name)) {
    log.warn(`Rejected unknown port: ${port.name}`);
    port.disconnect();
    return;
  }

  log.info(`Port connected: ${port.name}`);
  activePorts.set(port.name, port);

  port.onMessage.addListener(async (msg) => {
    try {
      await handlePortMessage(port, msg);
    } catch (err) {
      log.error(`Error handling port message from ${port.name}:`, err.message);
    }
  });

  port.onDisconnect.addListener(() => {
    log.info(`Port disconnected: ${port.name}`);
    activePorts.delete(port.name);
    // Content script will auto-reconnect via OmniCRM.connectPort()
  });
});

/**
 * Handle a message received on a platform port.
 */
async function handlePortMessage(port, msg) {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'NEW_INTERACTION': {
      if (!msg.payload) {
        log.warn(`NEW_INTERACTION from ${port.name} missing payload`);
        return;
      }

      const interaction = msg.payload;
      log.info(`New interaction from ${port.name}: ${interaction.id || 'no-id'}`);

      // Enqueue to IndexedDB for reliable delivery
      const itemId = await queueManager.enqueue(interaction);

      // Acknowledge back to content script
      try {
        port.postMessage({ type: 'INTERACTION_QUEUED', id: itemId });
      } catch {
        // Port may have disconnected — that's fine
      }

      // Process immediately (don't wait for alarm)
      processQueue().catch(err =>
        log.error('Immediate queue processing failed:', err.message)
      );
      break;
    }

    case 'PING': {
      try {
        port.postMessage({ type: 'PONG', timestamp: Date.now() });
      } catch {
        // Port gone
      }
      break;
    }

    default:
      log.debug(`Unknown port message type: ${msg.type}`);
  }
}


// ═══════════════════════════════════════════════════════════════════
//  2. MESSAGE HANDLING  (chrome.runtime.onMessage — popup/options)
// ═══════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // All handlers are async — wrap and return true to keep channel open.
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(err => {
      log.error('Message handler error:', err.message);
      sendResponse({ success: false, error: err.message });
    });
  return true; // keep message channel open for async response
});

async function handleMessage(message, _sender) {
  if (!message || !message.type) {
    return { success: false, error: 'Invalid message' };
  }

  switch (message.type) {

    // ── Sync status for popup ────────────────────────────────────
    case 'SYNC_STATUS_REQUEST': {
      const [stats, platforms, pendingCount] = await Promise.all([
        chrome.storage.local.get('stats'),
        chrome.storage.local.get('platforms'),
        queueManager.pendingCount()
      ]);

      return {
        success: true,
        stats: stats.stats || {},
        platforms: platforms.platforms || {},
        pendingCount
      };
    }

    // ── Toggle individual platform ───────────────────────────────
    case 'TOGGLE_PLATFORM': {
      const { platformId, enabled } = message;
      if (!platformId) return { success: false, error: 'Missing platformId' };

      const result = await chrome.storage.local.get('platforms');
      const platforms = result.platforms || {};
      if (platforms[platformId]) {
        platforms[platformId].enabled = !!enabled;
        await chrome.storage.local.set({ platforms });

        // Notify content script if port is connected
        const portName = `port-${platformId}`;
        const port = activePorts.get(portName);
        if (port) {
          try {
            port.postMessage({
              type: 'PLATFORM_STATE_CHANGED',
              enabled: !!enabled
            });
          } catch {
            // Port gone
          }
        }

        log.info(`Platform ${platformId} ${enabled ? 'enabled' : 'disabled'}`);
        return { success: true };
      }
      return { success: false, error: `Unknown platform: ${platformId}` };
    }

    // ── Pause / Resume all ───────────────────────────────────────
    case 'PAUSE_ALL': {
      const result = await chrome.storage.local.get('platforms');
      const platforms = result.platforms || {};
      for (const id of Object.keys(platforms)) {
        platforms[id].enabled = false;
      }
      await chrome.storage.local.set({ platforms });
      broadcastToAllPorts({ type: 'PLATFORM_STATE_CHANGED', enabled: false });
      log.info('All platforms paused');
      return { success: true };
    }

    case 'RESUME_ALL': {
      const result = await chrome.storage.local.get('platforms');
      const platforms = result.platforms || {};
      for (const id of Object.keys(platforms)) {
        platforms[id].enabled = true;
      }
      await chrome.storage.local.set({ platforms });
      broadcastToAllPorts({ type: 'PLATFORM_STATE_CHANGED', enabled: true });
      log.info('All platforms resumed');
      return { success: true };
    }

    // ── Queue statistics ─────────────────────────────────────────
    case 'GET_QUEUE_STATS': {
      const stats = await queueManager.getStats();
      return { success: true, stats };
    }

    // ── Clear dead items from queue ──────────────────────────────
    case 'CLEAR_QUEUE': {
      const removed = await clearDeadItems();
      return { success: true, removed };
    }

    // ── Store Claude API key in session storage ──────────────────
    case 'SET_API_KEY': {
      if (!message.apiKey) return { success: false, error: 'Missing apiKey' };
      await chrome.storage.session.set({ claudeApiKey: message.apiKey });
      log.info('Claude API key stored in session storage');
      return { success: true };
    }

    // ── Force queue processing ───────────────────────────────────
    case 'FORCE_SYNC': {
      processQueue().catch(err =>
        log.error('Forced sync failed:', err.message)
      );
      return { success: true, message: 'Queue processing triggered' };
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

/**
 * Send a message to all connected ports. Best-effort.
 */
function broadcastToAllPorts(msg) {
  for (const [name, port] of activePorts) {
    try {
      port.postMessage(msg);
    } catch {
      activePorts.delete(name);
    }
  }
}


// ═══════════════════════════════════════════════════════════════════
//  3. QUEUE PROCESSING  (main sync logic)
// ═══════════════════════════════════════════════════════════════════

let isProcessing = false;

async function processQueue() {
  // Prevent concurrent processing
  if (isProcessing) {
    log.debug('Queue processing already in progress — skipping');
    return;
  }

  isProcessing = true;

  try {
    const pending = await queueManager.getPending();
    if (pending.length === 0) {
      return;
    }

    log.info(`Processing ${pending.length} pending queue item(s)`);

    // Load CRM config and field mapping once per batch
    const config = await chrome.storage.local.get(['crm', 'fieldMapping', 'customFieldMapping', 'ai']);
    const crmConfig = config.crm || {};
    const mappingName = config.customFieldMapping || config.fieldMapping || 'google_sheets_all_platforms';
    const aiConfig = config.ai || {};
    const aiEnabled = aiConfig.enabled && (await aiEngine.isEnabled());

    for (const item of pending) {
      // Respect per-platform rate limits
      if (isRateLimited(item.platform)) {
        log.debug(`Skipping ${item.id} — platform ${item.platform} is rate-limited`);
        continue;
      }

      try {
        let interaction = item.payload;

        // ── AI categorization (if enabled) ─────────────────────
        if (aiEnabled && aiConfig.categorize && interaction.content?.text) {
          try {
            const categorization = await aiEngine.categorizeMessage(
              interaction.content.text,
              interaction.platform,
              queueManager
            );
            if (categorization) {
              interaction = {
                ...interaction,
                ai: {
                  ...(interaction.ai || {}),
                  category: categorization.category,
                  confidence: categorization.confidence,
                  sentiment: categorization.sentiment
                }
              };
            }
          } catch (aiErr) {
            // AI failure should not block CRM sync
            log.warn(`AI categorization failed for ${item.id}:`, aiErr.message);
          }
        }

        // ── Map payload ────────────────────────────────────────
        const mappedPayload = dataMapper.map(interaction, mappingName);

        // ── Send to CRM ────────────────────────────────────────
        const result = await crmConnector.send(mappedPayload, crmConfig);

        if (result.success) {
          await queueManager.markSuccess(item.id);
          await incrementPlatformStat(item.platform);
          consecutiveFailures = 0;
          log.info(`Synced ${item.id} [${item.platform}]`);
        } else {
          await queueManager.markFailed(item.id, result.error || 'Unknown error');
          consecutiveFailures++;
          log.warn(`Failed ${item.id} [${item.platform}]: ${result.error}`);

          // Handle rate limiting response
          if (result.error && result.error.includes('Rate limited')) {
            const retryMs = parseRetryAfter(result.error);
            setRateLimit(item.platform, retryMs);
            log.warn(`Rate-limited on ${item.platform} — backing off ${retryMs}ms`);
          }

          // Notify user after consecutive failures
          if (consecutiveFailures >= FAILURE_NOTIFICATION_THRESHOLD) {
            showErrorNotification(
              `CRM sync failing: ${consecutiveFailures} consecutive errors. Last: ${result.error}`
            );
          }
        }

      } catch (err) {
        await queueManager.markFailed(item.id, err.message);
        consecutiveFailures++;
        log.error(`Exception processing ${item.id}:`, err.message);

        if (consecutiveFailures >= FAILURE_NOTIFICATION_THRESHOLD) {
          showErrorNotification(
            `CRM sync error: ${err.message}`
          );
        }
      }
    }

  } catch (err) {
    log.error('Queue processing error:', err.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Increment the synced counter for a platform in chrome.storage.
 */
async function incrementPlatformStat(platform) {
  try {
    const result = await chrome.storage.local.get('stats');
    const stats = result.stats || {};
    if (stats[platform]) {
      stats[platform].synced = (stats[platform].synced || 0) + 1;
      stats[platform].today = (stats[platform].today || 0) + 1;
      stats[platform].lastSync = new Date().toISOString();
      await chrome.storage.local.set({ stats });
    }
  } catch (err) {
    log.error('Failed to update platform stats:', err.message);
  }
}

/**
 * Parse "Retry after: Xs" from error string, return ms. Default 60s.
 */
function parseRetryAfter(errorStr) {
  const match = errorStr.match(/Retry after:\s*(\d+)/i);
  if (match) {
    const seconds = parseInt(match[1], 10);
    return isNaN(seconds) ? 60000 : seconds * 1000;
  }
  return 60000;
}

/**
 * Clear dead (permanently failed) items from the queue.
 */
async function clearDeadItems() {
  try {
    const db = await queueManager.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite');
      const store = tx.objectStore('queue');
      const index = store.index('status');
      const req = index.openCursor('dead');
      let removed = 0;

      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          removed++;
          cursor.continue();
        } else {
          log.info(`Cleared ${removed} dead queue item(s)`);
          resolve(removed);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    log.error('Failed to clear dead items:', err.message);
    return 0;
  }
}


// ═══════════════════════════════════════════════════════════════════
//  4. CHROME ALARMS
// ═══════════════════════════════════════════════════════════════════

/**
 * Register all alarms. Called on install, startup, and as a safety net.
 * Alarms may be cleared by Chrome — always re-register.
 */
async function registerAlarms() {
  try {
    // Clear any stale alarms first
    await chrome.alarms.clearAll();

    // Keep-alive: prevent SW from dying during active sessions (30s)
    await chrome.alarms.create('keepAlive', {
      periodInMinutes: 0.5 // 30 seconds — minimum since Chrome 120
    });

    // Queue flush: process any pending items (30s)
    await chrome.alarms.create('queueFlush', {
      delayInMinutes: 0.5,
      periodInMinutes: 0.5
    });

    // Daily cleanup: remove old sent items and expired AI cache
    await chrome.alarms.create('cleanup', {
      delayInMinutes: 1,
      periodInMinutes: 1440 // 24 hours
    });

    // Daily stats reset: zero out daily counters
    await chrome.alarms.create('statsReset', {
      delayInMinutes: 2,
      periodInMinutes: 1440 // 24 hours
    });

    log.info('All alarms registered');
  } catch (err) {
    log.error('Failed to register alarms:', err.message);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  log.debug(`Alarm fired: ${alarm.name}`);

  try {
    switch (alarm.name) {

      case 'keepAlive':
        // Simply firing keeps the SW alive. Log active port count.
        log.debug(`Keep-alive — ${activePorts.size} port(s) connected`);
        break;

      case 'queueFlush':
        await processQueue();
        break;

      case 'cleanup':
        await runCleanup();
        break;

      case 'statsReset':
        await resetDailyStats();
        break;

      default:
        log.debug(`Unknown alarm: ${alarm.name}`);
    }
  } catch (err) {
    log.error(`Alarm handler error (${alarm.name}):`, err.message);
  }
});

/**
 * Daily cleanup: remove old sent items + expired AI cache entries.
 */
async function runCleanup() {
  try {
    const removedQueue = await queueManager.cleanup();
    const removedCache = await queueManager.cleanupAICache();
    log.info(`Cleanup complete — removed ${removedQueue} sent item(s), ${removedCache} expired cache entries`);
  } catch (err) {
    log.error('Cleanup failed:', err.message);
  }
}

/**
 * Reset daily sync counters for all platforms.
 */
async function resetDailyStats() {
  try {
    const result = await chrome.storage.local.get('stats');
    const stats = result.stats || {};
    for (const platform of Object.keys(stats)) {
      stats[platform].today = 0;
    }
    await chrome.storage.local.set({ stats });
    log.info('Daily stats reset');
  } catch (err) {
    log.error('Failed to reset daily stats:', err.message);
  }
}


// ═══════════════════════════════════════════════════════════════════
//  5. LIFECYCLE EVENTS
// ═══════════════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(async (details) => {
  log.info(`Extension installed/updated — reason: ${details.reason}`);

  try {
    // Initialize storage defaults
    await initializeStorageDefaults();

    // Register alarms
    await registerAlarms();

    // Show welcome notification on fresh install
    if (details.reason === 'install') {
      chrome.notifications.create('welcome', {
        type: 'basic',
        iconUrl: 'assets/icons/icon128.png',
        title: 'OmniCRM Sync Installed',
        message: 'Configure your CRM connection in the extension options to start syncing.',
        priority: 1
      });
    }
  } catch (err) {
    log.error('onInstalled handler error:', err.message);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  log.info('Browser startup — re-registering alarms');
  try {
    await registerAlarms();
  } catch (err) {
    log.error('onStartup handler error:', err.message);
  }
});

/**
 * Initialize storage with default values if not already set.
 */
async function initializeStorageDefaults() {
  const defaults = {
    platforms: {
      whatsapp:     { enabled: true, syncDirection: 'both', includeGroups: true, includeMedia: true },
      mercadolibre: { enabled: true, apiMode: false },
      facebook:     { enabled: true, includeMarketplace: true },
      instagram:    { enabled: true }
    },
    crm: {
      type: 'webhook',
      webhookUrl: '',
      webhookMethod: 'POST',
      webhookHeaders: {},
      googleSheetsUrl: '',
      hubspotToken: '',
      notionToken: '',
      notionDatabaseId: '',
      airtableToken: '',
      airtableBaseId: '',
      airtableTable: ''
    },
    ai: {
      enabled: false,
      categorize: true,
      summarize: false,
      suggestReplies: false
    },
    fieldMapping: 'google_sheets_all_platforms',
    customFieldMapping: null,
    stats: {
      whatsapp:     { synced: 0, today: 0, lastSync: null },
      mercadolibre: { synced: 0, today: 0, lastSync: null },
      facebook:     { synced: 0, today: 0, lastSync: null },
      instagram:    { synced: 0, today: 0, lastSync: null }
    },
    version: '1.0.0'
  };

  try {
    const existing = await chrome.storage.local.get(null);
    const toSet = {};
    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (existing[key] === undefined) {
        toSet[key] = defaultValue;
      }
    }
    if (Object.keys(toSet).length > 0) {
      await chrome.storage.local.set(toSet);
      log.info('Initialized storage defaults:', Object.keys(toSet).join(', '));
    }
  } catch (err) {
    log.error('Failed to initialize storage defaults:', err.message);
  }
}


// ═══════════════════════════════════════════════════════════════════
//  6. NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Show an error notification after repeated failures.
 * Debounced: only shows once per 5 minutes to avoid spamming.
 */
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN_MS = 300000; // 5 minutes

function showErrorNotification(message) {
  const now = Date.now();
  if (now - lastNotificationTime < NOTIFICATION_COOLDOWN_MS) {
    return; // Debounce
  }
  lastNotificationTime = now;

  try {
    chrome.notifications.create(`error-${now}`, {
      type: 'basic',
      iconUrl: 'assets/icons/icon128.png',
      title: 'OmniCRM Sync Error',
      message: message.substring(0, 200), // Chrome limits notification length
      priority: 2
    });
  } catch (err) {
    log.error('Failed to create notification:', err.message);
  }
}


// ═══════════════════════════════════════════════════════════════════
//  7. STARTUP SAFETY NET
// ═══════════════════════════════════════════════════════════════════

// On every SW wake-up, ensure alarms exist (they may have been cleared).
(async function onWakeUp() {
  try {
    const existing = await chrome.alarms.getAll();
    const alarmNames = new Set(existing.map(a => a.name));

    if (!alarmNames.has('keepAlive') || !alarmNames.has('queueFlush')) {
      log.info('Missing alarms detected on SW wake — re-registering');
      await registerAlarms();
    }
  } catch (err) {
    log.error('Wake-up alarm check failed:', err.message);
  }
})();

log.info('Service worker loaded');
