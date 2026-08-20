// LAM wordmark (casa terracota + taupe). Vector for header + PDF.
export const LAM_TERRACOTTA = "#B85C42";
export const LAM_TAUPE = "#A3988C";

export function lamLogoSvg(height = 36) {
  const h = Number(height) || 36;
  return `<svg viewBox="0 0 520 360" height="${h}" role="img" aria-label="LAM"
    xmlns="http://www.w3.org/2000/svg" style="display:block">
    <path fill="${LAM_TERRACOTTA}" d="M40 168 L200 48 L248 84 L88 204 Z"/>
    <path fill="${LAM_TAUPE}" d="M248 84 L360 168 L312 204 L220 120 Z"/>
    <path fill="none" stroke="${LAM_TERRACOTTA}" stroke-width="14" stroke-linejoin="miter"
      d="M48 172 L200 56 L352 172"/>
    <path fill="none" stroke="${LAM_TERRACOTTA}" stroke-width="14"
      d="M78 172 V248 H322 V172"/>
    <text x="48" y="318" font-family="Arial Black, Arial, sans-serif" font-size="118"
      font-weight="800" fill="${LAM_TERRACOTTA}" letter-spacing="-2">LAM</text>
  </svg>`;
}
