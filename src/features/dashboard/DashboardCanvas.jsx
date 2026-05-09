import React, { useMemo } from 'react';
import { Responsive, useContainerWidth } from 'react-grid-layout';
import { WidgetRegistry } from './widgets/registry.js';

/**
 * DashboardCanvas — renderiza widgets en un grid editable (drag & drop).
 *
 * @param {Object} props
 * @param {Object} props.layouts - { lg: [...], md: [...] } react-grid-layout
 * @param {Object} props.widgets - { [id]: { type, props } }
 * @param {boolean} props.editable - si true, widgets son arrastrables/redimensionables
 * @param {(layouts) => void} props.onLayoutChange
 */
export default function DashboardCanvas({ layouts, widgets, editable, onLayoutChange }) {
  const [containerRef, width] = useContainerWidth();
  const items = useMemo(
    () =>
      Object.entries(widgets).map(([id, w]) => {
        const Cmp = WidgetRegistry[w.type];
        return (
          <div key={id} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            {Cmp ? (
              <Cmp {...(w.props || {})} />
            ) : (
              <div className="p-4 text-sm text-stone-500">
                Widget desconocido: <code>{w.type}</code>
              </div>
            )}
          </div>
        );
      }),
    [widgets]
  );

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <Responsive
        className="layout"
        layouts={layouts}
        width={width || 1200}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
        rowHeight={60}
        margin={[12, 12]}
        isDraggable={editable}
        isResizable={editable}
        onLayoutChange={(_current, all) => onLayoutChange?.(all)}
        draggableCancel="button, a, input, select, textarea, .no-drag"
      >
        {items}
      </Responsive>
    </div>
  );
}
