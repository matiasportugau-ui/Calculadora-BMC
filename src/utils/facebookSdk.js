/**
 * Facebook JS SDK loader for WhatsApp Embedded Signup (coexistence onboarding).
 *
 * Mirrors the loadGsiScript() pattern in src/utils/googleDrive.js: caches the load
 * promise, de-dupes via a DOM selector, resets the cache on error. Calls FB.init once
 * with the given appId + Graph version. The QR/onboarding popup is rendered by Meta —
 * we only load the SDK and expose window.FB.
 */
const FB_SCRIPT_SELECTOR = 'script[data-fb-sdk="1"]';
let _fbLoadPromise = null;
let _initialized = false;

function isFbLoaded() {
  return typeof window !== "undefined" && typeof window.FB !== "undefined";
}

/**
 * @param {{ appId: string, graphVersion?: string }} opts
 * @returns {Promise<typeof window.FB>}
 */
export function loadFbSdk({ appId, graphVersion = "v21.0" } = {}) {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (!appId) return Promise.reject(new Error("Meta App ID missing"));

  const initOnce = () => {
    if (!_initialized) {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion });
      _initialized = true;
    }
    return window.FB;
  };

  if (isFbLoaded()) return Promise.resolve(initOnce());
  if (_fbLoadPromise) return _fbLoadPromise;

  _fbLoadPromise = new Promise((resolve, reject) => {
    let existing = document.querySelector(FB_SCRIPT_SELECTOR);
    if (existing?.dataset.fbLoadState === "error") {
      _fbLoadPromise = null;
      existing.remove();
      existing = null;
    }
    const s = existing || document.createElement("script");
    if (!existing) {
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true;
      s.defer = true;
      s.crossOrigin = "anonymous";
      s.dataset.fbSdk = "1";
      s.dataset.fbLoadState = "loading";
    }
    s.addEventListener(
      "load",
      () => {
        s.dataset.fbLoadState = "loaded";
        try {
          resolve(initOnce());
        } catch (e) {
          reject(e);
        }
      },
      { once: true },
    );
    s.addEventListener(
      "error",
      () => {
        s.dataset.fbLoadState = "error";
        _fbLoadPromise = null;
        s.remove();
        reject(new Error("Failed to load Facebook SDK"));
      },
      { once: true },
    );
    if (!existing) document.head.appendChild(s);
  });
  return _fbLoadPromise;
}
