/** Loop MP4 for Panelin agent avatar (header + chat drawer). */
import { WHITELABEL } from "../config/whitelabel.js";

const BASE = typeof import.meta !== "undefined" ? import.meta.env?.BASE_URL ?? "/" : "/";

const AVATAR = {
  bc: { video: "panelin-bc-loop.mp4", poster: "panelin-bc-poster.jpg" },
  paneleslam: { video: "panelin-lam-loop.mp4", poster: "panelin-lam-poster.jpg" },
  smartbuilding: { video: "panelin-smartbuilding-loop.mp4", poster: "panelin-smartbuilding-poster.jpg" },
};

const pick = AVATAR[WHITELABEL] || { video: "panelin-lista-loop.mp4", poster: null };

export const PANELIN_AGENT_VIDEO_SRC = pick.video ? `${BASE}video/${pick.video}` : "";
export const PANELIN_AGENT_POSTER_SRC = pick.poster ? `${BASE}video/${pick.poster}` : undefined;
