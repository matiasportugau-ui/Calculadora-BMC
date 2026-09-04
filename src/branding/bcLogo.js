// Official BC mark: gold B+C with roof, white paper knocked out.
// Raster lives in public/branding/bc-logo.png; PDF inlines the data URL
// because Chromium setContent has no origin for /branding/*.
import { BC_LOGO_DATA_URL } from "./bcLogo.dataurl.js";

export { BC_LOGO_DATA_URL };
export const BC_LOGO_HREF = "/branding/bc-logo.png";

export function isBcLogoDataUrl(v) {
  return typeof v === "string"
    && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
}

export function bcLogoImg(height = 62) {
  const h = Number(height) || 62;
  return `<img class="bc-logo-img" src="${BC_LOGO_DATA_URL}" alt="BC" height="${h}" style="display:block;height:${h}px;width:auto">`;
}
