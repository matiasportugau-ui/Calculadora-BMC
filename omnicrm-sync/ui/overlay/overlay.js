/**
 * OmniCRM Sync — Overlay (Content Script)
 * Shadow DOM isolated FAB + mini control panel.
 * Depends on: utils.js, storage-manager.js
 */

class OmniCRMOverlay {
  static PLATFORM_COLORS = {
    whatsapp: '#25D366',
    mercadolibre: '#FFE600',
    facebook: '#0084FF',
    instagram: null // uses gradient
  };

  static PLATFORM_LABELS = {
    whatsapp: 'WhatsApp',
    mercadolibre: 'MercadoLibre',
    facebook: 'Facebook',
    instagram: 'Instagram'
  };

  static PLATFORM_ICONS = {
    whatsapp: '<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.01a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zM20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.893c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 005.683 1.448h.005c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411z"/></svg>',
    mercadolibre: '<svg viewBox="0 0 24 24" width="24" height="24" fill="#333"><circle cx="12" cy="12" r="10" fill="#FFE600" stroke="#333" stroke-width="1"/><text x="12" y="16" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">ML</text></svg>',
    facebook: '<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>'
  };

  constructor(platformId = 'whatsapp') {
    this.log = new OmniCRM.OmniLog('overlay');
    this.platformId = platformId;
    this.color = OmniCRMOverlay.PLATFORM_COLORS[platformId] || '#25D366';
    this.label = OmniCRMOverlay.PLATFORM_LABELS[platformId] || 'Unknown';
    this.panelVisible = false;
    this.status = 'active'; // active | pending | error
    this.autoSync = true;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.stats = { messages: 0, contacts: 0, pending: 0 };
    this._darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    this._init();
  }

  // ── Inline styles (injected into shadow DOM) ─────────────────────
  _getStyles() {
    const accent = this.color || '#25D366';
    const igGradient = 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)';
    const isIG = this.platformId === 'instagram';
    const fabBg = isIG ? igGradient : accent;
    const isML = this.platformId === 'mercadolibre';
    const fabTextColor = isML ? '#333' : '#fff';

