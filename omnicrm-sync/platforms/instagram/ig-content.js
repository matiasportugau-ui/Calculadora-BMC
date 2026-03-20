/**
 * OmniCRM Sync — Instagram DM Content Script (Entry Point)
 * Initializes observer, overlay, and background connection for
 * Instagram Direct Messages at instagram.com/direct/.
 * Handles SPA navigation via popstate + URL polling.
 * Depends on: all shared + instagram platform files + overlay.js
 */

(function() {
  'use strict';

  // Guard against double initialization
  if (window.__omnicrm_ig_initialized) return;
  window.__omnicrm_ig_initialized = true;

  const log = new OmniCRM.OmniLog('instagram');
  log.info('Content script loaded');

  let observer = null;
  let overlay = null;
  let urlPollTimer = null;
  let lastPath = location.pathname;

  /**
   * Check if the current path is an Instagram Direct route.
   * @returns {boolean}
   */
  function isDirectPath() {
    return location.pathname.startsWith('/direct/');
  }

  /**
   * Initialize the observer, overlay, and background connection.
   */
  function init() {
    // Only activate on /direct/ paths
    if (!isDirectPath()) {
      log.debug('Not on /direct/ path — deferring init');
      startNavigationWatch();
      return;
    }

    // Avoid re-initializing if already running
    if (observer && observer.isRunning) return;

    try {
      // Create observer
      observer = new OmniCRM.IGObserver();

      // Connect to background service worker via port
      observer.connectToBackground();

      // Create overlay FAB
      overlay = new OmniCRM.OmniCRMOverlay('instagram');

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
        log.debug('Conversation switched:', chatInfo.name);
      });

      // Start observing
      observer.start();
      log.info('Instagram DM observer started');

    } catch (err) {
      log.error('Failed to initialize:', err);
    }
  }

  /**
   * Tear down the observer and overlay when navigating away from /direct/.
   */
  function teardown() {
    if (observer) {
      observer.stop();
      observer = null;
    }
    if (overlay) {
      overlay.destroy?.();
      overlay = null;
    }
    log.debug('Teardown complete — left /direct/ path');
  }

  /**
   * Handle SPA navigation.
   * Instagram is a single-page application and doesn't always fire
   * popstate on route changes (it uses History.pushState). We combine
   * popstate listening with URL polling for reliable detection.
   */
  function startNavigationWatch() {
    // Strategy 1: popstate listener
    window.addEventListener('popstate', onNavigate);

    // Strategy 2: URL polling (IG doesn't always fire popstate)
    if (!urlPollTimer) {
      urlPollTimer = setInterval(() => {
        const currentPath = location.pathname;
        if (currentPath !== lastPath) {
          lastPath = currentPath;
          onNavigate();
        }
      }, 800);
    }
  }

  /**
   * Called when a navigation event is detected.
   */
  function onNavigate() {
    lastPath = location.pathname;

    if (isDirectPath()) {
      // Navigated to /direct/ — wait for DOM and init
      log.info('Navigated to DM view');
      waitForDmContainer(() => {
        init();
      });
    } else {
      // Navigated away from /direct/ — teardown
      if (observer) {
        teardown();
      }
    }
  }

  /**
   * Wait for Instagram's DM container to render before initializing.
   * Instagram renders its UI asynchronously as an SPA.
   * @param {Function} callback - Called when the DM container is found
   */
  function waitForDmContainer(callback) {
    let attempts = 0;
    const maxAttempts = 20;

    const check = () => {
      attempts++;

      // Look for the DM thread container or conversation list
      const threadContainer = document.querySelector('div[role="grid"]') ||
                              document.querySelector('[role="listbox"]') ||
                              document.querySelector('main section');

      if (threadContainer) {
        callback();
      } else if (attempts < maxAttempts) {
        setTimeout(check, 500);
      } else {
        log.warn('DM container not found after max attempts');
      }
    };

    // Start checking after a short delay for initial render
    setTimeout(check, 300);
  }

  /**
   * Entry point: wait for DOM ready, then either init or watch for navigation.
   */
  function bootstrap() {
    if (isDirectPath()) {
      waitForDmContainer(() => {
        init();
      });
    }

    // Always start navigation watch to handle SPA transitions
    startNavigationWatch();
  }

  // Start when the document is ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(bootstrap, 500);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(bootstrap, 500));
  }
})();
