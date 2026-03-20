/**
 * OmniCRM Sync — CRM Connector
 * Dispatches mapped payloads to configured CRM endpoints.
 * Supports: Generic Webhook, Google Sheets, HubSpot, Notion, Airtable, Custom REST.
 */

class CRMConnector {
  constructor() {
    this.log = typeof OmniCRM !== 'undefined'
      ? new OmniCRM.OmniLog('crm')
      : { info: console.info.bind(console), warn: console.warn.bind(console), error: console.error.bind(console), debug: console.debug.bind(console) };
    this.requestTimeout = 15000; // 15s per webhook best practice
  }

  /**
   * Send an interaction to the configured CRM.
   * @param {Object} payload - Mapped CRM payload
   * @param {Object} config - CRM configuration from storage
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async send(payload, config) {
    try {
      switch (config.type) {
        case 'webhook':
          return await this._sendWebhook(payload, config);
        case 'google_sheets':
          return await this._sendGoogleSheets(payload, config);
        case 'hubspot':
          return await this._sendHubSpot(payload, config);
        case 'notion':
          return await this._sendNotion(payload, config);
        case 'airtable':
          return await this._sendAirtable(payload, config);
        case 'custom':
          return await this._sendCustom(payload, config);
        default:
          return { success: false, error: `Unknown CRM type: ${config.type}` };
      }
    } catch (err) {
      this.log.error('CRM send failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ── Generic Webhook ────────────────────────────────────────────

  async _sendWebhook(payload, config) {
    const url = config.webhookUrl;
    if (!url) return { success: false, error: 'No webhook URL configured' };

    const uuid = typeof OmniCRM !== 'undefined' ? OmniCRM.generateUUID() : crypto.randomUUID();
    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Source': 'OmniCRM-Sync',
      'X-Webhook-Timestamp': new Date().toISOString(),
      'X-Webhook-Delivery-Id': uuid,
      ...(config.webhookHeaders || {})
    };

    const response = await this._fetch(url, {
      method: config.webhookMethod || 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return { success: true };
    }

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      return { success: false, error: `Rate limited. Retry after: ${retryAfter || 'unknown'}` };
    }

    return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
  }

  // ── Google Sheets (via Apps Script Web App) ────────────────────

  async _sendGoogleSheets(payload, config) {
    const url = config.googleSheetsUrl;
    if (!url) return { success: false, error: 'No Google Sheets URL configured' };

    const response = await this._fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // Apps Script web apps return 302 redirect on success
    if (response.ok || response.redirected) {
      return { success: true };
    }

    return { success: false, error: `Google Sheets error: ${response.status}` };
  }

  // ── HubSpot ────────────────────────────────────────────────────

  async _sendHubSpot(payload, config) {
    const token = config.hubspotToken;
    if (!token) return { success: false, error: 'No HubSpot token configured' };

    const baseUrl = 'https://api.hubapi.com';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Create or update contact
    const contactPayload = {
      properties: {
        firstname: payload.properties?.firstname || payload['Contact Name'] || '',
        phone: payload.properties?.phone || payload['Contact ID'] || '',
        hs_lead_source: payload.properties?.hs_lead_source || payload['Platform'] || ''
      }
    };

    const contactRes = await this._fetch(`${baseUrl}/crm/v3/objects/contacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(contactPayload)
    });

    // Create a note with the message
    const noteText = payload.note || payload['Message'] || '';
    if (noteText) {
      const notePayload = {
        properties: {
          hs_note_body: noteText,
          hs_timestamp: new Date().toISOString()
        }
      };

      await this._fetch(`${baseUrl}/crm/v3/objects/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(notePayload)
      });
    }

    return { success: contactRes.ok || contactRes.status === 409 }; // 409 = contact already exists
  }

  // ── Notion ─────────────────────────────────────────────────────

  async _sendNotion(payload, config) {
    const token = config.notionToken;
    const databaseId = config.notionDatabaseId;
    if (!token || !databaseId) return { success: false, error: 'Notion token or database ID missing' };

    const properties = {};
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'Timestamp') {
        properties[key] = { date: { start: value || new Date().toISOString() } };
      } else {
        properties[key] = { rich_text: [{ text: { content: String(value || '') } }] };
      }
    }

    // Set the title property (Notion requires one)
    const titleKey = Object.keys(payload)[0] || 'Platform';
    properties[titleKey] = { title: [{ text: { content: String(payload[titleKey] || '') } }] };

    const response = await this._fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties
      })
    });

    if (response.ok) return { success: true };
    return { success: false, error: `Notion error: ${response.status}` };
  }

  // ── Airtable ───────────────────────────────────────────────────

  async _sendAirtable(payload, config) {
    const token = config.airtableToken;
    const baseId = config.airtableBaseId;
    const table = config.airtableTable;
    if (!token || !baseId || !table) return { success: false, error: 'Airtable config incomplete' };

    const response = await this._fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          records: [{ fields: payload }]
        })
      }
    );

    if (response.ok) return { success: true };
    return { success: false, error: `Airtable error: ${response.status}` };
  }

  // ── Custom REST API ────────────────────────────────────────────

  async _sendCustom(payload, config) {
    const url = config.customUrl;
    if (!url) return { success: false, error: 'No custom URL configured' };

    const response = await this._fetch(url, {
      method: config.customMethod || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.customHeaders || {})
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) return { success: true };
    return { success: false, error: `Custom API error: ${response.status}` };
  }

  // ── Fetch with timeout ─────────────────────────────────────────

  async _fetch(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Request timeout (${this.requestTimeout}ms)`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

if (typeof self !== 'undefined') {
  self.CRMConnector = CRMConnector;
}
if (typeof window !== 'undefined' && typeof OmniCRM !== 'undefined') {
  OmniCRM.CRMConnector = CRMConnector;
}
