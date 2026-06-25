import React, { useState } from 'react';
import { useQuestions, useAnswerQuestion, useSuggestAnswer, useItem } from '../hooks/useMlConnector.js';

/** Product preview for the question's listing: thumbnail + name + price + working link.
 *  /ml/questions only gives item_id, so we fetch the item to give the operator context. */
function ProductPreview({ itemId }) {
  const item = useItem(itemId);
  const d = item.data;
  const href = d?.permalink || (itemId ? `https://articulo.mercadolibre.com.uy/${itemId}` : undefined);
  const thumb = d?.pictures?.[0]?.secure_url || d?.pictures?.[0]?.url || d?.thumbnail;

  const wrap = {
    display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none',
    padding: '8px', marginBottom: '10px', borderRadius: '10px',
    background: 'var(--ac-bg)', border: '1px solid var(--ac-border)', color: 'inherit',
  };

  if (item.isLoading) {
    return <div style={{ ...wrap, color: 'var(--ac-text-2)', fontSize: '12px', fontFamily: 'monospace' }}>{itemId} · cargando…</div>;
  }
  if (!d) {
    // fall back to a plain (best-effort) link if the item failed to load
    return (
      <a href={href} target="_blank" rel="noreferrer" style={{ ...wrap, fontSize: '12px', fontFamily: 'monospace', color: 'var(--ac-accent)' }}>
        {itemId} ↗
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" style={wrap} title={d.title}>
      {thumb
        ? <img src={thumb} alt="" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, border: '1px solid var(--ac-border)' }} />
        : <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'var(--ac-border)', flexShrink: 0 }} />}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ac-text)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {d.title}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--ac-text-2)', marginTop: '2px' }}>
          {d.price != null ? `${d.currency_id || ''} ${d.price}` : ''}
          <span style={{ fontFamily: 'monospace', marginLeft: '8px', color: 'var(--ac-accent)' }}>{itemId} ↗</span>
        </div>
      </div>
    </a>
  );
}

function QuestionCard({ question }) {
  const answer = useAnswerQuestion();
  const suggest = useSuggestAnswer();
  const [text, setText] = useState('');

  const handleAnswer = () => {
    if (!text.trim()) return;
    answer.mutate({ id: question.id, text });
  };

  const handleGenerate = () => {
    suggest.mutate(
      { text: question.text, itemId: question.item_id },
      { onSuccess: (data) => { if (data?.respuesta) setText(data.respuesta); } },
    );
  };

  return (
    <div style={{ background: 'var(--ac-surface)', border: '1px solid var(--ac-border)', borderRadius: '12px', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
      <div style={{ marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--ac-text-2)' }}>
          {question.date_created ? new Date(question.date_created).toLocaleString('es-UY') : ''}
        </span>
      </div>
      {question.item_id && <ProductPreview itemId={question.item_id} />}
      <div style={{ fontSize: '14px', color: 'var(--ac-text)', lineHeight: 1.4, marginBottom: '12px' }}>
        {question.text}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Escribí tu respuesta…"
        style={{
          width: '100%',
          padding: '7px 10px',
          fontSize: '13px',
          border: '1.5px solid var(--ac-border)',
          borderRadius: '8px',
          fontFamily: 'inherit',
          background: 'var(--ac-bg)',
          color: 'var(--ac-text)',
          resize: 'vertical',
          boxSizing: 'border-box',
          marginBottom: '8px',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={handleGenerate}
          disabled={suggest.isPending}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '600',
            background: 'transparent',
            color: 'var(--ac-accent)',
            border: '1.5px solid var(--ac-accent)',
            cursor: suggest.isPending ? 'default' : 'pointer',
            opacity: suggest.isPending ? 0.6 : 1,
          }}
        >
          {suggest.isPending ? 'Generando…' : '✨ Generar con IA'}
        </button>
        <button
          onClick={handleAnswer}
          disabled={answer.isPending || !text.trim()}
          style={{
            padding: '7px 16px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '600',
            background: 'var(--ac-accent)',
            color: '#fff',
            border: 'none',
            cursor: answer.isPending || !text.trim() ? 'default' : 'pointer',
            opacity: answer.isPending || !text.trim() ? 0.6 : 1,
          }}
        >
          {answer.isPending ? 'Enviando…' : 'Responder'}
        </button>
        {answer.isSuccess && <span style={{ fontSize: '12px', color: 'var(--ac-success)' }}>Respuesta enviada.</span>}
        {answer.error && <span style={{ fontSize: '12px', color: 'var(--ac-error)' }}>Error al enviar.</span>}
        {suggest.error && <span style={{ fontSize: '12px', color: 'var(--ac-error)' }}>IA no disponible.</span>}
      </div>
    </div>
  );
}

export default function QuestionsTab() {
  const questions = useQuestions({ status: 'UNANSWERED', limit: 50 });

  if (questions.isLoading) {
    return <div style={{ padding: '40px', color: 'var(--ac-text-2)', textAlign: 'center' }}>Cargando preguntas…</div>;
  }
  if (questions.error) {
    return <div style={{ padding: '40px', color: 'var(--ac-error)', textAlign: 'center' }}>Error al cargar las preguntas.</div>;
  }

  // ML /questions/search returns { questions: [...] } — NOT { results }.
  const results = questions.data?.questions || [];
  if (!results.length) {
    return <div style={{ padding: '40px', color: 'var(--ac-text-2)', textAlign: 'center' }}>No hay preguntas sin responder.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {results.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}
    </div>
  );
}
