/**
 * OmniCRM Sync — WhatsApp Web Message Parser
 * Extracts structured message data from WhatsApp Web DOM elements.
 * Depends on: utils.js, base-parser.js, wa-selectors.js
 */

class WAParser extends OmniCRM.BaseParser {
  static log = new OmniCRM.OmniLog('whatsapp:parser');

  /**
   * Parse a complete message from a message row element.
   * @param {Element} element - A message row element ([role="row"] or similar)
   * @returns {Object|null} Parsed message data or null if unparseable
   */
  static parseMessage(element) {
    if (!element) return null;

    try {
      const text = WAParser._extractMessageText(element);
      const timestamp = WAParser.parseTimestamp(element);
      const direction = OmniCRM.BaseParser.detectDirection(element, 'whatsapp');
      const contentType = WAParser.detectMediaType(element);
      const quotedMessage = WAParser.extractQuotedMessage(element);
      const reactions = WAParser.extractReactions(element);
      const forwarded = WAParser.detectForwarded(element);

      // Skip system messages with no useful content
      if (!text && contentType === 'text') {
        const isSystem = element.querySelector('[data-icon="system"]') ||
                         element.querySelector('.system-msg');
        if (isSystem) {
          return {
            text: OmniCRM.BaseParser.extractText(element),
            timestamp,
            direction,
            contentType: 'system',
            quotedMessage: null,
            reactions: [],
            forwarded: false,
            raw: {}
          };
        }
      }

      return {
        text,
        timestamp,
        direction,
        contentType,
        quotedMessage,
        reactions,
        forwarded,
        raw: {
          dataId: element.getAttribute('data-id') || null,
          classes: element.className || ''
        }
      };
    } catch (err) {
      WAParser.log.error('Failed to parse message element:', err);
      return null;
    }
  }

  /**
   * Extract text content from a message element.
   * @param {Element} element
   * @returns {string}
   */
  static _extractMessageText(element) {
    // Try primary selector: .selectable-text.copyable-text
    let textEl = OmniCRM.qs('.selectable-text.copyable-text', element);
    if (!textEl) {
      textEl = OmniCRM.qs('span.selectable-text', element);
    }
    if (!textEl) {
      textEl = OmniCRM.qs('[data-testid="msg-text"]', element);
    }

    return OmniCRM.BaseParser.extractText(textEl);
  }

  /**
   * Parse timestamp from a WhatsApp message element.
   * WhatsApp stores timestamps in [data-pre-plain-text] attributes
   * with format: "[12:45 PM, 3/19/2026] Contact Name: "
   * @param {Element} element
   * @returns {string} ISO 8601 timestamp
   */
  static parseTimestamp(element) {
    if (!element) return new Date().toISOString();

    // Primary: data-pre-plain-text attribute
    const preText = OmniCRM.qs('[data-pre-plain-text]', element);
    if (preText) {
      const raw = preText.getAttribute('data-pre-plain-text') || '';
      // Format: "[12:45 PM, 3/19/2026] Contact Name: "
      const match = raw.match(/\[(.+?)\]/);
      if (match) {
        return WAParser._parseWATimestamp(match[1]);
      }
    }

    // Fallback: msg-meta timestamp span
    const metaSpan = OmniCRM.qs('[data-testid="msg-meta"] span', element) ||
                     OmniCRM.qs('.message-timestamp', element);
    if (metaSpan) {
      const timeText = (metaSpan.textContent || '').trim();
      if (timeText) {
        return OmniCRM.BaseParser.parseTimestamp(timeText);
      }
    }

    return new Date().toISOString();
  }

  /**
   * Parse WhatsApp-specific timestamp string.
   * Handles formats like "12:45 PM, 3/19/2026" and "14:30, 19/3/2026"
   * @param {string} raw - Timestamp string without brackets
   * @returns {string} ISO 8601 timestamp
   */
  static _parseWATimestamp(raw) {
    if (!raw) return new Date().toISOString();

    const text = raw.trim();

    // Try to split by comma: "12:45 PM, 3/19/2026"
    const parts = text.split(',').map(s => s.trim());

    let timePart = null;
    let datePart = null;

    for (const part of parts) {
      if (/\d{1,2}:\d{2}/.test(part) && !/\//.test(part)) {
        timePart = part;
      } else if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(part)) {
        datePart = part;
      }
    }

    const now = new Date();

    // Parse date portion
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();

    if (datePart) {
      const dateMatch = datePart.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (dateMatch) {
        const a = parseInt(dateMatch[1], 10);
        const b = parseInt(dateMatch[2], 10);
        let y = parseInt(dateMatch[3], 10);
        if (y < 100) y += 2000;

        // WhatsApp uses m/d/y in English locales, d/m/y in others.
        // Heuristic: if first number > 12, it must be a day (d/m/y)
        if (a > 12) {
          day = a;
          month = b - 1;
        } else if (b > 12) {
          month = a - 1;
          day = b;
        } else {
          // Ambiguous — assume m/d/y (US default for WhatsApp Web)
          month = a - 1;
          day = b;
        }
        year = y;
      }
    }

    // Parse time portion
    let hours = 0;
    let mins = 0;

    if (timePart) {
      const timeMatch = timePart.match(/(\d{1,2}):(\d{2})\s*(am|pm|a\.?\s?m\.?|p\.?\s?m\.?)?/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        mins = parseInt(timeMatch[2], 10);
        const ampm = (timeMatch[3] || '').replace(/[.\s]/g, '').toLowerCase();
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
      }
    }

