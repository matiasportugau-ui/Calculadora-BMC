/**
 * OmniCRM Sync — Instagram DM Observer
 * Observes Instagram Direct message threads for new messages,
 * conversation switches, and "Seen" status changes.
 * Handles Instagram's virtualized/lazy-loaded message list.
 * Depends on: utils.js, base-observer.js, ig-selectors.js, ig-parser.js, ig-contact.js
 */

class IGObserver extends OmniCRM.BaseObserver {
  constructor() {
    super('instagram');
    this.selectors = new OmniCRM.IGSelectors();
    this.contactExtractor = new OmniCRM.IGContactExtractor(this.selectors);
    this._lastChatId = null;
    this._lastUrl = location.href;
    this._urlPollTimer = null;
    this._seenObserver = null;
  }

  // -- Abstract method implementations ------------------------------------

  /**
   * Get the DM thread message container element.
   * Instagram renders messages inside a scrollable container within
   * the /direct/t/{threadId} view.
   * @returns {Element|null}
   */
  getMessageContainer() {
    // Primary: use the threadContainer selector
    const container = this.selectors.get('threadContainer');
    if (container) return container;

    // Fallback: structural pattern — the scrollable message area
    // within the direct thread view
    const grid = OmniCRM.qs('div[role="grid"]');
    if (grid) {
      // The actual scrollable container is usually a child with overflow
      const scrollable = OmniCRM.qs('div[style*="overflow"]', grid) || grid;
      return scrollable;
    }

    // Tertiary: look for the main content area under /direct/
    const main = OmniCRM.qs('main');
    if (main) {
      const candidates = OmniCRM.qsa('div[style*="flex-direction: column"]', main);
      for (const candidate of candidates) {
        const style = candidate.getAttribute('style') || '';
        if (style.includes('overflow')) return candidate;
      }
    }

    return null;
  }

  /**
   * Parse new messages from MutationObserver records.
   * Handles Instagram's virtualized message list where messages are
   * added/removed as the user scrolls.
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

        // Find message elements within the added node
        const rows = this._findMessageElements(node);
        for (const row of rows) {
          if (seenElements.has(row)) continue;
          seenElements.add(row);

          const parsed = OmniCRM.IGParser.parseMessage(row);
          if (!parsed) continue;

          // Enrich with contact info
          const contactInfo = this.contactExtractor.extractFromHeader();
          const groupInfo = this.contactExtractor.extractGroupInfo();

          const messageData = {
            text: parsed.text,
            timestamp: parsed.timestamp,
            direction: parsed.direction,
            contentType: parsed.contentType,
            senderName: this._extractSenderFromRow(row, parsed.direction, contactInfo),
            senderIdentifier: contactInfo.username || '',
            profileUrl: this.contactExtractor.getProfilePicUrl(),
            quotedMessage: parsed.quotedMessage,
            reactions: parsed.reactions,
            isBusinessChat: this.contactExtractor.getAccountType() !== 'personal',
            raw: {
              ...parsed.raw,
              sharedPost: parsed.sharedPost || null,
              isGroup: groupInfo.isGroup,
              groupName: groupInfo.groupName,
              isVerified: this.contactExtractor.isVerified(),
              accountType: this.contactExtractor.getAccountType()
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
   * Extracts thread ID from the URL (/direct/t/{threadId}) and
   * combines with the contact username from the header.
   * @returns {{ id: string, name: string, type: string }}
   */
  getChatIdentifier() {
    try {
      // Extract thread ID from URL
      const threadId = this._extractThreadIdFromUrl();
      const contactInfo = this.contactExtractor.extractFromHeader();
      const groupInfo = this.contactExtractor.extractGroupInfo();

      const name = groupInfo.isGroup
        ? groupInfo.groupName
        : (contactInfo.displayName || contactInfo.username);
      const type = groupInfo.isGroup ? 'group' : 'direct';
      const id = OmniCRM.contentHash(
        `ig:${threadId || ''}:${contactInfo.username || name}`
      );

      return { id, name, type };
    } catch (err) {
      this.log.error('Failed to get chat identifier:', err);
      return { id: '', name: '', type: 'direct' };
    }
  }

  // -- Lifecycle overrides ------------------------------------------------

  /**
   * Start observing for messages, conversation switches, and seen status.
   */
  start() {
    super.start();
    this._startConversationSwitchDetection();
    this._startSeenStatusDetection();
  }

  /**
   * Stop all observers and polling timers.
   */
  stop() {
    super.stop();
    this._stopConversationSwitchDetection();
    this._stopSeenStatusDetection();
  }

  // -- Conversation switch detection --------------------------------------

  /**
   * Detect conversation switches via URL changes.
   * Instagram is an SPA and doesn't always fire popstate events,
   * so we use both popstate listener and URL polling as a fallback.
   * @private
   */
  _startConversationSwitchDetection() {
    // Record current state
    const currentChat = this.getChatIdentifier();
    this._lastChatId = currentChat.id;
    this._lastUrl = location.href;

    // Strategy 1: popstate listener
    this._popstateHandler = () => {
      this._checkConversationSwitch();
    };
    window.addEventListener('popstate', this._popstateHandler);

    // Strategy 2: URL polling fallback
    // Instagram uses History.pushState for navigation without firing popstate
    this._urlPollTimer = setInterval(() => {
      const currentUrl = location.href;
      if (currentUrl !== this._lastUrl) {
        this._lastUrl = currentUrl;
        this._checkConversationSwitch();
      }
    }, 500);

    this.log.debug('Conversation switch detection started');
  }

