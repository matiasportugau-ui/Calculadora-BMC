/**
 * OmniCRM Sync — Platform Registry
 * Central configuration for all supported platforms.
 * No dependencies beyond utils.js (used in service worker via importScripts).
 */

const PLATFORMS = {
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: 'assets/platform-icons/whatsapp.svg',
    color: '#25D366',
    textOnColor: '#ffffff',
    urls: ['web.whatsapp.com'],
    activationPaths: ['*'],
    features: ['messages', 'contacts', 'groups', 'media', 'readReceipts', 'typing'],
    hasApi: false,
    portName: 'port-whatsapp'
  },
  mercadolibre: {
    id: 'mercadolibre',
    name: 'Mercado Libre',
    icon: 'assets/platform-icons/mercadolibre.svg',
    color: '#FFE600',
    textOnColor: '#333333',
    urls: ['*.mercadolibre.com.ar', '*.mercadolibre.com', '*.mercadolibre.com.mx',
           '*.mercadolibre.com.co', '*.mercadolivre.com.br'],
    activationPaths: ['/ventas/mensajes', '/sales/messages', '/messages'],
    features: ['messages', 'orderContext', 'buyerInfo', 'claims', 'productRefs'],
    hasApi: true,
    portName: 'port-mercadolibre',
    apiConfig: {
      baseUrl: 'https://api.mercadolibre.com',
      authUrl: 'https://auth.mercadolibre.com.ar/authorization',
      tokenUrl: 'https://api.mercadolibre.com/oauth/token',
      requiredScopes: ['read', 'write', 'offline_access'],
      rateLimits: {
        general: 1500,
        get: 500,
        post: 500
      }
    }
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook Messenger',
    icon: 'assets/platform-icons/facebook.svg',
    color: '#0084FF',
    textOnColor: '#ffffff',
    urls: ['www.facebook.com', 'www.messenger.com'],
    activationPaths: ['/messages', '/marketplace/messages', '*'],
    features: ['messages', 'contacts', 'groups', 'marketplace', 'reactions'],
    hasApi: false,
    portName: 'port-facebook',
    notes: 'messenger.com discontinued April 2026 — facebook.com/messages is primary'
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram DM',
    icon: 'assets/platform-icons/instagram.svg',
    color: '#E1306C',
    gradient: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
    textOnColor: '#ffffff',
    urls: ['www.instagram.com'],
    activationPaths: ['/direct'],
    features: ['messages', 'contacts', 'sharedPosts', 'reactions', 'stories', 'reels'],
    hasApi: false,
    portName: 'port-instagram'
  }
};

// Make available in both content script and service worker contexts
if (typeof window !== 'undefined') {
  OmniCRM.PLATFORMS = PLATFORMS;
} else if (typeof self !== 'undefined') {
  self.PLATFORMS = PLATFORMS;
}
