/**
 * OmniCRM Sync — Storage Manager
 * Dual storage: chrome.storage.local (persistent) + chrome.storage.session (ephemeral)
 * Depends on: utils.js
 */

class StorageManager {
  constructor() {
    this.log = new OmniCRM.OmniLog('storage');
    this.defaults = {
      platforms: {
        whatsapp: { enabled: true, syncDirection: 'both', includeGroups: true, includeMedia: true },
        mercadolibre: { enabled: true, apiMode: false },
        facebook: { enabled: true, includeMarketplace: true },
        instagram: { enabled: true }
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
        whatsapp: { synced: 0, today: 0, lastSync: null },
        mercadolibre: { synced: 0, today: 0, lastSync: null },
        facebook: { synced: 0, today: 0, lastSync: null },
        instagram: { synced: 0, today: 0, lastSync: null }
      },
      version: '1.0.0'
    };
  }

  // ── Local Storage (persistent config) ──────────────────────────
  async get(key) {
    try {
      const result = await chrome.storage.local.get(key);
      if (typeof key === 'string') {
        return result[key] !== undefined ? result[key] : this._getDefault(key);
      }
      return result;
    } catch (err) {
      this.log.error('Storage get failed:', err.message);
      return typeof key === 'string' ? this._getDefault(key) : {};
    }
  }

  async set(key, value) {
    try {
      if (typeof key === 'string') {
        await chrome.storage.local.set({ [key]: value });
      } else {
        await chrome.storage.local.set(key);
      }
    } catch (err) {
      this.log.error('Storage set failed:', err.message);
    }
  }

  async remove(key) {
    try {
      await chrome.storage.local.remove(key);
    } catch (err) {
      this.log.error('Storage remove failed:', err.message);
    }
  }

  // ── Session Storage (ephemeral secrets) ────────────────────────
  async getSession(key) {
    try {
      const result = await chrome.storage.session.get(key);
      return typeof key === 'string' ? result[key] || null : result;
    } catch (err) {
      this.log.error('Session get failed:', err.message);
      return null;
    }
  }

  async setSession(key, value) {
    try {
      if (typeof key === 'string') {
        await chrome.storage.session.set({ [key]: value });
      } else {
        await chrome.storage.session.set(key);
      }
    } catch (err) {
      this.log.error('Session set failed:', err.message);
    }
  }

  // ── Initialize with defaults ───────────────────────────────────
  async initialize() {
    const existing = await chrome.storage.local.get(null);
    const toSet = {};
    for (const [key, defaultValue] of Object.entries(this.defaults)) {
      if (existing[key] === undefined) {
        toSet[key] = defaultValue;
      }
    }
    if (Object.keys(toSet).length > 0) {
      await chrome.storage.local.set(toSet);
      this.log.info('Initialized defaults:', Object.keys(toSet));
    }
  }

  // ── Stats helpers ──────────────────────────────────────────────
  async incrementStat(platform, count = 1) {
    const stats = await this.get('stats');
    if (stats[platform]) {
      stats[platform].synced += count;
      stats[platform].today += count;
      stats[platform].lastSync = new Date().toISOString();
      await this.set('stats', stats);
    }
  }

  async resetDailyStats() {
    const stats = await this.get('stats');
    for (const platform of Object.keys(stats)) {
      stats[platform].today = 0;
    }
    await this.set('stats', stats);
  }

  // ── Export / Import ────────────────────────────────────────────
  async exportSettings() {
    const all = await chrome.storage.local.get(null);
    return JSON.stringify(all, null, 2);
  }

  async importSettings(json) {
    const data = JSON.parse(json);
    await chrome.storage.local.set(data);
    this.log.info('Settings imported');
  }

  _getDefault(key) {
    return this.defaults[key] !== undefined ? this.defaults[key] : null;
  }
}

OmniCRM.storage = new StorageManager();
