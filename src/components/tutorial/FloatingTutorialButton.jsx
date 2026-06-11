import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTutorial } from './useTutorial.js';

/**
 * Floating draggable "Modo Tutorial" button.
 *
 * Best-practice improvements applied:
 * - Clear drag affordance (emoji area acts as dedicated handle)
 * - Drag vs click disambiguation via movement threshold (prevents accidental drags)
 * - Direct style mutation + transform during drag for 60fps performance (no layout thrashing)
 * - Position persisted in localStorage + auto-clamped on load/resize
 * - Full keyboard support (focusable, arrow nudging, Enter/Space to activate)
 * - Proper ARIA + visual states (hover lift, active drag feedback)
 * - Respects reduced motion preference
 * - Touch + mouse via Pointer Events
 * - User can place it anywhere without conflicting with left-side tutorial controls
 */

const BUTTON_WIDTH = 168;
const BUTTON_HEIGHT = 40;
const EDGE_MARGIN = 12;
const DRAG_THRESHOLD = 6; // pixels of movement before we commit to "drag" mode

const STORAGE_KEY = 'bmc_floating_tutorial_position';

export default function FloatingTutorialButton() {
  const { isTutorialMode, activeWorkflowId } = useTutorial();

  const [basePosition, setBasePosition] = useState({ left: 0, top: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    moved: false,
  });
  const elementRef = useRef(null);

  const clampToViewport = (pos) => {
    return {
      left: Math.max(
        EDGE_MARGIN,
        Math.min(pos.left, window.innerWidth - BUTTON_WIDTH - EDGE_MARGIN)
      ),
      top: Math.max(
        EDGE_MARGIN,
        Math.min(pos.top, window.innerHeight - BUTTON_HEIGHT - EDGE_MARGIN)
      ),
    };
  };

  // ---------- ACTIVATION ----------
  const activateTutorial = () => {
    // Dispatch the working event listened by TutorialProvider (launches the calculator flow when on /).
    // This fixes the previously non-functional "open-tutorial-panel" dispatch.
    const event = new CustomEvent('start-calculator-tutorial');
    window.dispatchEvent(event);
  };

  // Load saved position (or sensible bottom-right default) and clamp it
  useEffect(() => {
    const loadPosition = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      let pos;

      if (saved) {
        try {
          pos = JSON.parse(saved);
        } catch {
          pos = null;
        }
      }

      if (!pos) {
        pos = {
          left: Math.max(EDGE_MARGIN, window.innerWidth - BUTTON_WIDTH - 24),
          top: Math.max(EDGE_MARGIN, window.innerHeight - BUTTON_HEIGHT - 24),
        };
      }

      return clampToViewport(pos);
    };

    setBasePosition(loadPosition());

    // Re-clamp on resize (user may have dragged near edge on previous screen size)
    const handleResize = () => {
      setBasePosition((current) => clampToViewport(current));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const savePosition = useCallback((pos) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  }, []);

  // ---------- DRAG LOGIC (high-performance) ----------
  const startDrag = (clientX, clientY) => {
    if (!elementRef.current) return;

    const rect = elementRef.current.getBoundingClientRect();

    dragStateRef.current = {
      startX: clientX,
      startY: clientY,
      startLeft: rect.left,
      startTop: rect.top,
      moved: false,
    };

    setIsDragging(true);

    // Use transform during drag for buttery performance (no layout)
    elementRef.current.style.transition = 'none';
    elementRef.current.style.willChange = 'transform';
  };

  const updateDrag = (clientX, clientY) => {
    const state = dragStateRef.current;
    if (!state || !elementRef.current) return;

    const deltaX = clientX - state.startX;
    const deltaY = clientY - state.startY;

    // Only commit to drag mode after threshold (distinguishes tap from drag)
    if (!state.moved && Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD) {
      state.moved = true;
    }

    if (!state.moved) return;

    const newLeft = state.startLeft + deltaX;
    const newTop = state.startTop + deltaY;

    const clamped = clampToViewport({ left: newLeft, top: newTop });

    // Direct DOM mutation during drag = 60fps, zero React re-renders
    elementRef.current.style.left = `${clamped.left}px`;
    elementRef.current.style.top = `${clamped.top}px`;
    elementRef.current.style.transform = 'none'; // we are driving left/top
  };

  const endDrag = () => {
    const state = dragStateRef.current;
    if (!state || !elementRef.current) return;

    setIsDragging(false);

    // Read final position from the element we were mutating
    const rect = elementRef.current.getBoundingClientRect();
    const finalPos = clampToViewport({ left: rect.left, top: rect.top });

    // Commit to React state + persistence
    setBasePosition(finalPos);
    savePosition(finalPos);

    // Restore normal styles
    elementRef.current.style.transition = '';
    elementRef.current.style.willChange = '';

    // If user barely moved, treat as click (activate tutorial)
    if (!state.moved && elementRef.current) {
      activateTutorial();
    }
  };

  // Pointer event handlers on the drag handle area
  const handleHandlePointerDown = (e) => {
    // Prevent the click from also firing the button
    e.stopPropagation();
    e.preventDefault();

    startDrag(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleHandlePointerMove = (e) => {
    if (!isDragging) return;
    updateDrag(e.clientX, e.clientY);
  };

  const handleHandlePointerUp = (e) => {
    if (isDragging) {
      endDrag();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch { /* capture may already be released */ }
    }
  };

  // Global listeners while dragging (captures mouse leaving the element)
  useEffect(() => {
    if (!isDragging) return;

    const move = (e) => updateDrag(e.clientX, e.clientY);
    const up = () => endDrag();

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);

    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };
  }, [isDragging]);


  // Keyboard support for the whole control (best practice for FABs)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateTutorial();
      return;
    }

    // Arrow keys nudge the button (very useful when it's in the way)
    const step = e.shiftKey ? 50 : 10;
    let { left, top } = basePosition;

    if (e.key === 'ArrowLeft') left -= step;
    if (e.key === 'ArrowRight') left += step;
    if (e.key === 'ArrowUp') top -= step;
    if (e.key === 'ArrowDown') top += step;

    const clamped = clampToViewport({ left, top });
    setBasePosition(clamped);
    savePosition(clamped);
  };

  // Hide when a flow is already running
  if (isTutorialMode && activeWorkflowId) return null;

  const reducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      ref={elementRef}
      role="button"
      tabIndex={0}
      aria-label="Modo Tutorial — arrastrable. Clic o Enter para abrir."
      aria-grabbed={isDragging}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        left: `${basePosition.left}px`,
        top: `${basePosition.top}px`,
        zIndex: 9999,
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 999,
        boxShadow: isDragging
          ? '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
          : '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        padding: '6px 6px 6px 4px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        userSelect: 'none',
        touchAction: 'none',
        transition: isDragging || reducedMotion ? 'none' : 'box-shadow 120ms ease, transform 120ms ease',
        transform: isDragging ? 'scale(0.98)' : 'scale(1)',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* Dedicated drag handle — clear affordance (best practice) */}
      <div
        onPointerDown={handleHandlePointerDown}
        onPointerMove={handleHandlePointerMove}
        onPointerUp={handleHandlePointerUp}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 999,
          background: isDragging ? '#f1f5f9' : 'transparent',
          cursor: 'grab',
          fontSize: 14,
          color: '#64748b',
          flexShrink: 0,
          transition: reducedMotion ? 'none' : 'background 100ms ease',
        }}
        title="Arrastrar para mover"
        aria-hidden="true"
      >
        🎓
      </div>

      {/* Clickable label — protected from drag */}
      <button
        onClick={activateTutorial}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: 999,
          padding: '6px 14px 6px 4px',
          fontSize: 12,
          fontWeight: 600,
          color: '#334155',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }}
      >
        Modo Tutorial
      </button>
    </div>
  );
}
