/**
 * OmniCRM Sync — Facebook Messenger Parser
 * Extracts structured message data from Facebook Messenger DOM elements.
 * Covers facebook.com/messages, /marketplace/messages/, and messenger.com.
 * Depends on: utils.js, base-parser.js, fb-selectors.js
 */

class FBParser extends OmniCRM.BaseParser {
  static log = new OmniCRM.OmniLog('facebook:parser');

  /**
   * Parse a complete message from a message row element.
   * @param {Element} element - A message row/gridcell element
   * @returns {Object|null} Parsed message data or null if unparseable
   */
  static parseMessage(element) {
    if (!element) return null;

    try {
      // Detect system messages first
      const systemText = FBParser._extractSystemMessage(element);
      if (systemText) {
        return {
          text: systemText,
          timestamp: FBParser.parseTimestamp(element),
          direction: 'system',
          contentType: 'system',
          reactions: [],
          quotedMessage: null,
          raw: {}
        };
      }

      const text = FBParser._extractMessageText(element);
      const timestamp = FBParser.parseTimestamp(element);
      const direction = FBParser.detectDirection(element);
      const contentType = FBParser.detectMediaType(element);
      const reactions = FBParser.extractReactions(element);

      // Skip empty text-only messages
      if (!text && contentType === 'text') return null;

      return {
        text,
        timestamp,
        direction,
        contentType,
        reactions,
        quotedMessage: null,
        raw: {
          ariaLabel: element.getAttribute('aria-label') || ''
        }
      };
    } catch (err) {
      FBParser.log.error('Failed to parse message element:', err);
      return null;
    }
  }

  /**
   * Extract text content from a message element.
   * Facebook uses [dir="auto"] spans for message text.
   * @param {Element} element
   * @returns {string}
   */
  static _extractMessageText(element) {
    // Find all [dir="auto"] elements inside the message
    const dirAutoEls = OmniCRM.qsa('[dir="auto"]', element);

    // Filter to the deepest text-bearing elements (skip container divs)
    const textParts = [];
    for (const el of dirAutoEls) {
      // Skip elements that contain other [dir="auto"] children (containers)
      const nestedDirAuto = OmniCRM.qs('[dir="auto"]', el);
      if (nestedDirAuto && nestedDirAuto !== el) continue;

      const text = OmniCRM.BaseParser.extractText(el);
      if (text) {
        textParts.push(text);
      }
    }

    return textParts.join('\n').trim();
  }

  /**
   * Detect system messages like "You are now connected", "Nickname changed", etc.
   * @param {Element} element
   * @returns {string|null} System message text or null
   */
  static _extractSystemMessage(element) {
    if (!element) return null;

    // System messages in FB Messenger are centered and lack sender alignment
    const text = (element.textContent || '').trim();

    const systemPatterns = [
      /^you are now connected/i,
      /^you can now message/i,
      /^you sent a link/i,
      /^.*changed the (group |chat )?name/i,
      /^.*set the nickname/i,
      /^.*changed the (theme|emoji)/i,
      /^.*added .*to the group/i,
      /^.*removed .*from the group/i,
      /^.*left the group/i,
      /^.*created the group/i,
      /^you (accepted|declined) the invitation/i,
      /^this conversation is (now )?end-to-end encrypted/i,
      /^.*missed (a |your )?(video |voice )?call/i
    ];

    for (const pattern of systemPatterns) {
      if (pattern.test(text)) return text;
    }

    // Check structural hints: system messages often have no gridcell role
    // and are rendered as standalone centered elements
    const hasGridcell = element.closest('[role="gridcell"]') ||
                        OmniCRM.qs('[role="gridcell"]', element);
    if (!hasGridcell) {
      const row = element.closest('[role="row"]');
      if (row) {
        const cells = OmniCRM.qsa('[role="gridcell"]', row);
        // System messages typically render in a single centered cell
        if (cells.length <= 1 && text.length > 0 && text.length < 200) {
          // Additional heuristic: no avatar image nearby
          const avatar = OmniCRM.qs('img[alt]', row) ||
                         OmniCRM.qs('[role="img"]', row);
          if (!avatar) return text;
        }
      }
    }

    return null;
  }

