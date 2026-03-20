/**
 * OmniCRM Sync — Instagram DM Message Parser
 * Extracts structured message data from Instagram Direct DOM elements.
 * Handles text, emojis, shared posts/reels, voice messages, images,
 * videos, reactions, and replied-to messages.
 * Depends on: utils.js, base-parser.js, ig-selectors.js
 */

class IGParser extends OmniCRM.BaseParser {
  static log = new OmniCRM.OmniLog('instagram:parser');

  /**
   * Parse a complete message from a message row element.
   * @param {Element} element - A message row/item element
   * @returns {Object|null} Parsed message data or null if unparseable
   */
  static parseMessage(element) {
    if (!element) return null;

    try {
      const text = IGParser._extractMessageText(element);
      const timestamp = IGParser.parseTimestamp(element);
      const direction = IGParser.detectDirection(element);
      const contentType = IGParser.detectMediaType(element);
      const quotedMessage = IGParser.extractQuotedMessage(element);
      const reactions = IGParser.extractReactions(element);
      const sharedPost = IGParser._extractSharedPost(element);

      // Skip empty system/date separator elements
      if (!text && contentType === 'text' && !sharedPost) {
        const isDateSeparator = IGParser._isDateSeparator(element);
        if (isDateSeparator) return null;
      }

      return {
        text,
        timestamp,
        direction,
        contentType,
        quotedMessage,
        reactions,
        sharedPost,
        raw: {
          classes: element.className || '',
          tagName: element.tagName || ''
        }
      };
    } catch (err) {
      IGParser.log.error('Failed to parse message element:', err);
      return null;
    }
  }

  /**
   * Extract text content from an Instagram DM message element.
   * Instagram wraps text in div[dir="auto"] or span[dir="auto"] elements.
   * @param {Element} element
   * @returns {string}
   */
  static _extractMessageText(element) {
    if (!element) return '';

    // Primary: div[dir="auto"] contains the message text
    let textEl = OmniCRM.qs('div[dir="auto"]', element);
    if (!textEl) {
      textEl = OmniCRM.qs('span[dir="auto"]', element);
    }
    if (!textEl) {
      textEl = OmniCRM.qs('div[role="none"] span', element);
    }

    if (!textEl) return '';

    // Extract text while preserving emoji alt text from <img alt="..."> tags
    return IGParser._extractTextWithEmoji(textEl);
  }

  /**
   * Extract text content while converting emoji <img alt="..."> to their
   * unicode representation.
   * @param {Element} element
   * @returns {string}
   */
  static _extractTextWithEmoji(element) {
    if (!element) return '';

    let result = '';
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
          if (node.tagName === 'IMG') return NodeFilter.FILTER_ACCEPT;
          if (node.tagName === 'BR') return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else if (node.tagName === 'IMG') {
        result += node.alt || '';
      } else if (node.tagName === 'BR') {
        result += '\n';
      }
    }

