import { useDroppable } from "@dnd-kit/core";
import PaymentCard from "./PaymentCard.jsx";

export default function TimelineBucket({ bucket, highlight }) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.weekKey, data: { weekKey: bucket.weekKey } });
  return (
    <div className="fp-bucket" style={{ opacity: highlight === false ? 0.45 : 1, transition: "opacity 0.2s" }}>
      <div className="fp-bucket-head">{bucket.label}</div>
      <div ref={setNodeRef} className={`fp-bucket-drop${isOver ? " over" : ""}`}>
        {bucket.transactions.map((tx) => (
          <PaymentCard key={tx.id} tx={tx} />
        ))}
      </div>
    </div>
  );
}
