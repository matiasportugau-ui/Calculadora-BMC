// Spanish prose averages ~3.8 chars/token; structured system prompts ~3.5
const CHARS_PER_TOKEN_PROSE = 3.8;
const CHARS_PER_TOKEN_SYSTEM = 3.5;

export function estimateTokensText(str) {
  return Math.ceil((str?.length || 0) / CHARS_PER_TOKEN_PROSE) + 5;
}

export function estimateTokensSystem(str) {
  return Math.ceil((str?.length || 0) / CHARS_PER_TOKEN_SYSTEM);
}

export const CHAT_MAX_TOKENS = Number(process.env.CHAT_MAX_TOKENS) || 2048;

export const MODEL_CONTEXT_LIMITS = {
  "claude-haiku-4-5-20251001": 200_000,
  "claude-sonnet-4-5-20250929": 200_000,
  "claude-sonnet-4-20250514": 200_000,
  "claude-3-5-haiku-20241022": 200_000,
  "claude-3-5-sonnet-20241022": 200_000,
  "claude-3-opus-20240229": 200_000,
  "gpt-4o-mini": 128_000,
  "gpt-4o": 128_000,
  "grok-3-mini": 131_072,
  "grok-3": 131_072,
  "gemini-2.0-flash": 1_000_000,
  "gemini-1.5-flash": 1_000_000,
};

export const TOKEN_BUDGET = 10_000;
