// Meta Ads Analyst SSE chat — POST /api/marketing/ai/ads-chat
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getCalcApiBase } from '../../../utils/calcApiBase.js';

const STARTERS = [
  '¿Dónde reasignar presupuesto esta semana?',
  '¿Hay fatiga creativa o frecuencia alta?',
  'Resumen ejecutivo en 5 bullets para dirección',
  '¿Qué campañas zombie conviene pausar primero?',
];

function uid() {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random()}`; }
}

export default function MetaAdsAnalystChat({ token, range, source }) {
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
    if (!content || streaming || !token) return;
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
      const res = await fetch(`${base}/api/marketing/ai/ads-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          range,
          source,
        }),
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
              setError(evt.message || 'Error del analista Meta');
              setMessages((prev) => prev.flatMap((m) => {
                if (m.id !== assistantId) return [m];
                return m.content ? [{ ...m, pending: false }] : [];
              }));
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') setError('No se pudo conectar con el analista Meta Ads.');
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming, messages, token, range, source]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 420, background: 'var(--ac-surface)', border: '1px solid var(--ac-border)', borderRadius: 'var(--ac-radius)', overflow: 'hidden', boxShadow: 'var(--ac-shadow-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--ac-border)' }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--ac-accent)', color: 'var(--ac-accent-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>MA</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ac-text)' }}>Meta Ads Analyst</div>
          <div style={{ fontSize: 11, color: 'var(--ac-text-3)' }}>Grounded en el reporte actual · no inventa métricas</div>
        </div>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} style={{ textAlign: 'left', fontSize: 12, padding: '8px 10px', borderRadius: 'var(--ac-radius-sm)', border: '1px solid var(--ac-border)', background: 'var(--ac-surface-2)', color: 'var(--ac-text)', cursor: 'pointer' }}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%', padding: '8px 10px', borderRadius: 10, fontSize: 12, lineHeight: 1.45, background: m.role === 'user' ? 'var(--ac-accent)' : 'var(--ac-surface-2)', color: m.role === 'user' ? 'var(--ac-accent-fg)' : 'var(--ac-text)' }}>
            {m.content || (m.pending ? '…' : '')}
          </div>
        ))}
      </div>
      {error && <div style={{ padding: '4px 12px', fontSize: 11, color: 'var(--ac-error)' }}>{error}</div>}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid var(--ac-border)' }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Preguntá sobre el reporte Meta…"
          disabled={streaming}
          style={{ flex: 1, fontSize: 12, padding: '8px 10px', borderRadius: 'var(--ac-radius-sm)', border: '1px solid var(--ac-border)', background: 'var(--ac-surface)', color: 'var(--ac-text)' }}
        />
        <button type="submit" disabled={streaming || !input.trim()} style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 'var(--ac-radius-sm)', border: 'none', background: 'var(--ac-accent)', color: 'var(--ac-accent-fg)', cursor: 'pointer' }}>
          Enviar
        </button>
      </form>
    </div>
  );
}
