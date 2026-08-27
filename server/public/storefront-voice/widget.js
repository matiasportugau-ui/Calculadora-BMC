/**
 * BMC Panelin storefront voice widget.
 * Loads on bmcuruguay.com.uy. Talks to /api/public/voice/* on Cloud Run.
 */
(function () {
  "use strict";
  if (window.__bmcPanelinVoice) return;
  window.__bmcPanelinVoice = true;

  const SAMPLE_RATE = 24000;
  const SECRET_PREFIX = "xai-client-secret.";
  const MAX_MS = 8 * 60 * 1000;

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
    } catch {
      /* ignore */
    }
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

  function grokWsUrl(realtimeBase, model) {
    let base = String(realtimeBase || "https://api.x.ai/v1/realtime").replace(/\/+$/, "");
    if (/^https:/i.test(base)) base = base.replace(/^https:/i, "wss:");
    else if (/^http:/i.test(base)) base = base.replace(/^http:/i, "ws:");
    const m = String(model || "grok-voice-latest");
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}model=${encodeURIComponent(m)}`;
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
    };
    if (boot.replace) session.replace = boot.replace;
    if (Array.isArray(boot.tools) && boot.tools.length) session.tools = boot.tools;
    if (boot.reasoning) session.reasoning = boot.reasoning;
    if (boot.resumption) session.resumption = boot.resumption;
    return { type: "session.update", session };
  }

  const css = `
#bmc-paneli-voice{all:initial;display:block;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;position:fixed;z-index:2147483000;right:96px;bottom:calc(20px + env(safe-area-inset-bottom,0px));color:#141311}
@media(max-width:640px){#bmc-paneli-voice{right:16px;bottom:calc(92px + env(safe-area-inset-bottom,0px))}}
#bmc-paneli-voice *{box-sizing:border-box}
#bmc-paneli-voice .bmc-orb{width:58px;height:58px;border:0;border-radius:18px;background:linear-gradient(160deg,#2A2A28 0%,#141311 70%);color:#F3EDE3;cursor:pointer;display:grid;place-items:center;box-shadow:0 10px 28px rgba(20,19,17,.35);position:relative}
#bmc-paneli-voice .bmc-orb:focus-visible{outline:2px solid #C45C26;outline-offset:3px}
#bmc-paneli-voice .bmc-orb[data-state="listening"]{box-shadow:0 0 0 6px rgba(196,92,38,.35)}
#bmc-paneli-voice .bmc-orb[data-state="speaking"]{box-shadow:0 0 0 6px rgba(200,196,184,.4)}
#bmc-paneli-voice .bmc-rib{width:28px;height:22px}
#bmc-paneli-voice .bmc-panel{display:none;position:absolute;right:0;bottom:70px;width:min(320px,calc(100vw - 32px));background:#F3EDE3;border:1px solid #C8C4B8;border-radius:16px;padding:14px 14px 12px;box-shadow:0 18px 40px rgba(20,19,17,.22)}
#bmc-paneli-voice.open .bmc-panel{display:block}
#bmc-paneli-voice .bmc-kicker{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#C45C26;margin:0 0 4px}
#bmc-paneli-voice .bmc-title{margin:0 0 8px;font-size:16px;font-weight:650;color:#141311}
#bmc-paneli-voice .bmc-caps{min-height:72px;max-height:140px;overflow:auto;font-size:13px;line-height:1.4;color:#2A2A28;background:#fff;border-radius:10px;padding:8px 10px;margin:0 0 10px}
#bmc-paneli-voice .bmc-line{margin:0 0 6px}
#bmc-paneli-voice .bmc-line[data-role="user"]{color:#6b6358}
#bmc-paneli-voice .bmc-row{display:flex;gap:8px}
#bmc-paneli-voice .bmc-btn{flex:1;min-height:44px;border:0;border-radius:10px;font:inherit;font-weight:600;cursor:pointer}
#bmc-paneli-voice .bmc-go{background:#C45C26;color:#fff}
#bmc-paneli-voice .bmc-stop{background:#141311;color:#F3EDE3}
#bmc-paneli-voice .bmc-wa{background:transparent;border:1px solid #C8C4B8;color:#141311}
#bmc-paneli-voice .bmc-err{color:#8b2e12;font-size:12px;margin:6px 0 0}
#bmc-paneli-voice .bmc-hint{margin:6px 0 0;font-size:11px;color:#6b6358}
@media(prefers-reduced-motion:reduce){#bmc-paneli-voice .bmc-orb{box-shadow:0 10px 28px rgba(20,19,17,.35)!important}}
`;

  const root = document.createElement("div");
  root.id = "bmc-paneli-voice";
  root.innerHTML = `
    <style>${css}</style>
    <div class="bmc-panel" role="dialog" aria-label="Hablar con Panelin">
      <p class="bmc-kicker">BMC Uruguay</p>
      <p class="bmc-title">Panelin</p>
      <div class="bmc-caps" id="bmc-caps" aria-live="polite"></div>
      <div class="bmc-row">
        <button type="button" class="bmc-btn bmc-go" id="bmc-go">Hablar</button>
        <button type="button" class="bmc-btn bmc-stop" id="bmc-stop" hidden>Cortar</button>
        <button type="button" class="bmc-btn bmc-wa" id="bmc-wa">WhatsApp</button>
      </div>
      <p class="bmc-hint">Lista web. Cotización orientativa — confirmamos por WhatsApp.</p>
      <p class="bmc-err" id="bmc-err" hidden></p>
    </div>
    <button type="button" class="bmc-orb" id="bmc-orb" aria-label="Hablar con Panelin" data-state="idle">
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
  const caps = root.querySelector("#bmc-caps");
  const errEl = root.querySelector("#bmc-err");

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
    if (!text) return;
    const p = document.createElement("p");
    p.className = "bmc-line";
    p.dataset.role = role;
    p.textContent = (role === "user" ? "Vos: " : "Panelin: ") + text;
    caps.appendChild(p);
    caps.scrollTop = caps.scrollHeight;
  }

  function setStatus(s) {
    state.status = s;
    orb.dataset.state = s;
    const talking = s === "connecting" || s === "active" || s === "listening" || s === "speaking";
    go.hidden = talking;
    stopBtn.hidden = !talking;
    go.textContent = s === "connecting" ? "Conectando…" : "Hablar";
  }

  function teardown() {
    if (state.maxTimer) {
      clearTimeout(state.maxTimer);
      state.maxTimer = null;
    }
    try {
      state.processor?.disconnect();
    } catch { /* ignore */ }
    state.processor = null;
    try {
      state.audioCtx?.close();
    } catch { /* ignore */ }
    state.audioCtx = null;
    if (state.stream) {
      state.stream.getTracks().forEach((t) => t.stop());
      state.stream = null;
    }
    state.send = null;
    if (state.ws) {
      try {
        state.ws.close();
      } catch { /* ignore */ }
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
    if (type === "session.updated" && !state.greeted) {
      state.greeted = true;
      state.send?.({
        type: "conversation.item.create",
        item: {
          type: "force_message",
          role: "assistant",
          interruptible: true,
          content: [
            {
              type: "output_text",
              text: "Hola, soy Panelin de BMC Uruguay. ¿Buscás un techo, una pared, o una cámara?",
            },
          ],
        },
      });
      addCap("assistant", "Hola, soy Panelin de BMC Uruguay. ¿Buscás un techo, una pared, o una cámara?");
    }
    if (type === "response.output_audio.delta" || type === "response.audio.delta") {
      setStatus("speaking");
      if (msg.delta) playPcm(msg.delta);
    }
    if (type === "response.done" || type === "response.output_audio.done") {
      if (state.status !== "idle") setStatus("active");
    }
    if (type === "input_audio_buffer.speech_started") setStatus("listening");
    if (type === "input_audio_buffer.speech_stopped" && state.status === "listening") setStatus("active");
    if (type === "response.output_audio_transcript.delta" || type === "response.audio_transcript.delta") {
      if (msg.delta) {
        const last = caps.querySelector(".bmc-line[data-role='assistant']:last-child");
        if (last && last.dataset.live === "1") last.textContent = (last.textContent || "") + msg.delta;
        else {
          const p = document.createElement("p");
          p.className = "bmc-line";
          p.dataset.role = "assistant";
          p.dataset.live = "1";
          p.textContent = "Panelin: " + msg.delta;
          caps.appendChild(p);
        }
      }
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
        state.send?.({ type: "response.create" });
      }
    }
  }

  async function startCall() {
    if (state.status !== "idle") return;
    setErr("");
    setStatus("connecting");
    caps.innerHTML = "";
    root.classList.add("open");

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
      const wsUrl = grokWsUrl(sess.realtime_base, sess.model);
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
          send(buildSessionUpdate(sess.session_bootstrap || {}));
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
})();
