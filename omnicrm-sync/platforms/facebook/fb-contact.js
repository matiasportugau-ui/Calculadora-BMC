/**
 * OmniCRM Sync — Facebook Messenger Contact Extractor
 * Extracts contact, marketplace, and status information from Facebook Messenger DOM.
 * Covers facebook.com/messages, /marketplace/messages/, and messenger.com.
 * Depends on: utils.js, fb-selectors.js
 */

class FBContactExtractor {
  constructor(selectors) {
    this.selectors = selectors || new OmniCRM.FBSelectors();
    this.log = new OmniCRM.OmniLog('facebook:contact');
    this._cache = {
      name: null,
      isMarketplace: null,
      onlineStatus: null,
      expiry: 0
    };
    this._cacheTtlMs = 3000;
  }

  /**
   * Extract contact name from the conversation header.
   * FB Messenger stores the contact name in header aria-label or h2 elements.
   * @returns {{ name: string }}
   */
  extractFromHeader() {
    const now = Date.now();
    if (this._cache.name && now < this._cache.expiry) {
      return { name: this._cache.name };
    }

    let name = '';

    try {
      // Method 1: h2 element in [role="main"]
      const h2El = this.selectors.get('contactName');
      if (h2El) {
        name = (h2El.textContent || '').trim();
      }

      // Method 2: header aria-label attribute
      if (!name) {
        const headerEl = this.selectors.get('chatHeader');
        if (headerEl) {
          const ariaLabel = headerEl.getAttribute('aria-label') || '';
          // aria-label is often "Conversation with <Name>"
          const match = ariaLabel.match(/(?:conversation with|chat with)\s+(.+)/i);
          if (match) {
            name = match[1].trim();
          } else if (ariaLabel && !ariaLabel.toLowerCase().includes('message')) {
            name = ariaLabel.trim();
          }
        }
      }

      // Method 3: first [dir="auto"] span in the header area
      if (!name) {
        const mainEl = document.querySelector('[role="main"]');
        if (mainEl) {
          const headerSpan = OmniCRM.qs('header [dir="auto"]', mainEl) ||
                             OmniCRM.qs('a[role="link"] span', mainEl);
          if (headerSpan) {
            name = (headerSpan.textContent || '').trim();
          }
        }
      }

      // Update cache
      this._cache.name = name;
      this._cache.expiry = now + this._cacheTtlMs;
    } catch (err) {
      this.log.error('Failed to extract contact from header:', err);
    }

    return { name };
  }

  /**
   * Detect whether the current conversation is a Marketplace thread.
   * Marketplace conversations contain product references, listing links,
   * or originate from /marketplace/messages/ URLs.
   * @returns {{ isMarketplace: boolean, productName: string }}
   */
  detectMarketplace() {
    const now = Date.now();
    if (this._cache.isMarketplace !== null && now < this._cache.expiry) {
      return {
        isMarketplace: this._cache.isMarketplace,
        productName: this._cache.productName || ''
      };
    }

    const result = { isMarketplace: false, productName: '' };

    try {
      // Check URL path for marketplace indicator
      const url = window.location.href;
      if (url.includes('/marketplace/') || url.includes('marketplace_product_id')) {
        result.isMarketplace = true;
      }

      // Check thread content for product listing references
      const mainEl = document.querySelector('[role="main"]');
      if (mainEl) {
        // Marketplace threads often show a product card at the top
        const productCard = OmniCRM.qs('[aria-label*="listing" i]', mainEl) ||
                            OmniCRM.qs('[aria-label*="product" i]', mainEl) ||
                            OmniCRM.qs('a[href*="/marketplace/item/"]', mainEl) ||
                            OmniCRM.qs('a[href*="marketplace_product_id"]', mainEl);

        if (productCard) {
          result.isMarketplace = true;
          // Try to extract product name from the card
          const nameEl = OmniCRM.qs('[dir="auto"]', productCard) ||
                         OmniCRM.qs('span', productCard);
          if (nameEl) {
            result.productName = (nameEl.textContent || '').trim();
          }
          if (!result.productName) {
            result.productName = productCard.getAttribute('aria-label') || '';
          }
        }

        // Fallback: look for price patterns in the header area
        if (!result.isMarketplace) {
          const headerTexts = OmniCRM.qsa('[dir="auto"]', mainEl);
          for (const el of headerTexts) {
            const text = (el.textContent || '').trim();
            // Price patterns like "$25", "US$100", "R$50"
            if (/^[A-Z]{0,3}\$\s?\d+/.test(text) || /^\d+[\.,]\d{2}\s?[A-Z]{3}$/.test(text)) {
              result.isMarketplace = true;
              result.productName = text;
              break;
            }
          }
        }
      }

      // Update cache
      this._cache.isMarketplace = result.isMarketplace;
      this._cache.productName = result.productName;
    } catch (err) {
      this.log.error('Failed to detect marketplace conversation:', err);
    }

    return result;
  }

