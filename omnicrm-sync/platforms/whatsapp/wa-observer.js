/**
 * OmniCRM Sync — WhatsApp Web Observer
 * Observes WhatsApp Web DOM for new messages and chat switches.
 * Depends on: utils.js, base-observer.js, wa-selectors.js, wa-parser.js, wa-contact.js
 */

class WAObserver extends OmniCRM.BaseObserver {
  constructor() {
    super('whatsapp');
    this.selectors = new OmniCRM.WASelectors();
    this.contactExtractor = new OmniCRM.WAContactExtractor(this.selectors);
    this._lastChatId = null;
    this._chatSwitchObserver = null;
  }

  // ── Abstract method implementations ────────────────────────────

  /**
   * Get the scrollable message container element.
   * @returns {Element|null}
   */
  getMessageContainer() {
    return this.selectors.get('messageContainer');
  }

  /**
   * Parse new messages from MutationObserver records.
   * Filters added nodes for message rows and extracts structured data.
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

        // Find message row elements — either the node itself or its descendants
        const rows = this._findMessageRows(node);
        for (const row of rows) {
          // Avoid processing the same element twice in a single batch
          if (seenElements.has(row)) continue;
          seenElements.add(row);

          const parsed = OmniCRM.WAParser.parseMessage(row);
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
            senderIdentifier: contactInfo.phone || '',
            profileUrl: this.contactExtractor.getProfilePicUrl(),
            quotedMessage: parsed.quotedMessage,
            reactions: parsed.reactions,
            isBusinessChat: this.contactExtractor.isBusinessAccount(),
            raw: {
              ...parsed.raw,
              forwarded: parsed.forwarded,
              isGroup: groupInfo.isGroup,
              groupName: groupInfo.groupName
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
   * @returns {{ id: string, name: string, type: string }}
   */
  getChatIdentifier() {
    try {
      const contactInfo = this.contactExtractor.extractFromHeader();
      const groupInfo = this.contactExtractor.extractGroupInfo();

      const name = groupInfo.isGroup ? groupInfo.groupName : contactInfo.name;
      const id = OmniCRM.contentHash(`wa:${name}:${contactInfo.phone}`);
      const type = groupInfo.isGroup ? 'group' : 'direct';

      return { id, name, type };
    } catch (err) {
      this.log.error('Failed to get chat identifier:', err);
      return { id: '', name: '', type: 'direct' };
    }
  }

  // ── Chat switch detection ──────────────────────────────────────

  /**
   * Start observing for chat switches in addition to messages.
   * Overrides the base start() to add chat switch detection.
   */
  start() {
    super.start();
    this._startChatSwitchDetection();
  }

  /**
   * Stop all observers including chat switch detection.
   */
  stop() {
    super.stop();
    this._stopChatSwitchDetection();
  }

  /**
   * Watch for chat switches by observing the chat header area.
   * When the user clicks a different conversation, the header content changes.
   * @private
   */
  _startChatSwitchDetection() {
    if (this._chatSwitchObserver) return;

    const header = this.selectors.get('chatHeader');
    if (!header) {
      this.log.warn('Chat header not found — cannot watch for chat switches');
      return;
    }

    // Record current chat
    const currentChat = this.getChatIdentifier();
    this._lastChatId = currentChat.id;

    this._chatSwitchObserver = new MutationObserver(
      OmniCRM.debounce(() => {
        this._checkChatSwitch();
      }, 200)
    );

    this._chatSwitchObserver.observe(header, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // Also observe the main panel for full re-renders
    const mainPanel = OmniCRM.qs('#main');
    if (mainPanel && mainPanel !== header) {
      const panelObserver = new MutationObserver(
        OmniCRM.debounce(() => {
          this._checkChatSwitch();
        }, 300)
      );

      panelObserver.observe(mainPanel, {
        childList: true
      });

      this.observers.push(panelObserver);
    }

    this.observers.push(this._chatSwitchObserver);
    this.log.debug('Chat switch detection started');
  }

  /**
   * Stop chat switch detection observer.
   * @private
   */
  _stopChatSwitchDetection() {
    if (this._chatSwitchObserver) {
      this._chatSwitchObserver.disconnect();
      this._chatSwitchObserver = null;
    }
  }

  /**
   * Check if the user has switched to a different chat.
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
    const rowSelector = this.selectors.getSelector('messageRow') || '[role="row"]';

    // Check if the node itself is a message row
    if (node.matches && node.matches(rowSelector)) {
      rows.push(node);
    }

    // Check descendants
    try {
      const descendants = OmniCRM.qsa(rowSelector, node);
      rows.push(...descendants);
    } catch (_) {
      // Node may not support querySelectorAll
    }

    // Also check for data-id elements (alternative message container)
    if (rows.length === 0 && node.matches) {
      if (node.matches('div[data-id]')) {
        rows.push(node);
      } else {
        const dataIdEls = OmniCRM.qsa('div[data-id]', node);
        rows.push(...dataIdEls);
      }
    }

    return rows;
  }

  /**
   * Extract the sender name from a message row.
   * In direct chats, use the header contact name for incoming messages.
   * In group chats, the sender is shown within the message bubble.
   * @param {Element} row
   * @param {string} direction
   * @param {{ name: string, phone: string }} contactInfo
   * @returns {string}
   * @private
   */
  _extractSenderFromRow(row, direction, contactInfo) {
    // Outgoing messages are from the current user
    if (direction === 'outgoing') return 'You';

    // In group chats, sender name appears in the message bubble
    const senderSpan = OmniCRM.qs('[data-testid="msg-author"]', row) ||
                       OmniCRM.qs('span[aria-label][dir]', row);
    if (senderSpan) {
      const name = (senderSpan.getAttribute('aria-label') ||
                    senderSpan.textContent || '').trim();
      if (name) return name;
    }

    // Direct chat: use header contact name
    return contactInfo.name || 'Unknown';
  }
}

OmniCRM.WAObserver = WAObserver;