    try {
      const result = new Date(year, month, day, hours, mins, 0, 0);
      if (isNaN(result.getTime())) return new Date().toISOString();
      return result.toISOString();
    } catch (_) {
      return new Date().toISOString();
    }
  }

  /**
   * Detect media type from a message element by inspecting data-icon attributes.
   * @param {Element} element
   * @returns {string} "text"|"image"|"video"|"audio"|"document"|"sticker"|"link"|"system"
   */
  static detectMediaType(element) {
    if (!element) return 'text';

    // Check data-icon attributes for known media types
    const icons = OmniCRM.qsa('[data-icon]', element);
    const iconTypes = new Set(icons.map(el => el.getAttribute('data-icon')));

    // Sticker check (before image, since stickers contain images)
    if (iconTypes.has('sticker') || element.querySelector('[data-sticker]')) {
      return 'sticker';
    }

    // Video
    if (iconTypes.has('video') || iconTypes.has('video-play') ||
        iconTypes.has('media-video') || element.querySelector('video')) {
      return 'video';
    }

    // Audio (voice note or audio file)
    if (iconTypes.has('audio') || iconTypes.has('audio-play') ||
        iconTypes.has('ptt') || iconTypes.has('media-audio') ||
        element.querySelector('audio')) {
      return 'audio';
    }

    // Document
    if (iconTypes.has('document') || iconTypes.has('audio-download') ||
        iconTypes.has('media-document')) {
      return 'document';
    }

    // Image
    if (iconTypes.has('media-image') || iconTypes.has('image') ||
        iconTypes.has('gallery')) {
      return 'image';
    }
    // Also detect images by actual <img> tags (exclude emoji/profile pics)
    const imgs = OmniCRM.qsa('img:not(.emoji):not([data-plain-text])', element);
    const hasLargeImage = imgs.some(img => {
      const w = img.naturalWidth || img.width || 0;
      return w > 60;
    });
    if (hasLargeImage) return 'image';

    // Link preview
    if (element.querySelector('a[href*="http"]') &&
        (element.textContent || '').match(/https?:\/\//)) {
      return 'link';
    }

    // System message
    if (iconTypes.has('system') ||
        element.querySelector('.system-msg') ||
        element.closest('[data-icon="system"]')) {
      return 'system';
    }

    return OmniCRM.BaseParser.detectContentType(element);
  }

  /**
   * Extract quoted (replied-to) message content.
   * @param {Element} element
   * @returns {Object|null} { text, sender } or null
   */
  static extractQuotedMessage(element) {
    if (!element) return null;

    const quotedEl = OmniCRM.qs('.quoted-msg', element) ||
                     OmniCRM.qs('[data-icon="quoted"]', element) ||
                     OmniCRM.qs('[data-testid="quoted-message"]', element);

    if (!quotedEl) return null;

    try {
      const text = OmniCRM.BaseParser.extractText(quotedEl);

      // Sender is usually in a preceding sibling or parent container
      const quotedContainer = quotedEl.closest('[data-testid="msg-quoted"]') || quotedEl.parentElement;
      let sender = '';
      if (quotedContainer) {
        const senderEl = OmniCRM.qs('span[dir]', quotedContainer) ||
                         OmniCRM.qs('span', quotedContainer);
        if (senderEl && senderEl !== quotedEl) {
          sender = (senderEl.textContent || '').trim();
        }
      }

      if (!text && !sender) return null;

      return { text, sender };
    } catch (err) {
      WAParser.log.warn('Failed to extract quoted message:', err);
      return null;
    }
  }

  /**
   * Extract emoji reactions attached to a message.
   * @param {Element} element
   * @returns {Array<{emoji: string, count: number}>}
   */
  static extractReactions(element) {
    if (!element) return [];

    try {
      // WhatsApp reactions container
      const reactionsContainer = OmniCRM.qs('[data-testid="reactions"]', element) ||
                                 OmniCRM.qs('.reactions-container', element) ||
                                 OmniCRM.qs('[data-icon="reactions"]', element);

      if (!reactionsContainer) return [];

      const reactions = [];
      const reactionItems = OmniCRM.qsa('[data-testid="reaction"]', reactionsContainer);

      if (reactionItems.length > 0) {
        for (const item of reactionItems) {
          const emojiEl = OmniCRM.qs('img[alt]', item) || item;
          const emoji = emojiEl.alt || emojiEl.textContent || '';
          const countEl = OmniCRM.qs('span', item);
          const count = countEl ? parseInt(countEl.textContent, 10) || 1 : 1;

          if (emoji.trim()) {
            reactions.push({ emoji: emoji.trim(), count });
          }
        }
      } else {
        // Fallback: scan for emoji images within the reactions area
        const emojiImgs = OmniCRM.qsa('img[alt]', reactionsContainer);
        for (const img of emojiImgs) {
          const emoji = img.alt || '';
          if (emoji.trim()) {
            reactions.push({ emoji: emoji.trim(), count: 1 });
          }
        }
      }

      return reactions;
    } catch (err) {
      WAParser.log.warn('Failed to extract reactions:', err);
      return [];
    }
  }

  /**
   * Detect if a message has been forwarded.
   * @param {Element} element
   * @returns {boolean}
   */
  static detectForwarded(element) {
    if (!element) return false;

    // WhatsApp shows a "forwarded" label with a specific icon
    const forwardedIcon = OmniCRM.qs('[data-icon="forwarded"]', element) ||
                          OmniCRM.qs('[data-icon="frequently-forwarded"]', element) ||
                          OmniCRM.qs('[data-testid="forwarded"]', element);

    if (forwardedIcon) return true;

    // Fallback: check for forwarded text label
    const spans = OmniCRM.qsa('span', element);
    for (const span of spans) {
      const text = (span.textContent || '').toLowerCase().trim();
      if (text === 'forwarded' || text === 'reenviado' || text === 'encaminhada') {
        return true;
      }
    }

    return false;
  }
}

OmniCRM.WAParser = WAParser;
