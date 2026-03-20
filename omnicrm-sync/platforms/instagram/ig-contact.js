/**
 * OmniCRM Sync — Instagram DM Contact Extractor
 * Extracts username, account type, verification, and activity status
 * from Instagram Direct thread headers.
 * Depends on: utils.js, ig-selectors.js
 */

class IGContactExtractor {
  constructor(selectors) {
    this.selectors = selectors || new OmniCRM.IGSelectors();
    this.log = new OmniCRM.OmniLog('instagram:contact');
    this._cache = {
      username: null,
      displayName: null,
      isVerified: null,
      accountType: null,
      activityStatus: null,
      expiry: 0
    };
    this._cacheTtlMs = 3000;
  }

  /**
   * Extract username and display name from the DM thread header.
   * @returns {{ username: string, displayName: string }}
   */
  extractFromHeader() {
    const now = Date.now();
    if (this._cache.username && now < this._cache.expiry) {
      return {
        username: this._cache.username,
        displayName: this._cache.displayName
      };
    }

    let username = '';
    let displayName = '';

    try {
      // Primary: link element in banner with href containing the username
      const nameEl = this.selectors.get('contactName');
      if (nameEl) {
        // Extract username from href (e.g., "/username/" or "/username")
        const href = nameEl.getAttribute('href') || '';
        const hrefMatch = href.match(/^\/([^/?]+)\/?$/);
        if (hrefMatch) {
          username = hrefMatch[1];
        }

        // Display name is the visible text
        displayName = (nameEl.textContent || '').trim();

        // If no username from href, use the text as username
        if (!username && displayName) {
          username = displayName;
        }
      }

      // Fallback: try header span elements
      if (!username) {
        const header = this.selectors.get('chatHeader');
        if (header) {
          const headerLink = OmniCRM.qs('a[href*="/"]', header);
          if (headerLink) {
            const href = headerLink.getAttribute('href') || '';
            const match = href.match(/^\/([^/?]+)\/?$/);
            if (match) username = match[1];
            displayName = (headerLink.textContent || '').trim() || displayName;
          }

          // Try heading elements
          if (!username) {
            const heading = OmniCRM.qs('h2', header) ||
                            OmniCRM.qs('span[style*="font-weight"]', header) ||
                            OmniCRM.qs('div[style*="font-weight: 600"]', header);
            if (heading) {
              displayName = (heading.textContent || '').trim();
              username = displayName;
            }
          }
        }
      }

      // Update cache
      this._cache.username = username;
      this._cache.displayName = displayName;
      this._cache.expiry = now + this._cacheTtlMs;
    } catch (err) {
      this.log.error('Failed to extract contact from header:', err);
    }

    return { username, displayName };
  }

  /**
   * Detect if the contact has a verified badge (blue checkmark).
   * @returns {boolean}
   */
  isVerified() {
    if (this._cache.isVerified !== null && Date.now() < this._cache.expiry) {
      return this._cache.isVerified;
    }

    let verified = false;

    try {
      const header = this.selectors.get('chatHeader');
      if (!header) return false;

      // Verified badge is typically an svg or span with specific aria-label
      const verifiedBadge = OmniCRM.qs('[aria-label="Verified"]', header) ||
                            OmniCRM.qs('[aria-label="Verified" i]', header) ||
                            OmniCRM.qs('[title="Verified"]', header) ||
                            OmniCRM.qs('span[data-testid="verified-badge"]', header);

      if (verifiedBadge) {
        verified = true;
      } else {
        // Fallback: look for the blue checkmark SVG (circle with check)
        const svgs = OmniCRM.qsa('svg', header);
        for (const svg of svgs) {
          const label = svg.getAttribute('aria-label') || '';
          if (label.toLowerCase().includes('verified') ||
              label.toLowerCase().includes('verificad')) {
            verified = true;
            break;
          }
        }
      }

      this._cache.isVerified = verified;
    } catch (err) {
      this.log.warn('Failed to detect verified badge:', err);
    }

    return verified;
  }

  /**
   * Detect the account type: personal, business, or creator.
   * Business and creator accounts show category labels and action buttons
   * (e.g., "Shop", "Contact") in their profiles.
   * @returns {string} "personal"|"business"|"creator"
   */
  getAccountType() {
    if (this._cache.accountType && Date.now() < this._cache.expiry) {
      return this._cache.accountType;
    }

    let accountType = 'personal';

    try {
      const header = this.selectors.get('chatHeader');
      if (!header) return accountType;

      // Business/creator accounts show a category label beneath the name
      // e.g., "Clothing Brand", "Digital Creator", "Musician/Band"
      const spans = OmniCRM.qsa('span', header);
      for (const span of spans) {
        const text = (span.textContent || '').trim().toLowerCase();

        // Known business/creator category keywords
        if (text.includes('shop') || text.includes('tienda') ||
            text.includes('business') || text.includes('empresa') ||
            text.includes('brand') || text.includes('marca') ||
            text.includes('store') || text.includes('company')) {
          accountType = 'business';
          break;
        }

        if (text.includes('creator') || text.includes('creador') ||
            text.includes('artist') || text.includes('artista') ||
            text.includes('musician') || text.includes('blogger') ||
            text.includes('public figure') || text.includes('influencer') ||
            text.includes('digital creator')) {
          accountType = 'creator';
          break;
        }
      }

      // Fallback: check for shopping bag icon or contact action buttons
      const shopIcon = OmniCRM.qs('[aria-label*="Shop" i]', header) ||
                       OmniCRM.qs('[aria-label*="View shop" i]', header);
      if (shopIcon) {
        accountType = 'business';
      }

      this._cache.accountType = accountType;
    } catch (err) {
      this.log.warn('Failed to detect account type:', err);
    }

    return accountType;
  }

