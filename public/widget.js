(function () {
  var scriptTag = document.currentScript;
  var WS_URL = window.PANELIN_WS_URL
    || (scriptTag && scriptTag.dataset.wsUrl)
    || 'ws://localhost:8765/ws';
  var BUTTON_COLOR = '#4ade80';
  var SESSION_KEY = 'panelin_widget_session';

  var state = {
    ws: null,
    sessionId: localStorage.getItem(SESSION_KEY) || crypto.randomUUID(),
    connected: false,
    open: false,
  };

  // Inject styles
  var style = document.createElement('style');
  style.textContent = `
#panelin-btn {
  position: fixed; bottom: 24px; right: 24px; z-index: 99999;
  width: 56px; height: 56px; border-radius: 50%;
  background: ${BUTTON_COLOR}; border: none; cursor: pointer;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  font-size: 28px; display: flex; align-items: center; justify-content: center;
  transition: transform 0.2s;
}
#panelin-btn:hover { transform: scale(1.1); }
#panelin-btn.active { background: #ef4444; }
#panelin-panel {
  position: fixed; bottom: 92px; right: 24px; z-index: 99998;
  width: 360px; height: 500px; border-radius: 16px;
  background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  display: none; flex-direction: column; overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
}
#panelin-panel.open { display: flex; }
#panelin-header {
  padding: 14px 18px; background: rgba(0,0,0,0.3);
  color: #fff; font-weight: 600; font-size: 14px;
  display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);
}
#panelin-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #ef4444; transition: background 0.3s;
}
#panelin-dot.connected { background: #4ade80; }
#panelin-messages {
  flex: 1; overflow-y: auto; padding: 12px 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.panelin-msg {
  max-width: 85%; padding: 10px 14px; border-radius: 12px;
  font-size: 13px; line-height: 1.4; word-wrap: break-word;
}
.panelin-msg.user {
  align-self: flex-end; background: #4ade80; color: #000;
  border-bottom-right-radius: 4px;
}
.panelin-msg.bot {
  align-self: flex-start; background: rgba(255,255,255,0.08); color: #e0e0e0;
  border-bottom-left-radius: 4px;
}
.panelin-msg.bot.typing { opacity: 0.7; }
#panelin-input-row {
  display: flex; gap: 8px; padding: 10px 12px;
  border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);
}
#panelin-input {
  flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px; padding: 8px 14px; color: #fff; font-size: 13px;
  outline: none; font-family: inherit;
}
#panelin-input::placeholder { color: rgba(255,255,255,0.3); }
#panelin-send {
  background: #4ade80; color: #000; border: none; border-radius: 20px;
  padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
}
#panelin-send:disabled { opacity: 0.4; cursor: default; }
`;

  document.head.appendChild(style);

  // Button
  var btn = document.createElement('button');
  btn.id = 'panelin-btn';
  btn.textContent = '🤖';
  btn.onclick = toggle;
  document.body.appendChild(btn);

  // Panel
  var panel = document.createElement('div');
  panel.id = 'panelin-panel';
  panel.innerHTML =
    '<div id="panelin-header">' +
    '  <span id="panelin-dot"></span>' +
    '  <span>Panelin</span>' +
    '</div>' +
    '<div id="panelin-messages"></div>' +
    '<div id="panelin-input-row">' +
    '  <input id="panelin-input" placeholder="Escribí un mensaje..." />' +
    '  <button id="panelin-send" disabled>Enviar</button>' +
    '</div>';
  document.body.appendChild(panel);

  var msgContainer = document.getElementById('panelin-messages');
  var input = document.getElementById('panelin-input');
  var sendBtn = document.getElementById('panelin-send');
  var dot = document.getElementById('panelin-dot');

  function toggle() {
    state.open = !state.open;
    panel.classList.toggle('open', state.open);
    btn.classList.toggle('active', state.open);
    if (state.open && !state.ws) connect();
    if (state.open) setTimeout(function () { input.focus(); }, 300);
  }

  function connect() {
    state.ws = new WebSocket(WS_URL + '?session_id=' + state.sessionId);
    state.ws.onopen = function () {
      state.connected = true;
      dot.classList.add('connected');
    };
    state.ws.onmessage = function (e) {
      var msg = JSON.parse(e.data);
      if (msg.type === 'greeting') {
        localStorage.setItem(SESSION_KEY, msg.session_id || state.sessionId);
        addMsg('bot', msg.text || '');
      } else if (msg.type === 'token') {
        appendTyping(msg.text);
      } else if (msg.type === 'response_start') {
        finishTyping(msg.text);
      } else if (msg.type === 'transcript' && msg.text) {
        sendBtn.disabled = true;
      } else if (msg.type === 'response_end') {
        sendBtn.disabled = false;
        input.disabled = false;
        input.focus();
      }
    };
    state.ws.onclose = function () {
      state.connected = false;
      dot.classList.remove('connected');
      state.ws = null;
    };
  }

  function send() {
    var text = input.value.trim();
    if (!text || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    addMsg('user', text);
    input.value = '';
    sendBtn.disabled = true;
    input.disabled = true;
    state.ws.send(JSON.stringify({ type: 'text', data: text }));
  }

  function addMsg(role, text) {
    var div = document.createElement('div');
    div.className = 'panelin-msg ' + role;
    div.textContent = text;
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  var typingEl = null;

  function appendTyping(token) {
    if (!typingEl) {
      typingEl = document.createElement('div');
      typingEl.className = 'panelin-msg bot typing';
      typingEl.textContent = '';
      msgContainer.appendChild(typingEl);
    }
    typingEl.textContent += token;
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function finishTyping(fullText) {
    if (typingEl) {
      typingEl.remove();
      typingEl = null;
    }
    addMsg('bot', fullText);
  }

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  sendBtn.addEventListener('click', send);
})();