  /**
   * Parse timestamp from a Facebook message element.
   * FB uses data-utime (Unix epoch) or tooltip/aria-label with time strings.
   * @param {Element} element
   * @returns {string} ISO 8601 timestamp
   */
  static parseTimestamp(element) {
    if (!element) return new Date().toISOString();

    // Primary: data-utime attribute (Unix epoch seconds)
    const utimeEl = OmniCRM.qs('[data-utime]', element);
    if (utimeEl) {
      const epoch = parseInt(utimeEl.getAttribute('data-utime'), 10);
      if (epoch && !isNaN(epoch)) {
        try {
          const date = new Date(epoch * 1000);
          if (!isNaN(date.getTime())) return date.toISOString();
        } catch (_) {
          // Fall through
        }
      }
    }

    // Secondary: <time datetime="..."> element
    const timeEl = OmniCRM.qs('time[datetime]', element);
    if (timeEl) {
      const dt = timeEl.getAttribute('datetime');
      if (dt) {
        try {
          const date = new Date(dt);
          if (!isNaN(date.getTime())) return date.toISOString();
        } catch (_) {
          // Fall through
        }
      }
    }

    // Tertiary: tooltip or aria-label with time text
    const tooltipEl = OmniCRM.qs('[role="tooltip"]', element) ||
                      OmniCRM.qs('[aria-label]', element);
    if (tooltipEl) {
      const label = tooltipEl.getAttribute('aria-label') || tooltipEl.textContent || '';
      // Look for time patterns like "3:45 PM" or "15:45"
      const timeMatch = label.match(/\d{1,2}:\d{2}\s*(AM|PM)?/i);
      if (timeMatch) {
        return OmniCRM.BaseParser.parseTimestamp(timeMatch[0]);
      }
    }

    return new Date().toISOString();
  }

  /**
   * Detect message direction via structural position.
   * Facebook Messenger uses alignment (right = outgoing, left = incoming).
   * Outgoing messages lack an avatar image on the left side.
   * @param {Element} element
   * @returns {string} "incoming"|"outgoing"
   */
  static detectDirection(element) {
    if (!element) return 'incoming';

    // Method 1: Check computed alignment via style or class heuristics
    // FB outgoing messages are typically right-aligned with a distinct background
    const row = element.closest('[role="row"]') || element;
    const cells = OmniCRM.qsa('[role="gridcell"]', row);

    if (cells.length >= 2) {
      // In FB Messenger's grid layout, outgoing messages have content
      // in the right cell and an empty left cell (no avatar)
      const firstCell = cells[0];
      const lastCell = cells[cells.length - 1];

      // Outgoing: first cell is empty, last cell has content
      const firstHasAvatar = OmniCRM.qs('img', firstCell) ||
                             OmniCRM.qs('[role="img"]', firstCell) ||
                             OmniCRM.qs('svg', firstCell);
      const firstHasText = (firstCell.textContent || '').trim().length > 0;

      if (!firstHasAvatar && !firstHasText) {
        return 'outgoing';
      }
    }

    // Method 2: Check for avatar presence (incoming messages show sender avatar)
    const avatar = OmniCRM.qs('img[alt]:not([alt=""])', row) ||
                   OmniCRM.qs('[role="img"][aria-label]', row);
    if (!avatar) {
      // No avatar usually means outgoing
      // But verify there's actual message content
      const hasContent = OmniCRM.qs('[dir="auto"]', row);
      if (hasContent) return 'outgoing';
    }

    // Method 3: Check inline styles for margin/float patterns
    // Outgoing messages often have margin-left: auto or similar
    const messageDiv = OmniCRM.qs('[dir="auto"]', row);
    if (messageDiv) {
      const container = messageDiv.closest('[role="gridcell"]') || messageDiv.parentElement;
      if (container) {
        const style = container.getAttribute('style') || '';
        if (style.includes('margin-left: auto') || style.includes('flex-end')) {
          return 'outgoing';
        }
      }
    }

    return 'incoming';
  }

