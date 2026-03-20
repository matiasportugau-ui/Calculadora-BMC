/**
 * OmniCRM Sync — Facebook Messenger Observer
 * Observes Facebook Messenger DOM for new messages and chat switches.
 * Handles both facebook.com/messages and messenger.com (legacy, EOL April 2026).
 * Depends on: utils.js, base-observer.js, fb-selectors.js, fb-parser.js, fb-contact.js
 */

class FBObserver extends OmniCRM.BaseObserver {
  constructor() {
    super('facebook');
    this.selectors = new OmniCRM.FBSelectors();
    this.contactExtractor = new OmniCRM.FBContactExtractor(this.selectors);
    this._lastChatId = null;
    this._lastUrl = window.location.href;
    this._chatSwitchObserver = null;
    this._urlPollInterval = null;
  }

  // ── Abstract method implementations ────────────────────────────

  /**
   * Get the scrollable message container element.
   * Facebook uses a virtualized list inside [role="main"] — only visible
   * messages are present in the DOM at any given time.
   * @returns {Element|null}
   */
  getMessageContainer() {
    // Try grid/list containers within main
    const mainEl = document.querySelector('[role="main"]');
    if (!mainEl) return null;

    // Prefer the grid (standard layout) or list (fallback)
    const container = OmniCRM.qs('[role="grid"]', mainEl) ||
                      OmniCRM.qs('[role="list"]', mainEl) ||
                      OmniCRM.qs('[role="log"]', mainEl) ||
                      OmniCRM.qs('[aria-label*="message" i]', mainEl);

    if (container) return container;

    // Last resort: the deepest scrollable div inside main
    return this.selectors.get('messageContainer');
  }

