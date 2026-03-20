/**
 * OmniCRM Sync — WhatsApp Contact Extractor
 * Extracts contact, group, and profile information from WhatsApp Web DOM.
 * Depends on: utils.js, wa-selectors.js
 */

class WAContactExtractor {
  constructor(selectors) {
    this.selectors = selectors || new OmniCRM.WASelectors();
    this.log = new OmniCRM.OmniLog('whatsapp:contact');
    this._cache = {
      name: null,
      phone: null,
      isGroup: null,
      expiry: 0
    };
    this._cacheTtlMs = 3000;
  }

  /**
   * Extract contact name and phone number from the chat header.
   * @returns {{ name: string, phone: string }}
   */
  extractFromHeader() {
    // Return cached result if still valid
    const now = Date.now();
    if (this._cache.name && now < this._cache.expiry) {
      return { name: this._cache.name, phone: this._cache.phone };
    }

    let name = '';
    let phone = '';

    try {
      // Get contact name from header span[title]
      const nameEl = this.selectors.get('contactName');
      if (nameEl) {
        name = (nameEl.getAttribute('title') || nameEl.textContent || '').trim();
      }

      // Attempt to extract phone number from profile image URL
      phone = this._extractPhoneFromProfile();

      // If name looks like a phone number, use it as the phone
      if (!phone && name && /^\+?\d[\d\s\-()]{6,}$/.test(name.replace(/\s/g, ''))) {
        phone = name.replace(/[\s\-()]/g, '');
      }

      // Update cache
      this._cache.name = name;
      this._cache.phone = phone;
      this._cache.expiry = now + this._cacheTtlMs;
    } catch (err) {
      this.log.error('Failed to extract contact from header:', err);
    }

    return { name, phone };
  }

  /**
   * Extract phone number from the profile picture URL.
   * WhatsApp encodes the user ID in the image URL as /u=<digits>/
   * @returns {string} Phone number or empty string
   * @private
   */
  _extractPhoneFromProfile() {
    try {
      const header = this.selectors.get('chatHeader');
      if (!header) return '';

      const img = OmniCRM.qs('img[src]', header);
      if (!img) return '';

      const src = img.getAttribute('src') || '';
      const match = src.match(/u=(\d+)/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (_) {
      // Silently ignore — phone extraction is best-effort
    }
    return '';
  }

  /**
   * Extract group chat information.
   * @returns {{ isGroup: boolean, groupName: string, participants: string[] }}
   */
  extractGroupInfo() {
    const result = {
      isGroup: false,
      groupName: '',
      participants: []
    };

    try {
      const header = this.selectors.get('chatHeader');
      if (!header) return result;

      // Group chats show participant list below the group name
      // Usually in a subtitle span or a separate element
      const subtitleEl = OmniCRM.qs('[data-testid="conversation-subtitle"]', header) ||
                         OmniCRM.qs('header span[title] + span', header) ||
                         OmniCRM.qs('header span:nth-child(2)', header);

      if (subtitleEl) {
        const subtitleText = (subtitleEl.textContent || '').trim();

        // Group subtitles contain participant names separated by commas
        // e.g. "You, John, Maria, +1 234 567 8901"
        const hasMultipleNames = subtitleText.includes(',') &&
                                 !subtitleText.match(/^(online|typing|last seen|en l[ií]nea|escribiendo|visto)/i);

        if (hasMultipleNames) {
          result.isGroup = true;
          const { name } = this.extractFromHeader();
          result.groupName = name;
          result.participants = subtitleText
            .split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0);
        }
      }

      // Alternative: check for group-specific icons
      if (!result.isGroup) {
        const groupIcon = OmniCRM.qs('[data-icon="group"]', header) ||
                          OmniCRM.qs('[data-icon="community"]', header) ||
                          OmniCRM.qs('[data-testid="group"]', header);
        if (groupIcon) {
          result.isGroup = true;
          const { name } = this.extractFromHeader();
          result.groupName = name;
        }
      }

      // Cache the group status
      this._cache.isGroup = result.isGroup;
    } catch (err) {
      this.log.error('Failed to extract group info:', err);
    }

    return result;
  }

  /**
   * Check if the current chat is with a WhatsApp Business account.
   * Business accounts have a verified badge or business-specific icons.
   * @returns {boolean}
   */
  isBusinessAccount() {
    try {
      const header = this.selectors.get('chatHeader');
      if (!header) return false;

      // Check for business/verified badges
      const businessIcon = OmniCRM.qs('[data-icon="business"]', header) ||
                           OmniCRM.qs('[data-icon="verified-business"]', header) ||
                           OmniCRM.qs('[data-icon="psa-verified"]', header) ||
                           OmniCRM.qs('[data-testid="business-badge"]', header) ||
                           OmniCRM.qs('[data-icon="verified"]', header);

      if (businessIcon) return true;

      // Fallback: check for business label text
      const labels = OmniCRM.qsa('span', header);
      for (const label of labels) {
        const text = (label.textContent || '').toLowerCase().trim();
        if (text === 'business account' || text === 'cuenta de empresa' ||
            text === 'conta comercial') {
          return true;
        }
      }

      return false;
    } catch (err) {
      this.log.warn('Failed to check business account:', err);
      return false;
    }
  }

  /**
   * Extract the profile picture URL for the current contact.
   * @returns {string|null} URL of the profile picture or null
   */
  getProfilePicUrl() {
    try {
      const header = this.selectors.get('chatHeader');
      if (!header) return null;

      // Profile pic is usually the first img in the header
      const img = OmniCRM.qs('img[src*="pps.whatsapp.net"]', header) ||
                  OmniCRM.qs('img[src*="web.whatsapp.com"]', header) ||
                  OmniCRM.qs('img[draggable="false"]', header) ||
                  OmniCRM.qs('img[src]', header);

      if (img) {
        const src = img.getAttribute('src') || '';
        // Filter out placeholder/default avatars
        if (src && !src.includes('data:image') && !src.includes('dyn/')) {
          return src;
        }
      }

      return null;
    } catch (err) {
      this.log.warn('Failed to get profile pic URL:', err);
      return null;
    }
  }

  /**
   * Invalidate cached contact data (e.g., on chat switch).
   */
  clearCache() {
    this._cache.name = null;
    this._cache.phone = null;
    this._cache.isGroup = null;
    this._cache.expiry = 0;
  }
}

OmniCRM.WAContactExtractor = WAContactExtractor;
