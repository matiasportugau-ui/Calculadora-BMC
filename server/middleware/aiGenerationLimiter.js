import rateLimit from "express-rate-limit";

export const AI_GENERATION_RATE = Object.freeze({
  windowMs: 60 * 1000,
  max: 20,
});

export function createAiGenerationLimiter(overrides = {}) {
  return rateLimit({
    ...AI_GENERATION_RATE,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      error: "rate_limited",
      detail: "Demasiadas consultas de IA. Esperá un momento.",
    },
    ...overrides,
  });
}

export default createAiGenerationLimiter;
