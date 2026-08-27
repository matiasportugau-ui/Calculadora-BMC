/**
 * Drop non-speech / backchannel / TV-bleed so the agent does not loop on "Shh".
 * Best practice: energy+VAD on the client; this is the transcript-side gate.
 */

const EXACT_NOISE = new Set([
  "sh",
  "shh",
  "sshh",
  "sssh",
  "chh",
  "ok",
  "okay",
  "uh",
  "um",
  "eh",
  "ah",
  "mm",
  "mhm",
  "hmm",
  "ya",
  "yes",
  "yeah",
  "yep",
  "look",
  "network",
  "luego",
  "...",
  "…",
]);

export function isNoiseUtterance(text) {
  const raw = String(text || "").trim();
  if (!raw) return true;
  const n = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return true;
  if (n.length <= 1) return true;
  if (/^(sh+|s+h+|chh+)$/.test(n)) return true;
  if (EXACT_NOISE.has(n)) return true;
  // background English bleed mixed into the operator mic
  if (
    /\b(this is the folder|transcripts|workspace|i have another email|meetings i have)\b/i.test(
      raw,
    )
  ) {
    return true;
  }
  return false;
}