  /**
   * Extract the activity status of the contact.
   * Instagram shows "Active now", "Active Xh ago", "Active Xm ago", etc.
   * @returns {{ isActive: boolean, statusText: string, lastActiveAt: string|null }}
   */
  getActivityStatus() {
    if (this._cache.activityStatus && Date.now() < this._cache.expiry) {
      return this._cache.activityStatus;
    }

    const result = {
      isActive: false,
      statusText: '',
      lastActiveAt: null
    };

    try {
      const statusEl = this.selectors.get('activeStatus');
      if (!statusEl) return result;

      const text = (statusEl.textContent || '').trim();
      if (!text) return result;

      result.statusText = text;

      if (/active\s+now/i.test(text) || /en\s+l[ií]nea/i.test(text)) {
        result.isActive = true;
        result.lastActiveAt = new Date().toISOString();
      } else {
        // Parse "Active Xh ago", "Active Xm ago", etc.
        const match = text.match(/active\s+(\d+)\s*(m|h|d|w)\s+ago/i);
        if (match) {
          const value = parseInt(match[1], 10);
          const unit = match[2].toLowerCase();
          const multipliers = {
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
            w: 7 * 24 * 60 * 60 * 1000
          };
          const offset = value * (multipliers[unit] || 0);
          result.lastActiveAt = new Date(Date.now() - offset).toISOString();
        }
      }

      // Also check for the green dot indicator (active now)
      if (!result.isActive) {
        const header = this.selectors.get('chatHeader');
        if (header) {
          const greenDot = OmniCRM.qs('div[style*="background-color: rgb(38, 183, 5)"]', header) ||
                           OmniCRM.qs('div[style*="background: rgb(38, 183, 5)"]', header) ||
                           OmniCRM.qs('[aria-label*="Active" i]', header);
          if (greenDot) {
            result.isActive = true;
            result.lastActiveAt = result.lastActiveAt || new Date().toISOString();
          }
        }
      }

      this._cache.activityStatus = result;
    } catch (err) {
      this.log.warn('Failed to extract activity status:', err);
    }

    return result;
  }

  /**
   * Extract the profile picture URL for the current contact.
   * @returns {string|null} URL or null
   */
  getProfilePicUrl() {
    try {
      const header = this.selectors.get('chatHeader');
      if (!header) return null;

      const img = OmniCRM.qs('img[src*="instagram"]', header) ||
                  OmniCRM.qs('img[draggable="false"]', header) ||
                  OmniCRM.qs('img[alt]', header);

      if (img) {
        const src = img.getAttribute('src') || '';
        // Filter out placeholder/default images
        if (src && !src.includes('data:image') && !src.includes('s.cdninstagram.com/static')) {
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
   * Check if the current thread is a group conversation.
   * Instagram group DMs show multiple participant names in the header.
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

      // Group chats show multiple avatars or a group name
      // Check for multiple profile images in the header
      const avatars = OmniCRM.qsa('img[alt]', header);
      const uniqueAvatars = new Set(
        avatars
          .map(img => img.getAttribute('src'))
          .filter(src => src && !src.includes('data:image'))
      );

      if (uniqueAvatars.size > 1) {
        result.isGroup = true;
      }

      // Group DM headers often show "X members" or participant names
      const spans = OmniCRM.qsa('span', header);
      for (const span of spans) {
        const text = (span.textContent || '').trim();
        if (/\d+\s*members?/i.test(text) || /\d+\s*miembros?/i.test(text)) {
          result.isGroup = true;
        }
        // Comma-separated participant names
        if (text.includes(',') && !text.match(/^(active|en\s+l[ií]nea)/i)) {
          result.isGroup = true;
          result.participants = text.split(',').map(p => p.trim()).filter(p => p);
        }
      }

      if (result.isGroup) {
        const { displayName } = this.extractFromHeader();
        result.groupName = displayName;
      }
    } catch (err) {
      this.log.error('Failed to extract group info:', err);
    }

    return result;
  }

  /**
   * Invalidate cached contact data (e.g., on conversation switch).
   */
  clearCache() {
    this._cache.username = null;
    this._cache.displayName = null;
    this._cache.isVerified = null;
    this._cache.accountType = null;
    this._cache.activityStatus = null;
    this._cache.expiry = 0;
  }
}

OmniCRM.IGContactExtractor = IGContactExtractor;