  /**
   * Stop conversation switch detection.
   * @private
   */
  _stopConversationSwitchDetection() {
    if (this._popstateHandler) {
      window.removeEventListener('popstate', this._popstateHandler);
      this._popstateHandler = null;
    }

    if (this._urlPollTimer) {
      clearInterval(this._urlPollTimer);
      this._urlPollTimer = null;
    }
  }

  /**
   * Check if the conversation has changed and emit event if so.
   * @private
   */
  _checkConversationSwitch() {
    try {
      // Only act if we're on a direct thread URL
      if (!location.pathname.startsWith('/direct/')) return;

      const currentChat = this.getChatIdentifier();
      if (currentChat.id && currentChat.id !== this._lastChatId) {
        this._lastChatId = currentChat.id;
        this.contactExtractor.clearCache();

        this.log.info('Conversation switched to:', currentChat.name);

        // Notify callbacks
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

        // Re-attach observer to the new thread's message container
        this._reattachToNewThread();
      }
    } catch (err) {
      this.log.error('Error checking conversation switch:', err);
    }
  }

  /**
   * When a conversation switch is detected, stop the current message
   * observer and start a new one on the new thread's container.
   * @private
   */
  _reattachToNewThread() {
    // Disconnect existing message observers
    this.observers.forEach(obs => obs.disconnect());
    this.observers = [];
    this.isRunning = false;

    // Small delay to let Instagram render the new thread
    setTimeout(() => {
      this.start();
    }, 300);
  }

  // -- Seen status detection ----------------------------------------------

  /**
   * Watch for "Seen" status changes on sent messages.
   * Instagram shows "Seen" or "Seen by X" under the last outgoing message.
   * @private
   */
  _startSeenStatusDetection() {
    const container = this.getMessageContainer();
    if (!container) return;

    this._seenObserver = new MutationObserver(
      OmniCRM.debounce(() => {
        this._checkSeenStatus();
      }, 500)
    );

    this._seenObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });

    this.observers.push(this._seenObserver);
  }

  /**
   * Stop seen status detection.
   * @private
   */
  _stopSeenStatusDetection() {
    if (this._seenObserver) {
      this._seenObserver.disconnect();
      this._seenObserver = null;
    }
  }

  /**
   * Check for "Seen" status indicators in the thread.
   * @private
   */
  _checkSeenStatus() {
    try {
      const container = this.getMessageContainer();
      if (!container) return;

      // Look for "Seen" text or seen indicators
      const seenIndicators = OmniCRM.qsa('span', container);
      for (const span of seenIndicators) {
        const text = (span.textContent || '').trim().toLowerCase();
        if (text === 'seen' || text === 'visto' || text.startsWith('seen by')) {
          // Emit seen status update
          if (this.port) {
            this.port.postMessage({
              type: 'SEEN_STATUS',
              platform: this.platformId,
              payload: {
                conversation: this.getChatIdentifier(),
                seenText: span.textContent.trim(),
                timestamp: new Date().toISOString()
              }
            });
          }
          break;
        }
      }
    } catch (err) {
      this.log.warn('Error checking seen status:', err);
    }
  }

  // -- Helpers ------------------------------------------------------------

  /**
   * Extract thread ID from the current URL.
   * Instagram DM threads are at /direct/t/{threadId}/
   * @returns {string} Thread ID or empty string
   * @private
   */
  _extractThreadIdFromUrl() {
    const match = location.pathname.match(/\/direct\/t\/(\d+)/);
    return match ? match[1] : '';
  }

  /**
   * Find message elements from a DOM node.
   * Handles Instagram's virtualized list where messages may be
   * wrapped in various container structures.
   * @param {Element} node
   * @returns {Element[]}
   * @private
   */
  _findMessageElements(node) {
    const elements = [];
    const rowSelector = this.selectors.getSelector('messageRow') || 'div[role="row"]';

    // Check if the node itself is a message element
    if (node.matches && node.matches(rowSelector)) {
      elements.push(node);
    }

    // Check descendants
    try {
      const descendants = OmniCRM.qsa(rowSelector, node);
      elements.push(...descendants);
    } catch (_) {
      // Node may not support querySelectorAll
    }

    // Fallback: look for elements with message-like structure
    if (elements.length === 0) {
      const listItems = OmniCRM.qsa('div[role="listitem"]', node);
      elements.push(...listItems);

      if (elements.length === 0) {
        const gridCells = OmniCRM.qsa('div[role="gridcell"]', node);
        elements.push(...gridCells);
      }

      // Structural fallback: divs with dir="auto" text content
      if (elements.length === 0 && node.matches) {
        if (node.querySelector('div[dir="auto"]') || node.querySelector('span[dir="auto"]')) {
          elements.push(node);
        }
      }
    }

    return elements;
  }

  /**
   * Extract the sender name from a message element.
   * In direct chats, incoming messages are from the contact.
   * In group chats, the sender name may appear above the message.
   * @param {Element} row
   * @param {string} direction
   * @param {{ username: string, displayName: string }} contactInfo
   * @returns {string}
   * @private
   */
  _extractSenderFromRow(row, direction, contactInfo) {
    // Outgoing messages are from the current user
    if (direction === 'outgoing') return 'You';

    // In group DMs, sender name may appear as a label above the message
    const senderLabel = OmniCRM.qs('span[dir="auto"]', row);
    if (senderLabel) {
      const parent = senderLabel.parentElement;
      if (parent) {
        // Sender labels are typically styled differently (smaller, lighter)
        const style = parent.getAttribute('style') || '';
        if (style.includes('font-size') && style.includes('color')) {
          const name = (senderLabel.textContent || '').trim();
          if (name && name !== contactInfo.displayName) {
            return name;
          }
        }
      }
    }

    // Direct chat: use header contact info
    return contactInfo.displayName || contactInfo.username || 'Unknown';
  }
}

OmniCRM.IGObserver = IGObserver;
