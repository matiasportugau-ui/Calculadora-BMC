/**
 * Custom ESLint plugin — `bmc-help`.
 *
 * Rule `anchor-must-use-const`:
 *   Forbid raw string literals as the first argument to `useHelp(...)` or
 *   `useFirstTimeTipState(...)`. Consumers must import HELP_ANCHORS from
 *   `src/components/help/anchors.js` and pass `HELP_ANCHORS.X`.
 *
 * Rationale: typo'd anchor ids silently return null and render no tooltip,
 * which is hard to catch in review or CI. The lint rule turns the bug class
 * into a hard-fail at lint time. See drafts/02-skin-help-anchoring-proposal.md § B.
 */

const HELP_HOOKS = new Set(["useHelp", "useFirstTimeTipState"]);

const anchorMustUseConst = {
  meta: {
    type: "problem",
    docs: {
      description:
        "useHelp / useFirstTimeTipState must receive HELP_ANCHORS.X, not a raw string literal",
    },
    schema: [],
    messages: {
      rawString:
        'Pass HELP_ANCHORS.<KEY> to {{name}}(), not the raw string "{{value}}". Import from src/components/help/anchors.js.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;
        if (!HELP_HOOKS.has(node.callee.name)) return;
        const arg = node.arguments[0];
        if (arg && arg.type === "Literal" && typeof arg.value === "string") {
          context.report({
            node: arg,
            messageId: "rawString",
            data: { name: node.callee.name, value: arg.value },
          });
        }
      },
    };
  },
};

export default {
  rules: {
    "anchor-must-use-const": anchorMustUseConst,
  },
};
