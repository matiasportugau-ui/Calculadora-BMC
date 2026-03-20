/**
 * OmniCRM Sync — WhatsApp Web Content Script (Entry Point)
 * Initializes observer, overlay, and background connection.
 * Depends on: all shared + whatsapp platform files + overlay.js
 */

(function() {
  'use strict';

  // Guard against double initialization
  if (window.__omnicrm_wa_initialized) return;
  window.__omnicrm_wa_initialized = true;

  const log = new OmniCRM.OmniLog('whatsapp');
  log.info('Content script loaded');

  let observer = null;
  let overlay = null;

  function init() {
    try {
      // Create observer
      observer = new OmniCRM.WAObserver();

      // Connect to background service worker
      observer.connectToBackground();

      // Create overlay FAB
      overlay = new OmniCRM.OmniCRMOverlay('whatsapp');

      // Wire observer events to overlay
      observer.onNewMessage((interaction) => {
        overlay.updateStats({
          messages: (overlay.stats.messages || 0) + 1
        });
      });

      observer.onStatusChange((status) => {
        overlay.setStatus(status === 'active' ? 'active' : 'pending');
      });

      observer.onChatSwitch((chatInfo) => {
        log.debug('Chat switched:', chatInfo.name);
      });

      // Start observing
      observer.start();
      log.info('WhatsApp observer started');

    } catch (err) {
      log.error('Failed to initialize:', err);
    }
  }

  // Wait for WhatsApp Web to render (it's an SPA)
  function waitAndInit() {
    // Check if main chat area exists
    const checkReady = () => {
      const app = document.querySelector('#app');
      const main = document.querySelector('#main') || document.querySelector('[role="application"]');
      if (app && main) {
        init();
      } else {
        // Retry after a short delay
        setTimeout(checkReady, 2000);
      }
    };

    // Start checking after document is idle
    if (document.readyState === 'complete') {
      setTimeout(checkReady, 1000);
    } else {
      window.addEventListener('load', () => setTimeout(checkReady, 1000));
    }
  }

  waitAndInit();
})();
