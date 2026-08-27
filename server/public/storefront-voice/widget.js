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
  const SS_RESUME = "bmc_panelin_resume";
  const SHOP_HOSTS = ["bmcuruguay.com.uy", "www.bmcuruguay.com.uy", "xj4rir-qz.myshopify.com"];
  const GREETING = "Hola, soy Panelin de BMC Uruguay. ¿Buscás un techo, una pared, o una cámara?";
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
      voice: boot.voice || "ara",
      tool_choice: boot.tool_choice || "auto",
      turn_detection: boot.turn_detection || {
        type: "server_vad",
        threshold: 0.75,
        prefix_padding_ms: 333,
        silence_duration_ms: 900,
        idle_timeout_ms: 20000,
      },
      audio: {
        input: {
          format: { type: "audio/pcm", rate: SAMPLE_RATE },
          transcription: {
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
    return { ok: true, products: products.map(summarizeProduct) };
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

  async function addToCart(variantId, quantity) {
    const id = Number(variantId);
    const qty = Math.max(1, Number(quantity) || 1);
    if (!id) return { ok: false, error: "Falta variant_id" };
    const r = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ items: [{ id, quantity: qty }] }),
    });
    const raw = await r.text();
    let data = {};
    try { data = JSON.parse(raw); } catch { /* ignore */ }
    if (!r.ok) {
      return { ok: false, error: data.description || data.message || "No se pudo agregar" };
    }
    const cart = await getCart();
    return { ok: true, added: data.title || data.items?.[0]?.title || "ítem", cart };
  }

  const css = `
#bmc-paneli-voice{all:initial;display:block;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;position:fixed;z-index:2147483000;right:92px;bottom:calc(18px + env(safe-area-inset-bottom,0px));color:#141311}
@media(max-width:640px){#bmc-paneli-voice{right:14px;bottom:calc(88px + env(safe-area-inset-bottom,0px))}}
#bmc-paneli-voice *{box-sizing:border-box}
#bmc-paneli-voice .bmc-orb{width:56px;height:56px;border:0;border-radius:16px;background:linear-gradient(160deg,#2A2A28 0%,#141311 70%);color:#F3EDE3;cursor:pointer;display:grid;place-items:center;box-shadow:0 10px 28px rgba(20,19,17,.35);position:relative}
#bmc-paneli-voice .bmc-orb:focus-visible{outline:2px solid #C45C26;outline-offset:3px}
#bmc-paneli-voice .bmc-orb[data-state="listening"]{box-shadow:0 0 0 5px rgba(196,92,38,.4)}
#bmc-paneli-voice .bmc-orb[data-state="speaking"]{box-shadow:0 0 0 5px rgba(200,196,184,.45)}
#bmc-paneli-voice .bmc-rib{width:26px;height:20px}
#bmc-paneli-voice .bmc-badge{position:absolute;top:-6px;left:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#C45C26;color:#fff;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center}
#bmc-paneli-voice .bmc-badge.show{display:flex}
#bmc-paneli-voice .bmc-panel{display:none;position:absolute;right:0;bottom:66px;width:min(340px,calc(100vw - 28px));background:#F7F1E6;border:1px solid #D4CFC4;border-radius:18px;padding:12px 12px 10px;box-shadow:0 16px 36px rgba(20,19,17,.2)}
#bmc-paneli-voice.open .bmc-panel{display:block}
#bmc-paneli-voice .bmc-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 0 6px}
#bmc-paneli-voice .bmc-kicker{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#C45C26;margin:0}
#bmc-paneli-voice .bmc-status{font-size:11px;color:#6b6358;margin:0}
#bmc-paneli-voice .bmc-title{margin:0 0 8px;font-size:17px;font-weight:650;color:#141311}
#bmc-paneli-voice .bmc-caps{min-height:64px;max-height:120px;overflow:auto;font-size:13px;line-height:1.45;color:#2A2A28;background:#fff;border-radius:12px;padding:10px 12px;margin:0 0 8px;scrollbar-width:thin}
#bmc-paneli-voice .bmc-line{margin:0 0 8px}
#bmc-paneli-voice .bmc-line:last-child{margin:0}
#bmc-paneli-voice .bmc-line[data-role="user"]{color:#6b6358}
#bmc-paneli-voice .bmc-picks{display:flex;flex-direction:column;gap:6px;margin:0 0 8px}
#bmc-paneli-voice .bmc-pick{display:block;width:100%;text-align:left;border:1px solid #D4CFC4;background:#fff;border-radius:10px;padding:8px 10px;font:inherit;font-size:12px;cursor:pointer;color:#141311}
#bmc-paneli-voice .bmc-pick:hover{border-color:#C45C26}
#bmc-paneli-voice .bmc-row{display:flex;gap:6px}
#bmc-paneli-voice .bmc-btn{flex:1;min-height:42px;border:0;border-radius:10px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
#bmc-paneli-voice .bmc-go{background:#C45C26;color:#fff}
#bmc-paneli-voice .bmc-stop{background:#141311;color:#F3EDE3}
#bmc-paneli-voice .bmc-cart{background:#fff;border:1px solid #D4CFC4;color:#141311}
#bmc-paneli-voice .bmc-wa{background:transparent;border:1px solid #D4CFC4;color:#141311}
#bmc-paneli-voice .bmc-err{color:#8b2e12;font-size:12px;margin:6px 0 0}
#bmc-paneli-voice .bmc-hint{margin:6px 0 0;font-size:11px;color:#6b6358}
@media(prefers-reduced-motion:reduce){#bmc-paneli-voice .bmc-orb{box-shadow:0 10px 28px rgba(20,19,17,.35)!important}}
`;

  const root = document.createElement("div");
  root.id = "bmc-paneli-voice";
  root.innerHTML = `
    <style>${css}</style>
    <div class="bmc-panel" role="dialog" aria-label="Hablar con Panelin">
      <div class="bmc-head">
        <p class="bmc-kicker">BMC Uruguay</p>
        <p class="bmc-status" id="bmc-status">Listo</p>
      </div>
      <p class="bmc-title">Panelin</p>
      <div class="bmc-caps" id="bmc-caps" aria-live="polite"></div>
      <div class="bmc-picks" id="bmc-picks" hidden></div>
      <div class="bmc-row">
        <button type="button" class="bmc-btn bmc-go" id="bmc-go">Hablar</button>
        <button type="button" class="bmc-btn bmc-stop" id="bmc-stop" hidden>Cortar</button>
        <button type="button" class="bmc-btn bmc-cart" id="bmc-cart">Carrito</button>
        <button type="button" class="bmc-btn bmc-wa" id="bmc-wa">WhatsApp</button>
      </div>
      <p class="bmc-hint">Puedo llevarte a un producto, armar el carrito o cotizar un techo.</p>
      <p class="bmc-err" id="bmc-err" hidden></p>
    </div>
    <button type="button" class="bmc-orb" id="bmc-orb" aria-label="Hablar con Panelin" data-state="idle">
      <span class="bmc-badge" id="bmc-badge">0</span>
      <svg class="bmc-rib" viewBox="0 0 28 22" aria-hidden="true">
        <path fill="currentColor" d="M1 16 L6 4 H10 L15 16 H19 L24 4 H27 V18 H1 Z"/>
      </svg>
    </button>
  `;
  document.body.appendChild(root);

  const orb = root.querySelector("#bmc-orb");
  const go = root.querySelector("#bmc-go");
  const stopBtn = root.querySelector("#bmc-stop");
  const waBtn = root.querySelector("#bmc-wa");
  const cartBtn = root.querySelector("#bmc-cart");
  const caps = root.querySelector("#bmc-caps");
  const picks = root.querySelector("#bmc-picks");
  const errEl = root.querySelector("#bmc-err");
  const statusEl = root.querySelector("#bmc-status");
  const badge = root.querySelector("#bmc-badge");

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
  };

  function setErr(msg) {
    if (!msg) {
      errEl.hidden = true;
      errEl.textContent = "";
      return;
    }
    errEl.hidden = false;
    errEl.textContent = msg;
  }

  function addCap(role, text) {
    const t = String(text || "").trim();
    if (!t) return;
    const last = caps.querySelector(".bmc-line:last-child");
    const prefix = role === "user" ? "Vos: " : "";
    const next = prefix + t;
    if (last && last.textContent.trim() === next.trim()) return;
    if (last && role !== "user" && last.dataset.role === "assistant" && t.startsWith((last.textContent || "").replace(/^Panelin:\s*/, "").trim().slice(0, 40))) {
      last.textContent = t;
      last.dataset.live = "0";
      return;
    }
    const p = document.createElement("p");
    p.className = "bmc-line";
    p.dataset.role = role;
    p.textContent = next;
    caps.appendChild(p);
    caps.scrollTop = caps.scrollHeight;
  }

  function appendLive(delta) {
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
    if (last) last.dataset.live = "0";
  }

  function setStatus(s) {
    state.status = s;
    orb.dataset.state = s;
    const talking = s === "connecting" || s === "active" || s === "listening" || s === "speaking";
    go.hidden = talking;
    stopBtn.hidden = !talking;
    go.textContent = s === "connecting" ? "Conectando…" : "Hablar";
    const labels = {
      idle: "Listo",
      connecting: "Conectando",
      active: "En llamada",
      listening: "Te escucho",
      speaking: "Hablando",
    };
    statusEl.textContent = labels[s] || s;
  }

  function renderPicks(products) {
    picks.innerHTML = "";
    const list = (products || []).slice(0, 3);
    if (!list.length) {
      picks.hidden = true;
      return;
    }
    picks.hidden = false;
    list.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bmc-pick";
      b.textContent = p.title;
      b.addEventListener("click", () => goTo(p.url));
      picks.appendChild(b);
    });
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

  function goTo(pathOrUrl) {
    const path = shopUrl(pathOrUrl);
    if (!path) return { ok: false, error: "Link fuera de la tienda BMC" };
    try {
      sessionStorage.setItem(SS_RESUME, JSON.stringify({
        conversationId: state.conversationId,
        open: true,
      }));
    } catch { /* ignore */ }
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
      if (out.ok) renderPicks(out.products);
      return out;
    }
    if (name === "shop_product") {
      const out = await shopProduct(args.handle);
      if (out.ok && out.product) renderPicks([out.product]);
      return out;
    }
    if (name === "get_cart") {
      const out = await getCart();
      if (out.ok) setCartCount(out.item_count);
      return out;
    }
    if (name === "add_to_cart") {
      const out = await addToCart(args.variant_id, args.quantity);
      if (out.ok && out.cart) setCartCount(out.cart.item_count);
      return out;
    }
    if (name === "navigate" || name === "open_url") {
      return goTo(args.path || args.url);
    }
    if (name === "share_link") {
      return shareLink(args.url, args.title);
    }
    return { ok: false, error: "tool desconocida" };
  }

  function teardown() {
    if (state.maxTimer) {
      clearTimeout(state.maxTimer);
      state.maxTimer = null;
    }
    try { state.processor?.disconnect(); } catch { /* ignore */ }
    state.processor = null;
    try { state.audioCtx?.close(); } catch { /* ignore */ }
    state.audioCtx = null;
    if (state.stream) {
      state.stream.getTracks().forEach((t) => t.stop());
      state.stream = null;
    }
    state.send = null;
    if (state.ws) {
      try { state.ws.close(); } catch { /* ignore */ }
      state.ws = null;
    }
    state.greeted = false;
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
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (name === "handoff_whatsapp") {
      try {
        const parsed = JSON.parse(data.result || "{}");
        if (parsed.url) state.lastWa = parsed.url;
      } catch { /* ignore */ }
    }
    return typeof data.result === "string" ? data.result : JSON.stringify(data.result || data);
  }

  async function onWsEvent(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const type = msg.type;
    if (type === "conversation.created" && msg.conversation?.id) {
      state.conversationId = msg.conversation.id;
    }
    if (type === "session.updated" && !state.greeted) {
      state.greeted = true;
      state.send?.({
        type: "conversation.item.create",
        item: {
          type: "force_message",
          role: "assistant",
          interruptible: true,
          content: [{ type: "output_text", text: GREETING }],
        },
      });
    }
    if (type === "response.output_audio.delta" || type === "response.audio.delta") {
      setStatus("speaking");
      if (msg.delta) playPcm(msg.delta);
    }
    if (type === "response.done" || type === "response.output_audio.done") {
      endLive();
      if (state.status !== "idle") setStatus("active");
    }
    if (type === "input_audio_buffer.speech_started") setStatus("listening");
    if (type === "input_audio_buffer.speech_stopped" && state.status === "listening") setStatus("active");
    if (type === "response.output_audio_transcript.delta" || type === "response.audio_transcript.delta") {
      if (msg.delta) appendLive(msg.delta);
    }
    if (type === "conversation.item.input_audio_transcription.completed") {
      addCap("user", msg.transcript || "");
    }
    if (type === "error") {
      setErr(msg.error?.message || msg.message || "Error de voz");
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
        if (fnName !== "navigate" && fnName !== "open_url") {
          state.send?.({ type: "response.create" });
        }
      }
    }
  }

  async function startCall() {
    if (state.status !== "idle") return;
    setErr("");
    setStatus("connecting");
    caps.innerHTML = "";
    picks.hidden = true;
    root.classList.add("open");

    let resumeId = state.conversationId;
    try {
      const saved = JSON.parse(sessionStorage.getItem(SS_RESUME) || "null");
      if (saved && saved.conversationId) resumeId = saved.conversationId;
    } catch { /* ignore */ }

    let stream;
    try {
      const micP = navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      const sessP = fetch(`${API}/api/public/voice/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageUrl: window.location.href }),
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.error || "No se pudo iniciar la sesión");
        return j;
      });
      const [mic, sess] = await Promise.all([micP, sessP]);
      stream = mic;
      state.stream = stream;
      const token = sess.client_secret?.value;
      if (!token) throw new Error("Sin token de voz");
      const wsUrl = grokWsUrl(sess.realtime_base, sess.model, resumeId);
      const ws = new WebSocket(wsUrl, grokProtocols(token));
      state.ws = ws;
      await new Promise((resolve, reject) => {
        const fail = (e) => reject(e instanceof Error ? e : new Error(String(e)));
        ws.onerror = () => fail(new Error("No se pudo conectar con la voz"));
        ws.onclose = () => {
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
          const ctx = new AudioContext();
          state.audioCtx = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const processor = ctx.createScriptProcessor(4096, 1, 1);
          state.processor = processor;
          processor.onaudioprocess = (ev) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const input = ev.inputBuffer.getChannelData(0);
            const resampled = resample(input, ctx.sampleRate, SAMPLE_RATE);
            send({ type: "input_audio_buffer.append", audio: float32ToB64Pcm16(resampled) });
          };
          const mute = ctx.createGain();
          mute.gain.value = 0;
          src.connect(processor);
          processor.connect(mute);
          mute.connect(ctx.destination);
          setStatus("active");
          state.maxTimer = setTimeout(() => {
            addCap("assistant", "Llegamos al tope de esta llamada. Si querés, abrimos WhatsApp.");
            teardown();
          }, sess.max_session_ms || MAX_MS);
          resolve();
        };
      });
    } catch (err) {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      teardown();
      const denied = /NotAllowedError|PermissionDenied/i.test(err?.name || "") || /permission/i.test(err?.message || "");
      setErr(
        denied
          ? "Necesitamos el micrófono. Si no, usá WhatsApp."
          : err?.message || "No se pudo iniciar la voz.",
      );
    }
  }

  orb.addEventListener("click", () => {
    root.classList.toggle("open");
  });
  go.addEventListener("click", startCall);
  stopBtn.addEventListener("click", () => {
    teardown();
    addCap("assistant", "Listo, cortamos.");
  });
  waBtn.addEventListener("click", () => {
    window.open(state.lastWa, "_blank", "noopener");
  });
  cartBtn.addEventListener("click", () => {
    goTo("/cart");
  });

  refreshCartBadge();
  try {
    const saved = JSON.parse(sessionStorage.getItem(SS_RESUME) || "null");
    if (saved && saved.open) {
      sessionStorage.removeItem(SS_RESUME);
      root.classList.add("open");
      if (saved.conversationId) state.conversationId = saved.conversationId;
      startCall();
    }
  } catch { /* ignore */ }
})();
