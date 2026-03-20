/**
 * OmniCRM Sync — MercadoLibre Message Parser
 * Extracts structured message data from MercadoLibre messaging DOM elements.
 * Depends on: utils.js, base-parser.js, ml-selectors.js
 */

class MLParser extends OmniCRM.BaseParser {
  static log = new OmniCRM.OmniLog('mercadolibre:parser');

  /**
   * Regex for MercadoLibre order ID prefixes across all country sites.
   * MLA = Argentina, MLB = Brazil, MLC = Chile, MLM = Mexico, MLU = Uruguay
   * MCO = Colombia, MLV = Venezuela, MEC = Ecuador, MPE = Peru, MBO = Bolivia
   */
  static ORDER_ID_PATTERN = /\b(MLA|MLB|MLC|MLM|MLU|MCO|MLV|MEC|MPE|MBO)-?\d{6,14}\b/gi;

  /**
   * Parse a complete message from a message item element.
   * @param {Element} element - A message item element
   * @returns {Object|null} Parsed message data or null if unparseable
   */
  static parseMessage(element) {
    if (!element) return null;

    try {
      const text = MLParser._extractMessageText(element);
      const timestamp = MLParser.parseTimestamp(element);
      const direction = MLParser.detectDirection(element);
      const contentType = MLParser.detectContentType(element);
      const isSystem = MLParser.isSystemMessage(element);
      const orderRefs = MLParser.extractOrderReferences(text || (element.textContent || ''));
      const imageInfo = MLParser.detectAttachedImage(element);

      if (isSystem) {
        return {
          text: text || OmniCRM.BaseParser.extractText(element),
          timestamp,
          direction: 'system',
          contentType: 'system',
          orderReferences: orderRefs,
          raw: {
            classes: element.className || '',
            isAutoMessage: true
          }
        };
      }

      // Skip empty non-media messages
      if (!text && contentType === 'text') return null;

      return {
        text,
        timestamp,
        direction,
        contentType,
        orderReferences: orderRefs,
        hasImage: imageInfo.hasImage,
        imageSrc: imageInfo.src,
        raw: {
          classes: element.className || ''
        }
      };
    } catch (err) {
      MLParser.log.error('Failed to parse message element:', err);
      return null;
    }
  }

  /**
   * Extract text content from a message element.
   * @param {Element} element
   * @returns {string}
   * @private
   */
  static _extractMessageText(element) {
    // Primary: [data-testid="message-text"]
    let textEl = OmniCRM.qs('[data-testid="message-text"]', element);
    if (!textEl) {
      textEl = OmniCRM.qs('.message-text', element);
    }
    if (!textEl) {
      textEl = OmniCRM.qs('.message-content p', element);
    }
    if (!textEl) {
      textEl = OmniCRM.qs('[class*="MessageText"]', element);
    }
    if (!textEl) {
      textEl = OmniCRM.qs('.message-bubble p', element);
    }

    return OmniCRM.BaseParser.extractText(textEl);
  }

  /**
   * Parse timestamp from a MercadoLibre message element.
   * ML commonly uses dd/mm/yyyy HH:mm format in LATAM locales.
   * @param {Element} element
   * @returns {string} ISO 8601 timestamp
   */
  static parseTimestamp(element) {
    if (!element) return new Date().toISOString();

    // Primary: <time datetime="...">
    const timeEl = OmniCRM.qs('time[datetime]', element);
    if (timeEl) {
      const iso = timeEl.getAttribute('datetime');
      if (iso) {
        const parsed = new Date(iso);
        if (!isNaN(parsed.getTime())) return parsed.toISOString();
      }
    }

    // Secondary: [data-testid="message-timestamp"]
    const tsEl = OmniCRM.qs('[data-testid="message-timestamp"]', element) ||
                 OmniCRM.qs('.message-timestamp', element) ||
                 OmniCRM.qs('.message-time', element) ||
                 OmniCRM.qs('span[class*="time"]', element);

    if (tsEl) {
      const raw = (tsEl.textContent || '').trim();
      if (raw) return MLParser._parseMLTimestamp(raw);
    }

    return new Date().toISOString();
  }

