/**
 * OmniCRM Sync — Options Page Logic
 */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ── Field Mapping Presets ───────────────────────────────────────
  const MAPPING_PRESETS = {
    google_sheets_all_platforms: {
      timestamp: '$.message.timestamp',
      platform: '$.platform',
      contact_name: '$.contact.name',
      phone: '$.contact.phone',
      email: '$.contact.email',
      message: '$.message.text',
      direction: '$.message.direction',
      category: '$.ai.category',
      summary: '$.ai.summary',
      media_url: '$.message.media.url'
    },
    hubspot_contacts: {
      firstname: '$.contact.firstName',
      lastname: '$.contact.lastName',
      phone: '$.contact.phone',
      email: '$.contact.email',
      hs_lead_status: '$.ai.category',
      description: '$.ai.summary',
      source: '$.platform'
    },
    hubspot_deals: {
      dealname: '$.contact.name',
      pipeline: '$.crm.hubspotPipelineId',
      dealstage: '$.ai.category',
      description: '$.ai.summary',
      amount: '$.message.dealAmount',
      source_platform: '$.platform'
    },
    notion_database: {
      Name: { title: '$.contact.name' },
      Platform: { select: '$.platform' },
      Phone: { phone_number: '$.contact.phone' },
      Email: { email: '$.contact.email' },
      Message: { rich_text: '$.message.text' },
      Category: { select: '$.ai.category' },
      Summary: { rich_text: '$.ai.summary' },
      Date: { date: '$.message.timestamp' }
    },
    airtable_base: {
      Name: '$.contact.name',
      Platform: '$.platform',
      Phone: '$.contact.phone',
      Email: '$.contact.email',
      Message: '$.message.text',
      Direction: '$.message.direction',
      Category: '$.ai.category',
      Summary: '$.ai.summary',
      Timestamp: '$.message.timestamp'
    }
  };

  // ── Default Settings ────────────────────────────────────────────
  const DEFAULT_SETTINGS = {
    platforms: {
      whatsapp: { enabled: true, includeGroups: true, includeMedia: true, syncDirection: 'both' },
      mercadolibre: { enabled: true, apiMode: false },
      facebook: { enabled: true, includeMarketplace: true },
      instagram: { enabled: true }
    },
    crm: {
      type: 'webhook',
      webhookUrl: '',
      webhookMethod: 'POST',
      webhookHeaders: '',
      googleSheetsUrl: '',
      googleSheetsName: '',
      hubspotToken: '',
      hubspotPipelineId: '',
      notionToken: '',
      notionDatabaseId: '',
      airtableToken: '',
      airtableBaseId: '',
      airtableTable: '',
      customUrl: '',
      customMethod: 'POST',
      customHeaders: '',
      customBodyTemplate: ''
    },
    ai: {
      enabled: false,
      categorize: true,
      summarize: false,
      suggestReplies: false,
      model: 'claude-sonnet-4-20250514',
      maxTokens: 1024
    },
    fieldMapping: {
      preset: 'google_sheets_all_platforms',
      custom: ''
    }
  };

  let saveTimer = null;
  const SAVE_DEBOUNCE_MS = 600;

  // ── Init ──────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    loadVersion();
    loadSettings();
    bindTabs();
    bindCRMTypeSwitch();
    bindMappingPreset();
    bindAIKey();
    bindQueueActions();
    bindImportExport();
    bindSaveReset();
    bindAutoSave();
  });

  // ── Version ───────────────────────────────────────────────────────
  function loadVersion() {
    try {
      const manifest = chrome.runtime.getManifest();
      const ver = manifest.version;
      const appVer = $('#appVersion');
      const aboutVer = $('#aboutVersion');
      if (appVer) appVer.textContent = `v${ver}`;
      if (aboutVer) aboutVer.textContent = `Version ${ver}`;
    } catch (_) { /* ignore -- not in extension context */ }
  }

  // ── Load Settings ─────────────────────────────────────────────────
  function loadSettings() {
    try {
      chrome.storage.local.get(null, (data) => {
        if (chrome.runtime.lastError) return;
        applySettingsToUI(data);
      });

      // Load AI key from session
      chrome.storage.session.get('aiApiKey', (result) => {
        if (chrome.runtime.lastError) return;
        const keyInput = $('#aiApiKey');
        if (keyInput && result.aiApiKey) {
          keyInput.value = result.aiApiKey;
        }
      });
    } catch (_) { /* ignore */ }
  }

  function applySettingsToUI(data) {
    $$('[data-setting]').forEach((el) => {
      const path = el.getAttribute('data-setting');
      const value = getNestedValue(data, path);
      if (value === undefined || value === null) return;

      if (el.type === 'checkbox') {
        el.checked = !!value;
      } else if (el.tagName === 'TEXTAREA' && typeof value === 'object') {
        el.value = JSON.stringify(value, null, 2);
      } else {
        el.value = value;
      }
    });

    // Trigger CRM type display
    const crmType = $('#crmType');
    if (crmType) showCRMFields(crmType.value);

    // Trigger mapping preset display
    const preset = $('#mappingPreset');
    if (preset) {
      toggleCustomMapping(preset.value);
      populatePresetPreview(preset.value);
    }

    // Load queue stats
    loadQueueStats();
  }

  // ── Tab Switching ─────────────────────────────────────────────────
  function bindTabs() {
    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');

        $$('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        $$('.tab-panel').forEach(p => p.classList.remove('active'));
        const panel = $(`[data-panel="${tab}"]`);
        if (panel) panel.classList.add('active');

        // Refresh queue when switching to queue tab
        if (tab === 'queue') loadQueueStats();
      });
    });
  }

  // ── CRM Type Switch ──────────────────────────────────────────────
  function bindCRMTypeSwitch() {
    const crmType = $('#crmType');
    if (!crmType) return;

    crmType.addEventListener('change', () => {
      showCRMFields(crmType.value);
    });
  }

  function showCRMFields(type) {
    $$('.crm-fields').forEach((section) => {
      const sectionType = section.getAttribute('data-crm');
      section.style.display = sectionType === type ? '' : 'none';
    });
  }

  // ── Mapping Preset ────────────────────────────────────────────────
  function bindMappingPreset() {
    const preset = $('#mappingPreset');
    if (!preset) return;

    preset.addEventListener('change', () => {
      toggleCustomMapping(preset.value);
      populatePresetPreview(preset.value);
    });
  }

  function toggleCustomMapping(value) {
    const presetPreview = $('#presetPreview');
    const customGroup = $('#customMappingGroup');

    if (value === 'custom') {
      if (presetPreview) presetPreview.style.display = 'none';
      if (customGroup) customGroup.style.display = '';
    } else {
      if (presetPreview) presetPreview.style.display = '';
      if (customGroup) customGroup.style.display = 'none';
    }
  }

  function populatePresetPreview(presetKey) {
    const editor = $('#presetPreviewEditor');
    if (!editor) return;

    const presetData = MAPPING_PRESETS[presetKey];
    if (presetData) {
      editor.value = JSON.stringify(presetData, null, 2);
    } else {
      editor.value = '';
    }
  }

  // ── AI Key (session storage via background) ───────────────────────
  function bindAIKey() {
    const btnSave = $('#btnSaveApiKey');
    const keyInput = $('#aiApiKey');
    if (!btnSave || !keyInput) return;

    btnSave.addEventListener('click', () => {
      const apiKey = keyInput.value.trim();
      if (!apiKey) {
        showToast('Please enter an API key');
        return;
      }

      try {
        // Send to background for session storage
        chrome.runtime.sendMessage({ type: 'SET_API_KEY', apiKey: apiKey }, (response) => {
          if (chrome.runtime.lastError) {
            // Fallback: store directly in session storage
            try {
              chrome.storage.session.set({ aiApiKey: apiKey });
            } catch (_) { /* ignore */ }
          }
          showToast('API key saved to session');
        });
      } catch (_) {
        showToast('Could not save API key');
      }
    });
  }

  // ── Queue Actions ─────────────────────────────────────────────────
  function bindQueueActions() {
    const btnRefresh = $('#btnRefreshQueue');
    const btnClearDead = $('#btnClearDead');
    const btnForceSync = $('#btnForceSync');

    if (btnRefresh) {
      btnRefresh.addEventListener('click', loadQueueStats);
    }

    if (btnClearDead) {
      btnClearDead.addEventListener('click', () => {
        if (!confirm('Clear all dead/failed items from the queue? This cannot be undone.')) return;
        try {
          chrome.runtime.sendMessage({ type: 'CLEAR_QUEUE' }, () => {
            if (chrome.runtime.lastError) {
              showToast('Failed to clear queue');
              return;
            }
            loadQueueStats();
            showToast('Dead items cleared');
          });
        } catch (_) {
          showToast('Failed to clear queue');
        }
      });
    }

    if (btnForceSync) {
      btnForceSync.addEventListener('click', () => {
        btnForceSync.disabled = true;
        btnForceSync.textContent = 'Syncing...';
        try {
          chrome.runtime.sendMessage({ type: 'FORCE_SYNC' }, () => {
            if (chrome.runtime.lastError) {
              showToast('Force sync failed');
            } else {
              showToast('Force sync triggered');
            }
            btnForceSync.disabled = false;
            btnForceSync.textContent = 'Force Sync';
            // Refresh stats after a short delay to let sync process
            setTimeout(loadQueueStats, 1500);
          });
        } catch (_) {
          showToast('Force sync failed');
          btnForceSync.disabled = false;
          btnForceSync.textContent = 'Force Sync';
        }
      });
    }
  }

  function loadQueueStats() {
    try {
      chrome.runtime.sendMessage({ type: 'GET_QUEUE_STATS' }, (response) => {
        if (chrome.runtime.lastError || !response) return;
        renderQueueStats(response);
      });
    } catch (_) { /* ignore */ }
  }

  function renderQueueStats(data) {
    const qPending = $('#qPending');
    const qSent = $('#qSent');
    const qDead = $('#qDead');

    if (qPending) qPending.textContent = data.pending || 0;
    if (qSent) qSent.textContent = data.sent || 0;
    if (qDead) qDead.textContent = data.dead || 0;

    // Render table rows
    const tbody = $('#queueTableBody');
    if (!tbody) return;

    const items = data.items || [];
    if (items.length === 0) {
      tbody.innerHTML = '<tr class="queue-empty"><td colspan="5">Queue is empty</td></tr>';
      return;
    }

    tbody.innerHTML = items.map((item) => {
      const statusClass = item.status === 'pending' ? 'warning'
        : item.status === 'sent' ? 'success' : 'danger';
      const lastAttempt = item.lastAttempt
        ? new Date(item.lastAttempt).toLocaleString()
        : '--';

      return `<tr>
        <td>${escapeHtml(item.platform || '--')}</td>
        <td>${escapeHtml(item.contact || '--')}</td>
        <td><span class="status-dot ${statusClass}"></span>${escapeHtml(item.status || '--')}</td>
        <td>${item.retries || 0}</td>
        <td>${lastAttempt}</td>
      </tr>`;
    }).join('');
  }

  // ── Import / Export ───────────────────────────────────────────────
  function bindImportExport() {
    const btnExport = $('#btnExport');
    const btnImport = $('#btnImport');
    const fileInput = $('#importFileInput');

    if (btnExport) {
      btnExport.addEventListener('click', () => {
        try {
          chrome.storage.local.get(null, (data) => {
            if (chrome.runtime.lastError) return;
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `omnicrm-settings-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Settings exported');
          });
        } catch (_) { /* ignore */ }
      });
    }

    if (btnImport && fileInput) {
      btnImport.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            chrome.storage.local.set(data, () => {
              if (chrome.runtime.lastError) {
                showToast('Import failed');
                return;
              }
              applySettingsToUI(data);
              showToast('Settings imported');
            });
          } catch (err) {
            showToast('Invalid JSON file');
          }
        };
        reader.readAsText(file);
        fileInput.value = '';
      });
    }
  }

  // ── Save / Reset Buttons ──────────────────────────────────────────
  function bindSaveReset() {
    const btnSave = $('#btnSave');
    const btnReset = $('#btnReset');

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        clearTimeout(saveTimer);
        saveAllSettings();
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (!confirm('Reset all settings to their defaults? This cannot be undone.')) return;
        try {
          chrome.storage.local.set(DEFAULT_SETTINGS, () => {
            if (chrome.runtime.lastError) {
              showToast('Reset failed');
              return;
            }
            applySettingsToUI(DEFAULT_SETTINGS);
            showToast('Settings reset to defaults');

            // Notify background
            try {
              chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: DEFAULT_SETTINGS });
            } catch (_) { /* ignore */ }
          });
        } catch (_) {
          showToast('Reset failed');
        }
      });
    }
  }

  // ── Auto-save with debounce ───────────────────────────────────────
  function bindAutoSave() {
    $$('[data-setting]').forEach((el) => {
      const eventType = (el.type === 'checkbox' || el.tagName === 'SELECT')
        ? 'change' : 'input';

      el.addEventListener(eventType, () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveAllSettings, SAVE_DEBOUNCE_MS);
      });
    });
  }

  function saveAllSettings() {
    try {
      chrome.storage.local.get(null, (existing) => {
        if (chrome.runtime.lastError) return;

        const updates = {};

        $$('[data-setting]').forEach((el) => {
          const path = el.getAttribute('data-setting');
          let value;

          if (el.type === 'checkbox') {
            value = el.checked;
          } else if (el.type === 'number') {
            value = parseInt(el.value, 10) || 0;
          } else if (el.classList.contains('json-editor') && !el.readOnly) {
            try {
              value = JSON.parse(el.value);
            } catch (_) {
              value = el.value; // keep as string if invalid JSON
            }
          } else {
            value = el.value;
          }

          setNestedValue(updates, path, value);
        });

        // Deep merge updates into existing
        const merged = deepMerge(existing, updates);

        chrome.storage.local.set(merged, () => {
          if (chrome.runtime.lastError) {
            showToast('Save failed');
            return;
          }
          showToast('Settings saved');

          // Notify background
          try {
            chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: merged });
          } catch (_) { /* ignore */ }
        });
      });
    } catch (_) { /* ignore */ }
  }

  // ── Toast ─────────────────────────────────────────────────────────
  function showToast(message) {
    const toast = $('#saveToast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2000);
  }

  // ── Utility Functions ─────────────────────────────────────────────
  function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, key) => {
      return acc && acc[key] !== undefined ? acc[key] : undefined;
    }, obj);
  }

  function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
