import { useMemo } from "react";

export default function ProductTooltip({
  product,
  visible = false,
  position = { x: 0, y: 0 },
}) {
  const sanitizedContent = useMemo(() => {
    if (!product?.descriptionHtml) return "";
    // Strip HTML tags, preserve line breaks
    let text = product.descriptionHtml;
    text = text.replace(/<[^>]*>/g, ""); // Remove all HTML tags
    text = text.replace(/&nbsp;/g, " "); // Convert HTML entities
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&amp;/g, "&");
    text = text.trim();
    return text;
  }, [product?.descriptionHtml]);

  if (!visible || !sanitizedContent) return null;

  // Clamp position to viewport
  const tooltipWidth = 320;
  const tooltipHeight = 120;
  const padding = 10;

  let x = position.x + 10;
  let y = position.y + 10;

  // Prevent overflow on right
  if (x + tooltipWidth + padding > window.innerWidth) {
    x = window.innerWidth - tooltipWidth - padding;
  }

  // Prevent overflow on bottom
  if (y + tooltipHeight + padding > window.innerHeight) {
    y = position.y - tooltipHeight - 10;
  }

  // Prevent overflow on left
  if (x < padding) {
    x = padding;
  }

  // Prevent overflow on top
  if (y < padding) {
    y = padding;
  }

  return (
    <div
      role="tooltip"
      aria-hidden={!visible}
      className="productTooltip"
      style={{
        position: "fixed",
        left: `${x}px`,
        top: `${y}px`,
        width: `${tooltipWidth}px`,
        maxHeight: "200px",
        backgroundColor: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        borderRadius: "12px",
        padding: "12px 16px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
        zIndex: 10000,
        fontSize: "12px",
        lineHeight: "1.5",
        color: "#1f1f1f",
        overflow: "auto",
        animation: "productTooltipFade 0.18s ease-in-out",
        pointerEvents: "none",
      }}
    >
      {sanitizedContent}
    </div>
  );
}
