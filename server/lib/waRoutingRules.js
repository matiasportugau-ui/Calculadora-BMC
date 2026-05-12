/**
 * WA Cockpit — Routing rules engine (Missive-style).
 *
 * Evalúa wa_rules sobre un mensaje recién ingestado y aplica acciones:
 *  - assign: <operator_id>      → setea wa_conversations.owner_op
 *  - label: <text>              → push en meta.labels
 *  - status: <new|in_progress|closed>
 *  - alert: { kind, message }   → emit webhook 'rule.alert' con payload
 *  - stop_processing: true      → no evalúa reglas con priority menor
 *
 * Schema de when_conditions (todos opcionales, AND entre claves presentes,
 * OR dentro de cada array):
 *   {
 *     phone_starts_with: ["+598"],
 *     phone_contains: ["..."],
 *     contact_name_contains: ["..."],
 *     text_matches: ["urgente", "presupuesto"],   // regex case-insensitive
 *     intent_in: ["cotizacion","follow_up"],
 *     hour_between: [9, 18],
 *     days_of_week: ["mon","tue",...]
 *   }
 *
 * Flag: routingRules.enabled.
 */

import { getFlag } from "./waConfig.js";
import { emitWaWebhook } from "./waWebhooks.js";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Evalúa todas las reglas activas contra un contexto y aplica acciones.
 * Idempotente — si el chat ya tiene owner_op, assign no lo sobrescribe.
 *
 * @param {object} pool — pg pool
 * @param {object} ctx — { chat_id, phone, contact_name, text, intent, ts }
 * @returns {Promise<{applied: Array<{rule_id, name, actions}>}>}
 */
export async function applyRoutingRules(pool, ctx) {
  if (!pool) return { applied: [] };
  try {
    if (!getFlag("routingRules.enabled")) return { applied: [] };
  } catch { return { applied: [] }; }

  const { rows } = await pool.query(
    `select id, name, priority, when_conditions, then_actions
       from wa_rules
      where enabled = true
      order by priority asc`,
  );
  if (!rows.length) return { applied: [] };

  const applied = [];

  for (const rule of rows) {
    let matches = false;
    try {
      matches = _evaluateConditions(rule.when_conditions || {}, ctx);
    } catch (e) {
      // Regla con conditions corruptas: no matchea (no crash).
      continue;
    }
    if (!matches) continue;

    try {
      await _applyActions(pool, rule, ctx);
    } catch (e) {
      // Continuamos con otras reglas aún si una falla.
      continue;
    }

    // hit_count + last_hit_at
    await pool
      .query(
        `update wa_rules
            set hit_count = hit_count + 1,
                last_hit_at = now()
          where id = $1`,
        [rule.id],
      )
      .catch(() => {});

    applied.push({
      rule_id: rule.id,
      name: rule.name,
      actions: rule.then_actions,
    });

    if (rule.then_actions?.stop_processing) break;
  }

  return { applied };
}

/**
 * Preview: cuántos chats matchearían esta regla (no aplica nada).
 * Útil para el editor visual.
 */
export async function previewRoutingRule(pool, conditions) {
  if (!pool) return { count: 0, sample: [] };
  // Obtenemos hasta 200 conversaciones recientes y evaluamos en memoria
  // (más fácil que traducir conditions a SQL puro). Si la base crece, se
  // puede pre-filtrar por hint en SQL antes del eval.
  const { rows } = await pool.query(
    `select c.chat_id, c.phone, c.contact_name, c.intent_last as intent,
            (select text from wa_messages m where m.chat_id=c.chat_id order by ts desc limit 1) as last_text
       from wa_conversations c
      order by c.last_msg_at desc nulls last
      limit 200`,
  );
  const matched = [];
  for (const r of rows) {
    const ctx = {
      chat_id: r.chat_id,
      phone: r.phone || "",
      contact_name: r.contact_name || "",
      text: r.last_text || "",
      intent: r.intent || "",
      ts: new Date(),
    };
    if (_evaluateConditions(conditions || {}, ctx)) {
      matched.push({ chat_id: r.chat_id, contact_name: r.contact_name });
    }
  }
  return {
    count: matched.length,
    sample: matched.slice(0, 10),
    scanned: rows.length,
  };
}

// ─── Internal ──────────────────────────────────────────────────────────

function _evaluateConditions(conds, ctx) {
  if (!conds || typeof conds !== "object") return false;
  const keys = Object.keys(conds);
  if (keys.length === 0) return false;

  for (const k of keys) {
    const v = conds[k];
    switch (k) {
      case "phone_starts_with":
        if (!_anyMatch(v, (s) => String(ctx.phone || "").startsWith(s))) return false;
        break;
      case "phone_contains":
        if (!_anyMatch(v, (s) => String(ctx.phone || "").includes(s))) return false;
        break;
      case "contact_name_contains":
        if (!_anyMatch(v, (s) => String(ctx.contact_name || "").toLowerCase().includes(String(s).toLowerCase()))) return false;
        break;
      case "text_matches":
        if (!_anyMatch(v, (pat) => {
          try {
            return new RegExp(pat, "i").test(String(ctx.text || ""));
          } catch { return false; }
        })) return false;
        break;
      case "intent_in":
        if (!Array.isArray(v) || !v.includes(ctx.intent)) return false;
        break;
      case "hour_between": {
        if (!Array.isArray(v) || v.length !== 2) return false;
        const h = (ctx.ts || new Date()).getHours();
        if (!(h >= v[0] && h < v[1])) return false;
        break;
      }
      case "days_of_week": {
        if (!Array.isArray(v)) return false;
        const day = DAYS[(ctx.ts || new Date()).getDay()];
        if (!v.includes(day)) return false;
        break;
      }
      default:
        // Condition key desconocida → ignoramos.
        break;
    }
  }
  return true;
}

function _anyMatch(values, pred) {
  if (!Array.isArray(values)) return false;
  return values.some(pred);
}

async function _applyActions(pool, rule, ctx) {
  const actions = rule.then_actions || {};
  const updates = [];
  const params = [ctx.chat_id];
  let p = 2;

  // assign
  if (typeof actions.assign === "string" && actions.assign.trim()) {
    // Solo asigna si no hay owner_op aún (no sobrescribe asignaciones manuales).
    updates.push(`owner_op = coalesce(owner_op, $${p++})`);
    params.push(actions.assign.trim());
  }

  // status
  if (["new", "in_progress", "closed", "blocked"].includes(actions.status)) {
    updates.push(`status = $${p++}`);
    params.push(actions.status);
  }

  // label → meta.labels[]
  if (typeof actions.label === "string" && actions.label.trim()) {
    updates.push(`meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('labels', (coalesce(meta->'labels', '[]'::jsonb) || to_jsonb($${p++}::text)))`);
    params.push(actions.label.trim());
  }

  if (updates.length > 0) {
    updates.push("updated_at = now()");
    await pool.query(
      `update wa_conversations set ${updates.join(", ")} where chat_id = $1`,
      params,
    );
  }

  // alert (webhook + log)
  if (actions.alert && typeof actions.alert === "object") {
    emitWaWebhook("rule.alert", {
      chat_id: ctx.chat_id,
      rule_id: rule.id,
      rule_name: rule.name,
      alert: actions.alert,
      ctx_text: ctx.text,
    });
  }
}
