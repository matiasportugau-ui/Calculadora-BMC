import React, { useState } from 'react';
import { useQuestions, useAnswerQuestion, useSuggestAnswer } from '../hooks/useMlConnector.js';

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
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--ac-text-2)' }}>
          {question.date_created ? new Date(question.date_created).toLocaleString('es-UY') : ''}
        </span>
        {question.item_id && (
          <a
            href={`https://articulo.mercadolibre.com.uy/${question.item_id}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '11px', color: 'var(--ac-accent)', textDecoration: 'none', fontFamily: 'monospace' }}
          >
            {question.item_id}
          </a>
        )}
      </div>
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
