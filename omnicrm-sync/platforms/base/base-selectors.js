/**
 * OmniCRM Sync — Base Selectors
 * Abstract base class providing multi-tier selector fallback chains.
 * Depends on: utils.js
 */

class BaseSelectors {
  constructor(platformId, selectorMap = {}) {
    this.platformId = platformId;
    this.selectorMap = selectorMap;
    this.fallbackMap = {};
    this.failedSelectors = new Set();
    this.log = new OmniCRM.OmniLog(platformId + ':selectors');
  }

  /**
   * Register fallback selectors for a key.
   * @param {string} key - Selector key name
   * @param {string|string[]} fallbacks - One or more fallback CSS selectors
   */
  addFallback(key, fallbacks) {
    if (!this.fallbackMap[key]) this.fallbackMap[key] = [];
    const list = Array.isArray(fallbacks) ? fallbacks : [fallbacks];
    this.fallbackMap[key].push(...list);
  }

  /**
   * Get a single DOM element with fallback chain.
   * Priority: primary selector → fallbacks in order.
   * @param {string} key - Selector key
   * @param {Element} root - Root element to search within
   * @returns {Element|null}
   */
  get(key, root = document) {
    // Try primary selector
    const primary = this.selectorMap[key];
    if (primary) {
      const el = OmniCRM.qs(primary, root);
      if (el) {
        this.failedSelectors.delete(key);
        return el;
      }
    }

    // Try fallbacks
    const fallbacks = this.fallbackMap[key] || [];
    for (const selector of fallbacks) {
      const el = OmniCRM.qs(selector, root);
      if (el) {
        this.failedSelectors.delete(key);
        return el;
      }
    }

    // All failed
    if (!this.failedSelectors.has(key)) {
      this.log.warn(`Selector '${key}' failed — DOM may have changed`);
      this.failedSelectors.add(key);
    }
    return null;
  }

  /**
   * Get all matching DOM elements with fallback chain.
   * @param {string} key - Selector key
   * @param {Element} root - Root element to search within
   * @returns {Element[]}
   */
  getAll(key, root = document) {
    const primary = this.selectorMap[key];
    if (primary) {
      const els = OmniCRM.qsa(primary, root);
      if (els.length > 0) {
        this.failedSelectors.delete(key);
        return els;
      }
    }

    const fallbacks = this.fallbackMap[key] || [];
    for (const selector of fallbacks) {
      const els = OmniCRM.qsa(selector, root);
      if (els.length > 0) {
        this.failedSelectors.delete(key);
        return els;
      }
    }

    if (!this.failedSelectors.has(key)) {
      this.log.warn(`Selector '${key}' (getAll) failed — DOM may have changed`);
      this.failedSelectors.add(key);
    }
    return [];
  }

  /**
   * Wait for an element to appear in the DOM.
   * Uses MutationObserver on document.body.
   * @param {string} key - Selector key
   * @param {number} timeoutMs - Max wait time
   * @returns {Promise<Element>}
   */
  waitFor(key, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      // Check immediately
      const existing = this.get(key);
      if (existing) {
        resolve(existing);
        return;
      }

      let observer = null;
      const timer = setTimeout(() => {
        if (observer) observer.disconnect();
        reject(new Error(`Timeout waiting for selector '${key}' (${timeoutMs}ms)`));
      }, timeoutMs);

      observer = new MutationObserver(() => {
        const el = this.get(key);
        if (el) {
          clearTimeout(timer);
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }

  /**
   * Test all selectors and report which work.
   * @returns {{ working: string[], broken: string[] }}
   */
  healthCheck() {
    const working = [];
    const broken = [];

    for (const key of Object.keys(this.selectorMap)) {
      const el = this.get(key);
      if (el) {
        working.push(key);
      } else {
        broken.push(key);
      }
    }

    this.log.info(`Health check: ${working.length} working, ${broken.length} broken`);
    if (broken.length > 0) {
      this.log.warn('Broken selectors:', broken);
    }

    return { working, broken };
  }

  /**
   * Get the raw CSS selector string for a key (primary only).
   * @param {string} key
   * @returns {string|null}
   */
  getSelector(key) {
    return this.selectorMap[key] || null;
  }
}

OmniCRM.BaseSelectors = BaseSelectors;
