/**
 * OmniCRM Sync — MercadoLibre API Client
 * Optional REST API integration for enriched data from MercadoLibre.
 * Uses Authorization header (never query params) for token transmission.
 * Depends on: utils.js
 */

class MLApiClient {
  /**
   * @param {Object} config
   * @param {string} config.appId - ML application ID
   * @param {string} config.clientSecret - ML client secret (encrypted at rest)
   * @param {string} config.redirectUri - OAuth redirect URI
   * @param {string} [config.baseUrl] - API base URL (default: https://api.mercadolibre.com)
   */
  constructor(config = {}) {
    this.appId = config.appId || '';
    this.clientSecret = config.clientSecret || '';
    this.redirectUri = config.redirectUri || '';
    this.baseUrl = config.baseUrl || 'https://api.mercadolibre.com';
    this.log = new OmniCRM.OmniLog('mercadolibre:api');

    // Token state
    this._accessToken = null;
    this._refreshToken = null;
    this._tokenExpiry = 0;

    // Rate limit tracking (ML allows 500 GET requests per minute)
    this._rateLimit = {
      maxRpm: 500,
      requests: [],
      windowMs: 60000
    };

    // Request cache to reduce API calls
    this._cache = new Map();
    this._cacheTtlMs = 30000; // 30 seconds default
  }

  // ── Token Management ──────────────────────────────────────────

  /**
   * Set tokens from storage or OAuth flow.
   * @param {string} accessToken
   * @param {string} refreshToken
   * @param {number} expiresIn - Seconds until expiry
   */
  setTokens(accessToken, refreshToken, expiresIn = 21600) {
    this._accessToken = accessToken;
    this._refreshToken = refreshToken;
    this._tokenExpiry = Date.now() + (expiresIn * 1000);
    this.log.info('Tokens set, expires in', expiresIn, 'seconds');
  }

