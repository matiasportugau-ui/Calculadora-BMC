/**
 * OmniCRM Sync — Queue Manager
 * IndexedDB-backed reliable delivery queue with retry logic.
 * Used by service worker only (via importScripts).
 */

class QueueManager {
  constructor() {
    this.dbName = 'omnicrm_queue';
    this.dbVersion = 1;
    this.maxRetries = 5;
    this.backoffBase = 2000; // 2s, 4s, 8s, 16s, 32s
    this.log = typeof OmniCRM !== 'undefined'
      ? new OmniCRM.OmniLog('queue')
      : { info: console.info.bind(console), warn: console.warn.bind(console), error: console.error.bind(console), debug: console.debug.bind(console) };
  }

  async getDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.dbVersion);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('queue')) {
          const store = db.createObjectStore('queue', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('platform', 'platform', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('ai_cache')) {
          const cache = db.createObjectStore('ai_cache', { keyPath: 'hash' });
          cache.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
  }

  /**
   * Add an interaction to the queue.
   * @param {Object} interaction - The standardized interaction event
   * @returns {Promise<string>} The queue item ID
   */
  async enqueue(interaction) {
    const db = await this.getDB();
    const item = {
      id: interaction.id || (typeof OmniCRM !== 'undefined' ? OmniCRM.generateUUID() : crypto.randomUUID()),
      platform: interaction.platform,
      payload: interaction,
      status: 'pending',
      retries: 0,
      nextRetryAt: null,
      createdAt: Date.now(),
      lastError: null
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite');
      tx.objectStore('queue').put(item);
      tx.oncomplete = () => {
        this.log.debug(`Enqueued: ${item.id} [${item.platform}]`);
        resolve(item.id);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get all pending items ready for processing.
   * @returns {Promise<Object[]>}
   */
  async getPending() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readonly');
      const store = tx.objectStore('queue');
      const index = store.index('status');
      const req = index.getAll('pending');
      req.onsuccess = () => {
        const now = Date.now();
        const ready = req.result.filter(item =>
          !item.nextRetryAt || item.nextRetryAt <= now
        );
        resolve(ready);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Mark an item as successfully sent.
   * @param {string} id
   */
  async markSuccess(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite');
      const store = tx.objectStore('queue');
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) {
          req.result.status = 'sent';
          req.result.sentAt = Date.now();
          store.put(req.result);
        }
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Mark an item as failed, schedule retry with exponential backoff.
   * @param {string} id
   * @param {string} error - Error message
   */
  async markFailed(id, error) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite');
      const store = tx.objectStore('queue');
      const req = store.get(id);
      req.onsuccess = () => {
        const item = req.result;
        if (!item) { resolve(); return; }

        item.retries += 1;
        item.lastError = error;

        if (item.retries >= this.maxRetries) {
          item.status = 'dead';
          this.log.warn(`Item ${id} exceeded max retries — marked dead`);
        } else {
          item.status = 'pending';
          item.nextRetryAt = Date.now() + this.backoffBase * Math.pow(2, item.retries - 1);
          this.log.info(`Item ${id} retry ${item.retries}/${this.maxRetries} — next at +${this.backoffBase * Math.pow(2, item.retries - 1)}ms`);
        }

        store.put(item);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Remove successfully sent items older than 24 hours.
   */
  async cleanup() {
    const db = await this.getDB();
    const cutoff = Date.now() - 86400000;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite');
      const store = tx.objectStore('queue');
      const req = store.openCursor();
      let removed = 0;
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.status === 'sent' && cursor.value.sentAt < cutoff) {
            cursor.delete();
            removed++;
          }
          cursor.continue();
        } else {
          if (removed > 0) this.log.info(`Cleaned up ${removed} sent items`);
          resolve(removed);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get queue statistics per platform.
   * @returns {Promise<Object>}
   */
  async getStats() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readonly');
      const req = tx.objectStore('queue').getAll();
      req.onsuccess = () => {
        const stats = { pending: 0, sent: 0, dead: 0, byPlatform: {} };
        for (const item of req.result) {
          stats[item.status] = (stats[item.status] || 0) + 1;
          if (!stats.byPlatform[item.platform]) {
            stats.byPlatform[item.platform] = { pending: 0, sent: 0, dead: 0 };
          }
          stats.byPlatform[item.platform][item.status] = (stats.byPlatform[item.platform][item.status] || 0) + 1;
        }
        resolve(stats);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get count of pending items.
   * @returns {Promise<number>}
   */
  async pendingCount() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readonly');
      const index = tx.objectStore('queue').index('status');
      const req = index.count('pending');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ── AI Cache ───────────────────────────────────────────────────

  async getCachedAI(hash) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('ai_cache', 'readonly');
      const req = tx.objectStore('ai_cache').get(hash);
      req.onsuccess = () => {
        const result = req.result;
        if (result && result.expiresAt > Date.now()) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async setCachedAI(hash, data, ttlMs = 604800000) { // 7 days default
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('ai_cache', 'readwrite');
      tx.objectStore('ai_cache').put({
        hash,
        data,
        expiresAt: Date.now() + ttlMs,
        createdAt: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async cleanupAICache() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('ai_cache', 'readwrite');
      const store = tx.objectStore('ai_cache');
      const now = Date.now();
      const req = store.openCursor();
      let removed = 0;
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.expiresAt <= now) {
            cursor.delete();
            removed++;
          }
          cursor.continue();
        } else {
          resolve(removed);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }
}

// Make available in service worker context
if (typeof self !== 'undefined') {
  self.QueueManager = QueueManager;
}
if (typeof window !== 'undefined' && typeof OmniCRM !== 'undefined') {
  OmniCRM.QueueManager = QueueManager;
}