    return `
      :host { all: initial; }

      *, *::before, *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .omnicrm-fab {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: ${fabBg};
        border: none;
        cursor: grab;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        position: relative;
        transition: box-shadow 0.2s ease, transform 0.15s ease;
        user-select: none;
        touch-action: none;
        color: ${fabTextColor};
      }

      .omnicrm-fab:hover {
        box-shadow: 0 6px 20px rgba(0,0,0,0.35);
        transform: scale(1.05);
      }

      .omnicrm-fab:active {
        cursor: grabbing;
      }

      .omnicrm-fab svg {
        width: 28px;
        height: 28px;
        pointer-events: none;
      }

      .omnicrm-status-dot {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid #fff;
        transition: background-color 0.3s ease;
      }

      .omnicrm-status-dot.active { background-color: #22c55e; }
      .omnicrm-status-dot.pending { background-color: #eab308; }
      .omnicrm-status-dot.error { background-color: #ef4444; }

      .omnicrm-panel {
        position: absolute;
        bottom: 64px;
        right: 0;
        width: 280px;
        background: ${this._darkMode ? '#1e1e1e' : '#ffffff'};
        color: ${this._darkMode ? '#e0e0e0' : '#1a1a1a'};
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        overflow: hidden;
        opacity: 0;
        transform: translateY(8px) scale(0.95);
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
      }

      .omnicrm-panel.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .omnicrm-panel-header {
        padding: 14px 16px;
        background: ${fabBg};
        color: ${fabTextColor};
        font-weight: 600;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .omnicrm-panel-header svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
      }

      .omnicrm-panel-body {
        padding: 14px 16px;
      }

      .omnicrm-stats {
        font-size: 13px;
        color: ${this._darkMode ? '#aaa' : '#666'};
        margin-bottom: 12px;
      }

      .omnicrm-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }

      .omnicrm-row-label {
        font-size: 13px;
        font-weight: 500;
      }

      /* Toggle switch */
      .omnicrm-toggle {
        position: relative;
        width: 40px;
        height: 22px;
        cursor: pointer;
      }

      .omnicrm-toggle input {
        opacity: 0;
        width: 0;
        height: 0;
        position: absolute;
      }

      .omnicrm-toggle-track {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: ${this._darkMode ? '#444' : '#ccc'};
        border-radius: 11px;
        transition: background 0.2s ease;
      }

      .omnicrm-toggle input:checked + .omnicrm-toggle-track {
        background: ${isIG ? '#dc2743' : accent};
      }

      .omnicrm-toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.2s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }

      .omnicrm-toggle input:checked ~ .omnicrm-toggle-thumb {
        transform: translateX(18px);
      }

      .omnicrm-btn-row {
        display: flex;
        gap: 8px;
        margin-top: 4px;
      }

      .omnicrm-btn {
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease, transform 0.1s ease;
      }

      .omnicrm-btn:active {
        transform: scale(0.97);
      }

      .omnicrm-btn-primary {
        background: ${isIG ? '#dc2743' : accent};
        color: ${fabTextColor};
      }

      .omnicrm-btn-primary:hover {
        filter: brightness(1.1);
      }

      .omnicrm-btn-secondary {
        background: ${this._darkMode ? '#333' : '#f0f0f0'};
        color: ${this._darkMode ? '#ccc' : '#555'};
      }

      .omnicrm-btn-secondary:hover {
        background: ${this._darkMode ? '#444' : '#e0e0e0'};
      }

      .omnicrm-queue {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid ${this._darkMode ? '#333' : '#eee'};
        font-size: 12px;
        color: ${this._darkMode ? '#888' : '#999'};
        text-align: center;
      }

      @media (prefers-color-scheme: dark) {
        .omnicrm-panel { background: #1e1e1e; color: #e0e0e0; }
        .omnicrm-stats { color: #aaa; }
        .omnicrm-toggle-track { background: #444; }
        .omnicrm-btn-secondary { background: #333; color: #ccc; }
        .omnicrm-btn-secondary:hover { background: #444; }
        .omnicrm-queue { border-top-color: #333; color: #888; }
      }
    `;
  }

  // ── Build DOM ────────────────────────────────────────────────────
  _init() {
    // Create host element
    this.host = document.createElement('div');
    this.host.classList.add('omnicrm-host');

    // Attach shadow DOM
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = this._getStyles();
    this.shadow.appendChild(styleEl);

    // Container
    const container = document.createElement('div');
    container.classList.add('omnicrm-container');

    // FAB
    this.fab = document.createElement('button');
    this.fab.classList.add('omnicrm-fab');
    this.fab.setAttribute('aria-label', `OmniCRM ${this.label} Sync`);
    this.fab.innerHTML = `
      ${OmniCRMOverlay.PLATFORM_ICONS[this.platformId] || ''}
      <span class="omnicrm-status-dot ${this.status}"></span>
    `;
    this.statusDot = this.fab.querySelector('.omnicrm-status-dot');

    // Panel
    this.panel = document.createElement('div');
    this.panel.classList.add('omnicrm-panel');
    this.panel.innerHTML = `
      <div class="omnicrm-panel-header">
        ${OmniCRMOverlay.PLATFORM_ICONS[this.platformId] || ''}
        <span>${this.label} Sync Active</span>
      </div>
      <div class="omnicrm-panel-body">
        <div class="omnicrm-stats" data-ref="stats">
          Today: 0 messages | 0 contacts
        </div>
        <div class="omnicrm-row">
          <span class="omnicrm-row-label">Auto-Sync</span>
          <label class="omnicrm-toggle">
            <input type="checkbox" data-ref="autoSyncToggle" checked>
            <span class="omnicrm-toggle-track"></span>
            <span class="omnicrm-toggle-thumb"></span>
          </label>
        </div>
        <div class="omnicrm-btn-row">
          <button class="omnicrm-btn omnicrm-btn-primary" data-ref="syncBtn">Sync This Chat</button>
          <button class="omnicrm-btn omnicrm-btn-secondary" data-ref="pauseBtn">Pause</button>
        </div>
        <div class="omnicrm-queue" data-ref="queue">0 pending</div>
      </div>
    `;

    container.appendChild(this.panel);
    container.appendChild(this.fab);
    this.shadow.appendChild(container);

    // Cache refs
    this._statsEl = this.shadow.querySelector('[data-ref="stats"]');
    this._queueEl = this.shadow.querySelector('[data-ref="queue"]');
    this._autoSyncToggle = this.shadow.querySelector('[data-ref="autoSyncToggle"]');
    this._syncBtn = this.shadow.querySelector('[data-ref="syncBtn"]');
    this._pauseBtn = this.shadow.querySelector('[data-ref="pauseBtn"]');
    this._headerEl = this.shadow.querySelector('.omnicrm-panel-header span');

    this._bindEvents();

    // Append to page
    document.body.appendChild(this.host);
    this.log.info(`Overlay mounted for ${this.label}`);
  }

  // ── Events ───────────────────────────────────────────────────────
  _bindEvents() {
    // Click to toggle panel
    this.fab.addEventListener('click', (e) => {
      if (this.isDragging) return;
      this._togglePanel();
    });

    // Dragging via pointer events
    this.fab.addEventListener('pointerdown', (e) => this._onPointerDown(e));

    // Auto-sync toggle
    this._autoSyncToggle.addEventListener('change', (e) => {
      this.autoSync = e.target.checked;
      this.log.info(`Auto-sync ${this.autoSync ? 'enabled' : 'disabled'}`);
      try {
        chrome.runtime.sendMessage({
          type: 'TOGGLE_AUTO_SYNC',
          platform: this.platformId,
          enabled: this.autoSync
        });
      } catch (_) { /* extension context may be invalid */ }
    });

    // Sync this chat button
    this._syncBtn.addEventListener('click', () => {
      this.log.info('Manual sync triggered');
      try {
        chrome.runtime.sendMessage({
          type: 'SYNC_CURRENT_CHAT',
          platform: this.platformId
        });
      } catch (_) {}
    });

    // Pause button
    this._pauseBtn.addEventListener('click', () => {
      const isPaused = this._pauseBtn.textContent === 'Resume';
      this._pauseBtn.textContent = isPaused ? 'Pause' : 'Resume';
      this.setStatus(isPaused ? 'active' : 'pending');
      if (this._headerEl) {
        this._headerEl.textContent = isPaused
          ? `${this.label} Sync Active`
          : `${this.label} Sync Paused`;
      }
      try {
        chrome.runtime.sendMessage({
          type: 'TOGGLE_PLATFORM',
          platform: this.platformId,
          enabled: isPaused
        });
      } catch (_) {}
    });

    // Stop event propagation for keyboard events (prevent host page shortcuts)
    const stopKeys = (e) => e.stopPropagation();
    this.shadow.addEventListener('keydown', stopKeys, true);
    this.shadow.addEventListener('keyup', stopKeys, true);
    this.shadow.addEventListener('keypress', stopKeys, true);

    // Listen for dark mode changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      this._darkMode = e.matches;
      const styleEl = this.shadow.querySelector('style');
      if (styleEl) styleEl.textContent = this._getStyles();
    });
  }

  // ── Drag handling ────────────────────────────────────────────────
  _onPointerDown(e) {
    if (e.button !== 0) return;
    this.isDragging = false;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;

    const rect = this.host.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.right;
    this.dragOffset.y = e.clientY - rect.bottom;

    const onMove = (ev) => {
      const dx = ev.clientX - this._dragStartX;
      const dy = ev.clientY - this._dragStartY;
      if (!this.isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        this.isDragging = true;
        this.fab.style.cursor = 'grabbing';
      }
      if (this.isDragging) {
        const newRight = window.innerWidth - ev.clientX + this.dragOffset.x;
        const newBottom = window.innerHeight - ev.clientY + this.dragOffset.y;
        this.host.style.right = Math.max(8, Math.min(window.innerWidth - 64, newRight)) + 'px';
        this.host.style.bottom = Math.max(8, Math.min(window.innerHeight - 64, newBottom)) + 'px';
      }
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      this.fab.style.cursor = 'grab';
      // Reset dragging after a tick so click handler can check
      setTimeout(() => { this.isDragging = false; }, 50);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  // ── Panel toggle ─────────────────────────────────────────────────
  _togglePanel() {
    this.panelVisible = !this.panelVisible;
    this.panel.classList.toggle('visible', this.panelVisible);
  }

  // ── Public API ───────────────────────────────────────────────────
  updateStats(stats) {
    if (!stats) return;
    this.stats = { ...this.stats, ...stats };
    if (this._statsEl) {
      this._statsEl.textContent =
        `Today: ${this.stats.messages || 0} messages | ${this.stats.contacts || 0} contacts`;
    }
    if (this._queueEl) {
      this._queueEl.textContent = `${this.stats.pending || 0} pending`;
    }
  }

  setStatus(status) {
    this.status = status;
    if (this.statusDot) {
      this.statusDot.className = `omnicrm-status-dot ${status}`;
    }
  }

  show() {
    this.host.style.display = '';
  }

  hide() {
    this.host.style.display = 'none';
    this.panelVisible = false;
    this.panel.classList.remove('visible');
  }
}

OmniCRM.OmniCRMOverlay = OmniCRMOverlay;