  /**
   * Parse new messages from MutationObserver records.
   * Handles Facebook's virtualized list where only visible messages exist in DOM.
   * @param {MutationRecord[]} mutations
   * @returns {Object[]} Array of parsed message data objects
   */
  parseNewMessages(mutations) {
    const messages = [];
    const seenElements = new Set();

    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;

      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        const rows = this._findMessageRows(node);
        for (const row of rows) {
          if (seenElements.has(row)) continue;
          seenElements.add(row);

          const parsed = OmniCRM.FBParser.parseMessage(row);
          if (!parsed) continue;

          // Enrich with contact info
          const contactInfo = this.contactExtractor.extractFromHeader();
          const marketplace = this.contactExtractor.detectMarketplace();
          const onlineStatus = this.contactExtractor.getOnlineStatus();

          const messageData = {
            text: parsed.text,
            timestamp: parsed.timestamp,
            direction: parsed.direction,
            contentType: parsed.contentType,
            senderName: this._extractSenderFromRow(row, parsed.direction, contactInfo),
            senderIdentifier: '',
            profileUrl: this.contactExtractor.getProfilePicUrl(),
            quotedMessage: parsed.quotedMessage,
            reactions: parsed.reactions,
            isMarketplace: marketplace.isMarketplace,
            raw: {
              ...parsed.raw,
              productName: marketplace.productName || '',
              online: onlineStatus.online,
              lastActive: onlineStatus.lastActive,
              host: window.location.hostname
            }
          };

          messages.push(messageData);
        }
      }
    }

    return messages;
  }

  /**
   * Get the current chat identifier for deduplication and routing.
   * Extracts identity from header content and URL path.
   * @returns {{ id: string, name: string, type: string }}
   */
  getChatIdentifier() {
    try {
      const contactInfo = this.contactExtractor.extractFromHeader();
      const marketplace = this.contactExtractor.detectMarketplace();

      const name = contactInfo.name;
      const type = marketplace.isMarketplace ? 'marketplace' : 'direct';

      // Extract thread ID from URL if available
      const urlThreadId = this._extractThreadIdFromUrl();
      const idSource = urlThreadId || name;
      const id = OmniCRM.contentHash(`fb:${idSource}:${type}`);

      return { id, name, type };
    } catch (err) {
      this.log.error('Failed to get chat identifier:', err);
      return { id: '', name: '', type: 'direct' };
    }
  }

  // ── Chat switch detection ──────────────────────────────────────

  /**
   * Start observing for messages and chat switches.
   * Overrides the base start() to add URL change detection and header watching.
   */
  start() {
    super.start();
    this._startChatSwitchDetection();
  }

  /**
   * Stop all observers and polling intervals.
   */
  stop() {
    super.stop();
    this._stopChatSwitchDetection();
  }

  /**
   * Watch for chat switches via URL changes and header mutations.
   * Facebook Messenger is an SPA — conversation switches change the URL
   * (pushState) and update the header content without full page reloads.
   * @private
   */
  _startChatSwitchDetection() {
    if (this._chatSwitchObserver) return;

    // Record current state
    const currentChat = this.getChatIdentifier();
    this._lastChatId = currentChat.id;
    this._lastUrl = window.location.href;

    // Method 1: Listen for popstate (back/forward navigation)
    this._popstateHandler = () => {
      this._handleUrlChange();
    };
    window.addEventListener('popstate', this._popstateHandler);

    // Method 2: Poll for URL changes (catches pushState/replaceState)
    this._urlPollInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== this._lastUrl) {
        this._lastUrl = currentUrl;
        this._handleUrlChange();
      }
    }, 500);

    // Method 3: Observe header element for content changes
    const mainEl = document.querySelector('[role="main"]');
    if (mainEl) {
      this._chatSwitchObserver = new MutationObserver(
        OmniCRM.debounce(() => {
          this._checkChatSwitch();
        }, 250)
      );

      this._chatSwitchObserver.observe(mainEl, {
        childList: true,
        subtree: true
      });

      this.observers.push(this._chatSwitchObserver);
    }

    this.log.debug('Chat switch detection started');
  }

  /**
   * Stop chat switch detection — observers, listeners, and polling.
   * @private
   */
  _stopChatSwitchDetection() {
    if (this._chatSwitchObserver) {
      this._chatSwitchObserver.disconnect();
      this._chatSwitchObserver = null;
    }

    if (this._urlPollInterval) {
      clearInterval(this._urlPollInterval);
      this._urlPollInterval = null;
    }

    if (this._popstateHandler) {
      window.removeEventListener('popstate', this._popstateHandler);
      this._popstateHandler = null;
    }
  }

  /**
   * Handle a detected URL change (SPA navigation).
   * @private
   */
  _handleUrlChange() {
    // Small delay to let React render the new conversation
    setTimeout(() => {
      this._checkChatSwitch();

      // Re-attach message observer to the new conversation container
      // because FB may destroy and recreate the grid element
      this._reattachMessageObserver();
    }, 300);
  }

  /**
   * Re-attach the message MutationObserver to the current container.
   * Called after a chat switch when FB may have replaced the grid element.
   * @private
   */
  _reattachMessageObserver() {
    try {
      const container = this.getMessageContainer();
      if (!container) return;

      // Check if any existing observer is still watching this container
      // If not, restart the base observer
      if (this.observers.length === 0 ||
          !document.contains(this.observers[0]?._target)) {
        this.log.debug('Re-attaching message observer to new container');
        // Stop and restart base observer (keeps chat switch detection intact)
        const chatObs = this._chatSwitchObserver;
        const urlPoll = this._urlPollInterval;
        const popHandler = this._popstateHandler;

        // Temporarily null these so stop() doesn't clear them
        this._chatSwitchObserver = null;
        this._urlPollInterval = null;
        this._popstateHandler = null;

        super.stop();
        super.start();

        // Restore chat switch watchers
        this._chatSwitchObserver = chatObs;
        this._urlPollInterval = urlPoll;
        this._popstateHandler = popHandler;
        if (chatObs) this.observers.push(chatObs);
      }
    } catch (err) {
      this.log.warn('Failed to re-attach message observer:', err);
    }
  }

  /**
   * Check if the user has switched to a different conversation.
   * @private
   */
  _checkChatSwitch() {
    try {
      const currentChat = this.getChatIdentifier();
      if (currentChat.id && currentChat.id !== this._lastChatId) {
        this._lastChatId = currentChat.id;
        this.contactExtractor.clearCache();

        this.log.info('Chat switched to:', currentChat.name);

        this.callbacks.onChatSwitch.forEach(cb => {
          try {
            cb(currentChat);
          } catch (e) {
            this.log.error('Chat switch callback error:', e);
          }
        });

        // Notify background
        if (this.port) {
          this.port.postMessage({
            type: 'CHAT_SWITCH',
            platform: this.platformId,
            payload: currentChat
          });
        }
      }
    } catch (err) {
      this.log.error('Error checking chat switch:', err);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  /**
   * Find message row elements from a DOM node.
   * @param {Element} node
   * @returns {Element[]}
   * @private
   */
  _findMessageRows(node) {
    const rows = [];

    // Primary: [role="row"] elements
    const rowSelector = '[role="row"]';
    if (node.matches && node.matches(rowSelector)) {
      rows.push(node);
    }

    try {
      const descendants = OmniCRM.qsa(rowSelector, node);
      rows.push(...descendants);
    } catch (_) {
      // Node may not support querySelectorAll
    }

    // Fallback: [role="gridcell"] or [role="listitem"]
    if (rows.length === 0) {
      const fallbackSelectors = ['[role="gridcell"]', '[role="listitem"]'];
      for (const sel of fallbackSelectors) {
        if (node.matches && node.matches(sel)) {
          rows.push(node);
        }
        try {
          const found = OmniCRM.qsa(sel, node);
          rows.push(...found);
        } catch (_) {
          // Ignore
        }
        if (rows.length > 0) break;
      }
    }

    return rows;
  }

  /**
   * Extract the sender name from a message row.
   * In FB Messenger, incoming messages show a sender avatar with alt text.
   * @param {Element} row
   * @param {string} direction
   * @param {{ name: string }} contactInfo
   * @returns {string}
   * @private
   */
  _extractSenderFromRow(row, direction, contactInfo) {
    if (direction === 'outgoing') return 'You';
    if (direction === 'system') return 'System';

    // Try avatar alt text (group chats show individual sender avatars)
    const avatar = OmniCRM.qs('img[alt]:not([alt=""])', row) ||
                   OmniCRM.qs('[role="img"][aria-label]', row);
    if (avatar) {
      const name = (avatar.getAttribute('alt') || avatar.getAttribute('aria-label') || '').trim();
      // Filter out generic labels like "Profile picture"
      if (name && !/^(profile|photo|image|picture)/i.test(name)) {
        return name;
      }
    }

    // Fall back to header contact name
    return contactInfo.name || 'Unknown';
  }

  /**
   * Extract the thread ID from the current URL.
   * facebook.com/messages/t/<thread_id> or messenger.com/t/<thread_id>
   * @returns {string} Thread ID or empty string
   * @private
   */
  _extractThreadIdFromUrl() {
    try {
      const path = window.location.pathname;

      // facebook.com/messages/t/123456 or messenger.com/t/123456
      const threadMatch = path.match(/\/t\/(\d+)/);
      if (threadMatch) return threadMatch[1];

      // facebook.com/marketplace/messages/t/123456
      const marketplaceMatch = path.match(/\/marketplace\/.*\/t\/(\d+)/);
      if (marketplaceMatch) return marketplaceMatch[1];

      return '';
    } catch (_) {
      return '';
    }
  }
}

OmniCRM.FBObserver = FBObserver;
