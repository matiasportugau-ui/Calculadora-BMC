/**
 * OmniCRM Sync — MercadoLibre Contact Extractor
 * Extracts buyer, order, and product information from MercadoLibre messaging DOM.
 * Optionally enriches data via MLApiClient.
 * Depends on: utils.js, ml-selectors.js, ml-parser.js
 */

class MLContactExtractor {
  /**
   * @param {MLSelectors} selectors - MLSelectors instance
   * @param {MLApiClient} [apiClient] - Optional MLApiClient for API enrichment
   */
  constructor(selectors, apiClient) {
    this.selectors = selectors || new OmniCRM.MLSelectors();
    this.apiClient = apiClient || null;
    this.log = new OmniCRM.OmniLog('mercadolibre:contact');

    // Cache with TTL
    this._cache = new Map();
    this._cacheTtlMs = 5000;
  }

  // ── DOM-Based Extraction ──────────────────────────────────────

  /**
   * Extract buyer nickname from the conversation header.
   * @returns {{ nickname: string, displayName: string }}
   */
  extractBuyerFromHeader() {
    const cacheKey = 'buyer_header';
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    let nickname = '';
    let displayName = '';

    try {
      // Primary: [data-testid="buyer-name"]
      const nameEl = this.selectors.get('buyerName');
      if (nameEl) {
        displayName = (nameEl.textContent || '').trim();
        nickname = displayName;
      }

      // Fallback: conversation header contains buyer info
      if (!displayName) {
        const header = this.selectors.get('conversationHeader');
        if (header) {
          // Try h2, h3, or prominent span inside the header
          const headingEl = OmniCRM.qs('h2', header) ||
                            OmniCRM.qs('h3', header) ||
                            OmniCRM.qs('span[class*="name"]', header) ||
                            OmniCRM.qs('span[class*="nickname"]', header);
          if (headingEl) {
            displayName = (headingEl.textContent || '').trim();
            nickname = displayName;
          }
        }
      }

      // Try to extract nickname from profile link if available
      if (!nickname) {
        const profileLink = OmniCRM.qs('a[href*="/perfil/"]', document) ||
                            OmniCRM.qs('a[href*="/profile/"]', document);
        if (profileLink) {
          const href = profileLink.getAttribute('href') || '';
          const match = href.match(/\/(?:perfil|profile)\/([^\/\?]+)/);
          if (match) {
            nickname = decodeURIComponent(match[1]);
            if (!displayName) displayName = nickname;
          }
        }
      }

      const result = { nickname, displayName };
      this._setCache(cacheKey, result);
      return result;
    } catch (err) {
      this.log.error('Failed to extract buyer from header:', err);
      return { nickname: '', displayName: '' };
    }
  }

  /**
   * Extract order information visible in the DOM.
   * @returns {{ orderId: string, productTitle: string, price: string, orderUrl: string }}
   */
  extractOrderInfo() {
    const cacheKey = 'order_info';
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    const result = {
      orderId: '',
      productTitle: '',
      price: '',
      orderUrl: ''
    };

    try {
      // Order ID from the order reference element
      const orderEl = this.selectors.get('orderReference');
      if (orderEl) {
        const text = (orderEl.textContent || '').trim();
        const refs = OmniCRM.MLParser.extractOrderReferences(text);
        if (refs.length > 0) {
          result.orderId = refs[0];
        }

        // Check for order link
        const orderLink = orderEl.closest('a') || OmniCRM.qs('a', orderEl);
        if (orderLink) {
          result.orderUrl = orderLink.getAttribute('href') || '';
        }
      }

      // Fallback: search entire visible area for order IDs
      if (!result.orderId) {
        const header = this.selectors.get('conversationHeader');
        if (header) {
          const headerText = header.textContent || '';
          const refs = OmniCRM.MLParser.extractOrderReferences(headerText);
          if (refs.length > 0) {
            result.orderId = refs[0];
          }

          // Check for order links in header
          const orderLinks = OmniCRM.qsa('a[href*="/orders/"]', header);
          for (const link of orderLinks) {
            const href = link.getAttribute('href') || '';
            if (href) {
              result.orderUrl = href;
              // Extract numeric order ID from URL
              const idMatch = href.match(/\/orders\/(\d+)/);
              if (idMatch && !result.orderId) {
                result.orderId = idMatch[1];
              }
              break;
            }
          }
        }
      }

      // Product title
      const titleEl = this.selectors.get('productTitle');
      if (titleEl) {
        result.productTitle = (titleEl.textContent || '').trim();
      }

      // Price: look for currency patterns in the conversation context
      if (!result.price) {
        const header = this.selectors.get('conversationHeader');
        if (header) {
          const priceEl = OmniCRM.qs('[class*="price"]', header) ||
                          OmniCRM.qs('[class*="Price"]', header) ||
                          OmniCRM.qs('span[class*="amount"]', header);
          if (priceEl) {
            result.price = (priceEl.textContent || '').trim();
          }
        }
      }

      this._setCache(cacheKey, result);
      return result;
    } catch (err) {
      this.log.error('Failed to extract order info:', err);
      return result;
    }
  }