  /**
   * Parse MercadoLibre-specific timestamp strings.
   * Handles: "20/03/2026 14:30", "20 mar 2026 14:30", "Hoy 14:30",
   * "Ayer 10:00", "hace 2 horas", "2 horas atras"
   * @param {string} raw
   * @returns {string} ISO 8601 timestamp
   * @private
   */
  static _parseMLTimestamp(raw) {
    if (!raw) return new Date().toISOString();
    const text = raw.trim();
    const lower = text.toLowerCase();

    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text;

    const now = new Date();

    // Relative: "hace X minutos/horas" (Spanish)
    const relMinES = lower.match(/hace\s+(\d+)\s*min/);
    if (relMinES) return new Date(now - parseInt(relMinES[1]) * 60000).toISOString();

    const relHrES = lower.match(/hace\s+(\d+)\s*hora/);
    if (relHrES) return new Date(now - parseInt(relHrES[1]) * 3600000).toISOString();

    // Relative: "ha X minutos/horas" (Portuguese)
    const relMinPT = lower.match(/h[aá]\s+(\d+)\s*min/);
    if (relMinPT) return new Date(now - parseInt(relMinPT[1]) * 60000).toISOString();

    const relHrPT = lower.match(/h[aá]\s+(\d+)\s*hora/);
    if (relHrPT) return new Date(now - parseInt(relHrPT[1]) * 3600000).toISOString();

    // Relative: English
    const relMinEN = lower.match(/(\d+)\s*min(?:ute)?s?\s*ago/);
    if (relMinEN) return new Date(now - parseInt(relMinEN[1]) * 60000).toISOString();

    const relHrEN = lower.match(/(\d+)\s*hours?\s*ago/);
    if (relHrEN) return new Date(now - parseInt(relHrEN[1]) * 3600000).toISOString();

    // "Hoy" / "Today" / "Hoje"
    if (/^(hoy|today|hoje)\b/i.test(lower)) {
      const timeMatch = lower.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const d = new Date(now);
        d.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
        return d.toISOString();
      }
      return now.toISOString();
    }

