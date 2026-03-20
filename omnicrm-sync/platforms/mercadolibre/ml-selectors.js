/**
 * OmniCRM Sync — MercadoLibre Selectors
 * DOM selectors for MercadoLibre messaging with multi-tier fallback chains.
 * Depends on: utils.js, base-selectors.js
 */

class MLSelectors extends OmniCRM.BaseSelectors {
  constructor() {
    super('mercadolibre', {
      // Message thread container
      messageContainer:   '[data-testid="message-list"]',
      // Individual message items
      messageItem:        '[data-testid="message-item"]',
      // Message text content
      messageText:        '[data-testid="message-text"]',
      // Buyer (incoming) messages — typically lighter background
      messageBuyer:       '[data-testid="message-buyer"]',
      // Seller (outgoing) messages — typically darker/branded background
      messageSeller:      '[data-testid="message-seller"]',
      // Timestamp element within a message
      timestamp:          '[data-testid="message-timestamp"]',
      // Order reference (MLA-xxxxx, MLB-xxxxx, etc.)
      orderReference:     '[data-testid="order-reference"]',
      // Product title shown in conversation context
      productTitle:       '[data-testid="product-title"]',
      // Conversation list sidebar
      conversationList:   '[data-testid="conversation-list"]',
      // Conversation header (buyer info, order context)
      conversationHeader: '[data-testid="conversation-header"]',
      // Buyer name in header
      buyerName:          '[data-testid="buyer-name"]',
      // System/auto messages from MercadoLibre
      systemMessage:      '[data-testid="system-message"]',
      // Attached image in message
      attachedImage:      '[data-testid="message-image"]',
      // Message input area
      messageInput:       '[data-testid="message-input"]',
      // Send button
      sendButton:         '[data-testid="send-button"]'
    });

    this._registerFallbacks();
  }

  /**
   * Register fallback selectors for all keys.
   * MercadoLibre updates its DOM frequently; [data-testid] is primary,
   * with class-based and structural fallbacks.
   */
  _registerFallbacks() {
    this.addFallback('messageContainer', [
      '.messages-list',
      '.thread-messages',
      '[class*="MessageList"]',
      '.messages__thread-container',
      'section[class*="message"] > div'
    ]);

    this.addFallback('messageItem', [
      '.message-row',
      '[class*="MessageRow"]',
      '.thread-message',
      'div[class*="message-item"]'
    ]);

    this.addFallback('messageText', [
      '.message-text',
      '.message-content p',
      '[class*="MessageText"]',
      '.thread-message__text',
      '.message-bubble p'
    ]);

    this.addFallback('messageBuyer', [
      '.message-buyer',
      '.message--buyer',
      '[class*="from-buyer"]',
      'div[class*="buyer"]',
      '.message-row--incoming'
    ]);

    this.addFallback('messageSeller', [
      '.message-seller',
      '.message--seller',
      '[class*="from-seller"]',
      'div[class*="seller"]',
      '.message-row--outgoing'
    ]);

    this.addFallback('timestamp', [
      '.message-timestamp',
      '.message-time',
      '[class*="Timestamp"]',
      'time[datetime]',
      'span[class*="time"]'
    ]);

    this.addFallback('orderReference', [
      '.order-id',
      '[class*="OrderId"]',
      'a[href*="/orders/"]',
      'span[class*="order-reference"]',
      '.pack-order-id'
    ]);

    this.addFallback('productTitle', [
      '.product-title',
      '[class*="ProductTitle"]',
      '.item-title',
      'a[href*="/MLA-"]',
      'a[href*="/MLB-"]',
      '.message-context__product-name'
    ]);

    this.addFallback('conversationList', [
      '.conversations-list',
      '[class*="ConversationList"]',
      'nav[class*="conversation"]',
      '.message-list-sidebar',
      'aside ul'
    ]);

    this.addFallback('conversationHeader', [
      '.conversation-header',
      '[class*="ConversationHeader"]',
      '.thread-header',
      'header[class*="message"]',
      '.messages__header'
    ]);

    this.addFallback('buyerName', [
      '.buyer-name',
      '.buyer-nickname',
      '[class*="BuyerName"]',
      '.conversation-header__name',
      '.thread-header__buyer',
      'h2[class*="buyer"]',
      'span[class*="nickname"]'
    ]);

    this.addFallback('systemMessage', [
      '.system-message',
      '.auto-message',
      '[class*="SystemMessage"]',
      '.message--system',
      '[class*="automated"]'
    ]);

    this.addFallback('attachedImage', [
      '.message-image',
      '.message-attachment img',
      '[class*="MessageImage"]',
      '.thread-message__image img',
      'img[class*="attachment"]'
    ]);

    this.addFallback('messageInput', [
      'textarea[class*="message"]',
      '[class*="MessageInput"] textarea',
      '.reply-input textarea',
      '#message-input'
    ]);

    this.addFallback('sendButton', [
      'button[class*="send"]',
      '[class*="SendButton"]',
      'button[type="submit"]',
      '.reply-actions button[class*="primary"]'
    ]);
  }
}

OmniCRM.MLSelectors = MLSelectors;
