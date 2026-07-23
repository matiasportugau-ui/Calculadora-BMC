import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { getTransactionDisplayAmount } from "../../../../lib/cashflow/currency.js";
import { fmtMoney } from "../finanzasUi.js";
import { useCashflowStore } from "./cashflowStore.js";

export default function PaymentCard({ tx }) {
  const state = useCashflowStore((s) => s.state);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tx.id, data: { tx } });
  const amt = state ? getTransactionDisplayAmount(tx, state.currencyMode, state.fx) : tx.amount;
  const signed = tx.type === "outflow" ? -(amt ?? 0) : (amt ?? 0);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 }}
      className={`fp-pay ${tx.type}`}
      {...listeners}
      {...attributes}
    >
      <div className="fp-pay-title">{tx.description}</div>
      <div className="fp-pay-row">
        <span className={`fp-pay-amt ${tx.type}`}>{fmtMoney(signed, state?.currencyMode)}</span>
        <span className="fp-badge">{tx.currency}</span>
      </div>
    </div>
  );
}
