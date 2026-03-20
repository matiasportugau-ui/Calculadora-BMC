/**
 * OmniCRM Sync — Facebook Messenger Content Script (Entry Point)
 * Initializes observer, overlay, and background connection for FB Messenger.
 * Activates on facebook.com/messages/, /marketplace/messages/, and messenger.com.
 * Depends on: all shared + facebook platform files + overlay.js
 */

(function() {
  'use strict';

  // Guard against double initialization
  if (window.__omnicrm_fb_initialized) return;
  window.__omnicrm_fb_initialized = true;

  const log = new OmniCRM.OmniLog('facebook');
  log.info('Content script loaded');

  let observer = null;
  let overlay = null;

  /**
   * Determine if the current URL is a valid Facebook messaging page.
   * @returns {boolean}
   */
  function isMessagingUrl() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    // messenger.com — all paths are messaging (legacy, EOL April 2026)
    if (hostname === 'www.messenger.com' || hostname === 'messenger.com') {
      return true;
    }

    // facebook.com — only messaging-specific paths
    if (hostname === 'www.facebook.com' || hostname === 'facebook.com') {
      return pathname.startsWith('/messages/') ||
             pathname.startsWith('/messages') ||
             pathname.includes('/marketplace/messages/') ||
             pathname.includes('/marketplace/messages');
    }

    return false;
  }

  /**
   * Initialize the observer, overlay, and background connection.
   */
  function init() {
    // Verify we're on a messaging URL before proceeding
    if (!isMessagingUrl()) {
      log.debug('Not a messaging URL, skipping init:', window.location.href);
      return;
    }

    try {
      // Create observer
      observer = new OmniCRM.FBObserver();

      // Connect to background service worker via port-facebook
      observer.connectToBackground();

      // Create overlay FAB
      overlay = new OmniCRM.OmniCRMOverlay('facebook');

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
      log.info('Facebook Messenger observer started');

    } catch (err) {
      log.error('Failed to initialize:', err);
    }
  }

  /**
   * Watch for SPA navigation to messaging URLs.
   * Facebook is a full SPA — the user may navigate from feed to messages
   * without a page reload. We poll for URL changes and re-check.
   */
  function startUrlWatcher() {
    let lastCheckedUrl = window.location.href;
    let wasMessaging = isMessagingUrl();

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      handlePossibleNavigation();
    });

    // Poll for pushState/replaceState changes (SPA navigation)
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastCheckedUrl) {
        lastCheckedUrl = currentUrl;
        handlePossibleNavigation();
      }
    }, 1000);

    function handlePossibleNavigation() {
      const nowMessaging = isMessagingUrl();

      if (nowMessaging && !wasMessaging) {
        // Navigated INTO messaging — initialize
        log.info('Navigated to messaging URL, initializing');
        wasMessaging = true;
        // Delay to let React render the messaging UI
        setTimeout(() => {
          waitAndInit();
        }, 500);
      } else if (!nowMessaging && wasMessaging) {
        // Navigated AWAY from messaging — clean up
        log.info('Navigated away from messaging URL, cleaning up');
        wasMessaging = false;
        if (observer) {
          observer.stop();
          observer = null;
        }
        if (overlay) {
          overlay.destroy();
          overlay = null;
        }
        // Allow re-initialization if user navigates back
        window.__omnicrm_fb_initialized = false;
      }
    }
  }

  /**
   * Wait for the messaging UI to render before initializing.
   * Facebook's React app loads asynchronously — the message container
   * may not exist immediately.
   */
  function waitAndInit() {
    const checkReady = () => {
      const mainEl = document.querySelector('[role="main"]');
      const hasGrid = mainEl && (
        OmniCRM.qs('[role="grid"]', mainEl) ||
        OmniCRM.qs('[role="list"]', mainEl) ||
        OmniCRM.qs('[role="log"]', mainEl) ||
        OmniCRM.qs('[role="textbox"]', mainEl)
      );

      if (mainEl && hasGrid) {
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

  // Start URL watcher immediately (handles SPA navigation)
  startUrlWatcher();

  // If already on a messaging URL, wait for UI and initialize
  if (isMessagingUrl()) {
    waitAndInit();
  }
})();
