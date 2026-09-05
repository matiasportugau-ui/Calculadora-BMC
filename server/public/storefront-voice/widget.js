/**
 * BMC Panelin storefront voice widget.
 * Cloud Run API + Shopify Ajax cart / navigation on bmcuruguay.com.uy.
 */
(function () {
  "use strict";
  if (window.__bmcPanelinVoice) return;
  window.__bmcPanelinVoice = true;

  const SAMPLE_RATE = 24000;
  const SECRET_PREFIX = "xai-client-secret.";
  const MAX_MS = 8 * 60 * 1000;
  /** Wall-clock idle after last speech/turn: stop mic + WS so silence is not billed. */
  const SILENCE_CUT_MS = 10 * 1000;
  /** Skip PCM append below this peak — xAI bills silence the same as speech. */
  const PCM_SILENCE_PEAK = 0.008;
  const SS_RESUME = "bmc_panelin_resume";
  const SS_IDENTITY = "bmc_panelin_identity";
  const SS_LIVE = "bmc_panelin_live";
  const LIVE_HANDOFF = "Un agente de ventas de BMC se suma a la conversación.";
  const SHOP_HOSTS = ["bmcuruguay.com.uy", "www.bmcuruguay.com.uy", "xj4rir-qz.myshopify.com"];
  const COL_HINTS = {
    isodec: "isodec",
    "isodec pir": "isodec-pir",
    isoroof: "isoroof",
    isowall: "isowall-pir",
    panel: "paneles-aislantes",
    accesor: "accesorios",
    galpon: "galpones-de-jardin",
    hiansa: "hianza-panel",
    tornill: "tornilleria-2",
  };
  const SHOP_TOOLS = {
    shop_search: 1,
    shop_product: 1,
    get_cart: 1,
    add_to_cart: 1,
    navigate: 1,
    open_url: 1,
    share_link: 1,
    present_choices: 1,
    add_quote_to_cart: 1,
  };

  function scriptEl() {
    return (
      document.currentScript ||
      document.querySelector('script[src*="storefront-voice"]') ||
      document.querySelector("script[data-bmc-voice]")
    );
  }

  function apiBase() {
    const el = scriptEl();
    const fromData = (el && (el.getAttribute("data-api") || el.dataset.api)) || "";
    if (fromData) return String(fromData).replace(/\/$/, "");
    try {
      if (el && el.src) return new URL(el.src).origin;
    } catch { /* ignore */ }
    return window.location.origin;
  }

  const API = apiBase();
  const LOCAL_HOST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const VOICE_MODES = { text: 1, pipeline: 1, realtime: 1 };

  function readVoiceMode() {
    try {
      const q = String(new URLSearchParams(location.search).get("voice") || "").trim();
      if (VOICE_MODES[q]) return q;
    } catch { /* ignore */ }
    const el = scriptEl();
    const d = String((el && (el.getAttribute("data-bmc-voice-mode") || el.dataset.bmcVoiceMode)) || "").trim();
    if (VOICE_MODES[d]) return d;
    return "pipeline";
  }

  const VOICE_MODE = readVoiceMode();
  window.__bmcVoiceMode = VOICE_MODE;

  function micScore(label) {
    const l = String(label || "");
    if (/aggregate|agregado|virtual|blackhole|soundflower|loopback/i.test(l)) return -100;
    if (/iphone|continuity|airpods/i.test(l)) return 1;
    if (/macbook|built-in|built in|interno/i.test(l)) return 50;
    return 5;
  }

  async function openMic() {
    const loose = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
    };
    const first = await navigator.mediaDevices.getUserMedia({ audio: loose });
    const label = first.getAudioTracks()[0]?.label || "";
    if (!/aggregate|agregado|virtual|blackhole|soundflower|loopback/i.test(label)) {
      return first;
    }
    let best = null;
    try {
      const inputs = (await navigator.mediaDevices.enumerateDevices())
        .filter((d) => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications");
      best = inputs.slice().sort((a, b) => micScore(b.label) - micScore(a.label))[0];
    } catch { /* ignore */ }
    first.getTracks().forEach((t) => t.stop());
    await new Promise((r) => setTimeout(r, 400));
    if (best && micScore(best.label) > 0) {
      return navigator.mediaDevices.getUserMedia({
        audio: { ...loose, deviceId: { ideal: best.deviceId } },
      });
    }
    return navigator.mediaDevices.getUserMedia({ audio: loose });
  }

  function b64Encode(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function b64Decode(b64) {
    const binary = atob(String(b64 || ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function float32ToB64Pcm16(float32) {
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    }
    return b64Encode(new Uint8Array(pcm16.buffer));
  }

  function b64Pcm16ToFloat32(b64) {
    const bytes = b64Decode(b64);
    const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const out = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) out[i] = pcm16[i] / 32768;
    return out;
  }

  function resample(input, fromRate, toRate) {
    if (!input?.length || fromRate === toRate) return input || new Float32Array(0);
    const ratio = fromRate / toRate;
    const outLen = Math.max(1, Math.floor(input.length / ratio));
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const src = i * ratio;
      const i0 = Math.floor(src);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const t = src - i0;
      out[i] = input[i0] * (1 - t) + input[i1] * t;
    }
    return out;
  }

  function grokWsUrl(realtimeBase, model, conversationId) {
    let base = String(realtimeBase || "https://api.x.ai/v1/realtime").replace(/\/+$/, "");
    if (/^https:/i.test(base)) base = base.replace(/^https:/i, "wss:");
    else if (/^http:/i.test(base)) base = base.replace(/^http:/i, "ws:");
    const m = String(model || "grok-voice-latest");
    const sep = base.includes("?") ? "&" : "?";
    let url = `${base}${sep}model=${encodeURIComponent(m)}`;
    if (conversationId) url += `&conversation_id=${encodeURIComponent(conversationId)}`;
    return url;
  }

  function grokProtocols(token) {
    const t = String(token || "").replace(/^Bearer\s+/i, "").trim();
    if (t.startsWith(SECRET_PREFIX)) return [t];
    return [`${SECRET_PREFIX}${t}`];
  }

  function buildSessionUpdate(boot) {
    const session = {
      instructions: boot.instructions || "",
      voice: boot.voice || "rex",
      tool_choice: boot.tool_choice || "auto",
      turn_detection: boot.turn_detection || {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 333,
        silence_duration_ms: 900,
        idle_timeout_ms: SILENCE_CUT_MS,
      },
      audio: {
        input: {
          format: { type: "audio/pcm", rate: SAMPLE_RATE },
          transcription: {
            model: boot.transcription_model || "grok-transcribe",
            language_hint: boot.language_hint || "es-MX",
            keyterms: boot.keyterms || [],
          },
        },
        output: { format: { type: "audio/pcm", rate: SAMPLE_RATE } },
      },
      resumption: { enabled: true },
    };
    if (boot.replace) session.replace = boot.replace;
    if (Array.isArray(boot.tools) && boot.tools.length) session.tools = boot.tools;
    if (boot.reasoning) session.reasoning = boot.reasoning;
    return { type: "session.update", session };
  }

  function shopUrl(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    try {
      const u = s.startsWith("/") ? new URL(s, location.origin) : new URL(s, location.origin);
      const host = u.hostname.replace(/^www\./, "");
      const here = location.hostname.replace(/^www\./, "");
      if (u.origin === location.origin || SHOP_HOSTS.some((h) => h.replace(/^www\./, "") === host) || host === here) {
        return u.pathname + u.search;
      }
    } catch { /* ignore */ }
    return null;
  }

  function summarizeProduct(p) {
    const variants = p.variants || [];
    const v = variants.find((x) => x.available !== false) || variants[0] || {};
    const img = (p.images && p.images[0] && (p.images[0].src || p.images[0])) || p.featured_image || "";
    const price = v.price != null ? v.price : p.price;
    return {
      title: p.title,
      handle: p.handle,
      url: `/products/${p.handle}`,
      variant_id: v.id || null,
      variant_title: v.title || "",
      price,
      image: typeof img === "string" ? img : "",
    };
  }

  async function shopSearch(query) {
    const q = String(query || "").trim();
    if (!q) return { ok: false, error: "Falta query" };
    const low = q.toLowerCase();
    const col = Object.keys(COL_HINTS).find((k) => low.includes(k));
    let products = [];
    try {
      if (col) {
        const r = await fetch(`/collections/${COL_HINTS[col]}/products.json?limit=8`);
        if (r.ok) products = (await r.json()).products || [];
      }
      if (!products.length) {
        const r = await fetch("/products.json?limit=50");
        const d = r.ok ? await r.json() : { products: [] };
        const toks = low.split(/\s+/).filter(Boolean);
        products = (d.products || [])
          .filter((p) => {
            const hay = `${p.title} ${p.handle} ${(p.tags || []).join(" ")}`.toLowerCase();
            return toks.every((t) => hay.includes(t));
          })
          .slice(0, 8);
      }
    } catch (err) {
      return { ok: false, error: err.message || "search failed" };
    }
    const colHandle = col ? COL_HINTS[col] : null;
    return {
      ok: true,
      products: products.map(summarizeProduct),
      collection: colHandle ? `/collections/${colHandle}` : null,
    };
  }

  async function shopProduct(handle) {
    const h = String(handle || "").replace(/^\/products\//, "").split("?")[0].trim();
    if (!h) return { ok: false, error: "Falta handle" };
    const r = await fetch(`/products/${encodeURIComponent(h)}.json`);
    if (!r.ok) return { ok: false, error: "Producto no encontrado" };
    const d = await r.json();
    const p = d.product || d;
    const summary = summarizeProduct(p);
    summary.variants = (p.variants || []).slice(0, 12).map((v) => ({
      id: v.id,
      title: v.title,
      price: v.price,
      available: v.available !== false,
    }));
    return { ok: true, product: summary };
  }

  async function getCart() {
    const r = await fetch("/cart.js", { headers: { Accept: "application/json" } });
    if (!r.ok) return { ok: false, error: "No se pudo leer el carrito" };
    const c = await r.json();
    return {
      ok: true,
      item_count: c.item_count || 0,
      total_price: c.total_price,
      currency: c.currency,
      items: (c.items || []).map((it) => ({
        title: it.product_title || it.title,
        quantity: it.quantity,
        variant_id: it.variant_id,
        url: it.url,
      })),
    };
  }

  function cartSectionIds() {
    return [...document.querySelectorAll("cart-items-component")]
      .map((el) => el.dataset.sectionId)
      .filter(Boolean);
  }

  function notifyThemeCart(cart, sections) {
    const itemCount = Number(cart?.item_count) || 0;
    try {
      document.dispatchEvent(new CustomEvent("cart:update", {
        bubbles: true,
        detail: {
          resource: cart || {},
          sourceId: "bmc-panelin",
          data: {
            itemCount,
            source: "bmc-panelin",
            sections: sections || {},
          },
        },
      }));
    } catch { /* ignore */ }
  }

  async function addToCart(variantId, quantity) {
    const id = Number(variantId);
    const qty = Math.max(1, Number(quantity) || 1);
    if (!id) return { ok: false, error: "Falta variant_id" };
    const payload = { items: [{ id, quantity: qty }] };
    const sectionIds = cartSectionIds();
    if (sectionIds.length) {
      payload.sections = sectionIds.join(",");
      payload.sections_url = location.pathname;
    }
    const r = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const raw = await r.text();
    let data = {};
    try { data = JSON.parse(raw); } catch { /* ignore */ }
    if (!r.ok) {
      return { ok: false, error: data.description || data.message || "No se pudo agregar" };
    }
    const cart = await getCart();
    if (cart.ok) notifyThemeCart(cart, data.sections);
    return { ok: true, added: data.title || data.items?.[0]?.title || "ítem", cart };
  }

  // Thickness matching SoT: server/lib/voice/storefrontCartVariant.js (keep in sync).
  function mmInTitle(title, mm) {
    if (!mm) return true;
    const t = String(title || "").toLowerCase().replace(/\s+/g, "");
    const n = String(mm).replace(/\D/g, "");
    if (!n) return true;
    if (new RegExp(`(?:^|[^0-9])${n}mm(?:[^0-9]|$)`).test(t)) return true;
    if (/\dmm/.test(t)) return false;
    return new RegExp(`(?:^|[^0-9])${n}(?:[^0-9]|$)`).test(t);
  }

  function colorInTitle(title, color) {
    if (!color) return true;
    return String(title || "").toLowerCase().includes(String(color).toLowerCase());
  }

  function pickVariant(product, line) {
    const vs = (product && product.variants) || [];
    if (!vs.length) return null;
    const mm = String(line.espesor || "").replace(/\D/g, "");
    const color = String(line.color || "Blanco");
    const scored = vs.map((v) => {
      const title = `${v.title || ""} ${v.option1 || ""} ${v.option2 || ""} ${v.option3 || ""}`;
      let score = 0;
      if (mm && mmInTitle(title, mm)) score += 4;
      if (colorInTitle(title, color)) score += 2;
      if (v.available !== false) score += 1;
      return { v, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best) return null;
    // Never silently substitute a different thickness (e.g. 100mm for a 50mm quote).
    if (mm && best.score < 4) return null;
    return best.v;
  }

  function cartQtyFromLine(line, shopPrice) {
    let q = Math.max(1, Math.round(Number(line.quantity) || 1));
    const pu = Number(line.pu_usd) || 0;
    const sp = Number(shopPrice) || 0;
    const cant = Number(line.cant) || q;
    if (pu > 0 && sp > pu * 4) {
      q = Math.max(1, Math.round((cant * pu) / sp));
    }
    return Math.min(500, q);
  }

  async function addQuoteLinesToCart(lines, meta = {}) {
    const list = Array.isArray(lines) ? lines : [];
    if (meta.pdf_url) addQuoteCard(meta.pdf_url, meta.code);
    if (!list.length) return { ok: false, error: "sin líneas" };
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      addCap("assistant", "En la tienda (bmcuruguay.com.uy) estos ítems se agregan al carrito para comprar online. Acá en local no hay carrito Shopify.");
      return { ok: true, skipped: "local", n: list.length };
    }
    const items = [];
    const skipped = [];
    for (const line of list.slice(0, 24)) {
      const handle = String(line.handle || "").trim();
      if (!handle) {
        skipped.push(line.title || line.sku);
        continue;
      }
      try {
        const r = await fetch(`/products/${encodeURIComponent(handle)}.json`);
        if (!r.ok) {
          skipped.push(line.title || handle);
          continue;
        }
        const d = await r.json();
        const product = d.product || d;
        const v = pickVariant(product, line);
        if (!v || !v.id) {
          skipped.push(line.title || handle);
          continue;
        }
        items.push({
          id: Number(v.id),
          quantity: cartQtyFromLine(line, v.price),
        });
      } catch {
        skipped.push(line.title || handle);
      }
    }
    if (!items.length) {
      return { ok: false, error: "No encontré esos productos en la tienda", skipped };
    }
    const payload = { items };
    const sectionIds = cartSectionIds();
    if (sectionIds.length) {
      payload.sections = sectionIds.join(",");
      payload.sections_url = location.pathname;
    }
    const r = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const raw = await r.text();
    let data = {};
    try { data = JSON.parse(raw); } catch { /* ignore */ }
    if (!r.ok) {
      return { ok: false, error: data.description || data.message || "No se pudo cargar el carrito", skipped };
    }
    const cart = await getCart();
    if (cart.ok) {
      setCartCount(cart.item_count);
      notifyThemeCart(cart, data.sections);
    }
    persistResume();
    openCartUi();
    return {
      ok: true,
      added: items.length,
      skipped,
      item_count: cart.ok ? cart.item_count : items.length,
    };
  }

  const css = `
#bmc-paneli-voice{all:initial;display:block;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Helvetica,Arial,sans-serif;position:fixed;z-index:2147483000;right:92px;bottom:calc(18px + env(safe-area-inset-bottom,0px));color:#1d1d1f}
@media(max-width:640px){#bmc-paneli-voice{right:16px;left:16px;bottom:calc(88px + env(safe-area-inset-bottom,0px))}}
#bmc-paneli-voice *{box-sizing:border-box}
#bmc-paneli-voice .bmc-launch{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-left:auto}
#bmc-paneli-voice .bmc-ask{max-width:11.5em;background:rgba(15,23,42,.92);color:#fff;font-size:13px;font-weight:600;line-height:1.25;padding:8px 12px;border-radius:12px;box-shadow:0 8px 20px rgba(0,0,0,.22);cursor:pointer}
#bmc-paneli-voice.open .bmc-ask{display:none}
#bmc-paneli-voice.open .bmc-launch{visibility:hidden;pointer-events:none}
#bmc-paneli-voice .bmc-orb{width:76px;height:76px;padding:0;border:2px solid #fff;border-radius:50%;background:#1a3a5c;cursor:pointer;display:grid;place-items:center;overflow:hidden;box-shadow:0 10px 28px rgba(20,19,17,.28);position:relative;flex:none;animation:bmc-orb-breathe 3.6s ease-in-out infinite}
#bmc-paneli-voice .bmc-orb:focus-visible{outline:2px solid #0071e3;outline-offset:3px}
#bmc-paneli-voice .bmc-orb[data-state="listening"]{box-shadow:0 0 0 5px rgba(0,113,227,.35);animation:none}
#bmc-paneli-voice .bmc-orb[data-state="speaking"]{box-shadow:0 0 0 5px rgba(0,113,227,.45);animation:none}
#bmc-paneli-voice .bmc-orb[data-state="thinking"]{box-shadow:0 0 0 5px rgba(167,139,250,.4);animation:none}
#bmc-paneli-voice .bmc-face{width:100%;height:100%;object-fit:cover;display:block;background:#1a3a5c}
#bmc-paneli-voice .bmc-badge{position:absolute;top:-6px;left:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#C45C26;color:#fff;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center}
#bmc-paneli-voice .bmc-badge.show{display:flex}
@keyframes bmc-orb-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
#bmc-paneli-voice .bmc-panel{display:none;position:absolute;right:0;bottom:88px;width:min(380px,calc(100vw - 32px));max-height:min(72dvh,560px);background:#fff;border:1px solid #e5e5ea;border-radius:22px;padding:14px 14px 12px;box-shadow:0 16px 36px rgba(20,19,17,.18);overflow:auto}
@media(max-width:640px){#bmc-paneli-voice .bmc-panel{width:100%;right:0;left:0}}
#bmc-paneli-voice.open .bmc-panel{display:flex;flex-direction:column}
#bmc-paneli-voice .bmc-x{position:absolute;top:8px;right:8px;width:44px;height:44px;border:0;background:transparent;color:#6e6e73;font-size:22px;cursor:pointer;line-height:1}
#bmc-paneli-voice .bmc-empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:8px 8px 16px;gap:10px}
#bmc-paneli-voice.has-chat .bmc-empty{display:none}
#bmc-paneli-voice .bmc-empty .bmc-hero-face{width:64px;height:64px;border-radius:50%;object-fit:cover;background:#1a3a5c;border:2px solid #fff}
#bmc-paneli-voice .bmc-title{margin:0;font-size:15px;font-weight:600;color:#1d1d1f}
#bmc-paneli-voice .bmc-sub{margin:0;font-size:13px;line-height:1.5;color:#6e6e73;max-width:16em}
#bmc-paneli-voice .bmc-picks{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:4px 0 0}
#bmc-paneli-voice .bmc-pick{border:1px solid #e5e5ea;background:#f5f5f7;border-radius:20px;padding:8px 12px;min-height:44px;font:inherit;font-size:12px;cursor:pointer;color:#1d1d1f}
#bmc-paneli-voice .bmc-pick:hover{border-color:#0071e3;color:#0071e3}
#bmc-paneli-voice .bmc-caps{display:none;flex:1;min-height:96px;max-height:220px;overflow:auto;font-size:13px;line-height:1.45;color:#1d1d1f;padding:4px 2px 10px;scrollbar-width:thin}
#bmc-paneli-voice.has-chat .bmc-caps{display:block}
#bmc-paneli-voice .bmc-line{margin:0 0 8px;overflow-wrap:anywhere}
#bmc-paneli-voice .bmc-line:last-child{margin:0}
#bmc-paneli-voice .bmc-line[data-role="user"]{color:#6e6e73}
#bmc-paneli-voice .bmc-line[data-role="agent"]{color:#1a3a5c;font-weight:600}
#bmc-paneli-voice .bmc-link{color:#0071e3;font-weight:600;text-decoration:underline;text-underline-offset:2px}
#bmc-paneli-voice .bmc-quote{display:flex;align-items:center;gap:10px;margin:0 0 10px;padding:10px 12px;border:1px solid #e5e5ea;border-radius:14px;background:#f5f5f7;color:#1d1d1f;text-decoration:none;min-height:52px}
#bmc-paneli-voice .bmc-quote:hover{border-color:#0071e3}
#bmc-paneli-voice .bmc-quote-icon{width:36px;height:36px;border-radius:8px;background:#0071e3;color:#fff;display:grid;place-items:center;flex:none}
#bmc-paneli-voice .bmc-quote-title{display:block;font-size:13px;font-weight:700}
#bmc-paneli-voice .bmc-quote-sub{display:block;font-size:11px;color:#6e6e73;margin-top:2px}
#bmc-paneli-voice .bmc-shop-picks{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
#bmc-paneli-voice .bmc-shop-picks[hidden]{display:none}
#bmc-paneli-voice .bmc-shop-picks .bmc-pick{min-height:44px}
#bmc-paneli-voice .bmc-status{margin:0 0 6px;font-size:11px;color:#6e6e73;min-height:1em}
#bmc-paneli-voice .bmc-vu{margin:0 0 6px;font-size:11px;color:#6e6e73;font-variant-numeric:tabular-nums}
#bmc-paneli-voice .bmc-composer{display:flex;align-items:center;gap:8px;margin:0 0 8px}
#bmc-paneli-voice .bmc-inwrap{flex:1;display:flex;align-items:center;border:1px solid #e5e5ea;border-radius:999px;background:#f5f5f7;padding:4px 6px 4px 14px;min-height:48px}
#bmc-paneli-voice .bmc-in{flex:1;border:0;outline:none;font:inherit;font-size:16px;min-height:40px;background:transparent;color:#1d1d1f}
#bmc-paneli-voice .bmc-send,#bmc-paneli-voice .bmc-mic{width:44px;height:44px;flex:none;border:0;border-radius:50%;cursor:pointer;display:grid;place-items:center;padding:0}
#bmc-paneli-voice .bmc-send{background:#0071e3;color:#fff}
#bmc-paneli-voice .bmc-mic{background:transparent;color:#6e6e73}
#bmc-paneli-voice .bmc-mic[data-state="listening"],#bmc-paneli-voice .bmc-mic[data-state="speaking"]{background:#ff3b30;color:#fff}
#bmc-paneli-voice .bmc-mic[data-state="connecting"],#bmc-paneli-voice .bmc-mic[data-state="active"]{background:#0071e3;color:#fff}
#bmc-paneli-voice .bmc-row{display:flex;gap:8px}
#bmc-paneli-voice .bmc-btn{flex:1;min-height:44px;border:1px solid #e5e5ea;border-radius:12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;background:#fff;color:#1d1d1f}
#bmc-paneli-voice .bmc-stop{width:100%;margin:0 0 8px;background:#1d1d1f;color:#fff;border:0}
#bmc-paneli-voice .bmc-err{color:#8b2e12;font-size:12px;margin:6px 0 0}
#bmc-paneli-voice .bmc-hint{margin:8px 0 0;font-size:11px;color:#6e6e73;line-height:1.35}
#bmc-paneli-voice .bmc-id{display:flex;flex-direction:column;gap:8px;width:100%;margin:4px 0 0;text-align:left}
#bmc-paneli-voice.identified .bmc-id{display:none}
#bmc-paneli-voice:not(.identified) .bmc-sub{display:none}
#bmc-paneli-voice:not(.identified) #bmc-form,
#bmc-paneli-voice:not(.identified) #bmc-picks{display:none}
#bmc-paneli-voice .bmc-id-ask{margin:0;font-size:14px;line-height:1.45;color:#1d1d1f;text-align:center}
#bmc-paneli-voice .bmc-id input{width:100%;min-height:48px;border:1px solid #e5e5ea;border-radius:12px;padding:10px 12px;font:inherit;font-size:16px;background:#f5f5f7;color:#1d1d1f}
#bmc-paneli-voice .bmc-id-go{width:100%;min-height:48px;border:0;border-radius:12px;background:#0071e3;color:#fff;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
#bmc-paneli-voice[data-voice-mode="text"] .bmc-mic{display:none}
#bmc-paneli-voice .bmc-mode-chip{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.02em;color:#6e6e73}
#bmc-paneli-voice:not(.local-eval) .bmc-mode-chip{display:none}
@media(prefers-reduced-motion:reduce){#bmc-paneli-voice .bmc-orb{box-shadow:0 10px 28px rgba(20,19,17,.35)!important;animation:none}}
`;

  const root = document.createElement("div");
  root.id = "bmc-paneli-voice";
  root.innerHTML = `
    <style>${css}</style>
    <div class="bmc-panel" role="dialog" aria-label="Panelin">
      <button type="button" class="bmc-x" id="bmc-x" aria-label="Cerrar">×</button>
      <div class="bmc-empty" id="bmc-empty">
        <video class="bmc-hero-face" src="${API}/storefront-voice/panelin-lista-loop.mp4" poster="${API}/storefront-voice/panelin.png" autoplay muted loop playsinline></video>
        <p class="bmc-title">¡Hola! Soy Panelin</p>
        <p class="bmc-mode-chip" id="bmc-mode-chip" hidden></p>
        <p class="bmc-sub">Cuando quieras, hablamos.</p>
        <form class="bmc-id" id="bmc-id">
          <p class="bmc-id-ask">¡Qué bueno que estés acá! Para ayudarte de verdad y dejarle tu consulta al equipo BMC, ¿me decís tu nombre y un celular? ¡Con eso ya podemos chatear!</p>
          <input id="bmc-name" type="text" name="name" autocomplete="name" maxlength="80" required placeholder="Tu nombre" />
          <input id="bmc-phone" type="tel" name="tel" autocomplete="tel" inputmode="tel" maxlength="20" required placeholder="Celular 099…" />
          <button type="submit" class="bmc-id-go">¡Dale, chateamos!</button>
        </form>
        <div class="bmc-picks" id="bmc-picks" hidden></div>
      </div>
      <div class="bmc-caps" id="bmc-caps" aria-live="polite"></div>
      <div class="bmc-shop-picks" id="bmc-shop-picks" hidden role="group" aria-label="Opciones rápidas"></div>
      <p class="bmc-status" id="bmc-status"></p>
      <p class="bmc-vu" id="bmc-vu" hidden></p>
      <form class="bmc-composer" id="bmc-form">
        <button type="button" class="bmc-mic" id="bmc-go" aria-label="Hablar" aria-pressed="false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
        </button>
        <div class="bmc-inwrap">
          <input class="bmc-in" id="bmc-in" type="text" maxlength="2000" autocomplete="off" placeholder="Escribí tu consulta…" />
          <button type="submit" class="bmc-send" id="bmc-send" aria-label="Enviar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9l20-7z"/></svg>
          </button>
        </div>
      </form>
      <button type="button" class="bmc-btn bmc-stop" id="bmc-stop" hidden>Cortar voz</button>
      <div class="bmc-row">
        <button type="button" class="bmc-btn bmc-cart" id="bmc-cart">Carrito</button>
        <button type="button" class="bmc-btn bmc-wa" id="bmc-wa">WhatsApp</button>
      </div>
      <p class="bmc-hint">Con tu nombre y celular dejo la consulta en BMC. El flete hay que corroborarlo.</p>
      <p class="bmc-err" id="bmc-err" hidden></p>
    </div>
    <div class="bmc-launch">
      <span class="bmc-ask">¿Necesitás ayuda?</span>
      <button type="button" class="bmc-orb" id="bmc-orb" aria-label="¿Necesitás ayuda? Abrir Panelin" data-state="idle">
        <span class="bmc-badge" id="bmc-badge">0</span>
        <video class="bmc-face" src="${API}/storefront-voice/panelin-lista-loop.mp4" poster="${API}/storefront-voice/panelin.png" autoplay muted loop playsinline></video>
      </button>
    </div>
  `;

  function attachBubble() {
    if (!root.parentNode) {
      (document.body || document.documentElement).appendChild(root);
    }
  }

  function hideBubble() {
    try { teardown(); } catch { /* ignore */ }
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.querySelectorAll("video").forEach((v) => {
      v.removeAttribute("autoplay");
      v.pause();
    });
  }

  const orb = root.querySelector("#bmc-orb");
  const ask = root.querySelector(".bmc-ask");
  const go = root.querySelector("#bmc-go");
  const stopBtn = root.querySelector("#bmc-stop");
  const waBtn = root.querySelector("#bmc-wa");
  const cartBtn = root.querySelector("#bmc-cart");
  const closeBtn = root.querySelector("#bmc-x");
  const caps = root.querySelector("#bmc-caps");
  const picks = root.querySelector("#bmc-picks");
  const shopPicks = root.querySelector("#bmc-shop-picks");
  const errEl = root.querySelector("#bmc-err");
  const statusEl = root.querySelector("#bmc-status");
  const badge = root.querySelector("#bmc-badge");
  const hintEl = root.querySelector(".bmc-hint");
  const modeChip = root.querySelector("#bmc-mode-chip");

  const state = {
    status: "idle",
    ws: null,
    stream: null,
    processor: null,
    audioCtx: null,
    playCtx: null,
    playTime: 0,
    send: null,
    greeted: false,
    pendingTools: 0,
    maxTimer: null,
    conversationId: null,
    lastWa: `https://wa.me/59892663245?text=${encodeURIComponent("Hola, vengo del sitio de BMC.")}`,
    chatHistory: [],
    chatBusy: false,
    voiceDenied: false,
    voiceWanted: VOICE_MODE === "realtime",
    voiceMode: VOICE_MODE,
    lastInputWasVoice: false,
    rec: null,
    identified: false,
    cliente: "",
    telefono: "",
    adminRow: null,
    logTimer: null,
    silenceTimer: null,
    liveId: null,
    livePing: null,
    livePoll: null,
    agentMode: false,
  };

  function markChat() {
    root.classList.add("has-chat");
  }

  function isLocalEval() {
    return LOCAL_HOST;
  }

  function applyVoiceMode() {
    root.dataset.voiceMode = state.voiceMode;
    if (LOCAL_HOST) root.classList.add("local-eval");
    const chips = {
      text: "Modo texto — solo escribir",
      pipeline: "Modo STT + TTS — sin agente de voz realtime",
      realtime: "Modo voz realtime — Grok cobra el minuto",
    };
    if (modeChip) {
      modeChip.hidden = !LOCAL_HOST;
      modeChip.textContent = chips[state.voiceMode] || "";
    }
    if (hintEl) {
      const hints = {
        text: "Escribí abajo. Con tu nombre y celular dejo la consulta en BMC. El flete hay que corroborarlo.",
        pipeline: "Mic = dictado (STT). Panelin puede leerte la respuesta (TTS). No hay llamada realtime. El flete hay que corroborarlo.",
        realtime: "Tocá Hablar para la voz realtime (cobra por minuto de sesión). El flete hay que corroborarlo.",
      };
      hintEl.textContent = hints[state.voiceMode] || hints.pipeline;
    }
    if (state.voiceMode === "text") go.setAttribute("hidden", "");
    else go.removeAttribute("hidden");
  }

  function speakable(text) {
    return String(text || "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[#*_`>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);
  }

  function pickSttLang() {
    return "es-UY";
  }

  function pickTtsVoice() {
    const voices = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
    const rank = (v) => {
      const blob = `${v.lang} ${v.name}`.toLowerCase();
      if (/es-uy/.test(blob)) return 50;
      if (/es-ar/.test(blob)) return 40;
      if (/es-mx/.test(blob)) return 30;
      if (/es-es/.test(blob)) return 20;
      if (/\bes[-_]/.test(blob) || /spanish|español/.test(blob)) return 10;
      return 0;
    };
    return voices.slice().sort((a, b) => rank(b) - rank(a))[0] || null;
  }

  function stopPipelineListen() {
    const rec = state.rec;
    state.rec = null;
    if (rec) {
      try { rec.stop(); } catch { /* ignore */ }
      try { rec.abort(); } catch { /* ignore */ }
    }
    if (state.voiceMode === "pipeline" && state.status === "listening") setStatus("idle");
  }

  function stopPipelineSpeak() {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { /* ignore */ }
    if (state.voiceMode === "pipeline" && state.status === "speaking") setStatus("idle");
  }

  function speakPipeline(text) {
    if (state.voiceMode !== "pipeline") return;
    const t = speakable(text);
    if (!t || !window.speechSynthesis) return;
    stopPipelineListen();
    stopPipelineSpeak();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = (pickTtsVoice() && pickTtsVoice().lang) || "es-AR";
    const voice = pickTtsVoice();
    if (voice) u.voice = voice;
    u.rate = 1.02;
    u.onstart = () => {
      if (state.voiceMode === "pipeline") setStatus("speaking");
    };
    u.onend = () => {
      if (state.voiceMode === "pipeline" && state.status === "speaking") setStatus("idle");
    };
    u.onerror = () => {
      if (state.voiceMode === "pipeline" && state.status === "speaking") setStatus("idle");
    };
    const kick = () => {
      try { window.speechSynthesis.speak(u); } catch { /* ignore */ }
    };
    if (window.speechSynthesis.getVoices().length) kick();
    else window.speechSynthesis.addEventListener("voiceschanged", kick, { once: true });
  }

  function startPipelineListen() {
    if (!state.identified) return;
    if (state.chatBusy) return;
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) {
      setErr("Este navegador no dicta. Usá Chrome o el modo texto.");
      return;
    }
    stopPipelineSpeak();
    stopPipelineListen();
    const rec = new Rec();
    rec.lang = pickSttLang();
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      let interim = "";
      let finalTxt = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalTxt += t;
        else interim += t;
      }
      if (finalTxt) {
        endUserLive(finalTxt);
        stopPipelineListen();
        state.lastInputWasVoice = true;
        sendText(finalTxt);
      } else if (interim) {
        setUserLive(interim);
      }
    };
    rec.onerror = (ev) => {
      const err = String(ev.error || "");
      if (err === "aborted") return;
      if (err === "not-allowed") setErr("Activá el mic para dictar. Mientras, escribí abajo.");
      else if (err === "no-speech") setErr("No te escuché. Tocá Hablar y repetí.");
      else setErr("No pude dictar. Probá Chrome o escribí.");
      stopPipelineListen();
    };
    rec.onend = () => {
      if (state.rec === rec) {
        state.rec = null;
        if (state.status === "listening") setStatus("idle");
      }
    };
    state.rec = rec;
    setErr("");
    setStatus("listening");
    try {
      rec.start();
    } catch (err) {
      state.rec = null;
      setStatus("idle");
      setErr(err?.message || "No pude arrancar el dictado.");
    }
  }

  function togglePipelineListen() {
    if (state.rec || state.status === "listening") {
      stopPipelineListen();
      return;
    }
    startPipelineListen();
  }

  applyVoiceMode();

  function logVoiceEvent(msg) {
    if (!isLocalEval() || !msg || !msg.type) return;
    const row = {
      t: Date.now(),
      type: msg.type,
      status: msg.status || undefined,
      transcript: typeof msg.transcript === "string" ? msg.transcript : undefined,
      delta: typeof msg.delta === "string" ? msg.delta.slice(0, 160) : undefined,
    };
    window.__bmcVoiceEvents = window.__bmcVoiceEvents || [];
    window.__bmcVoiceEvents.push(row);
    if (window.__bmcVoiceEvents.length > 300) window.__bmcVoiceEvents = window.__bmcVoiceEvents.slice(-300);
  }

  function remember(role, content) {
    const t = String(content || "").trim();
    if (!t) return;
    const last = state.chatHistory[state.chatHistory.length - 1];
    if (last && last.role === role && last.content === t) return;
    state.chatHistory.push({ role, content: t.slice(0, 4000) });
    if (state.chatHistory.length > 20) state.chatHistory = state.chatHistory.slice(-20);
    if (role !== "agent") postLiveTurn(role === "user" ? "user" : "assistant", t);
  }

  function voiceLive() {
    if (state.voiceMode !== "realtime") return false;
    return state.status === "connecting" || state.status === "active" || state.status === "listening" || state.status === "speaking";
  }

  function clearSilenceCut() {
    if (state.silenceTimer) {
      clearTimeout(state.silenceTimer);
      state.silenceTimer = null;
    }
  }

  function touchVoice() {
    if (!voiceLive()) return;
    clearSilenceCut();
    state.silenceTimer = setTimeout(onSilenceWatchdog, SILENCE_CUT_MS);
  }

  function onSilenceWatchdog() {
    if (!voiceLive()) return;
    if (state.status === "connecting" || state.status === "speaking" || state.status === "listening" || state.pendingTools > 0) {
      touchVoice();
      return;
    }
    cutMicForSilence();
  }

  function cutMicForSilence(reason) {
    if (state.status === "idle" || state.agentMode) return;
    teardown();
    setErr(reason || "Corté el mic por silencio. Tocá Hablar para seguir.");
  }

  function persistIdentity() {
    if (!state.identified) return;
    try {
      sessionStorage.setItem(SS_IDENTITY, JSON.stringify({
        cliente: state.cliente,
        telefono: state.telefono,
        adminRow: state.adminRow,
      }));
    } catch { /* ignore */ }
  }

  function applyIdentified(info) {
    state.identified = true;
    state.cliente = String(info?.cliente || "").trim();
    state.telefono = String(info?.telefono || "").trim();
    const row = Number(info?.adminRow);
    state.adminRow = Number.isFinite(row) && row >= 2 ? row : info?.adminRow || null;
    root.classList.add("identified");
    persistIdentity();
    ensureLiveId();
    startLiveLoop();
  }

  function ensureLiveId() {
    if (state.liveId) return state.liveId;
    try {
      const saved = sessionStorage.getItem(SS_LIVE);
      if (saved) state.liveId = saved;
    } catch { /* ignore */ }
    if (!state.liveId) {
      state.liveId = (crypto.randomUUID && crypto.randomUUID()) || `live-${Date.now()}`;
    }
    try { sessionStorage.setItem(SS_LIVE, state.liveId); } catch { /* ignore */ }
    return state.liveId;
  }

  function liveBody() {
    return {
      id: ensureLiveId(),
      conversationId: state.conversationId,
      cliente: state.cliente,
      telefono: state.telefono,
      adminRow: state.adminRow,
      pageUrl: window.location.href,
    };
  }

  function postLive(path, body) {
    fetch(`${API}/api/public/voice/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  function postLiveTurn(role, text) {
    if (!state.identified) return;
    const t = String(text || "").trim();
    if (!t) return;
    postLive("live/turn", { ...liveBody(), role, text: t });
  }

  function pingLive(status) {
    if (!state.identified) return;
    postLive("live/ping", { ...liveBody(), status: status || (state.agentMode ? "takeover" : undefined) });
  }

  function stopLiveLoop() {
    if (state.livePing) { clearInterval(state.livePing); state.livePing = null; }
    if (state.livePoll) { clearInterval(state.livePoll); state.livePoll = null; }
  }

  async function pollLiveState() {
    if (!state.identified || !state.liveId) return;
    try {
      const res = await fetch(`${API}/api/public/voice/live/state?id=${encodeURIComponent(state.liveId)}`);
      const data = await res.json().catch(() => ({}));
      if (!data || data.ok === false) return;
      if (data.handoff && !state.agentMode) await enterAgentMode();
      (data.injects || []).forEach((row) => { if (row && row.text) addCap("agent", row.text); });
    } catch { /* ignore */ }
  }

  async function enterAgentMode() {
    if (state.agentMode) return;
    state.agentMode = true;
    addCap("assistant", LIVE_HANDOFF);
    if (state.send) {
      try {
        state.send({
          type: "response.create",
          response: { instructions: `Say exactly this in Spanish, then stop: ${LIVE_HANDOFF}` },
        });
      } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 2800));
    }
    if (state.status !== "idle") teardown();
    setErr("Un agente de BMC está en el chat. Podés seguir escribiendo.");
  }

  function startLiveLoop() {
    if (!state.identified) return;
    ensureLiveId();
    pingLive();
    if (!state.livePing) state.livePing = setInterval(() => pingLive(), 10000);
    if (!state.livePoll) state.livePoll = setInterval(() => pollLiveState(), 2000);
  }

  function transcriptText() {
    const lines = [...caps.querySelectorAll(".bmc-line")].map((el) => el.textContent.trim()).filter(Boolean);
    const head = [
      `Chat Panelin (VW) · ${state.cliente} · ${state.telefono}`,
      "flete: no cotizado / a corroborar",
    ];
    return [...head, ...lines].join("\n").slice(0, 8000);
  }

  function scheduleLog() {
    if (!state.identified || !state.adminRow) return;
    if (state.logTimer) clearTimeout(state.logTimer);
    state.logTimer = setTimeout(() => {
      flushLog();
    }, 2500);
  }

  async function flushLog() {
    if (state.logTimer) {
      clearTimeout(state.logTimer);
      state.logTimer = null;
    }
    if (!state.identified || !state.adminRow) return;
    const transcript = transcriptText();
    if (!transcript) return;
    try {
      await fetch(`${API}/api/public/voice/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminRow: state.adminRow,
          telefono: state.telefono,
          cliente: state.cliente,
          transcript,
          pageUrl: window.location.href,
        }),
      });
    } catch { /* ignore */ }
  }

  function setErr(msg) {
    if (!msg) {
      errEl.hidden = true;
      errEl.textContent = "";
      return;
    }
    errEl.hidden = false;
    errEl.textContent = msg;
  }

  function isSafeHref(href) {
    const s = String(href || "").trim();
    if (!s) return false;
    if (s.startsWith("/") && !s.startsWith("//")) return true;
    try {
      const u = new URL(s, location.origin);
      if (u.protocol !== "http:" && u.protocol !== "https:") return false;
      const host = u.hostname.replace(/^www\./, "").toLowerCase();
      const here = location.hostname.replace(/^www\./, "").toLowerCase();
      if (host === here) return true;
      if (SHOP_HOSTS.some((h) => h.replace(/^www\./, "") === host)) return true;
      if (host === "wa.me" || host.endsWith("whatsapp.com")) return true;
      if (host.endsWith("run.app") || host.endsWith("googleapis.com") || host.endsWith("googleusercontent.com")) return true;
      return false;
    } catch {
      return false;
    }
  }

  function fillRichText(el, text) {
    el.textContent = "";
    const src = String(text || "");
    const re = /(https?:\/\/[^\s<>"'）)]+|\/(?:products|collections|pages|cart)[^\s<>"']*)/gi;
    let last = 0;
    let m;
    while ((m = re.exec(src))) {
      if (m.index > last) el.appendChild(document.createTextNode(src.slice(last, m.index)));
      let raw = m[0].replace(/[),.;]+$/g, "");
      if (isSafeHref(raw)) {
        const a = document.createElement("a");
        a.className = "bmc-link";
        a.href = raw.startsWith("/") ? raw : raw;
        const isShop = raw.startsWith("/") || SHOP_HOSTS.some((h) => raw.includes(h));
        a.textContent = isShop ? (raw.startsWith("http") ? new URL(raw).pathname : raw) : "abrir enlace";
        if (isShop) {
          a.addEventListener("click", (ev) => {
            ev.preventDefault();
            goTo(raw);
          });
        } else {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        }
        el.appendChild(a);
      } else {
        el.appendChild(document.createTextNode(raw));
      }
      last = m.index + m[0].length;
    }
    if (last < src.length) el.appendChild(document.createTextNode(src.slice(last)));
  }

  function addQuoteCard(url, code) {
    const href = String(url || "").trim();
    if (!href || !isSafeHref(href)) return;
    markChat();
    const fromUrl = String(href).match(/\/calc\/pdf\/([^/?#]+)/i);
    const id = String(code || fromUrl?.[1] || "").replace(/^BMC-?/i, "").replace(/-/g, "").slice(0, 12) || "nuevo";
    const label = `Presupuesto ${id}`;
    const a = document.createElement("a");
    a.className = "bmc-quote";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", `${label}. Abrir PDF`);
    const icon = document.createElement("span");
    icon.className = "bmc-quote-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>';
    const meta = document.createElement("span");
    const titleEl = document.createElement("span");
    titleEl.className = "bmc-quote-title";
    titleEl.textContent = label;
    const subEl = document.createElement("span");
    subEl.className = "bmc-quote-sub";
    subEl.textContent = "Tocá para abrir el PDF";
    meta.appendChild(titleEl);
    meta.appendChild(subEl);
    a.appendChild(icon);
    a.appendChild(meta);
    caps.appendChild(a);
    caps.scrollTop = caps.scrollHeight;
    remember("assistant", `${label} ${href}`);
    scheduleLog();
  }

  function isCannedGreeting(t) {
    return /Hola,\s*soy Panelin de BMC Uruguay/i.test(String(t || ""))
      || /^Hola,\s*soy Panelin/i.test(String(t || "").trim());
  }

  function addCap(role, text) {
    const t = String(text || "").trim();
    if (!t) return;
    if (role !== "user" && isCannedGreeting(t) && (root.classList.contains("has-chat") || (state.chatHistory || []).length)) return;
    const pdfOnly = t.match(/^PDF:\s*(\S+)/i);
    if (role !== "user" && pdfOnly) {
      addQuoteCard(pdfOnly[1]);
      return;
    }
    markChat();
    const last = caps.querySelector(".bmc-line:last-child");
    const prefix = role === "user" ? "Vos: " : role === "agent" ? "BMC · ventas: " : "";
    const next = prefix + t;
    if (last && last.textContent.trim() === next.trim()) return;
    if (last && role !== "user" && last.dataset.role === "assistant" && t.startsWith((last.textContent || "").replace(/^Panelin:\s*/, "").trim().slice(0, 40))) {
      fillRichText(last, next);
      last.dataset.live = "0";
      remember("assistant", t);
      scheduleLog();
      return;
    }
    const p = document.createElement("p");
    p.className = "bmc-line";
    p.dataset.role = role;
    fillRichText(p, next);
    caps.appendChild(p);
    caps.scrollTop = caps.scrollHeight;
    remember(role === "user" ? "user" : role === "agent" ? "agent" : "assistant", t);
    scheduleLog();
    if (role !== "user" && shopPicks.hidden) renderChoiceChips(parseReplyChoices(t));
  }

  function setUserLive(text) {
    const t = String(text || "").trim();
    if (!t) return;
    markChat();
    let last = caps.querySelector(".bmc-line[data-role='user'][data-live='1']");
    if (!last) {
      last = document.createElement("p");
      last.className = "bmc-line";
      last.dataset.role = "user";
      last.dataset.live = "1";
      caps.appendChild(last);
    }
    last.textContent = "Vos: " + t;
    caps.scrollTop = caps.scrollHeight;
  }

  function endUserLive(finalText) {
    const last = caps.querySelector(".bmc-line[data-role='user'][data-live='1']");
    const t = String(finalText || (last && String(last.textContent || "").replace(/^Vos:\s*/, "")) || "").trim();
    if (last) {
      last.dataset.live = "0";
      if (t) last.textContent = "Vos: " + t;
      remember("user", t);
      scheduleLog();
      return;
    }
    if (t) addCap("user", t);
  }

  function appendLive(delta) {
    const chunk = String(delta || "");
    if (!chunk) return;
    const live = caps.querySelector(".bmc-line[data-role='assistant'][data-live='1']");
    const soFar = `${(live && live.textContent) || ""}${chunk}`;
    if (isCannedGreeting(soFar) || isCannedGreeting(chunk)) {
      if (live) live.remove();
      return;
    }
    markChat();
    let last = caps.querySelector(".bmc-line[data-role='assistant'][data-live='1']");
    if (!last) {
      last = document.createElement("p");
      last.className = "bmc-line";
      last.dataset.role = "assistant";
      last.dataset.live = "1";
      last.textContent = "";
      caps.appendChild(last);
    }
    last.textContent += delta;
    caps.scrollTop = caps.scrollHeight;
  }

  function endLive() {
    const last = caps.querySelector(".bmc-line[data-live='1']");
    if (last) {
      last.dataset.live = "0";
      const t = last.textContent || "";
      fillRichText(last, t);
      remember("assistant", t);
      scheduleLog();
      if (shopPicks.hidden) renderChoiceChips(parseReplyChoices(t));
    }
  }

  function setStatus(s) {
    state.status = s;
    orb.dataset.state = s;
    go.dataset.state = s;
    const pipelineTalking =
      state.voiceMode === "pipeline" && (s === "listening" || s === "speaking");
    const talking = voiceLive() || pipelineTalking;
    stopBtn.hidden = true;
    go.setAttribute("aria-pressed", talking ? "true" : "false");
    go.setAttribute("aria-label", talking ? "Cortar voz" : "Hablar");
    const labels = {
      idle: "",
      thinking: "Pensando…",
      connecting: "Conectando voz…",
      active: "Te escucho",
      listening: "Te escucho",
      speaking: "Hablando…",
    };
    statusEl.textContent = labels[s] || "";
  }

  function normalizeChoiceOptions(raw) {
    const arr = Array.isArray(raw) ? raw : [];
    const out = [];
    const seen = new Set();
    for (const item of arr) {
      if (out.length >= 4) break;
      let label = "";
      let send = "";
      if (typeof item === "string") {
        label = item;
        send = item;
      } else if (item && typeof item === "object") {
        label = item.label || item.text || item.send || item.title || "";
        send = item.send || item.value || item.label || item.title || "";
      }
      label = String(label || "").replace(/\s+/g, " ").trim().slice(0, 32);
      send = String(send || label).replace(/\s+/g, " ").trim().slice(0, 120);
      if (label.length < 1 || send.length < 1) continue;
      const key = send.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label, send });
    }
    return out;
  }

  function parseReplyChoices(text) {
    const src = String(text || "");
    const t = src.replace(/\s+/g, " ").trim();
    if (!t || t.length > 400) return [];
    const listed = [];
    src.split(/\n/).forEach((line) => {
      const m = String(line || "").trim().match(/^(?:[-*•]|\d+[.)]|[A-Da-d][.)])\s+(.{2,40})$/);
      if (!m) return;
      const label = m[1].replace(/[?.!]+$/g, "").trim();
      if (label.length >= 2) listed.push({ label, send: label });
    });
    const fromList = normalizeChoiceOptions(listed);
    if (fromList.length >= 2) return fromList;
    const or = t.match(
      /([A-Za-zÁÉÍÓÚÑ0-9][A-Za-zÁÉÍÓÚÑ0-9 +/%.-]{0,28}[A-Za-zÁÉÍÓÚÑ0-9])\s+o\s+([A-Za-zÁÉÍÓÚÑ0-9][A-Za-zÁÉÍÓÚÑ0-9 +/%.-]{0,28}[A-Za-zÁÉÍÓÚÑ0-9])\??/i,
    );
    if (or && !/\b(día|días|hora|horas|minutos)\b/i.test(or[0])) {
      return normalizeChoiceOptions([or[1], or[2]]);
    }
    return [];
  }

  function renderChoiceChips(options) {
    shopPicks.innerHTML = "";
    const list = normalizeChoiceOptions(options);
    if (!list.length) {
      shopPicks.hidden = true;
      return false;
    }
    shopPicks.hidden = false;
    list.forEach((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bmc-pick";
      b.setAttribute("data-send", opt.send);
      b.textContent = opt.label;
      shopPicks.appendChild(b);
    });
    return true;
  }

  function renderPicks(products) {
    const list = (products || []).slice(0, 4).map((p) => ({
      label: String(p.title || p.handle || "").slice(0, 32),
      send: String(p.title || p.handle || "").slice(0, 120),
    }));
    renderChoiceChips(list);
  }

  if (LOCAL_HOST) {
    window.__bmcShowChoices = (opts) => renderChoiceChips(opts);
  }

  function setCartCount(n) {
    const c = Number(n) || 0;
    badge.textContent = String(c);
    badge.classList.toggle("show", c > 0);
  }

  async function refreshCartBadge() {
    try {
      const cart = await getCart();
      if (cart.ok) setCartCount(cart.item_count);
    } catch { /* shop only */ }
  }

  function persistResume() {
    try {
      sessionStorage.setItem(SS_RESUME, JSON.stringify({
        conversationId: state.conversationId,
        open: true,
        chatHistory: state.chatHistory.slice(-20),
      }));
    } catch { /* ignore */ }
  }

  function isCartPath(path) {
    const p = String(path || "").split("?")[0].replace(/\/+$/, "") || "/";
    return p === "/cart";
  }

  function openCartUi() {
    root.classList.remove("open");
    try {
      if (window.Shopify?.actions?.openCart) {
        Promise.resolve(window.Shopify.actions.openCart()).catch(() => {});
        return { ok: true, opened: "shopify-action" };
      }
    } catch { /* ignore */ }
    const drawer = document.querySelector("cart-drawer-component");
    if (drawer && typeof drawer.open === "function") {
      try {
        drawer.open();
        return { ok: true, opened: "drawer" };
      } catch { /* ignore */ }
    }
    persistResume();
    location.assign("/cart");
    return { ok: true, path: "/cart" };
  }

  async function loadCart() {
    let cart = { ok: false };
    try {
      cart = await getCart();
    } catch { /* ignore */ }
    if (cart.ok) setCartCount(cart.item_count);
    notifyThemeCart(cart.ok ? cart : { item_count: 0 });
    const opened = openCartUi();
    return { ok: true, ...opened, item_count: cart.item_count || 0 };
  }

  function goTo(pathOrUrl) {
    const path = shopUrl(pathOrUrl);
    if (!path) return { ok: false, error: "Link fuera de la tienda BMC" };
    if (isCartPath(path)) return loadCart();
    const destPath = String(path).split("?")[0].replace(/\/+$/, "") || "/";
    const here = (location.pathname || "/").replace(/\/+$/, "") || "/";
    if (destPath === here) return { ok: true, path, already: true };
    persistResume();
    location.assign(path);
    return { ok: true, path };
  }

  async function shareLink(url, title) {
    const path = shopUrl(url) || shopUrl(location.href);
    if (!path) return { ok: false, error: "Link fuera de la tienda BMC" };
    const abs = new URL(path, location.origin).href;
    try {
      if (navigator.share) {
        await navigator.share({ title: title || "BMC Uruguay", url: abs });
        return { ok: true, shared: true, url: abs };
      }
    } catch { /* fall through */ }
    try {
      await navigator.clipboard.writeText(abs);
      return { ok: true, copied: true, url: abs };
    } catch {
      return { ok: true, url: abs };
    }
  }

  async function runShopTool(name, args) {
    if (name === "shop_search") {
      const out = await shopSearch(args.query);
      if (out.ok) {
        renderPicks(out.products);
        const dest = out.collection || out.products?.[0]?.url;
        if (dest) out.navigated = goTo(dest);
      }
      return out;
    }
    if (name === "shop_product") {
      const out = await shopProduct(args.handle);
      if (out.ok && out.product) {
        renderPicks([out.product]);
        if (out.product.url) out.navigated = goTo(out.product.url);
      }
      return out;
    }
    if (name === "get_cart") {
      const out = await getCart();
      if (out.ok) setCartCount(out.item_count);
      return out;
    }
    if (name === "add_to_cart") {
      const out = await addToCart(args.variant_id, args.quantity);
      if (out.ok && out.cart) {
        setCartCount(out.cart.item_count);
        openCartUi();
      }
      return out;
    }
    if (name === "navigate" || name === "open_url") {
      return goTo(args.path || args.url);
    }
    if (name === "share_link") {
      return shareLink(args.url, args.title);
    }
    if (name === "present_choices") {
      const n = renderChoiceChips(args.options || args.choices || []);
      return { ok: true, shown: n };
    }
    if (name === "add_quote_to_cart") {
      return addQuoteLinesToCart(args.lines || args.cart_lines || [], {
        pdf_url: args.pdf_url,
        code: args.code,
      });
    }
    return { ok: false, error: "tool desconocida" };
  }

  async function ensureCaptureContext() {
    const AC = window.AudioContext || window.webkitAudioContext;
    let ctx = state.audioCtx;
    if (!ctx || ctx.state === "closed") {
      ctx = new AC();
      state.audioCtx = ctx;
    }
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
    return ctx;
  }

  function publishMic(ctx) {
    if (!isLocalEval()) return;
    const track = state.stream?.getAudioTracks()?.[0];
    const info = {
      frames: state.micFrames || 0,
      peak: Number((state.micPeak || 0).toFixed(4)),
      sampleRate: ctx?.sampleRate || 0,
      track: track?.label || "",
      ready: track?.readyState || "",
      muted: !!track?.muted,
    };
    window.__bmcMic = info;
    const vu = root.querySelector("#bmc-vu");
    if (vu) {
      vu.hidden = false;
      vu.textContent = `mic ${info.ready || "?"} · pico ${info.peak} · ${info.track || "sin track"}`;
    }
  }

  function onMicChunk(send, ctx, input) {
    if (!input || !input.length) return;
    let peak = 0;
    for (let i = 0; i < input.length; i++) {
      const a = Math.abs(input[i]);
      if (a > peak) peak = a;
    }
    state.micFrames = (state.micFrames || 0) + 1;
    state.micPeak = Math.max(state.micPeak || 0, peak);
    publishMic(ctx);
    if (!send || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    if (peak < PCM_SILENCE_PEAK) return;
    const resampled = resample(input, ctx.sampleRate || SAMPLE_RATE, SAMPLE_RATE);
    send({ type: "input_audio_buffer.append", audio: float32ToB64Pcm16(resampled) });
  }

  async function armMic(stream) {
    if (!state.micEl) {
      const el = document.createElement("audio");
      el.setAttribute("playsinline", "");
      el.muted = true;
      el.autoplay = true;
      el.srcObject = stream;
      el.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none";
      document.documentElement.appendChild(el);
      state.micEl = el;
    } else {
      state.micEl.srcObject = stream;
    }
    try { await state.micEl.play(); } catch { /* ignore */ }

    const AC = window.AudioContext || window.webkitAudioContext;
    let ctx = state.audioCtx;
    if (!ctx || ctx.state === "closed") {
      ctx = new AC();
      state.audioCtx = ctx;
    }
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
    try { state.processor?.disconnect(); } catch { /* ignore */ }
    state.micFrames = 0;
    state.micPeak = 0;
    const src = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    processor.onaudioprocess = (ev) => {
      onMicChunk(state.send, ctx, ev.inputBuffer.getChannelData(0));
    };
    src.connect(processor);
    processor.connect(gain);
    gain.connect(ctx.destination);
    state.processor = processor;
    publishMic(ctx);
    const track = stream.getAudioTracks()[0];
    if (track) {
      track.onended = () => {
        if (state.status === "idle") return;
        setErr("El mic se cortó. Tocá el botón azul para reconectar.");
      };
    }
    return ctx;
  }

  function teardown() {
    clearSilenceCut();
    if (state.maxTimer) {
      clearTimeout(state.maxTimer);
      state.maxTimer = null;
    }
    if (state.micTimer) {
      clearInterval(state.micTimer);
      state.micTimer = null;
    }
    state.micAnalyser = null;
    try { state.processor?.disconnect(); } catch { /* ignore */ }
    state.processor = null;
    try { state.audioCtx?.close(); } catch { /* ignore */ }
    state.audioCtx = null;
    if (state.micEl) {
      try { state.micEl.pause(); } catch { /* ignore */ }
      state.micEl.srcObject = null;
      state.micEl.remove();
      state.micEl = null;
    }
    if (state.stream) {
      state.stream.getTracks().forEach((t) => t.stop());
      state.stream = null;
    }
    state.send = null;
    if (state.ws) {
      const ws = state.ws;
      state.ws = null;
      try { ws.close(); } catch { /* ignore */ }
    }
    if (!root.classList.contains("has-chat")) state.greeted = false;
    setStatus("idle");
  }

  function playPcm(b64) {
    const float32 = b64Pcm16ToFloat32(b64);
    if (!float32.length) return;
    let ctx = state.playCtx;
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      state.playCtx = ctx;
      state.playTime = 0;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const buf = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    buf.copyToChannel(float32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.02, state.playTime || now);
    src.start(startAt);
    state.playTime = startAt + buf.duration;
  }

  function waitPlayback() {
    const ctx = state.playCtx;
    if (!ctx) return Promise.resolve();
    const remain = (state.playTime || 0) - ctx.currentTime;
    if (remain <= 0) return Promise.resolve();
    return new Promise((r) => setTimeout(r, Math.min(8000, remain * 1000 + 80)));
  }

  async function relayTool(name, args) {
    if (SHOP_TOOLS[name]) {
      const out = await runShopTool(name, args || {});
      return JSON.stringify(out);
    }
    const res = await fetch(`${API}/api/public/voice/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: { type: name, payload: args || {} },
        pageUrl: window.location.href,
        lead: state.adminRow ? { adminRow: state.adminRow, cliente: state.cliente, telefono: state.telefono } : undefined,
        shopperName: state.cliente || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const resultStr = typeof data.result === "string" ? data.result : JSON.stringify(data.result || data);
    if (name === "handoff_whatsapp") {
      try {
        const parsed = JSON.parse(resultStr || "{}");
        if (parsed.url) state.lastWa = parsed.url;
      } catch { /* ignore */ }
    }
    if (name === "generar_pdf") {
      try {
        const parsed = JSON.parse(resultStr || "{}");
        const url = parsed.pdf_url || parsed.pdf_file_url || parsed.gcs_url;
        const code = parsed.code || parsed.quote_code || (parsed.pdf_id ? String(parsed.pdf_id).replace(/-/g, "").slice(0, 8) : "");
        if (url) addQuoteCard(url, code);
        if (Array.isArray(parsed.cart_lines) && parsed.cart_lines.length) {
          await addQuoteLinesToCart(parsed.cart_lines, { pdf_url: "", code });
        }
      } catch { /* ignore */ }
    }
    return resultStr;
  }

  async function onWsEvent(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const type = msg.type;
    logVoiceEvent(msg);
    if (type === "conversation.created" && msg.conversation?.id) {
      state.conversationId = msg.conversation.id;
    }
    if (type === "session.updated") {
      const alreadyTalking = root.classList.contains("has-chat") || (state.chatHistory || []).length > 0;
      if (alreadyTalking) {
        state.greeted = true;
      } else if (!state.greeted) {
        state.greeted = true;
        state.send?.({ type: "response.create" });
      }
      touchVoice();
    }
    if (type === "response.output_audio.delta" || type === "response.audio.delta") {
      setStatus("speaking");
      touchVoice();
      if (msg.delta) playPcm(msg.delta);
    }
    if (type === "response.done" || type === "response.output_audio.done") {
      endLive();
      if (state.status !== "idle") setStatus("active");
      touchVoice();
    }
    if (type === "input_audio_buffer.speech_started") {
      setStatus("listening");
      touchVoice();
    }
    if (type === "input_audio_buffer.speech_stopped" && state.status === "listening") {
      setStatus("active");
      touchVoice();
    }
    if (type === "input_audio_buffer.timeout_triggered") {
      const frames = state.micFrames || 0;
      const peak = state.micPeak || 0;
      const ctxState = state.audioCtx?.state || "none";
      const label = (state.stream && state.stream.getAudioTracks()[0]?.label) || "sin-track";
      let reason = "Corté el mic por silencio. Tocá Hablar para seguir.";
      if (isLocalEval()) {
        if (frames < 8) {
          reason = `El mic no está enviando audio (${ctxState} · ${label}). Tocá el mic y hablá de nuevo.`;
        } else if (peak < PCM_SILENCE_PEAK) {
          reason = `Chrome abre ${label} pero el audio llega en silencio (pico ${peak.toFixed(3)}). Cerrá y reabrí el chat; si sigue, Ajustes → Sonido → Entrada (volumen) y Privacidad → Micrófono → Google Chrome.`;
        }
      }
      cutMicForSilence(reason);
    }
    if (
      type === "response.output_audio_transcript.delta"
      || type === "response.audio_transcript.delta"
      || type === "response.output_text.delta"
    ) {
      if (msg.delta) appendLive(msg.delta);
    }
    if (type === "response.output_audio_transcript.done" || type === "response.audio_transcript.done") {
      const live = caps.querySelector(".bmc-line[data-role='assistant'][data-live='1']");
      if (!live && msg.transcript) addCap("assistant", msg.transcript);
      else endLive();
    }
    if (type === "conversation.item.input_audio_transcription.updated") {
      setUserLive(msg.transcript || "");
      touchVoice();
    }
    if (type === "conversation.item.input_audio_transcription.completed") {
      const spoken = msg.transcript || "";
      if (msg.status === "in_progress") setUserLive(spoken);
      else endUserLive(spoken);
      touchVoice();
    }
    if (type === "error") {
      const em = msg.error?.message || msg.message || "Error de voz";
      if (/used all available credits|spending limit|insufficient credits/i.test(em)) {
        teardown();
        setErr("Voz realtime sin crédito. Seguí por texto o modo voz barata — el chat no se cierra.");
        return;
      }
      setErr(em);
    }
    if (type === "response.function_call_arguments.done") {
      const callId = msg.call_id;
      const fnName = msg.name;
      let args = {};
      try {
        args = JSON.parse(msg.arguments || "{}");
      } catch {
        args = {};
      }
      state.pendingTools += 1;
      touchVoice();
      let output = JSON.stringify({ ok: false, error: "tool failed" });
      try {
        output = await relayTool(fnName, args);
      } catch (err) {
        output = JSON.stringify({ ok: false, error: err?.message || "tool failed" });
      }
      state.send?.({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output },
      });
      state.pendingTools -= 1;
      if (state.pendingTools <= 0) {
        await waitPlayback();
        // Skip follow-up only when navigate/open_url actually left the page.
        let leftPage = false;
        if (fnName === "navigate" || fnName === "open_url") {
          try {
            leftPage = JSON.parse(output)?.ok === true;
          } catch { /* ignore */ }
        }
        if (!leftPage) {
          state.send?.({ type: "response.create" });
        }
      }
    }
  }

  async function startCall() {
    if (state.voiceMode !== "realtime") return;
    if (window.__bmcMicTestActive) {
      setErr("Pará primero la prueba de mic (botón azul del recuadro negro).");
      return;
    }
    if (!state.identified) return;
    if (state.status !== "idle") return;
    if (state.voiceDenied) return;
    setErr("");
    setStatus("connecting");
    root.classList.add("open");

    let resumeId = state.conversationId;
    if (isLocalEval()) {
      resumeId = null;
      try { sessionStorage.removeItem(SS_RESUME); } catch { /* ignore */ }
    } else {
      try {
        const saved = JSON.parse(sessionStorage.getItem(SS_RESUME) || "null");
        if (saved && saved.conversationId) resumeId = saved.conversationId;
      } catch { /* ignore */ }
    }

    let stream;
    try {
      const micP = openMic();
      const sessP = fetch(`${API}/api/public/voice/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageUrl: window.location.href, shopperName: state.cliente }),
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (j.bubble === false || j.code === "credits") {
          const err = new Error("credits");
          err.code = "credits";
          throw err;
        }
        if (!r.ok || j.ok === false) throw new Error(j.error || "No se pudo iniciar la sesión");
        return j;
      });
      const [mic, sess] = await Promise.all([micP, sessP]);
      stream = mic;
      state.stream = stream;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      await armMic(stream);
      const token = sess.client_secret?.value;
      if (!token) throw new Error("Sin token de voz");
      const wsUrl = grokWsUrl(sess.realtime_base, sess.model, resumeId);
      const ws = new WebSocket(wsUrl, grokProtocols(token));
      state.ws = ws;
      await new Promise((resolve, reject) => {
        const fail = (e) => reject(e instanceof Error ? e : new Error(String(e)));
        ws.onerror = () => fail(new Error("No se pudo conectar con la voz"));
        ws.onclose = () => {
          if (state.ws !== ws) return;
          if (state.status !== "idle") teardown();
        };
        ws.onmessage = (ev) => {
          if (typeof ev.data === "string") onWsEvent(ev.data);
        };
        ws.onopen = () => {
          const send = (payload) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(typeof payload === "string" ? payload : JSON.stringify(payload));
            }
          };
          state.send = send;
          const boot = sess.session_bootstrap || {};
          if (resumeId) state.greeted = true;
          send(buildSessionUpdate(boot));
          setStatus("active");
          startLiveLoop();
          touchVoice();
          state.maxTimer = setTimeout(() => {
            addCap("assistant", "Llegamos al tope de esta llamada. Si querés, abrimos WhatsApp.");
            teardown();
          }, sess.max_session_ms || MAX_MS);
          resolve();
        };
      });
    } catch (err) {
      if (err?.code === "credits") {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        teardown();
        setErr("Voz realtime sin crédito. Seguí por texto o modo voz barata — el chat no se cierra.");
        return;
      }
      if (stream) stream.getTracks().forEach((t) => t.stop());
      teardown();
      const denied = /NotAllowedError|PermissionDenied/i.test(err?.name || "") || /permission/i.test(err?.message || "");
      if (denied) state.voiceDenied = true;
      setErr(
        denied
          ? "Activá el mic para hablar. Mientras, escribí abajo — no se pierde el chat."
          : err?.message || "No se pudo iniciar la voz. Podés escribir.",
      );
    }
  }

  function sendVoiceText(text) {
    addCap("user", text);
    touchVoice();
    if (!state.send) return false;
    state.send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    state.send({ type: "response.create" });
    return true;
  }

  async function postChat(body) {
    const res = await fetch(`${API}/api/public/voice/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (data.bubble === false || data.code === "credits") {
      const err = new Error("credits");
      err.code = "credits";
      throw err;
    }
    if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo responder");
    return data;
  }

  async function sendText(raw) {
    const text = String(raw || "").trim();
    if (!state.identified) return;
    if (!text || state.chatBusy) return;
    shopPicks.hidden = true;
    shopPicks.innerHTML = "";
    setErr("");
    root.classList.add("open");
    if (state.agentMode) {
      addCap("user", text);
      return;
    }
    if (voiceLive() && state.send) {
      sendVoiceText(text);
      return;
    }
    state.chatBusy = true;
    addCap("user", text);
    const prior = state.chatHistory.slice(0, -1);
    setStatus("thinking");
    let body = {
      message: text,
      history: prior,
      pageUrl: window.location.href,
      shopperName: state.cliente,
      cliente: state.cliente,
      telefono: state.telefono,
      adminRow: state.adminRow,
    };
    let lastSpeak = "";
    try {
      for (let hop = 0; hop < 4; hop++) {
        const data = await postChat(body);
        if (data.history) state.chatHistory = data.history;
        if (data.text) {
          addCap("assistant", data.text);
          lastSpeak = data.text;
        }
        const actions = data.client_actions || [];
        if (!actions.length) break;
        const tool_results = [];
        for (const a of actions) {
          const result = await relayTool(a.name, a.payload || {});
          tool_results.push({
            id: a.id,
            tool_call_id: a.id,
            name: a.name,
            result,
          });
        }
        body = {
          tool_results,
          history: state.chatHistory,
          pageUrl: window.location.href,
          shopperName: state.cliente,
          cliente: state.cliente,
          telefono: state.telefono,
          adminRow: state.adminRow,
        };
      }
      if (state.voiceMode === "pipeline" && lastSpeak && state.lastInputWasVoice) {
        speakPipeline(lastSpeak);
      }
    } catch (err) {
      if (err?.code === "credits") {
        setErr("Sin crédito de voz. El chat sigue: escribí o usá dictado (voz barata).");
        return;
      }
      setErr(err?.message || "No se pudo enviar.");
    } finally {
      state.chatBusy = false;
      if (state.status === "thinking") setStatus("idle");
      flushLog();
    }
  }

  function openPanel() {
    root.classList.add("open");
  }

  root.querySelector(".bmc-panel").addEventListener("click", (e) => {
    e.stopPropagation();
  });

  function closePanel() {
    root.classList.remove("open");
    flushLog();
    stopPipelineListen();
    stopPipelineSpeak();
    if (voiceLive()) teardown();
    if (!state.agentMode) {
      pingLive("ended");
      stopLiveLoop();
    }
  }

  root.addEventListener("pointerdown", () => {
    ensureCaptureContext();
    if (state.playCtx?.state === "suspended") state.playCtx.resume().catch(() => {});
  });
  orb.addEventListener("click", (e) => {
    e.stopPropagation();
    if (root.classList.contains("open")) closePanel();
    else openPanel();
  });
  ask.addEventListener("click", () => {
    if (!root.classList.contains("open")) openPanel();
  });
  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closePanel();
  });
  go.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!state.identified) return;
    if (state.agentMode) return;
    if (state.voiceMode === "text") return;
    if (state.voiceMode === "pipeline") {
      togglePipelineListen();
      return;
    }
    if (voiceLive()) teardown();
    else startCall();
  });
  const form = root.querySelector("#bmc-form");
  const input = root.querySelector("#bmc-in");
  const idForm = root.querySelector("#bmc-id");
  const nameIn = root.querySelector("#bmc-name");
  const phoneIn = root.querySelector("#bmc-phone");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = "";
    state.lastInputWasVoice = false;
    sendText(v);
  });
  input.addEventListener("input", () => {
    if (voiceLive()) touchVoice();
  });
  idForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cliente = String(nameIn.value || "").trim();
    const telefono = String(phoneIn.value || "").trim();
    if (cliente.length < 2 || telefono.replace(/[^0-9]/g, "").length < 8) {
      setErr("Necesito tu nombre y un celular para chatear.");
      return;
    }
    setErr("");
    const goBtn = idForm.querySelector(".bmc-id-go");
    if (goBtn) goBtn.disabled = true;
    try {
      const res = await fetch(`${API}/api/public/voice/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente,
          telefono,
          consent: true,
          pageUrl: window.location.href,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo guardar en Admin.");
      applyIdentified({
        cliente: data.cliente || cliente,
        telefono: data.telefono || telefono,
        adminRow: data.adminRow,
      });
    } catch (err) {
      setErr(err?.message || "No se pudo iniciar el chat.");
    } finally {
      if (goBtn) goBtn.disabled = false;
    }
  });
  picks.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-send]");
    if (!btn) return;
    sendText(btn.getAttribute("data-send"));
  });
  shopPicks.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-send]");
    if (!btn) return;
    e.preventDefault();
    const send = btn.getAttribute("data-send");
    shopPicks.hidden = true;
    shopPicks.innerHTML = "";
    state.lastInputWasVoice = false;
    sendText(send);
  });
  stopBtn.addEventListener("click", () => {
    teardown();
    addCap("assistant", "Listo, cortamos.");
  });
  waBtn.addEventListener("click", () => {
    window.open(state.lastWa, "_blank", "noopener");
  });
  cartBtn.addEventListener("click", () => {
    loadCart();
  });

  refreshCartBadge();

  function restoreSession() {
    try {
      const ident = JSON.parse(sessionStorage.getItem(SS_IDENTITY) || "null");
      if (ident && ident.cliente && ident.telefono) applyIdentified(ident);
    } catch { /* ignore */ }
    try {
      const saved = JSON.parse(sessionStorage.getItem(SS_RESUME) || "null");
      if (saved && saved.open) {
        sessionStorage.removeItem(SS_RESUME);
        root.classList.add("open");
        if (Array.isArray(saved.chatHistory) && saved.chatHistory.length) {
          state.chatHistory = saved.chatHistory;
          markChat();
          saved.chatHistory.forEach((m) => {
            if (m.role !== "user" && m.role !== "assistant") return;
            const p = document.createElement("p");
            p.className = "bmc-line";
            p.dataset.role = m.role;
            const body = m.role === "user" ? `Vos: ${m.content || ""}` : String(m.content || "");
            fillRichText(p, body);
            caps.appendChild(p);
          });
        }
        if (saved.conversationId && state.voiceMode === "realtime") {
          state.conversationId = saved.conversationId;
          startCall();
        }
      }
    } catch { /* ignore */ }
  }

  window.addEventListener("pagehide", () => {
    flushLog();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushLog();
  });

  (async function boot() {
    try {
      const r = await fetch(`${API}/api/public/voice/status`);
      const j = await r.json().catch(() => ({}));
      if (j.bubble === false && !LOCAL_HOST) return;
    } catch { /* fail open */ }
    attachBubble();
    restoreSession();
    try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch { /* ignore */ }
  })();
})();