  /**
   * Extract online/last active status from the conversation header.
   * FB Messenger shows "Active now", "Active Xm ago", or nothing.
   * @returns {{ online: boolean, lastActive: string|null }}
   */
  getOnlineStatus() {
    const result = { online: false, lastActive: null };

    try {
      const mainEl = document.querySelector('[role="main"]');
      if (!mainEl) return result;

      // Status text is typically below the contact name in the header
      const statusPatterns = [
        '[aria-label*="Active" i]',
        '[aria-label*="active" i]'
      ];

      let statusEl = null;
      for (const selector of statusPatterns) {
        statusEl = OmniCRM.qs(selector, mainEl);
        if (statusEl) break;
      }

      // Also check subtitle/secondary text in header
      if (!statusEl) {
        const headerSpans = OmniCRM.qsa('[dir="auto"]', mainEl);
        for (const span of headerSpans) {
          const text = (span.textContent || '').trim().toLowerCase();
          if (text.startsWith('active')) {
            statusEl = span;
            break;
          }
        }
      }

      if (statusEl) {
        const statusText = (statusEl.textContent || statusEl.getAttribute('aria-label') || '').trim();

        if (/active now/i.test(statusText)) {
          result.online = true;
          result.lastActive = new Date().toISOString();
        } else {
          // Parse "Active Xm ago", "Active 2h ago", "Active yesterday"
          const timeMatch = statusText.match(/active\s+(\d+)\s*(m|h|d|min|hour|day)/i);
          if (timeMatch) {
            const value = parseInt(timeMatch[1], 10);
            const unit = timeMatch[2].toLowerCase();
            const msMap = { m: 60000, min: 60000, h: 3600000, hour: 3600000, d: 86400000, day: 86400000 };
            const ms = msMap[unit] || 60000;
            result.lastActive = new Date(Date.now() - value * ms).toISOString();
          }
        }
      }

      // Check for green dot indicator (online presence)
      const onlineDot = OmniCRM.qs('[data-visualcompletion="css-img"][style*="green"]', mainEl) ||
                        OmniCRM.qs('[aria-label*="online" i]', mainEl);
      if (onlineDot) {
        result.online = true;
        if (!result.lastActive) {
          result.lastActive = new Date().toISOString();
        }
      }
    } catch (err) {
      this.log.warn('Failed to get online status:', err);
    }

    return result;
  }

  /**
   * Extract the profile picture URL for the current contact.
   * @returns {string|null} URL of the profile picture or null
   */
  getProfilePicUrl() {
    try {
      const mainEl = document.querySelector('[role="main"]');
      if (!mainEl) return null;

      // Profile pic is typically in the header as an <img> or background image
      const headerArea = OmniCRM.qs('header', mainEl) ||
                         OmniCRM.qs('[role="banner"]', mainEl) ||
                         mainEl;

      const img = OmniCRM.qs('img[src*="scontent"]', headerArea) ||
                  OmniCRM.qs('img[src*="fbcdn"]', headerArea) ||
                  OmniCRM.qs('img[alt][src]:not([alt=""])', headerArea);

      if (img) {
        const src = img.getAttribute('src') || '';
        if (src && !src.includes('data:image') && !src.includes('emoji')) {
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
    this._cache.isMarketplace = null;
    this._cache.productName = null;
    this._cache.onlineStatus = null;
    this._cache.expiry = 0;
  }
}

OmniCRM.FBContactExtractor = FBContactExtractor;
