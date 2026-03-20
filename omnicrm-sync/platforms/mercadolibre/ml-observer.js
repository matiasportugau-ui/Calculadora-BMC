/**
 * OmniCRM Sync — MercadoLibre Observer
 * Observes MercadoLibre messaging DOM for new messages and conversation switches.
 * Depends on: utils.js, base-observer.js, ml-selectors.js, ml-parser.js, ml-contact.js
 */

class MLObserver extends OmniCRM.BaseObserver {
  constructor() {
    super('mercadolibre');
    this.selectors = new OmniCRM.MLSelectors();
    this.contactExtractor = new OmniCRM.MLContactExtractor(this.selectors);
    this._lastConversationId = null;
    this._conversationSwitchObserver = null;
    this._lastOrderContext = null;
  }

  // ── Abstract method implementations ────────────────────────────

  /**
   * Get the MercadoLibre message thread container element.
   * @returns {Element|null}
   */
  getMessageContainer() {
    return this.selectors.get('messageContainer');
  }

  /**
   * Parse new messages from MutationObserver records.
   * Filters added nodes for message items and extracts structured data.
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

        // Find message item elements
        const items = this._findMessageItems(node);
        for (const item of items) {
          if (seenElements.has(item)) continue;
          seenElements.add(item);

          const parsed = OmniCRM.MLParser.parseMessage(item);
          if (!parsed) continue;

          // Enrich with contact and order context
          const buyer = this.contactExtractor.extractBuyerFromHeader();
          const orderInfo = this.contactExtractor.extractOrderInfo();
          const packId = this.contactExtractor.extractPackId();

          const messageData = {
            text: parsed.text,
            timestamp: parsed.timestamp,
            direction: parsed.direction,
            contentType: parsed.contentType,
            senderName: this._extractSenderName(parsed.direction, buyer),
            senderIdentifier: buyer.nickname || '',
            orderId: orderInfo.orderId || null,
            productTitle: orderInfo.productTitle || null,
            orderReferences: parsed.orderReferences || [],
            hasImage: parsed.hasImage || false,
            imageSrc: parsed.imageSrc || null,
            raw: {
              ...parsed.raw,
              packId,
              orderUrl: orderInfo.orderUrl || ''
            }
          };

          messages.push(messageData);
        }
      }
    }

    return messages;
  }

  /**
   * Get the current conversation identifier for deduplication and routing.
   * @returns {{ id: string, name: string, type: string }}
   */
  getChatIdentifier() {
    try {
      const buyer = this.contactExtractor.extractBuyerFromHeader();
      const packId = this.contactExtractor.extractPackId();
      const orderInfo = this.contactExtractor.extractOrderInfo();

      const name = buyer.displayName || buyer.nickname || 'Unknown Buyer';
      const idSource = packId || orderInfo.orderId || name;
      const id = OmniCRM.contentHash(`ml:${idSource}`);

      return { id, name, type: 'sales' };
    } catch (err) {
      this.log.error('Failed to get conversation identifier:', err);
      return { id: '', name: '', type: 'sales' };
    }
  }

  // ── Conversation switch detection ──────────────────────────────

  /**
   * Start observing for conversation switches in addition to messages.
   * Overrides the base start() to add conversation switch detection.
   */
  start() {
    super.start();
    this._startConversationSwitchDetection();
    this._captureOrderContext();
  }

  /**
   * Stop all observers including conversation switch detection.
   */
  stop() {
    super.stop();
    this._stopConversationSwitchDetection();
  }

  /**
   * Watch for conversation switches by observing the header and URL changes.
   * @private
   */
  _startConversationSwitchDetection() {
    if (this._conversationSwitchObserver) return;

    const header = this.selectors.get('conversationHeader');
    if (!header) {
      this.log.warn('Conversation header not found — cannot watch for switches');
      return;
    }

    // Record current conversation
    const currentConv = this.getChatIdentifier();
    this._lastConversationId = currentConv.id;

    this._conversationSwitchObserver = new MutationObserver(
      OmniCRM.debounce(() => {
        this._checkConversationSwitch();
      }, 250)
    );

    this._conversationSwitchObserver.observe(header, {
      childList: true,
      subtree: true,
      characterData: true
    });

    this.observers.push(this._conversationSwitchObserver);

    // Also watch for URL changes (ML may use pushState for navigation)
    this._lastUrl = window.location.href;
    this._urlCheckTimer = setInterval(() => {
      if (window.location.href !== this._lastUrl) {
        this._lastUrl = window.location.href;
        this._checkConversationSwitch();
      }
    }, 1000);

    this.log.debug('Conversation switch detection started');
  }

