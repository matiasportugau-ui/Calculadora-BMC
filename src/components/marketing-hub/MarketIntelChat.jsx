// Module: market-intelligence | Owner: bmc-dev
// "Market Intel AI" chat — streams from POST /api/marketing/ai/chat (SSE).
// Self-contained (lean read-loop mirroring useChat.js); token-driven styling.

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getCalcApiBase } from '../../utils/calcApiBase.js';

const STARTERS = [
  '¿Cómo nos comparamos con Kingspan en EPS?',
  '¿Qué hago con las 47 preguntas sin responder en ML?',
  '¿Dónde tengo más riesgo de precio?',
];

function uid() {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random()}`; }
}

export default function MarketIntelChat({ token }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(async (text) => {
    const content = String(text ?? '').trim();
    if (!content || streaming) return;
    setError(null);
    const userMsg = { id: uid(), role: 'user', content };
    const assistantId = uid();
    const history = [...messages, userMsg];
    setMessages([...history, { id: assistantId, role: 'assistant', content: '', pending: true }]);
    setInput('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const base = getCalcApiBase().replace(/\/+$/, '');
      const res = await fetch(`${base}/api/marketing/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop();
        for (const part of parts) {
          const line = part.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'text') {
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + evt.delta, pending: false } : m)));
            } else if (evt.type === 'error') {
              setError(evt.message || 'Error del analista AI');
              // Server emits error→done→end (the catch never runs), so clear the
              // pending bubble here: keep partial text, drop an empty one.
              setMessages((prev) => prev.flatMap((m) => {
                if (m.id !== assistantId) return [m];
                return m.content ? [{ ...m, pending: false }] : [];
              }));
            }
          } catch { /* skip malformed event */ }
        }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') setError('No se pudo conectar con el analista AI.');
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming, messages, token]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 420, background: 'var(--ac-surface)', border: '1px solid var(--ac-border)', borderRadius: 'var(--ac-radius)', overflow: 'hidden', boxShadow: 'var(--ac-shadow-1)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--ac-border)' }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--ac-accent)', color: 'var(--ac-accent-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>AI</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ac-text)' }}>Market Intel AI</div>
          <div style={{ fontSize: 11, color: 'var(--ac-success)' }}>Competencia · Precios · Estrategia · Campañas</div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 360 }}>
            <p style={{ fontSize: 13, color: 'var(--ac-text-2)', margin: '0 0 12px' }}>Preguntá sobre la competencia, precios o estrategia. Respondo con los datos de inteligencia de mercado de BMC.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={streaming}
                  style={{ fontSize: 12, padding: '8px 12px', borderRadius: 999, border: '1px solid var(--ac-border)', background: 'var(--ac-surface-2)', color: 'var(--ac-text)', cursor: streaming ? 'not-allowed' : 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '78%', padding: '8px 12px', borderRadius: 14, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? 'var(--ac-accent)' : 'var(--ac-surface-2)',
              color: m.role === 'user' ? 'var(--ac-accent-fg)' : 'var(--ac-text)',
              border: m.role === 'user' ? 'none' : '1px solid var(--ac-border-2)',
            }}>
              {m.content || (m.pending ? <span style={{ color: 'var(--ac-text-3)' }}>…</span> : null)}
            </div>
          </div>
        ))}
        {error && (
          <div style={{ fontSize: 12, color: 'var(--ac-error)', textAlign: 'center' }}>{error}</div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: 12, borderTop: '1px solid var(--ac-border)', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Preguntá sobre competidores o estrategia…"
          disabled={streaming}
          style={{ flex: 1, padding: '10px 14px', borderRadius: 999, border: '1px solid var(--ac-border)', background: 'var(--ac-bg)', color: 'var(--ac-text)', fontSize: 13, outline: 'none' }}
        />
        {streaming ? (
          <button onClick={stop} aria-label="Detener" style={{ padding: '0 18px', borderRadius: 999, border: '1px solid var(--ac-border)', background: 'var(--ac-surface-2)', color: 'var(--ac-text)', cursor: 'pointer', fontSize: 13 }}>Detener</button>
        ) : (
          <button onClick={() => send(input)} aria-label="Enviar" disabled={!input.trim()} style={{ padding: '0 18px', borderRadius: 999, border: 'none', background: 'var(--ac-accent)', color: 'var(--ac-accent-fg)', cursor: input.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>Enviar</button>
        )}
      </div>
    </div>
  );
}
