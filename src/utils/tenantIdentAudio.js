import { WHITELABEL, WHITELABEL_BRANDS } from "../config/whitelabel.js";

export const IDENT_STING_SRC = {
  bc: "/audio/ident/bc-gold-foil.wav",
  paneleslam: "/audio/ident/lam-three-planks.wav",
  smartbuilding: "/audio/ident/smart-imax-air.wav",
};

export function identStingSrc(slug = WHITELABEL) {
  const fromBrand = slug && WHITELABEL_BRANDS[slug]?.ident?.sting;
  return fromBrand || IDENT_STING_SRC[slug] || null;
}

function prefersQuiet(matchMedia) {
  try {
    if (matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return true;
  } catch {
    /* ignore */
  }
  return false;
}

let current = null;
let primed = null;
let primedSrc = null;

/** Call inside the click handler so play() after Google is still allowed. */
export function primeIdentSting(slug = WHITELABEL) {
  const src = identStingSrc(slug);
  if (!src || typeof Audio === "undefined") return;
  try {
    if (!primed || primedSrc !== src) {
      primed = new Audio(src);
      primed.preload = "auto";
      primedSrc = src;
    }
    primed.muted = true;
    primed.volume = 0;
    primed.currentTime = 0;
    const play = primed.play();
    if (play && typeof play.then === "function") {
      play
        .then(() => {
          primed.pause();
          primed.currentTime = 0;
          primed.muted = false;
          primed.volume = 0.85;
        })
        .catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

export function playIdentSting(slug = WHITELABEL, matchMedia) {
  const src = identStingSrc(slug);
  if (!src || prefersQuiet(matchMedia)) return null;
  try {
    if (primed && primedSrc === src) {
      primed.muted = false;
      primed.volume = 0.85;
      primed.currentTime = 0;
      current = primed;
      const play = primed.play();
      if (play && typeof play.catch === "function") play.catch(() => {});
      return primed;
    }
    if (current) {
      current.pause();
      current = null;
    }
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = 0.85;
    current = audio;
    const play = audio.play();
    if (play && typeof play.catch === "function") play.catch(() => {});
    return audio;
  } catch {
    return null;
  }
}

export function preloadIdentSting(slug = WHITELABEL) {
  const src = identStingSrc(slug);
  if (!src || typeof Audio === "undefined") return;
  try {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.load();
  } catch {
    /* ignore */
  }
}
