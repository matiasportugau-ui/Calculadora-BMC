import { ExternalLink, Check } from "lucide-react";
import { C, FONT, PANELS_TECHO, PERFIL_TECHO, TR } from "../data/constants.js";
import { resolveBorderShopifyEntry } from "../data/quoteVisorShopifyResolve.js";

const GLASS_SHELL = {
  background: "rgba(255,255,255,0.62)",
  backdropFilter: "blur(28px) saturate(185%)",
  WebkitBackdropFilter: "blur(28px) saturate(185%)",
  border: "1px solid rgba(255,255,255,0.72)",
  boxShadow: "0 16px 48px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.82)",
};

const GLASS_INNER = {
  background: "rgba(255,255,255,0.45)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.5)",
};

function resolvePanelFamKey(panelFamiliaKey) {
  return PANELS_TECHO[panelFamiliaKey]?.fam || "";
}

/** SKU / largo comercial del perfil según familia de panel y espesor. */
export function resolveBorderPerfilSkuMeta(borderId, panelFamiliaKey, espesorMm) {
  if (!borderId || borderId === "none") return null;
  const fam = resolvePanelFamKey(panelFamiliaKey);
  const byTipo = PERFIL_TECHO[borderId];
  if (!byTipo || !fam) return null;
  const byFam = byTipo[fam];
  if (!byFam) return null;
  if (byFam._all) return byFam._all;
  const esp = Number(espesorMm);
  if (Number.isFinite(esp) && byFam[esp]) return byFam[esp];
  const keys = Object.keys(byFam).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  return keys.length ? byFam[keys[0]] : null;
}

/**
 * Selector de accesorio perimetral en planta — Liquid Glass + tarjeta de producto a la derecha al hover.
 */
export default function PlantaBorderGlassPicker({
  sideLabel,
  curVal,
  options = [],
  panelFamiliaKey = "",
  panelEspesorMm = null,
  hoverOptId,
  onHoverOpt,
  onSelect,
  popRef,
  style,
  onPointerEnterPopover,
  onPointerLeavePopover,
}) {
  const previewId = hoverOptId ?? curVal ?? options[0]?.id ?? "none";
  const previewOpt = options.find((o) => o.id === previewId) || options[0];
  const shop = resolveBorderShopifyEntry(previewId === "none" ? "none" : previewId);
  const skuMeta = resolveBorderPerfilSkuMeta(previewId, panelFamiliaKey, panelEspesorMm);
  const previewTitle = previewOpt?.label || "Sin perfil";

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label={sideLabel}
      onMouseEnter={onPointerEnterPopover}
      onMouseLeave={onPointerLeavePopover}
      style={{
        position: "fixed",
        zIndex: 10070,
        fontFamily: FONT,
        borderRadius: 20,
        display: "flex",
        flexDirection: "column",
        width: "min(520px, 92vw)",
        maxWidth: 560,
        maxHeight: "min(420px, 78vh)",
        overflow: "hidden",
        transition: "opacity 120ms ease",
        ...GLASS_SHELL,
        ...style,
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.35)",
          background: "rgba(0,113,227,0.08)",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: C.ts, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
          {sideLabel}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.primary, lineHeight: 1.3 }}>
          Accesorio perimetral
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "row" }}>
        <div
          style={{
            flex: "0 0 220px",
            minWidth: 0,
            borderRight: "1px solid rgba(255,255,255,0.35)",
            overflowY: "auto",
            padding: "8px 6px",
            background: "rgba(248,250,252,0.35)",
          }}
        >
          {options.map((opt, oi) => {
            const isSel = curVal === opt.id;
            const isHov = previewId === opt.id;
            return (
              <div
                key={`${opt.id}-${oi}`}
                role="button"
                tabIndex={0}
                onMouseEnter={() => onHoverOpt?.(opt.id)}
                onFocus={() => onHoverOpt?.(opt.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(opt.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(opt.id);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "10px 12px",
                  marginBottom: 4,
                  borderRadius: 14,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: isSel || isHov ? 600 : 500,
                  color: isSel || isHov ? C.primary : C.tp,
                  background: isSel
                    ? "rgba(0,113,227,0.18)"
                    : isHov
                      ? "rgba(255,255,255,0.72)"
                      : "rgba(255,255,255,0.28)",
                  border: isHov || isSel ? "1px solid rgba(0,113,227,0.28)" : "1px solid transparent",
                  boxShadow: isHov ? "0 4px 16px rgba(0,113,227,0.1)" : "none",
                  transition: TR,
                }}
              >
                <span style={{ lineHeight: 1.35 }}>{opt.label}</span>
                {isSel ? <Check size={14} color={C.primary} style={{ flexShrink: 0 }} /> : null}
              </div>
            );
          })}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: 14,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ ...GLASS_INNER, borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {shop.imageSrc ? (
              <div
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.55)",
                  aspectRatio: "4/3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={shop.imageSrc}
                  alt={previewTitle}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  loading="lazy"
                />
              </div>
            ) : (
              <div
                style={{
                  borderRadius: 12,
                  aspectRatio: "4/3",
                  background: "rgba(241,245,249,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: C.ts,
                }}
              >
                Sin imagen de referencia
              </div>
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.tp, lineHeight: 1.35 }}>{previewTitle}</div>
              {previewOpt?.descripcion ? (
                <div style={{ fontSize: 12, color: C.ts, lineHeight: 1.5, marginTop: 6 }}>{previewOpt.descripcion}</div>
              ) : (
                <div style={{ fontSize: 12, color: C.ts, lineHeight: 1.5, marginTop: 6 }}>
                  Perfil perimetral compatible con la familia de panel elegida. Se cotiza por barras según el perímetro en planta.
                </div>
              )}
              {skuMeta?.sku ? (
                <div style={{ fontSize: 11, color: C.ts, marginTop: 8 }}>
                  Ref. catálogo: <strong style={{ color: C.tp }}>{skuMeta.sku}</strong>
                  {skuMeta.largo ? (
                    <span> · barra {Number(skuMeta.largo).toFixed(2)} m</span>
                  ) : null}
                </div>
              ) : null}
            </div>
            {shop.productUrl && previewId !== "none" ? (
              <a
                href={shop.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  alignSelf: "flex-start",
                  padding: "8px 14px",
                  borderRadius: 12,
                  background: "rgba(0,113,227,0.12)",
                  color: C.primary,
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                  border: "1px solid rgba(0,113,227,0.2)",
                }}
              >
                Ver en tienda BMC
                <ExternalLink size={14} aria-hidden />
              </a>
            ) : null}
          </div>
          <div style={{ fontSize: 10, color: C.ts, lineHeight: 1.45, padding: "0 4px" }}>
            Pasá el mouse sobre cada tipo de perfil para previsualizar el producto. Clic para aplicar al borde seleccionado.
          </div>
        </div>
      </div>
    </div>
  );
}