/**
 * OmniCRM Sync — MercadoLibre Content Script (Entry Point)
 * Initializes observer, overlay, and background connection for MercadoLibre messaging.
 * Depends on: all shared + mercadolibre platform files + overlay.js
 */

(function() {
  'use strict';

  // Guard against double initialization
  if (window.__omnicrm_ml_initialized) return;
  window.__omnicrm_ml_initialized = true;

  const log = new OmniCRM.OmniLog('mercadolibre');
  log.info('Content script loaded');

  /**
   * MercadoLibre messaging URL patterns.
   * Matches across all ML country domains:
   *   mercadolibre.com.ar, mercadolibre.com, mercadolibre.com.mx,
   *   mercadolibre.com.co, mercadolivre.com.br
   */
  const ML_MESSAGING_PATHS = [
    '/ventas/mensajes',   // Spanish: Argentina, Mexico, Colombia, etc.
    '/sales/messages',    // English fallback
    '/messages'           // Short path (used in some variants)
  ];

  /**
   * Check if the current URL is a MercadoLibre messaging page.
   * @returns {boolean}
   */
  function isMessagingPage() {
    const hostname = window.location.hostname || '';
    const pathname = window.location.pathname || '';

    // Verify we are on a MercadoLibre/MercadoLivre domain
    const isMLDomain = /mercadoli[bv]re\.com/.test(hostname);
    if (!isMLDomain) return false;

    // Check if the path starts with a messaging path
    for (const path of ML_MESSAGING_PATHS) {
      if (pathname.startsWith(path)) return true;
    }

    return false;
  }

  // Only activate on messaging pages
  if (!isMessagingPage()) {
    log.debug('Not a messaging page — content script idle');
    return;
  }

  log.info('MercadoLibre messaging page detected');

  let observer = null;
  let overlay = null;
  let apiClient = null;

  /**
   * Initialize the MercadoLibre observer, overlay, and optional API client.
   */
  function init() {
    try {
      // Create observer
      observer = new OmniCRM.MLObserver();

      // Connect to background service worker
      observer.connectToBackground();

      // Create overlay FAB
      overlay = new OmniCRM.OmniCRMOverlay('mercadolibre');

      // Optionally initialize API client if credentials are configured
      initApiClient();

      // Wire observer events to overlay
      observer.onNewMessage((interaction) => {
        overlay.updateStats({
          messages: (overlay.stats.messages || 0) + 1
        });
      });

      observer.onStatusChange((status) => {
        overlay.setStatus(status === 'active' ? 'active' : 'pending');
      });

      observer.onChatSwitch((convInfo) => {
        log.debug('Conversation switched:', convInfo.name);
      });

      // Start observing
      observer.start();
      log.info('MercadoLibre observer started');

    } catch (err) {
      log.error('Failed to initialize:', err);
    }
  }

  /**
   * Initialize the ML API client if credentials are stored.
   * API mode is optional — DOM scraping works without it.
   */
  function initApiClient() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return;
      }

      chrome.storage.local.get('ml_api_config', (result) => {
        const config = result.ml_api_config;
        if (!config || !config.appId) {
          log.debug('No ML API credentials configured — running in DOM-only mode');
          return;
        }

        apiClient = new OmniCRM.MLApiClient({
          appId: config.appId,
          clientSecret: config.clientSecret || '',
          redirectUri: config.redirectUri || ''
        });

        // Try to load stored tokens
        apiClient.loadStoredTokens().then((loaded) => {
          if (loaded) {
            log.info('ML API client initialized with stored tokens');
            observer.setApiClient(apiClient);
          } else if (apiClient._refreshToken) {
            // Attempt token refresh
            apiClient.refreshAccessToken().then((refreshed) => {
              if (refreshed) {
                log.info('ML API client initialized after token refresh');
                observer.setApiClient(apiClient);
              } else {
                log.warn('ML API token refresh failed — running in DOM-only mode');
              }
            });
          } else {
            log.debug('ML API client created but no valid tokens — DOM-only mode');
          }
        });
      });
    } catch (err) {
      log.warn('Failed to initialize API client:', err);
    }
  }

  /**
   * Wait for MercadoLibre messaging UI to render, then initialize.
   * ML is an SPA, so we poll for the message container.
   */
  function waitAndInit() {
    const checkReady = () => {
      // Look for message container or conversation list
      const messageContainer = document.querySelector('[data-testid="message-list"]') ||
                               document.querySelector('.messages-list') ||
                               document.querySelector('.thread-messages') ||
                               document.querySelector('[class*="MessageList"]');

      const conversationList = document.querySelector('[data-testid="conversation-list"]') ||
                               document.querySelector('.conversations-list') ||
                               document.querySelector('[class*="ConversationList"]');

      if (messageContainer || conversationList) {
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
