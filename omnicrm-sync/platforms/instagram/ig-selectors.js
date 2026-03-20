/**
 * OmniCRM Sync — Instagram DM Selectors
 * DOM selectors for Instagram Direct Messages with multi-tier fallback chains.
 * Supports accessibility, content, class-pattern, and structural strategies.
 * Depends on: utils.js, base-selectors.js
 */

class IGSelectors extends OmniCRM.BaseSelectors {
  constructor() {
    super('instagram', {
      // Conversation list (inbox sidebar)
      conversationList:  '[role="listbox"]',
      // Message input field
      messageInput:      '[role="textbox"][aria-label]',
      // Send button
      sendButton:        '[aria-label="Send"]',
      // Thread container (messages area within /direct/t/ view)
      threadContainer:   'div[role="grid"] div[style]',
      // Individual message row
      messageRow:        'div[role="row"]',
      // Chat header (contact info at top of thread)
      chatHeader:        'div[role="banner"]',
      // Contact / username in thread header
      contactName:       'div[role="banner"] a[role="link"]',
      // Emoji picker button
      emojiButton:       '[aria-label="Emoji"]',
      // Like / heart button
      likeButton:        '[aria-label="Like"]',
      // Voice message button
      voiceButton:       '[aria-label="Voice Clip"]',
      // Media upload button
      mediaButton:       '[aria-label="Add Photo or Video"]',
      // Message text content
      messageText:       'div[dir="auto"]',
      // Reactions on messages
      reactionContainer: 'div[role="button"] img[alt]',
      // Active status indicator
      activeStatus:      'div[role="banner"] span'
    });

    this._registerFallbacks();
  }

  /**
   * Register fallback selector chains for resilience against
   * Instagram's frequent DOM structure changes.
   */
  _registerFallbacks() {
    // ── Conversation list ──────────────────────────────────────
    this.addFallback('conversationList', [
      '[aria-label="Direct messaging"] [role="listbox"]',
      '[aria-label*="Chats"] [role="list"]',
      'div[role="list"]',
      'section div[style] > div > div > div'
    ]);

    // ── Message input ──────────────────────────────────────────
    this.addFallback('messageInput', [
      '[aria-label="Message"]',
      '[aria-label*="Message..."]',
      '[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ]);

    // ── Send button ────────────────────────────────────────────
    this.addFallback('sendButton', [
      'button[type="button"] div:has(> svg)',
      '[aria-label="Send message"]',
      'form button[type="submit"]'
    ]);

    // ── Thread container ───────────────────────────────────────
    this.addFallback('threadContainer', [
      'div[role="grid"]',
      'section > div > div > div > div[style*="overflow"]',
      'main div[style*="flex-direction: column"]',
      'div[role="presentation"] div[style*="overflow"]'
    ]);

    // ── Message row ────────────────────────────────────────────
    this.addFallback('messageRow', [
      'div[role="listitem"]',
      'div[role="gridcell"]',
      'div[class] > div[class] > div[style*="flex"]'
    ]);

    // ── Chat header ────────────────────────────────────────────
    this.addFallback('chatHeader', [
      'header',
      'main > section > div:first-child',
      'div[role="navigation"] + div > div:first-child',
      'div[style*="border-bottom"] div[role="button"]'
    ]);

    // ── Contact name ───────────────────────────────────────────
    this.addFallback('contactName', [
      'header a[href*="/"]',
      'div[role="banner"] span[dir="auto"]',
      'header span[style*="font-weight"]',
      'header h2',
      'header div[style*="font-weight: 600"]'
    ]);

    // ── Emoji button ───────────────────────────────────────────
    this.addFallback('emojiButton', [
      '[aria-label="Choose an emoji"]',
      '[aria-label*="emoji" i]',
      'button svg[aria-label*="Emoji"]'
    ]);

    // ── Like button ────────────────────────────────────────────
    this.addFallback('likeButton', [
      '[aria-label="Like" i]',
      '[aria-label="Send Like"]',
      'button svg[aria-label*="Like"]'
    ]);

    // ── Voice message ──────────────────────────────────────────
    this.addFallback('voiceButton', [
      '[aria-label*="voice" i]',
      '[aria-label="Record"]',
      '[aria-label*="Audio" i]'
    ]);

    // ── Media upload ───────────────────────────────────────────
    this.addFallback('mediaButton', [
      '[aria-label*="photo" i]',
      '[aria-label*="upload" i]',
      'input[type="file"][accept*="image"]'
    ]);

    // ── Message text ───────────────────────────────────────────
    this.addFallback('messageText', [
      'span[dir="auto"]',
      'div[role="none"] span',
      'div[class] > span[class]'
    ]);

    // ── Reaction container ─────────────────────────────────────
    this.addFallback('reactionContainer', [
      'div[role="button"] span img[alt]',
      'div[style*="position: absolute"] img[alt]',
      'button img[alt]'
    ]);

    // ── Active status ──────────────────────────────────────────
    this.addFallback('activeStatus', [
      'header span[style*="color"]',
      'div[role="banner"] div[style*="color: rgb(142"]',
      'header time'
    ]);
  }
}

OmniCRM.IGSelectors = IGSelectors;
