/**
 * OmniCRM Sync — WhatsApp Web Selectors
 * DOM selectors for WhatsApp Web with multi-tier fallback chains.
 * Depends on: utils.js, base-selectors.js
 */

class WASelectors extends OmniCRM.BaseSelectors {
  constructor() {
    super('whatsapp', {
      messageContainer: '[role="application"] div[tabindex="-1"]',
      messageRow:       '[role="row"]',
      messageText:      '.selectable-text.copyable-text',
      timestamp:        '[data-pre-plain-text]',
      mediaIcon:        '[data-icon]',
      chatHeader:       '#main header',
      contactName:      'header span[title]',
      messageIn:        '.message-in',
      messageOut:       '.message-out',
      quotedMessage:    '.quoted-msg',
      searchBox:        '[data-testid="search"]',
      sendButton:       '[data-icon="send"]',
      chatList:         '[aria-label*="Chat list"]'
    });

    this._registerFallbacks();
  }

  /**
   * Register fallback selectors for all keys.
   * WhatsApp Web frequently updates its DOM structure, so multiple
   * fallbacks are essential for resilience.
   */
  _registerFallbacks() {
    this.addFallback('messageContainer', [
      '#main div[data-tab]',
      '#main div[role="list"]',
      '#main .copyable-area > div'
    ]);

    this.addFallback('messageRow', [
      'div[data-id]',
      '.focusable-list-item'
    ]);

    this.addFallback('messageText', [
      'span.selectable-text',
      '[data-testid="msg-text"]',
      '.copyable-text span'
    ]);

    this.addFallback('timestamp', [
      '[data-testid="msg-meta"] span',
      '.message-timestamp'
    ]);

    this.addFallback('mediaIcon', [
      '[data-testid] [data-icon]'
    ]);

    this.addFallback('chatHeader', [
      'header',
      '#main [data-testid="conversation-header"]'
    ]);

    this.addFallback('contactName', [
      'header [data-tab] span',
      'header [title]',
      '[data-testid="conversation-info-header"] span[title]'
    ]);

    this.addFallback('messageIn', [
      '[data-testid="msg-container"].message-in',
      'div[class*="message-in"]'
    ]);

    this.addFallback('messageOut', [
      '[data-testid="msg-container"].message-out',
      'div[class*="message-out"]'
    ]);

    this.addFallback('quotedMessage', [
      '[data-icon="quoted"]',
      '[data-testid="quoted-message"]'
    ]);

    this.addFallback('searchBox', [
      '[data-testid="chat-list-search"]',
      '[role="textbox"][title*="Search"]'
    ]);

    this.addFallback('sendButton', [
      '[data-testid="send"]',
      'button [data-icon="send"]'
    ]);

    this.addFallback('chatList', [
      '#pane-side',
      '[data-testid="chat-list"]',
      '[aria-label*="chat list" i]'
    ]);
  }
}

OmniCRM.WASelectors = WASelectors;
