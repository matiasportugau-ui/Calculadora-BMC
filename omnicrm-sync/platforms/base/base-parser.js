/**
 * OmniCRM Sync — Base Parser
 * Shared message parsing utilities for all platforms.
 * Depends on: utils.js
 */

class BaseParser {
  static log = new OmniCRM.OmniLog('parser');

  /**
   * Extract clean text from a DOM element, handling nested spans, emojis, etc.
   * @param {Element} element
   * @returns {string}
   */
  static extractText(element) {
    if (!element) return '';

    const clone = element.cloneNode(true);

    // Replace emoji images with their alt text
    clone.querySelectorAll('img[data-plain-text]').forEach(img => {
      img.replaceWith(document.createTextNode(img.getAttribute('data-plain-text') || img.alt || ''));
    });
    clone.querySelectorAll('img.emoji, img[alt]').forEach(img => {
      img.replaceWith(document.createTextNode(img.alt || ''));
    });

    // Get text content and normalize whitespace
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Parse a timestamp string into ISO 8601.
   * Handles: "12:45 PM", "Yesterday", "3/19/26", "hace 2 horas", relative times
   * @param {string} raw
   * @param {string} locale - 'en', 'es', 'pt', or 'auto'
   * @returns {string} ISO 8601 timestamp
   */
  static parseTimestamp(raw, locale = 'auto') {
    if (!raw) return new Date().toISOString();
    const text = raw.trim().toLowerCase();

    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return raw;

    // Unix timestamp (seconds or ms)
    if (/^\d{10,13}$/.test(text)) {
      const ts = text.length === 10 ? parseInt(text) * 1000 : parseInt(text);
      return new Date(ts).toISOString();
    }

    const now = new Date();

    // Relative times (EN)
    const relMinEN = text.match(/(\d+)\s*min(?:ute)?s?\s*ago/);
    if (relMinEN) return new Date(now - parseInt(relMinEN[1]) * 60000).toISOString();

    const relHrEN = text.match(/(\d+)\s*hours?\s*ago/);
    if (relHrEN) return new Date(now - parseInt(relHrEN[1]) * 3600000).toISOString();

    // Relative times (ES)
    const relMinES = text.match(/hace\s*(\d+)\s*min/);
    if (relMinES) return new Date(now - parseInt(relMinES[1]) * 60000).toISOString();

    const relHrES = text.match(/hace\s*(\d+)\s*hora/);
    if (relHrES) return new Date(now - parseInt(relHrES[1]) * 3600000).toISOString();

    // Relative times (PT)
    const relMinPT = text.match(/há\s*(\d+)\s*min/);
    if (relMinPT) return new Date(now - parseInt(relMinPT[1]) * 60000).toISOString();

    const relHrPT = text.match(/há\s*(\d+)\s*hora/);
    if (relHrPT) return new Date(now - parseInt(relHrPT[1]) * 3600000).toISOString();

    // "Yesterday" / "Ayer" / "Ontem"
    if (/^(yesterday|ayer|ontem)/.test(text)) {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return d.toISOString();
    }

    // "Today" / "Hoy" / "Hoje"
    if (/^(today|hoy|hoje)/.test(text)) {
      return now.toISOString();
    }

    // Time only: "12:45 PM", "14:30", "[12:45 PM, 3/19/2026]"
    const timeMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|a\.?\s?m\.?|p\.?\s?m\.?)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const mins = parseInt(timeMatch[2]);
      const secs = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
      const ampm = (timeMatch[4] || '').replace(/[.\s]/g, '').toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      const d = new Date(now);
      d.setHours(hours, mins, secs, 0);
      return d.toISOString();
    }

