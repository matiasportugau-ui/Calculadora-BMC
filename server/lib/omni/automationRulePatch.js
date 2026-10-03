import { z } from "zod";

/** PATCH /omni/automation/rules/:id — only the two fields that route writes. */
export const automationRulePatchSchema = z.object({
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
});