    // "Ayer" / "Yesterday" / "Ontem"
    if (/^(ayer|yesterday|ontem)\b/i.test(lower)) {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const timeMatch = lower.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        d.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
      }
      return d.toISOString();
    }

    // dd/mm/yyyy HH:mm (LATAM standard)
    const fullMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2})/);
    if (fullMatch) {
      const day = parseInt(fullMatch[1], 10);
      const month = parseInt(fullMatch[2], 10) - 1;
      let year = parseInt(fullMatch[3], 10);
      if (year < 100) year += 2000;
      const hours = parseInt(fullMatch[4], 10);
      const mins = parseInt(fullMatch[5], 10);

      try {
        const result = new Date(year, month, day, hours, mins, 0, 0);
        if (!isNaN(result.getTime())) return result.toISOString();
      } catch (_) { /* fall through */ }
    }

    // dd/mm/yyyy only (no time)
    const dateOnly = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dateOnly) {
      const day = parseInt(dateOnly[1], 10);
      const month = parseInt(dateOnly[2], 10) - 1;
      let year = parseInt(dateOnly[3], 10);
      if (year < 100) year += 2000;

      try {
        const result = new Date(year, month, day);
        if (!isNaN(result.getTime())) return result.toISOString();
      } catch (_) { /* fall through */ }
    }

    // Time only: "14:30"
    const timeOnly = text.match(/^(\d{1,2}):(\d{2})$/);
    if (timeOnly) {
      const d = new Date(now);
      d.setHours(parseInt(timeOnly[1]), parseInt(timeOnly[2]), 0, 0);
      return d.toISOString();
    }

    // Fallback to base parser
    return OmniCRM.BaseParser.parseTimestamp(text);
  }

  /**
   * Detect message direction by background color, class, or alignment.
   * In ML messaging, seller messages align right / have distinct styling.
   * @param {Element} element
   * @returns {string} "incoming"|"outgoing"
   */
  static detectDirection(element) {
    if (!element) return 'incoming';

    // Check data-testid
    const testId = element.getAttribute('data-testid') || '';
    if (/seller/i.test(testId)) return 'outgoing';
    if (/buyer/i.test(testId)) return 'incoming';

    // Check classes
    const classes = element.className || '';
    if (/seller|vendedor|from-seller|outgoing/i.test(classes)) return 'outgoing';
    if (/buyer|comprador|from-buyer|incoming/i.test(classes)) return 'incoming';

    // Check parent chain for direction indicators
    const sellerParent = element.closest('[data-testid="message-seller"]') ||
                         element.closest('[class*="seller"]') ||
                         element.closest('[class*="from-seller"]');
    if (sellerParent) return 'outgoing';

    const buyerParent = element.closest('[data-testid="message-buyer"]') ||
                        element.closest('[class*="buyer"]') ||
                        element.closest('[class*="from-buyer"]');
    if (buyerParent) return 'incoming';

    // Fallback: check computed style for right-alignment (seller messages)
    try {
      const style = window.getComputedStyle(element);
      if (style.marginLeft === 'auto' || style.textAlign === 'right') return 'outgoing';
    } catch (_) { /* ignore in non-browser contexts */ }

    // Fallback: use base parser direction detection for mercadolibre
    return OmniCRM.BaseParser.detectDirection(element, 'mercadolibre');
  }

  /**
   * Detect content type for a MercadoLibre message element.
   * @param {Element} element
   * @returns {string} "text"|"image"|"link"|"system"
   */
  static detectContentType(element) {
    if (!element) return 'text';

    // System / auto message
    if (MLParser.isSystemMessage(element)) return 'system';

    // Attached image
    const img = OmniCRM.qs('[data-testid="message-image"]', element) ||
                OmniCRM.qs('.message-attachment img', element) ||
                OmniCRM.qs('img[class*="attachment"]', element);
    if (img) return 'image';

    // Link with preview
    const link = element.querySelector('a[href*="http"]');
    const hasText = (element.textContent || '').match(/https?:\/\//);
    if (link && hasText) return 'link';

    return OmniCRM.BaseParser.detectContentType(element);
  }

  /**
   * Check if a message is a system/automated message from MercadoLibre.
   * These include auto-replies, status updates, and platform notifications.
   * @param {Element} element
   * @returns {boolean}
   */
  static isSystemMessage(element) {
    if (!element) return false;

    // data-testid check
    const testId = element.getAttribute('data-testid') || '';
    if (/system|auto/i.test(testId)) return true;

    // Class check
    const classes = element.className || '';
    if (/system|auto-message|automated|notification/i.test(classes)) return true;

    // Parent check
    if (element.closest('[data-testid="system-message"]') ||
        element.closest('.system-message') ||
        element.closest('.auto-message')) {
      return true;
    }

    // Content heuristic: ML auto-messages contain specific phrases
    const text = (element.textContent || '').toLowerCase();
    const autoPatterns = [
      'mensaje autom\u00e1t',     // "mensaje automatico" (ES)
      'mensagem autom\u00e1t',    // "mensagem automatica" (PT)
      'automatic message',         // EN
      'respuesta autom\u00e1t',   // "respuesta automatica" (ES)
      'resposta autom\u00e1t',    // "resposta automatica" (PT)
      'mercado libre',             // Platform name in system messages
      'mercado envios',            // Shipping notifications
      'mercado env\u00edos',
      'se ha actualizado',         // Status updates
      'foi atualizado'             // Status updates (PT)
    ];

    for (const pattern of autoPatterns) {
      if (text.includes(pattern)) return true;
    }

    return false;
  }

  /**
   * Extract MercadoLibre order references from text content.
   * Order IDs follow the pattern: {CountryPrefix}-{digits}
   * @param {string} text
   * @returns {string[]} Array of order ID strings (e.g., ["MLA-123456789"])
   */
  static extractOrderReferences(text) {
    if (!text) return [];

    const matches = text.match(MLParser.ORDER_ID_PATTERN);
    if (!matches) return [];

    // Normalize: ensure dash separator and uppercase
    return [...new Set(matches.map(id => {
      const upper = id.toUpperCase();
      // Insert dash if missing: "MLA123456" -> "MLA-123456"
      if (!/^[A-Z]{2,3}-/.test(upper)) {
        return upper.replace(/^([A-Z]{2,3})(\d)/, '$1-$2');
      }
      return upper;
    }))];
  }

  /**
   * Detect if a message has an attached image.
   * @param {Element} element
   * @returns {{ hasImage: boolean, src: string|null }}
   */
  static detectAttachedImage(element) {
    if (!element) return { hasImage: false, src: null };

    const img = OmniCRM.qs('[data-testid="message-image"]', element) ||
                OmniCRM.qs('.message-attachment img', element) ||
                OmniCRM.qs('img[class*="attachment"]', element) ||
                OmniCRM.qs('.message-image img', element);

    if (img) {
      const src = img.getAttribute('src') || null;
      return { hasImage: true, src };
    }

    return { hasImage: false, src: null };
  }
}

OmniCRM.MLParser = MLParser;
