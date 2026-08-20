// Faithful recreation of the SmartBuilding gable mark:
// circular photo (black roof, white fascia, silver monogram) + SVG fallback.
import { SMARTBUILDING_LOGO_DATA_URL } from "./smartbuildingLogo.dataurl.js";

export const SB_BLACK = "#0B0B0C";
export const SB_SILVER = "#E4E7EB";
export const SB_STEEL = "#9AA3AD";
export const SB_SKY = "#C9D3DB";
export const SB_INK = "#101114";
export const SMARTBUILDING_LOGO_HREF = "/branding/smartbuilding-logo.jpg";
export { SMARTBUILDING_LOGO_DATA_URL };

export function smartbuildingLogoImg(height = 40) {
  const h = Number(height) || 40;
  return `<img class="bc-logo-img" src="${SMARTBUILDING_LOGO_DATA_URL}" alt="SmartBuilding" width="${h}" height="${h}" style="display:block;height:${h}px;width:${h}px;border-radius:50%;object-fit:cover">`;
}

export const SMARTBUILDING_THEME = {
  headerBg: SB_BLACK,
  headerInk: "#F4F5F7",
  accent: SB_SILVER,
  accentSoft: SB_STEEL,
  wash: "#EEF2F5",
  ink: SB_INK,
  paper: "#FFFFFF",
  rule: "#C5CCD3",
};

export function smartbuildingLogoSvg(height = 40) {
  const h = Number(height) || 40;
  return `<svg viewBox="0 0 240 240" height="${h}" role="img" aria-label="SmartBuilding"
    xmlns="http://www.w3.org/2000/svg" style="display:block">
    <defs>
      <linearGradient id="sbSky" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#9EB0BD"/>
        <stop offset="1" stop-color="#E7EEF2"/>
      </linearGradient>
      <linearGradient id="sbMark" x1="0.15" y1="0.1" x2="0.9" y2="1">
        <stop offset="0" stop-color="#FFFFFF"/>
        <stop offset="0.55" stop-color="#D5DAE0"/>
        <stop offset="1" stop-color="#9AA3AD"/>
      </linearGradient>
    </defs>
    <circle cx="120" cy="120" r="118" fill="url(#sbSky)"/>
    <path fill="${SB_BLACK}" d="M18 196 L120 28 L222 196 Z"/>
    <path fill="none" stroke="#F3F5F7" stroke-width="7" stroke-linejoin="miter"
      d="M28 188 L120 42 L212 188"/>
    <path fill="none" stroke="#F3F5F7" stroke-width="4"
      d="M40 188 L120 58 L200 188"/>
    <g fill="url(#sbMark)">
      <path d="M120 62 L148 108 L132 108 L120 88 L108 108 L92 108 Z"/>
      <path d="M78 118 L112 118 L96 146 L78 146 Z"/>
      <path d="M118 118 L154 118 L138 146 L110 146 L118 132 L128 132 Z"/>
      <path d="M158 118 L186 164 L162 164 L148 140 L158 140 Z"/>
      <path d="M72 152 L118 152 L104 178 L58 178 Z"/>
      <path d="M124 152 L168 152 L186 178 L142 178 L132 164 L148 164 L140 152 Z"/>
    </g>
    <rect x="52" y="188" width="136" height="28" fill="#1A1C1F"/>
    <path fill="#2A2E33" d="M52 188 H188 V216 H52 Z M64 192 V212 H72 V192 Z M84 192 V212 H92 V192 Z M104 192 V212 H112 V192 Z M124 192 V212 H132 V192 Z M144 192 V212 H152 V192 Z M164 192 V212 H172 V192 Z"/>
  </svg>`;
}