  /**
   * Stop conversation switch detection observer.
   * @private
   */
  _stopConversationSwitchDetection() {
    if (this._conversationSwitchObserver) {
      this._conversationSwitchObserver.disconnect();
      this._conversationSwitchObserver = null;
    }

    if (this._urlCheckTimer) {
      clearInterval(this._urlCheckTimer);
      this._urlCheckTimer = null;
    }
  }

  /**
   * Check if the user has switched to a different conversation.
   * @private
   */
  _checkConversationSwitch() {
    try {
      const currentConv = this.getChatIdentifier();
      if (currentConv.id && currentConv.id !== this._lastConversationId) {
        this._lastConversationId = currentConv.id;
        this.contactExtractor.clearCache();
        this._captureOrderContext();

        this.log.info('Conversation switched to:', currentConv.name);

        this.callbacks.onChatSwitch.forEach(cb => {
          try {
            cb(currentConv);
          } catch (e) {
            this.log.error('Conversation switch callback error:', e);
          }
        });

        // Notify background
        if (this.port) {
          this.port.postMessage({
            type: 'CHAT_SWITCH',
            platform: this.platformId,
            payload: {
              ...currentConv,
              orderContext: this._lastOrderContext
            }
          });
        }
      }
    } catch (err) {
      this.log.error('Error checking conversation switch:', err);
    }
  }

  // ── Order Context ──────────────────────────────────────────────

  /**
   * Capture the order context for the current conversation.
   * Stores orderId, packId, and productTitle for use in interactions.
   * @private
   */
  _captureOrderContext() {
    try {
      const orderInfo = this.contactExtractor.extractOrderInfo();
      const packId = this.contactExtractor.extractPackId();

      this._lastOrderContext = {
        orderId: orderInfo.orderId || null,
        packId: packId || null,
        productTitle: orderInfo.productTitle || null,
        price: orderInfo.price || null,
        orderUrl: orderInfo.orderUrl || null
      };

      if (this._lastOrderContext.orderId || this._lastOrderContext.packId) {
        this.log.debug('Order context captured:', this._lastOrderContext);
      }
    } catch (err) {
      this.log.warn('Failed to capture order context:', err);
      this._lastOrderContext = null;
    }
  }

  /**
   * Get the current order context.
   * @returns {Object|null}
   */
  getOrderContext() {
    return this._lastOrderContext;
  }

  // ── Helpers ────────────────────────────────────────────────────

  /**
   * Find message item elements from a DOM node.
   * @param {Element} node
   * @returns {Element[]}
   * @private
   */
  _findMessageItems(node) {
    const items = [];
    const itemSelector = this.selectors.getSelector('messageItem') || '[data-testid="message-item"]';

    // Check if the node itself is a message item
    if (node.matches && node.matches(itemSelector)) {
      items.push(node);
    }

    // Check descendants
    try {
      const descendants = OmniCRM.qsa(itemSelector, node);
      items.push(...descendants);
    } catch (_) {
      // Node may not support querySelectorAll
    }

    // Fallback: look for message-row or thread-message elements
    if (items.length === 0 && node.matches) {
      const fallbackSelectors = [
        '.message-row',
        '[class*="MessageRow"]',
        '.thread-message',
        'div[class*="message-item"]'
      ];

      for (const sel of fallbackSelectors) {
        if (node.matches(sel)) {
          items.push(node);
          break;
        }
        const found = OmniCRM.qsa(sel, node);
        if (found.length > 0) {
          items.push(...found);
          break;
        }
      }
    }

    return items;
  }

  /**
   * Extract the sender name based on direction and buyer info.
   * @param {string} direction - "incoming"|"outgoing"|"system"
   * @param {{ nickname: string, displayName: string }} buyer
   * @returns {string}
   * @private
   */
  _extractSenderName(direction, buyer) {
    if (direction === 'outgoing') return 'You (Seller)';
    if (direction === 'system') return 'MercadoLibre';
    return buyer.displayName || buyer.nickname || 'Buyer';
  }

  /**
   * Set an API client for enriched data extraction.
   * @param {MLApiClient} apiClient
   */
  setApiClient(apiClient) {
    this.contactExtractor.apiClient = apiClient;
    this.log.info('API client attached to observer');
  }
}

OmniCRM.MLObserver = MLObserver;
