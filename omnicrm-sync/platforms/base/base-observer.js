/**
 * OmniCRM Sync — Base Observer
 * Abstract base class for platform-specific message observers.
 * Uses MutationObserver to detect new messages in real-time.
 * Depends on: utils.js, base-selectors.js, base-parser.js
 */

class BaseObserver {
  constructor(platformId) {
    this.platformId = platformId;
    this.isRunning = false;
    this.observers = [];
    this.processedIds = new Set();
    this.maxProcessedIds = 5000;
    this.debounceMs = 100;
    this.reconnectIntervalMs = 2000;
    this.reconnectTimer = null;
    this.port = null;
    this.log = new OmniCRM.OmniLog(platformId);

    this.callbacks = {
      onNewMessage: [],
      onChatSwitch: [],
      onStatusChange: []
    };
  }

  // ── Abstract methods — must be implemented by subclasses ───────

  /** @returns {Element|null} The scrollable message container element */
  getMessageContainer() {
    throw new Error('Must implement getMessageContainer()');
  }

  /** @param {MutationRecord[]} mutations @returns {Object[]} Parsed message objects */
  parseNewMessages(mutations) {
    throw new Error('Must implement parseNewMessages()');
  }

  /** @returns {Object} { id, name, type } for current conversation */
  getChatIdentifier() {
    throw new Error('Must implement getChatIdentifier()');
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  start() {
    if (this.isRunning) return;

    const container = this.getMessageContainer();
    if (!container) {
      this.log.warn('Message container not found — starting auto-reconnect');
      this.autoReconnect();
      return;
    }

    this.log.info('Starting observer on message container');

    // Create debounced mutation handler
    const debouncedHandler = OmniCRM.debounce((mutations) => {
      this._processMutations(mutations);
    }, this.debounceMs);

    // Observe message container — childList + subtree only for performance
    const observer = new MutationObserver((mutations) => {
      debouncedHandler(mutations);
    });

    observer.observe(container, {
      childList: true,
      subtree: true
    });

    this.observers.push(observer);
    this.isRunning = true;

    // Clear any reconnect timer
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Start watching for container removal (page navigation)
    this._watchContainerRemoval(container);

    this._emitStatus('active');
  }

  stop() {
    this.log.info('Stopping observer');
    this.observers.forEach(obs => obs.disconnect());
    this.observers = [];
    this.isRunning = false;

    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this._emitStatus('paused');
  }

  // ── Event Registration ─────────────────────────────────────────

  onNewMessage(callback) {
    this.callbacks.onNewMessage.push(callback);
  }

  onChatSwitch(callback) {
    this.callbacks.onChatSwitch.push(callback);
  }

  onStatusChange(callback) {
    this.callbacks.onStatusChange.push(callback);
  }

  // ── Deduplication ──────────────────────────────────────────────

  generateMessageId(message) {
    const parts = [
      this.platformId,
      message.timestamp || '',
      message.sender?.name || message.sender?.identifier || '',
      OmniCRM.contentHash(message.content?.text || '')
    ];
    return OmniCRM.contentHash(parts.join('|'));
  }

  isAlreadyProcessed(id) {
    return this.processedIds.has(id);
  }

  markAsProcessed(id) {
    this.processedIds.add(id);
    // FIFO cleanup when exceeding max
    if (this.processedIds.size > this.maxProcessedIds) {
      const iterator = this.processedIds.values();
      const oldest = iterator.next().value;
      this.processedIds.delete(oldest);
    }
  }

  // ── Emit Interaction ───────────────────────────────────────────

  emitInteraction(data) {
    const chatInfo = this.getChatIdentifier();
    const interaction = {
      id: OmniCRM.generateUUID(),
      platform: this.platformId,
      direction: data.direction || 'incoming',
      conversation: {
        id: chatInfo.id || '',
        name: chatInfo.name || '',
        type: chatInfo.type || 'direct'
      },
      sender: {
        name: data.senderName || '',
        identifier: data.senderIdentifier || '',
        profileUrl: data.profileUrl || null
      },
      content: {
        type: data.contentType || 'text',
        text: data.text || '',
        caption: data.caption || null,
        mediaUrl: data.mediaUrl || null,
        fileName: data.fileName || null
      },
      context: {
        orderId: data.orderId || null,
        productTitle: data.productTitle || null,
        productUrl: data.productUrl || null,
        orderStatus: data.orderStatus || null,
        isBusinessChat: data.isBusinessChat || false
      },
      timestamp: data.timestamp || new Date().toISOString(),
      status: data.status || null,
      reactions: data.reactions || [],
      quotedMessage: data.quotedMessage || null,
      raw: data.raw || {}
    };

    const msgId = this.generateMessageId(interaction);
    if (this.isAlreadyProcessed(msgId)) return;
    this.markAsProcessed(msgId);

    interaction.deduplicationId = msgId;

    // Notify callbacks
    this.callbacks.onNewMessage.forEach(cb => {
      try { cb(interaction); } catch (e) { this.log.error('Callback error:', e); }
    });

    // Send to service worker via port
    if (this.port) {
      this.port.postMessage({
        type: 'NEW_INTERACTION',
        platform: this.platformId,
        payload: interaction
      });
    }
  }

  // ── Port Connection ────────────────────────────────────────────

  connectToBackground() {
    const platformConfig = OmniCRM.PLATFORMS?.[this.platformId];
    const portName = platformConfig?.portName || `port-${this.platformId}`;

    this.port = OmniCRM.connectPort(portName, (msg) => {
      this._handleBackgroundMessage(msg);
    });

    this.log.info('Connected to background via port:', portName);
  }

  _handleBackgroundMessage(msg) {
    switch (msg.type) {
      case 'PAUSE':
        this.stop();
        break;
      case 'RESUME':
        this.start();
        break;
      case 'SYNC_CHAT':
        this._syncCurrentChat();
        break;
      case 'HEALTH_CHECK':
        // Respond with selector health
        if (this.port) {
          this.port.postMessage({
            type: 'HEALTH_CHECK_RESULT',
            platform: this.platformId,
            running: this.isRunning,
            processedCount: this.processedIds.size
          });
        }
        break;
    }
  }

  // ── Auto-Reconnect ─────────────────────────────────────────────

  autoReconnect() {
    if (this.reconnectTimer) return;

    this.log.info('Auto-reconnect: polling every', this.reconnectIntervalMs, 'ms');
    this.reconnectTimer = setInterval(() => {
      const container = this.getMessageContainer();
      if (container) {
        this.log.info('Container found — re-attaching observer');
        clearInterval(this.reconnectTimer);
        this.reconnectTimer = null;
        this.start();
      }
    }, this.reconnectIntervalMs);
  }

  // ── Internal ───────────────────────────────────────────────────

  _processMutations(mutations) {
    try {
      const newMessages = this.parseNewMessages(mutations);
      if (newMessages && newMessages.length > 0) {
        this.log.debug(`Detected ${newMessages.length} new message(s)`);
        newMessages.forEach(msg => this.emitInteraction(msg));
      }
    } catch (err) {
      this.log.error('Error processing mutations:', err);
    }
  }

  _watchContainerRemoval(container) {
    const bodyObserver = new MutationObserver(() => {
      if (!document.body.contains(container)) {
        this.log.warn('Message container removed — stopping and reconnecting');
        this.stop();
        this.autoReconnect();
        bodyObserver.disconnect();
      }
    });

    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.push(bodyObserver);
  }

  _emitStatus(status) {
    this.callbacks.onStatusChange.forEach(cb => {
      try { cb(status); } catch (e) { this.log.error('Status callback error:', e); }
    });

    if (this.port) {
      this.port.postMessage({
        type: 'PLATFORM_STATUS',
        platform: this.platformId,
        status
      });
    }
  }

  _syncCurrentChat() {
    this.log.info('Sync current chat requested — subclass should implement');
  }
}

OmniCRM.BaseObserver = BaseObserver;
