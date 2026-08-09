import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useBmcAuth } from "../../../../hooks/useBmcAuth.js";
import { getMoneyNeeded } from "../../../../lib/cashflow/project.js";
import { groupPendingByWeek } from "../../../../lib/cashflow/weeks.js";
import { fmtMoney } from "../finanzasUi.js";
import { useCashflowStore } from "./cashflowStore.js";
import TimelineBucket from "./TimelineBucket.jsx";

export default function PaymentTimelineView({ compact = false }) {
  const auth = useBmcAuth();
  const state = useCashflowStore((s) => s.state);
  const move = useCashflowStore((s) => s.moveTransactionDate);
  const buckets = state ? groupPendingByWeek(state, compact ? 3 : 4) : [];
  const net = state ? getMoneyNeeded(state, buckets.flatMap((b) => b.transactions)) : 0;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  return (
    <div className="fp-chart-card">
      <div className="fp-strip">
        <span style={{ fontSize: 13, fontWeight: 600 }}>Neto necesario ({compact ? "3" : "4"} sem)</span>
        <span style={{ fontFamily: "SF Mono, Menlo, monospace", fontSize: 16, fontWeight: 700 }}>
          {fmtMoney(-net, state?.currencyMode)}
        </span>
      </div>
      <DndContext sensors={sensors} onDragEnd={({ active, over }) => over && move(String(active.id), String(over.id), auth.accessToken)}>
        <div className="fp-timeline-scroll">
          <div className="fp-timeline">
            {buckets.map((b) => (
              <TimelineBucket key={b.weekKey} bucket={b} />
            ))}
          </div>
        </div>
      </DndContext>
      {!compact && (
        <p style={{ fontSize: 11, color: "var(--fp-muted)", marginTop: 12 }}>
          Arrastrá vencimientos entre semanas. Soft-warn si la liquidez cae bajo cero — igual se guarda.
        </p>
      )}
    </div>
  );
}