    // dd/mm/yyyy or mm/dd/yyyy
    const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dateMatch) {
      let [, a, b, yearStr] = dateMatch;
      let year = parseInt(yearStr);
      if (year < 100) year += 2000;
      // Assume dd/mm/yyyy for non-US locales (ES, PT)
      const day = parseInt(a);
      const month = parseInt(b) - 1;
      return new Date(year, month, day).toISOString();
    }

    // Fallback: try native Date parser
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();

    return now.toISOString();
  }

  /**
   * Detect message content type from DOM element.
   * @param {Element} element
   * @returns {string} "text"|"image"|"video"|"audio"|"document"|"sticker"|"link"|"system"
   */
  static detectContentType(element) {
    if (!element) return 'text';

    const html = element.innerHTML || '';
    const text = element.textContent || '';

    if (element.querySelector('img[data-sticker], [data-icon="sticker"]')) return 'sticker';
    if (element.querySelector('video')) return 'video';
    if (element.querySelector('audio')) return 'audio';
    if (element.querySelector('img:not(.emoji):not([data-plain-text])') ||
        element.querySelector('[data-icon="media-image"]')) return 'image';
    if (element.querySelector('[data-icon="audio-download"], [data-icon="document"]') ||
        element.querySelector('a[href*="blob:"]')) return 'document';
    if (element.querySelector('a[href*="http"]') && text.match(/https?:\/\//)) return 'link';

    // System messages (typically different styling)
    if (element.closest('[data-icon="system"]') ||
        element.classList.contains('system-msg') ||
        element.querySelector('.system-msg')) return 'system';

    return 'text';
  }

  /**
   * Generate a hash from message content for deduplication.
   * @param {string} text
   * @returns {string}
   */
  static contentHash(text) {
    return OmniCRM.contentHash(text || '');
  }

  /**
   * Strip HTML but preserve meaningful whitespace.
   * @param {string} html
   * @returns {string}
   */
  static cleanText(html) {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    // Replace <br> with newlines
    temp.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    return (temp.textContent || '').replace(/[ \t]+/g, ' ').trim();
  }

  /**
   * Detect message direction (incoming vs outgoing).
   * Platform-specific implementations should override this.
   * @param {Element} element
   * @param {string} platform
   * @returns {string} "incoming"|"outgoing"
   */
  static detectDirection(element, platform) {
    if (!element) return 'incoming';

    switch (platform) {
      case 'whatsapp': {
        if (element.closest('.message-out') || element.classList.contains('message-out')) return 'outgoing';
        if (element.closest('.message-in') || element.classList.contains('message-in')) return 'incoming';
        // Fallback: check class patterns for "out"
        const classes = element.className || '';
        if (/\bout\b|outgoing/i.test(classes)) return 'outgoing';
        return 'incoming';
      }
      case 'mercadolibre': {
        // ML uses different background colors or "from-seller" patterns
        const classes = element.className || '';
        if (/seller|vendedor|from-seller/i.test(classes)) return 'outgoing';
        if (/buyer|comprador|from-buyer/i.test(classes)) return 'incoming';
        // Fallback: check alignment
        const style = window.getComputedStyle(element);
        if (style.marginLeft === 'auto' || style.textAlign === 'right') return 'outgoing';
        return 'incoming';
      }
      case 'facebook': {
        // FB uses alignment for direction
        const ariaLabel = element.getAttribute('aria-label') || '';
        if (/you sent/i.test(ariaLabel)) return 'outgoing';
        // Check visual alignment (right = outgoing)
        const rect = element.getBoundingClientRect();
        const parentRect = element.parentElement ? element.parentElement.getBoundingClientRect() : rect;
        if (rect.right > parentRect.width * 0.6) return 'outgoing';
        return 'incoming';
      }
      case 'instagram': {
        // Similar to FB — alignment or sender indicator
        const ariaLabel = element.getAttribute('aria-label') || '';
        if (/you sent|your message/i.test(ariaLabel)) return 'outgoing';
        const rect = element.getBoundingClientRect();
        const parentRect = element.parentElement ? element.parentElement.getBoundingClientRect() : rect;
        if (rect.right > parentRect.width * 0.6) return 'outgoing';
        return 'incoming';
      }
      default:
        return 'incoming';
    }
  }
}

OmniCRM.BaseParser = BaseParser;
