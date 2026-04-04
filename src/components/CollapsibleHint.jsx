import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { C, FONT } from "../data/constants.js";

/**
 * Expandable/collapsible hint text with a subtle arrow.
 *
 * @param {{ title: string, children: React.ReactNode, defaultOpen?: boolean, style?: object }} props
 */
export default function CollapsibleHint({ title, children, defaultOpen = false, style }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        fontSize: 11,
        color: C.ts,
        lineHeight: 1.5,
        padding: open ? "10px 12px" : "8px 12px",
        background: C.surface,
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        transition: "padding 180ms ease",
        ...style,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 600,
          color: C.tp,
          width: "100%",
          textAlign: "left",
        }}
      >
        <ChevronRight
          size={14}
          color={C.ts}
          style={{
            flexShrink: 0,
            transition: "transform 180ms ease",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
        <span>{title}</span>
      </button>
      {open && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: C.ts,
            lineHeight: 1.5,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
