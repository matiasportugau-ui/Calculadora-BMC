/**
 * presupSegConsumer.js
 * Thin adapter to turn structured output from the "seg" (Post-Mortem & Learning)
 * specialist into a real followup using the existing followUpStore.
 *
 * This is the "run" part for the seg step in the presupuestacion-orchestrator.
 */

import { loadStore, saveStore, addItem } from './followUpStore.js';

/**
 * Creates a real followup from the structured JSON output of the seg specialist.
 *
 * Expected segOutput shape (from the improved prompt):
 * {
 *   title: string,
 *   detail: string,
 *   tags: string[],
 *   nextFollowUpAt: string | null,
 *   reasoning?: string
 * }
 */
export function createFollowupFromSegOutput(segOutput, options = {}) {
  if (!segOutput || typeof segOutput !== 'object') {
    throw new Error('segOutput must be an object');
  }

  const { title, detail, tags, nextFollowUpAt } = segOutput;
  const { dryRun = false } = options;

  if (!title) {
    throw new Error('segOutput.title is required');
  }

  if (dryRun) {
    return {
      dryRun: true,
      wouldCreate: {
        title: title.trim(),
        detail: detail ? String(detail).trim() : '',
        tags: Array.isArray(tags) ? tags.filter(Boolean) : ['presup', 'post-mortem'],
        nextFollowUpAt: nextFollowUpAt || null,
      },
      message: 'dryRun: no store write performed',
    };
  }

  const store = loadStore();

  const item = addItem(store, {
    title: title.trim(),
    detail: detail ? String(detail).trim() : '',
    tags: Array.isArray(tags) ? tags.filter(Boolean) : ['presup', 'post-mortem'],
    nextFollowUpAt: nextFollowUpAt || null,
  });

  saveStore(store);

  return {
    id: item.id,
    title: item.title,
    nextFollowUpAt: item.nextFollowUpAt,
    message: `Follow-up created via seg: ${item.id}`,
  };
}

export default {
  createFollowupFromSegOutput,
};