  /**
   * Check if the current access token is valid.
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!(this._accessToken && Date.now() < this._tokenExpiry);
  }

  /**
   * Refresh the access token using the refresh token.
   * POST /oauth/token with grant_type=refresh_token
   * @returns {boolean} True if refresh succeeded
   */
  async refreshAccessToken() {
    if (!this._refreshToken) {
      this.log.warn('No refresh token available');
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.appId,
          client_secret: this.clientSecret,
          refresh_token: this._refreshToken
        })
      });

      if (!response.ok) {
        this.log.error('Token refresh failed:', response.status);
        return false;
      }

      const data = await response.json();
      this.setTokens(data.access_token, data.refresh_token, data.expires_in);

      // Persist tokens (placeholder for encrypted storage via Web Crypto)
      await this._persistTokens(data);

      this.log.info('Access token refreshed successfully');
      return true;
    } catch (err) {
      this.log.error('Token refresh error:', err);
      return null;
    }
  }

  /**
   * Ensure a valid access token is available, refreshing if needed.
   * @returns {boolean}
   * @private
   */
  async _ensureAuth() {
    if (this.isAuthenticated()) return true;

    // Try refresh
    const refreshed = await this.refreshAccessToken();
    if (!refreshed) {
      this.log.warn('Authentication unavailable — API calls will be skipped');
      return false;
    }
    return true;
  }

  // ── API Methods ───────────────────────────────────────────────

  /**
   * Get messages for a pack (conversation) and seller.
   * GET /messages/packs/{packId}/sellers/{sellerId}
   * @param {string} packId - Message pack/conversation ID
   * @param {string} sellerId - Seller user ID
   * @returns {Object|null} Messages response or null on failure
   */
  async getMessages(packId, sellerId) {
    if (!packId || !sellerId) return null;

    const cacheKey = `messages:${packId}:${sellerId}`;
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    const data = await this._get(`/messages/packs/${packId}/sellers/${sellerId}`);
    if (data) this._setCache(cacheKey, data);
    return data;
  }

  /**
   * Get order details by order ID.
   * GET /orders/{orderId}
   * @param {string} orderId - Order ID (numeric, without prefix)
   * @returns {Object|null} Order data or null on failure
   */
  async getOrder(orderId) {
    if (!orderId) return null;

    const cacheKey = `order:${orderId}`;
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    const data = await this._get(`/orders/${orderId}`);
    if (data) this._setCache(cacheKey, data, 60000); // 1 min TTL for orders
    return data;
  }

  /**
   * Get buyer/user profile information.
   * GET /users/{userId}
   * @param {string} userId - User ID
   * @returns {Object|null} User data or null on failure
   */
  async getBuyer(userId) {
    if (!userId) return null;

    const cacheKey = `user:${userId}`;
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    const data = await this._get(`/users/${userId}`);
    if (data) this._setCache(cacheKey, data, 120000); // 2 min TTL for profiles
    return data;
  }

  // ── HTTP Helpers ──────────────────────────────────────────────

  /**
   * Perform an authenticated GET request with rate limit checking.
   * @param {string} path - API path (e.g., /orders/123)
   * @returns {Object|null} Parsed JSON response or null on failure
   * @private
   */
  async _get(path) {
    try {
      if (!(await this._ensureAuth())) return null;

      // Check rate limit before making request
      if (!this._checkRateLimit()) {
        this.log.warn('Rate limit approaching — skipping request:', path);
        return null;
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this._accessToken}`,
          'Accept': 'application/json'
        }
      });

      this._trackRequest();

      if (response.status === 401) {
        // Token expired mid-request — try refresh once
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this._get(path); // Retry once
        }
        return null;
      }

      if (!response.ok) {
        this.log.warn(`API ${response.status} for ${path}`);
        return null;
      }

      return await response.json();
    } catch (err) {
      this.log.error(`API error for ${path}:`, err);
      return null;
    }
  }

  // ── Rate Limiting ─────────────────────────────────────────────

  /**
   * Check if we can make another request within rate limits.
   * ML allows 500 GET requests per minute.
   * @returns {boolean}
   * @private
   */
  _checkRateLimit() {
    const now = Date.now();
    const windowStart = now - this._rateLimit.windowMs;

    // Remove expired entries
    this._rateLimit.requests = this._rateLimit.requests.filter(t => t > windowStart);

    // Leave 10% headroom
    const safeLimit = Math.floor(this._rateLimit.maxRpm * 0.9);
    return this._rateLimit.requests.length < safeLimit;
  }

  /**
   * Record a request timestamp for rate limit tracking.
   * @private
   */
  _trackRequest() {
    this._rateLimit.requests.push(Date.now());
  }

  /**
   * Get the current rate limit usage.
   * @returns {{ used: number, limit: number, remaining: number }}
   */
  getRateLimitStatus() {
    const now = Date.now();
    const windowStart = now - this._rateLimit.windowMs;
    this._rateLimit.requests = this._rateLimit.requests.filter(t => t > windowStart);

    const used = this._rateLimit.requests.length;
    return {
      used,
      limit: this._rateLimit.maxRpm,
      remaining: this._rateLimit.maxRpm - used
    };
  }

  // ── Cache ─────────────────────────────────────────────────────

  /**
   * Get a value from the in-memory cache.
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
   * Set a value in the in-memory cache.
   * @param {string} key
   * @param {*} data
   * @param {number} [ttlMs] - Override default TTL
   * @private
   */
  _setCache(key, data, ttlMs) {
    const ttl = ttlMs || this._cacheTtlMs;
    this._cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });

    // Prevent unbounded cache growth
    if (this._cache.size > 200) {
      const oldest = this._cache.keys().next().value;
      this._cache.delete(oldest);
    }
  }

  /**
   * Clear all cached data.
   */
  clearCache() {
    this._cache.clear();
  }

  // ── Token Persistence (Placeholder) ───────────────────────────

  /**
   * Persist tokens to chrome.storage.local with encryption.
   * Placeholder for Web Crypto API integration.
   * @param {Object} tokenData - { access_token, refresh_token, expires_in }
   * @private
   */
  async _persistTokens(tokenData) {
    try {
      // TODO: Encrypt tokens using Web Crypto API (AES-GCM) before storage
      // For now, store via chrome.storage.local with a warning
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          ml_tokens: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: Date.now() + (tokenData.expires_in * 1000),
            _encrypted: false // Flag: not yet encrypted
          }
        });
      }
    } catch (err) {
      this.log.warn('Failed to persist tokens:', err);
    }
  }

  /**
   * Load tokens from chrome.storage.local.
   * @returns {boolean} True if tokens were loaded successfully
   */
  async loadStoredTokens() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return false;
      }

      return new Promise((resolve) => {
        chrome.storage.local.get('ml_tokens', (result) => {
          const tokens = result.ml_tokens;
          if (tokens && tokens.accessToken && Date.now() < tokens.expiresAt) {
            this._accessToken = tokens.accessToken;
            this._refreshToken = tokens.refreshToken;
            this._tokenExpiry = tokens.expiresAt;
            this.log.info('Tokens loaded from storage');
            resolve(true);
          } else if (tokens && tokens.refreshToken) {
            // Token expired but we have a refresh token
            this._refreshToken = tokens.refreshToken;
            resolve(false); // Will need to refresh
          } else {
            resolve(false);
          }
        });
      });
    } catch (err) {
      this.log.warn('Failed to load stored tokens:', err);
      return false;
    }
  }
}

OmniCRM.MLApiClient = MLApiClient;
