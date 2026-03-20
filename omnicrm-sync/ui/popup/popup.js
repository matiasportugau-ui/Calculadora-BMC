/**
 * OmniCRM Sync — Popup Dashboard Logic
 * Loads sync status, renders platform cards, handles toggles and actions.
 */

(function () {
  'use strict';

  const PLATFORMS = ['whatsapp', 'mercadolibre', 'facebook', 'instagram'];
  const REFRESH_INTERVAL_MS = 5000;

  let allPaused = false;
  let refreshTimer = null;

  // ── Bootstrap ──────────────────────────────────────────

  async function init() {
    await loadStatus();
    bindEvents();
    startAutoRefresh();
  }

  // ── Status loading ─────────────────────────────────────

  async function loadStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SYNC_STATUS_REQUEST' });
      if (!response || !response.success) return;

      const { stats, platforms, pendingCount } = response;

      let totalToday = 0;
      let totalAll = 0;

      for (const platform of PLATFORMS) {
        const platformStats = stats[platform] || {};
        const platformConfig = platforms[platform] || {};
        const today = platformStats.today || 0;
        const synced = platformStats.synced || 0;
        const enabled = platformConfig.enabled !== false;

        totalToday += today;
        totalAll += synced;

        // Update stat text
        const statEl = document.querySelector(`[data-stat="${platform}"]`);
        if (statEl) statEl.textContent = `${today} today`;

        // Update status dot
        const dotEl = document.querySelector(`[data-status="${platform}"]`);
        if (dotEl) {
          dotEl.className = `status-dot ${enabled ? 'active' : 'paused'}`;
        }

        // Update toggle
        const toggleEl = document.querySelector(`[data-toggle="${platform}"]`);
        if (toggleEl) toggleEl.checked = enabled;
      }

      // Summary counters
      const todayEl = document.getElementById('totalToday');
      const allEl = document.getElementById('totalAll');
      const pendingEl = document.getElementById('pendingCount');

      if (todayEl) todayEl.textContent = totalToday;
      if (allEl) allEl.textContent = totalAll;
      if (pendingEl) pendingEl.textContent = pendingCount || 0;

      // Global status indicator
      const globalDot = document.querySelector('#globalStatus .status-dot');
      const globalLabel = document.querySelector('#globalStatus .status-label');

      if (globalDot) globalDot.className = `status-dot ${allPaused ? 'paused' : 'active'}`;
      if (globalLabel) globalLabel.textContent = allPaused ? 'Paused' : 'Active';

    } catch (err) {
      console.error('[OmniCRM Popup] Failed to load status:', err);
    }
  }

  // ── Event binding ──────────────────────────────────────

  function bindEvents() {
    // Platform toggles
    for (const platform of PLATFORMS) {
      const toggle = document.querySelector(`[data-toggle="${platform}"]`);
      if (toggle) {
        toggle.addEventListener('change', (e) => {
          chrome.runtime.sendMessage({
            type: 'TOGGLE_PLATFORM',
            platformId: platform,
            enabled: e.target.checked
          });

          // Optimistic UI update
          const dotEl = document.querySelector(`[data-status="${platform}"]`);
          if (dotEl) {
            dotEl.className = `status-dot ${e.target.checked ? 'active' : 'paused'}`;
          }
        });
      }
    }

    // Pause / Resume All button
    const btnPauseAll = document.getElementById('btnPauseAll');
    if (btnPauseAll) {
      btnPauseAll.addEventListener('click', async () => {
        allPaused = !allPaused;

        await chrome.runtime.sendMessage({
          type: allPaused ? 'PAUSE_ALL' : 'RESUME_ALL'
        });

        // Update button label and style
        const label = document.getElementById('pauseAllLabel');
        if (label) label.textContent = allPaused ? 'Resume All' : 'Pause All';
        btnPauseAll.classList.toggle('paused', allPaused);

        // Update global header status
        const globalDot = document.querySelector('#globalStatus .status-dot');
        const globalLabel = document.querySelector('#globalStatus .status-label');
        if (globalDot) globalDot.className = `status-dot ${allPaused ? 'paused' : 'active'}`;
        if (globalLabel) globalLabel.textContent = allPaused ? 'Paused' : 'Active';

        // Update every platform card
        for (const platform of PLATFORMS) {
          const dotEl = document.querySelector(`[data-status="${platform}"]`);
          const toggleEl = document.querySelector(`[data-toggle="${platform}"]`);
          if (dotEl) dotEl.className = `status-dot ${allPaused ? 'paused' : 'active'}`;
          if (toggleEl) toggleEl.checked = !allPaused;
        }
      });
    }

    // Open Settings button
    const btnSettings = document.getElementById('btnSettings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }
  }

  // ── Auto-refresh ───────────────────────────────────────

  function startAutoRefresh() {
    refreshTimer = setInterval(loadStatus, REFRESH_INTERVAL_MS);
  }

  // Clean up on popup close
  window.addEventListener('unload', () => {
    if (refreshTimer) clearInterval(refreshTimer);
  });

  // ── Init on DOM ready ──────────────────────────────────

  document.addEventListener('DOMContentLoaded', init);
})();