  /**
   * Extract pack ID from the current URL or DOM.
   * Pack ID groups messages for a sale.
   * @returns {string} Pack ID or empty string
   */
  extractPackId() {
    try {
      // From URL: /mensajes/{packId} or /messages/{packId}
      const urlMatch = window.location.pathname.match(
        /\/(?:mensajes|messages)\/(\d+)/
      );
      if (urlMatch) return urlMatch[1];

      // From URL query params
      const params = new URLSearchParams(window.location.search);
      const packParam = params.get('pack_id') || params.get('packId');
      if (packParam) return packParam;

      // From DOM: data attribute on the conversation
      const header = this.selectors.get('conversationHeader');
      if (header) {
        const packAttr = header.getAttribute('data-pack-id') ||
                         header.getAttribute('data-pack');
        if (packAttr) return packAttr;
      }

      return '';
    } catch (err) {
      this.log.warn('Failed to extract pack ID:', err);
      return '';
    }
  }

  // ── API-Enriched Extraction ───────────────────────────────────

  /**
   * Fetch full buyer profile via the ML API.
   * Only works when apiClient is configured and authenticated.
   * @param {string} userId - ML user ID
   * @returns {Object|null} { id, nickname, firstName, lastName, email, city, state }
   */
  async fetchBuyerProfile(userId) {
    if (!this.apiClient || !userId) return null;

    const cacheKey = `buyer_profile:${userId}`;
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const userData = await this.apiClient.getBuyer(userId);
      if (!userData) return null;

      const profile = {
        id: userData.id || userId,
        nickname: userData.nickname || '',
        firstName: userData.first_name || '',
        lastName: userData.last_name || '',
        email: userData.email || '',
        city: userData.address?.city || '',
        state: userData.address?.state || '',
        registrationDate: userData.registration_date || '',
        sellerReputation: userData.seller_reputation?.level_id || null,
        permalink: userData.permalink || ''
      };

      this._setCache(cacheKey, profile, 120000); // 2 min TTL
      return profile;
    } catch (err) {
      this.log.error('Failed to fetch buyer profile:', err);
      return null;
    }
  }

  /**
   * Fetch order details via the ML API.
   * @param {string} orderId - Numeric order ID
   * @returns {Object|null} Enriched order data
   */
  async fetchOrderDetails(orderId) {
    if (!this.apiClient || !orderId) return null;

    try {
      const orderData = await this.apiClient.getOrder(orderId);
      if (!orderData) return null;

      return {
        id: orderData.id,
        status: orderData.status || '',
        statusDetail: orderData.status_detail || '',
        totalAmount: orderData.total_amount || 0,
        currencyId: orderData.currency_id || '',
        buyerId: orderData.buyer?.id || '',
        buyerNickname: orderData.buyer?.nickname || '',
        items: (orderData.order_items || []).map(item => ({
          title: item.item?.title || '',
          quantity: item.quantity || 1,
          unitPrice: item.unit_price || 0,
          itemId: item.item?.id || ''
        })),
        dateCreated: orderData.date_created || '',
        shippingId: orderData.shipping?.id || null
      };
    } catch (err) {
      this.log.error('Failed to fetch order details:', err);
      return null;
    }
  }

  /**
   * Get a combined contact and order context object.
   * Merges DOM-extracted data with optional API-enriched data.
   * @returns {Object}
   */
  getContactContext() {
    const buyer = this.extractBuyerFromHeader();
    const order = this.extractOrderInfo();
    const packId = this.extractPackId();

    return {
      buyer: {
        nickname: buyer.nickname,
        displayName: buyer.displayName
      },
      order: {
        orderId: order.orderId,
        productTitle: order.productTitle,
        price: order.price,
        orderUrl: order.orderUrl
      },
      packId
    };
  }

  // ── Cache Management ──────────────────────────────────────────

  /**
   * Get a value from cache if still valid.
   * @param {string} key
   * @returns {*|null}
   * @private
   */
  _getFromCache(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this._cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /**
   * Set a value in the cache.
   * @param {string} key
   * @param {*} data
   * @param {number} [ttlMs]
   * @private
   */
  _setCache(key, data, ttlMs) {
    this._cache.set(key, {
      data,
      expiry: Date.now() + (ttlMs || this._cacheTtlMs)
    });
  }

  /**
   * Invalidate cached contact/order data (e.g., on conversation switch).
   */
  clearCache() {
    this._cache.clear();
  }
}

OmniCRM.MLContactExtractor = MLContactExtractor;