    return result.trim();
  }

  /**
   * Parse timestamp from an Instagram DM message element.
   * Instagram uses <time> elements with datetime attributes,
   * or relative timestamps like "1h", "2d", "Just now".
   * @param {Element} element
   * @returns {string} ISO 8601 timestamp
   */
  static parseTimestamp(element) {
    if (!element) return new Date().toISOString();

    // Primary: <time datetime="..."> element
    const timeEl = OmniCRM.qs('time[datetime]', element);
    if (timeEl) {
      const dt = timeEl.getAttribute('datetime');
      if (dt) {
        try {
          const parsed = new Date(dt);
          if (!isNaN(parsed.getTime())) return parsed.toISOString();
        } catch (_) {
          // Fall through to other strategies
        }
      }
    }

    // Secondary: <time> element with text content (relative time)
    const timeTextEl = OmniCRM.qs('time', element);
    if (timeTextEl) {
      const relativeText = (timeTextEl.textContent || '').trim();
      if (relativeText) {
        return IGParser._parseRelativeTimestamp(relativeText);
      }
    }

    // Tertiary: aria-label on the message container may contain time info
    const ariaLabel = element.getAttribute('aria-label') || '';
    if (ariaLabel) {
      const timeMatch = ariaLabel.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
      if (timeMatch) {
        return OmniCRM.BaseParser.parseTimestamp(timeMatch[1]);
      }
    }

    return new Date().toISOString();
  }

  /**
   * Parse Instagram relative timestamps like "1h", "2d", "Just now", "3w".
   * @param {string} text - Relative timestamp string
   * @returns {string} ISO 8601 timestamp
   */
  static _parseRelativeTimestamp(text) {
    const now = Date.now();
    const lower = text.toLowerCase().trim();

    if (lower === 'just now' || lower === 'now') {
      return new Date(now).toISOString();
    }

    const match = lower.match(/^(\d+)\s*(s|m|h|d|w)$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000
      };
      const offset = value * (multipliers[unit] || 0);
      return new Date(now - offset).toISOString();
    }

    // Fallback: try standard date parsing
    return OmniCRM.BaseParser.parseTimestamp(text);
  }

  /**
   * Detect message direction (incoming vs outgoing) from element structure.
   * Instagram DMs use alignment (right = outgoing, left = incoming) and
   * often have distinct container structures.
   * @param {Element} element
   * @returns {string} "incoming"|"outgoing"
   */
  static detectDirection(element) {
    if (!element) return 'incoming';

    // Strategy 1: Check alignment via computed style or inline style
    const style = element.getAttribute('style') || '';
    if (style.includes('flex-end') || style.includes('align-self: flex-end') ||
        style.includes('margin-left: auto')) {
      return 'outgoing';
    }

    // Strategy 2: Check parent container alignment
    const parent = element.parentElement;
    if (parent) {
      const parentStyle = parent.getAttribute('style') || '';
      if (parentStyle.includes('flex-end') || parentStyle.includes('align-items: flex-end')) {
        return 'outgoing';
      }
    }

    // Strategy 3: Traverse up to find the alignment wrapper
    let current = element;
    for (let i = 0; i < 5; i++) {
      if (!current) break;
      const cs = current.getAttribute('style') || '';
      if (cs.includes('flex-end') || cs.includes('margin-left: auto')) {
        return 'outgoing';
      }
      // Instagram sometimes uses class-based alignment
      const cls = current.className || '';
      if (typeof cls === 'string' && cls.length > 0) {
        // Outgoing messages tend to have a blue/branded background
        const computed = window.getComputedStyle?.(current);
        if (computed) {
          const bg = computed.backgroundColor;
          // Instagram uses rgb(0, 149, 246) or similar blue for outgoing
          if (bg && (bg.includes('0, 149, 246') || bg.includes('3, 126, 230') ||
                     bg.includes('0,149,246'))) {
            return 'outgoing';
          }
        }
      }
      current = current.parentElement;
    }

    // Strategy 4: Use BaseParser direction detection
    return OmniCRM.BaseParser.detectDirection(element, 'instagram');
  }

  /**
   * Detect media type from the message element's container structure.
   * @param {Element} element
   * @returns {string} "text"|"image"|"video"|"audio"|"shared_post"|"shared_reel"|"story_reply"|"link"|"sticker"
   */
  static detectMediaType(element) {
    if (!element) return 'text';

    // Voice message: audio element or waveform visualization
    if (element.querySelector('audio') ||
        element.querySelector('[aria-label*="Voice" i]') ||
        element.querySelector('[aria-label*="Audio" i]') ||
        element.querySelector('div[role="slider"]')) {
      return 'audio';
    }

    // Video: video element or play button overlay
    if (element.querySelector('video') ||
        element.querySelector('[aria-label*="Video" i]')) {
      return 'video';
    }

    // Shared reel: links to /reel/ or has reel indicator
    const links = OmniCRM.qsa('a[href]', element);
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (href.includes('/reel/') || href.includes('/reels/')) {
        return 'shared_reel';
      }
      if (href.includes('/p/')) {
        return 'shared_post';
      }
    }

    // Shared post: contains post preview card
    if (element.querySelector('article') ||
        element.querySelector('[aria-label*="post" i]')) {
      return 'shared_post';
    }

    // Story reply: story mention or reply indicator
    if (element.querySelector('[aria-label*="story" i]') ||
        element.querySelector('[aria-label*="Story" i]')) {
      return 'story_reply';
    }

    // Image: img elements (exclude small avatars and emoji)
    const imgs = OmniCRM.qsa('img:not([alt])', element);
    const hasLargeImage = imgs.some(img => {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      return w > 80 || h > 80;
    });
    if (hasLargeImage) return 'image';

    // Also check for images with src but filtering out emoji/avatar
    const allImgs = OmniCRM.qsa('img[src]', element);
    for (const img of allImgs) {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      // Skip emoji images (single character alt) and profile pics
      if (alt.length <= 2 && alt.length > 0) continue;
      if (src.includes('profile_pic') || src.includes('avatar')) continue;
      const w = img.naturalWidth || img.width || 0;
      if (w > 80) return 'image';
    }

    // Sticker: sticker-like image in specific container
    const stickerImgs = OmniCRM.qsa('img[alt]', element);
    for (const img of stickerImgs) {
      const w = img.naturalWidth || img.width || 0;
      if (w >= 100 && w <= 200) {
        const parentStyle = (img.parentElement?.getAttribute('style') || '');
        if (!parentStyle.includes('border-radius')) {
          return 'sticker';
        }
      }
    }

    // Link preview
    if (element.querySelector('a[href*="http"]') ||
        element.querySelector('[role="link"]')) {
      const text = (element.textContent || '');
      if (text.match(/https?:\/\//)) {
        return 'link';
      }
    }

    return OmniCRM.BaseParser.detectContentType(element);
  }

  /**
   * Extract quoted (replied-to) message content.
   * Instagram shows the original message above the reply in a collapsed container.
   * @param {Element} element
   * @returns {Object|null} { text, sender } or null
   */
  static extractQuotedMessage(element) {
    if (!element) return null;

    try {
      // Instagram reply containers often have a distinct visual style
      // with a line/bar on the left and the original message preview
      const replyIndicators = OmniCRM.qsa('div[role="button"]', element);

      for (const indicator of replyIndicators) {
        // Reply containers typically have a specific structure:
        // a smaller, greyed-out version of the original message
        const spans = OmniCRM.qsa('span[dir="auto"]', indicator);
        if (spans.length >= 1) {
          // Check if this looks like a reply (has border-left or specific styling)
          const style = indicator.getAttribute('style') || '';
          const parentStyle = (indicator.parentElement?.getAttribute('style') || '');

          const isReply = style.includes('border') ||
                          parentStyle.includes('border') ||
                          indicator.querySelector('div[style*="border-left"]') ||
                          indicator.querySelector('div[style*="border-inline-start"]');

          if (isReply && spans.length > 0) {
            const text = OmniCRM.BaseParser.extractText(spans[spans.length - 1]);
            const sender = spans.length > 1
              ? (spans[0].textContent || '').trim()
              : '';

            if (text || sender) {
              return { text, sender };
            }
          }
        }
      }

      // Fallback: look for aria-label indicating a reply
      const replyLabel = OmniCRM.qs('[aria-label*="Replied" i]', element) ||
                         OmniCRM.qs('[aria-label*="reply" i]', element);
      if (replyLabel) {
        const text = OmniCRM.BaseParser.extractText(replyLabel);
        return text ? { text, sender: '' } : null;
      }

      return null;
    } catch (err) {
      IGParser.log.warn('Failed to extract quoted message:', err);
      return null;
    }
  }

  /**
   * Extract reactions (heart and emoji) from a message element.
   * Instagram DMs support quick heart reactions and emoji reactions.
   * @param {Element} element
   * @returns {Array<{emoji: string, count: number}>}
   */
  static extractReactions(element) {
    if (!element) return [];

    try {
      const reactions = [];

      // Reactions appear as small emoji/image overlays below the message bubble
      const reactionImgs = OmniCRM.qsa('img[alt]', element);
      for (const img of reactionImgs) {
        const alt = img.getAttribute('alt') || '';
        // Reaction emojis have single-character or short alt text
        if (alt.length >= 1 && alt.length <= 4) {
          // Check if this is in a reaction container (usually positioned
          // at the bottom of the message bubble)
          const parent = img.closest('div[role="button"]') || img.parentElement;
          if (parent) {
            const parentStyle = parent.getAttribute('style') || '';
            const isReaction = parentStyle.includes('position') ||
                               parentStyle.includes('bottom') ||
                               parent.getAttribute('role') === 'button';
            if (isReaction) {
              reactions.push({ emoji: alt, count: 1 });
            }
          }
        }
      }

      // Also check for text-based emoji reactions (non-image)
      const reactionButtons = OmniCRM.qsa('button[aria-label*="reaction" i]', element);
      for (const btn of reactionButtons) {
        const emoji = (btn.textContent || '').trim();
        if (emoji && emoji.length <= 4) {
          reactions.push({ emoji, count: 1 });
        }
      }

      // Heart reaction: Instagram's default quick reaction
      const heartEl = OmniCRM.qs('[aria-label*="Liked" i]', element) ||
                      OmniCRM.qs('[aria-label*="loved" i]', element);
      if (heartEl && reactions.length === 0) {
        reactions.push({ emoji: '\u2764\uFE0F', count: 1 });
      }

      return reactions;
    } catch (err) {
      IGParser.log.warn('Failed to extract reactions:', err);
      return [];
    }
  }

  /**
   * Extract shared post/reel data from a message element.
   * @param {Element} element
   * @returns {Object|null} { url, type, caption } or null
   */
  static _extractSharedPost(element) {
    if (!element) return null;

    const links = OmniCRM.qsa('a[href]', element);
    for (const link of links) {
      const href = link.getAttribute('href') || '';

      if (href.includes('/p/') || href.includes('/reel/') || href.includes('/reels/')) {
        const type = href.includes('/reel') ? 'reel' : 'post';
        const caption = OmniCRM.BaseParser.extractText(link) || '';
        return {
          url: href.startsWith('/') ? `https://www.instagram.com${href}` : href,
          type,
          caption
        };
      }
    }

    return null;
  }

  /**
   * Check if an element is a date separator (e.g., "Today", "March 19, 2026").
   * @param {Element} element
   * @returns {boolean}
   */
  static _isDateSeparator(element) {
    if (!element) return false;

    const text = (element.textContent || '').trim();
    if (!text) return false;

    // Date separators are typically short and contain date-like text
    if (text.length > 50) return false;

    const datePatterns = [
      /^(today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
      /^\w+\s+\d{1,2},?\s+\d{4}$/,       // "March 19, 2026"
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,      // "3/19/2026"
      /^\d{1,2}\s+\w+\s+\d{4}$/           // "19 March 2026"
    ];

    return datePatterns.some(pattern => pattern.test(text));
  }
}

OmniCRM.IGParser = IGParser;
