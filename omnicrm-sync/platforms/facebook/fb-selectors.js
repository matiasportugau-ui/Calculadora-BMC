/**
 * OmniCRM Sync — Facebook Messenger Selectors
 * DOM selectors for Facebook Messenger (facebook.com/messages + messenger.com).
 * Avoids obfuscated React Fiber class names; relies on ARIA roles and attributes.
 * Depends on: utils.js, base-selectors.js
 */

class FBSelectors extends OmniCRM.BaseSelectors {
  constructor() {
    super('facebook', {
      messageContainer: '[role="main"]',
      messageRow:       '[role="row"]',
      messageCell:      '[role="gridcell"]',
      messageText:      '[dir="auto"]',
      timestamp:        '[data-utime]',
      chatHeader:       '[role="main"] [aria-label]',
      contactName:      '[role="main"] h2',
      conversationList: '[role="navigation"] [role="list"]',
      threadHeader:     '[role="banner"]',
      messageList:      '[role="main"] [role="grid"]',
      sendButton:       '[aria-label="Send"]',
      composeBox:       '[role="main"] [role="textbox"]',
      reactionOverlay:  '[aria-label*="reaction" i]'
    });

    this._registerFallbacks();
  }

  /**
   * Register fallback selectors for all keys.
   * Facebook Messenger's React Fiber DOM is highly volatile, so we rely
   * exclusively on semantic attributes (role, aria-label, dir, data-*).
   */
  _registerFallbacks() {
    this.addFallback('messageContainer', [
      '[role="main"] [role="grid"]',
      '[role="main"] [role="list"]',
      '[role="main"] [aria-label*="message" i]',
      '[role="main"] [tabindex="-1"]'
    ]);

    this.addFallback('messageRow', [
      '[role="main"] [role="gridcell"]',
      '[role="main"] [role="listitem"]',
      '[role="main"] [data-scope="messages_table"]'
    ]);

    this.addFallback('messageCell', [
      '[role="row"] > div',
      '[role="listitem"] > div'
    ]);

    this.addFallback('messageText', [
      '[role="gridcell"] [dir="auto"]',
      '[role="row"] [dir="auto"]',
      '[role="listitem"] [dir="auto"]',
      '[data-ad-preview="message"] [dir="auto"]'
    ]);

    this.addFallback('timestamp', [
      '[role="tooltip"]',
      '[aria-label*=":"]',
      'abbr[data-utime]',
      'time[datetime]'
    ]);

    this.addFallback('chatHeader', [
      '[role="main"] header',
      '[role="main"] [aria-label*="Conversation" i]',
      '[role="main"] [data-testid="mwthreadlist-header"]'
    ]);

    this.addFallback('contactName', [
      '[role="main"] header [dir="auto"]',
      '[role="main"] [aria-label] span[dir="auto"]',
      '[role="main"] a[role="link"] span'
    ]);

    this.addFallback('conversationList', [
      '[role="navigation"] [role="grid"]',
      '[role="navigation"] [aria-label*="chat" i]',
      '[aria-label="Chats"] [role="list"]',
      '[aria-label="Chats"] [role="grid"]'
    ]);

    this.addFallback('threadHeader', [
      '[role="main"] [role="heading"]',
      '[role="main"] [data-testid="mwthreadlist-header"]'
    ]);

    this.addFallback('messageList', [
      '[role="main"] [role="list"]',
      '[role="main"] [role="log"]',
      '[role="main"] [aria-label*="message" i]'
    ]);

    this.addFallback('sendButton', [
      '[aria-label="Press enter to send"]',
      '[role="main"] [aria-label="Send"] svg',
      'form [type="submit"]'
    ]);

    this.addFallback('composeBox', [
      '[role="main"] [contenteditable="true"]',
      '[role="main"] [aria-label*="message" i][role="textbox"]',
      '[role="main"] [aria-placeholder]'
    ]);

    this.addFallback('reactionOverlay', [
      '[role="row"] [aria-label*="emoji" i]',
      '[role="gridcell"] [aria-label*="reaction" i]',
      '[role="button"][aria-label*="React" i]'
    ]);
  }
}

OmniCRM.FBSelectors = FBSelectors;
