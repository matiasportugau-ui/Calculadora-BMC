// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/tasks/TaskCreateModal.jsx — Tareas Phase D create modal
// ───────────────────────────────────────────────────────────────────────────
// Mirrors the Google Tasks creation UI: title, date, time-of-day, all-day
// toggle, repeat dropdown, description, and list picker. Time + repeat are
// backed by a paired Google Calendar event (see server/lib/googleCalendarClient
// .js), which needs the calendar.events OAuth scope. For users connected before
// Phase D, `calendarAvailable` is false → a "Reconectá" CTA is shown; the task
// still saves (the time/repeat simply won't mirror to Calendar until re-consent).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from "react";

const REPEAT_OPTIONS = [
  { label: "No se repite", value: "" },
  { label: "Diariamente", value: "RRULE:FREQ=DAILY" },
  { label: "Semanalmente", value: "RRULE:FREQ=WEEKLY" },
  { label: "Mensualmente", value: "RRULE:FREQ=MONTHLY" },
  { label: "Anualmente", value: "RRULE:FREQ=YEARLY" },
];

export default function TaskCreateModal({
  lists = [],
  defaultListId = null,
  calendarAvailable = true,
  onReconnect,
  onClose,
  onSubmit,
  submitting = false,
  error = null,
}) {
  const [title, setTitle] = useState("");
  const [listId, setListId] = useState(defaultListId || lists[0]?.id || "");
  const [date, setDate] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [time, setTime] = useState("");
  const [repeat, setRepeat] = useState("");
  const [description, setDescription] = useState("");
  const [localErr, setLocalErr] = useState(null);
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Time + repeat are the Calendar-backed dimensions.
  const usesCalendar = (!allDay && !!time) || !!repeat;

  const handleSave = (e) => {
    e?.preventDefault?.();
    const trimmed = title.trim();
    if (!trimmed) {
      setLocalErr("El título es obligatorio.");
      return;
    }
    if (!listId) {
      setLocalErr("Elegí una lista.");
      return;
    }
    if (!allDay && time && !date) {
      setLocalErr("Una hora necesita una fecha.");
      return;
    }
    setLocalErr(null);
    onSubmit?.({
      listId,
      title: trimmed,
      due: date || null,
      is_all_day: allDay,
      due_time: !allDay && time ? time : null,
      recurrence_rule: repeat || null,
      notes: description.trim() || undefined,
    });
  };

  const shownErr = localErr || error;

  return (
    <div
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Nueva tarea" style={dialog}>
        <form onSubmit={handleSave}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.125rem" }}>Nueva tarea</h2>

          <label style={lbl}>Título</label>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="¿Qué hay que hacer?"
            style={input}
          />

          <label style={lbl}>Lista</label>
          <select value={listId} onChange={(e) => setListId(e.target.value)} style={input}>
            {lists.length === 0 ? <option value="">(sin listas)</option> : null}
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title || "(sin nombre)"}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Hora</label>
              <input
                type="time"
                value={time}
                disabled={allDay}
                onChange={(e) => setTime(e.target.value)}
                style={{ ...input, opacity: allDay ? 0.5 : 1 }}
              />
            </div>
          </div>

          <label style={{ ...checkboxRow }}>
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => {
                setAllDay(e.target.checked);
                if (e.target.checked) setTime("");
              }}
            />
            <span>Todo el día</span>
          </label>

          <label style={lbl}>Repetición</label>
          <select value={repeat} onChange={(e) => setRepeat(e.target.value)} style={input}>
            {REPEAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label style={lbl}>Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Notas (opcional)"
            style={{ ...input, resize: "vertical" }}
          />

          {usesCalendar && !calendarAvailable ? (
            <div style={reconnectBanner}>
              <span>
                Reconectá Google para habilitar <strong>hora / repetición</strong>. La
                tarea se guardará igual, pero no se sincronizará con el calendario hasta
                reconectar.
              </span>
              <button type="button" onClick={() => onReconnect?.()} style={reconnectBtn}>
                Reconectar
              </button>
            </div>
          ) : null}

          {shownErr ? <p style={errText}>{shownErr}</p> : null}

          <div style={actions}>
            <button type="button" onClick={() => onClose?.()} style={ghostBtn}>
              Cancelar
            </button>
            <button type="submit" disabled={submitting} style={{ ...saveBtn, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── inline styles ──────────────────────────────────────────────────────────
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(17,24,39,0.45)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "6vh 1rem",
  zIndex: 1000,
};
const dialog = {
  width: "100%",
  maxWidth: 460,
  background: "#fff",
  borderRadius: 10,
  padding: "1.5rem",
  boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
};
const lbl = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#374151",
  margin: "0.75rem 0 0.25rem",
};
const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.5rem 0.625rem",
  fontSize: "0.9375rem",
  border: "1px solid #d1d5db",
  borderRadius: 6,
};
const checkboxRow = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  margin: "0.75rem 0 0",
  fontSize: "0.875rem",
  color: "#374151",
};
const reconnectBanner = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginTop: "1rem",
  padding: "0.625rem 0.75rem",
  background: "#fffbeb",
  border: "1px solid #fcd34d",
  borderRadius: 6,
  fontSize: "0.8125rem",
  color: "#92400e",
};
const reconnectBtn = {
  flexShrink: 0,
  border: "none",
  background: "#d97706",
  color: "#fff",
  padding: "0.375rem 0.75rem",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: "0.8125rem",
  fontWeight: 600,
};
const errText = { color: "#b91c1c", fontSize: "0.8125rem", margin: "0.75rem 0 0" };
const actions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: "1.5rem",
};
const ghostBtn = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  padding: "0.5rem 1rem",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: "0.875rem",
};
const saveBtn = {
  border: "none",
  background: "#2563eb",
  color: "#fff",
  padding: "0.5rem 1.25rem",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "0.875rem",
};