  /**
   * Detect media content type from a message element.
   * @param {Element} element
   * @returns {string} "text"|"image"|"video"|"link"|"gif"|"sticker"|"audio"
   */
  static detectMediaType(element) {
    if (!element) return 'text';

    // Sticker: small image with specific size or sticker-related attributes
    const imgs = OmniCRM.qsa('img', element);
    for (const img of imgs) {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      // FB stickers are served from specific CDN paths
      if (src.includes('sticker') || alt.toLowerCase().includes('sticker')) {
        return 'sticker';
      }
      // Stickers are typically small fixed-size images
      const w = img.width || img.naturalWidth || 0;
      const h = img.height || img.naturalHeight || 0;
      if (w > 0 && w <= 180 && h > 0 && h <= 180 && src.includes('fbcdn')) {
        return 'sticker';
      }
    }

    // GIF: animated image or giphy-sourced content
    for (const img of imgs) {
      const src = img.getAttribute('src') || '';
      if (src.includes('.gif') || src.includes('giphy') || src.includes('tenor')) {
        return 'gif';
      }
    }

    // Video element
    if (OmniCRM.qs('video', element)) {
      return 'video';
    }

    // Audio element
    if (OmniCRM.qs('audio', element)) {
      return 'audio';
    }

    // Image: large images that are not stickers/GIFs
    const contentImgs = imgs.filter(img => {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      const w = img.width || img.naturalWidth || 0;
      // Skip avatars (typically small circular images)
      if (w > 0 && w <= 40) return false;
      // Skip emoji images
      if (alt && alt.length <= 2) return false;
      // Skip UI icons
      if (src.includes('emoji') || src.includes('data:image')) return false;
      return w > 60 || src.includes('fbcdn') || src.includes('scontent');
    });
    if (contentImgs.length > 0) return 'image';

    // Link preview: anchor elements with preview cards
    const links = OmniCRM.qsa('a[href*="http"]', element);
    if (links.length > 0) {
      // Check if there's a link preview card (not just inline URL text)
      const previewCard = OmniCRM.qs('[role="link"]', element) ||
                          OmniCRM.qs('a[href] img', element);
      if (previewCard) return 'link';

      // Also check for bare URL in text
      const text = (element.textContent || '').trim();
      if (/https?:\/\/\S+/.test(text)) return 'link';
    }

    return OmniCRM.BaseParser.detectContentType(element);
  }

  /**
   * Extract emoji reactions from a message element.
   * Facebook shows reactions as emoji overlays below the message bubble.
   * @param {Element} element
   * @returns {Array<{emoji: string, count: number}>}
   */
  static extractReactions(element) {
    if (!element) return [];

    try {
      // Reactions in FB appear as small emoji badges below/beside the message
      const reactionContainers = OmniCRM.qsa('[aria-label*="reaction" i]', element);
      const reactions = [];

      for (const container of reactionContainers) {
        const label = container.getAttribute('aria-label') || '';
        const emojiImgs = OmniCRM.qsa('img[alt]', container);

        if (emojiImgs.length > 0) {
          for (const img of emojiImgs) {
            const emoji = img.getAttribute('alt') || '';
            if (emoji.trim()) {
              reactions.push({ emoji: emoji.trim(), count: 1 });
            }
          }
        } else {
          // Text-based reactions or single emoji in aria-label
          const emojiMatch = label.match(/([\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])/gu);
          if (emojiMatch) {
            for (const emoji of emojiMatch) {
              reactions.push({ emoji, count: 1 });
            }
          }
        }
      }

      // Deduplicate and count
      const merged = {};
      for (const r of reactions) {
        if (merged[r.emoji]) {
          merged[r.emoji].count += r.count;
        } else {
          merged[r.emoji] = { emoji: r.emoji, count: r.count };
        }
      }

      return Object.values(merged);
    } catch (err) {
      FBParser.log.warn('Failed to extract reactions:', err);
      return [];
    }
  }
}

OmniCRM.FBParser = FBParser;
