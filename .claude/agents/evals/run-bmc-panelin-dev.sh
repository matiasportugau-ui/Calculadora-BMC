#!/usr/bin/env bash
# Eval runner for the bmc-panelin-dev subagent
# Usage: bash .claude/agents/evals/run-bmc-panelin-dev.sh
# Requires: claude (Claude Code CLI) with project-scope agents loaded, jq

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVAL_FILE="$SCRIPT_DIR/bmc-panelin-dev.json"
RESULTS_DIR="$SCRIPT_DIR/results/bmc-panelin-dev-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$RESULTS_DIR"

# -- Sanity checks ------------------------------------------------------------

if ! command -v claude >/dev/null 2>&1; then
  echo "❌ Claude Code CLI no encontrado. Instalalo desde https://claude.com/code" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq no encontrado. Instalalo: brew install jq  /  apt install jq" >&2
  exit 1
fi

if [[ ! -f "$EVAL_FILE" ]]; then
  echo "❌ No encuentro $EVAL_FILE" >&2
  exit 1
fi

# -- Read eval definition -----------------------------------------------------

AGENT_NAME=$(jq -r '.agent_name' "$EVAL_FILE")
NUM_CASES=$(jq '.test_cases | length' "$EVAL_FILE")
GLOBAL_MUST_NOT_CONTAIN=$(jq -r '.success_criteria.must_not_contain[]?' "$EVAL_FILE")

echo ""
echo "▶ Eval para agente: $AGENT_NAME"
echo "▶ Casos: $NUM_CASES"
echo "▶ Resultados: $RESULTS_DIR"
echo ""

if [[ "$NUM_CASES" -le 0 ]]; then
  echo "⚠ No hay test_cases definidos en $EVAL_FILE — nada que correr." >&2
  exit 0
fi

# -- Run each test case -------------------------------------------------------

PASSED=0
FAILED=0
FAILURES=()

# Helper: check global must_not_contain on output (uses FIXED-STRING match).
# Echoes the offending token on fail; empty on pass. Returns 0 always.
check_must_not_contain() {
  local out_file="$1"
  while IFS= read -r token; do
    [[ -z "$token" ]] && continue
    if grep -qFi -- "$token" "$out_file"; then
      printf '%s' "$token"
      return 0
    fi
  done <<< "$GLOBAL_MUST_NOT_CONTAIN"
  printf ''
  return 0
}

for i in $(seq 0 $((NUM_CASES - 1))); do
  CASE_NAME_RAW=$(jq -r ".test_cases[$i].name" "$EVAL_FILE")
  CASE_PROMPT=$(jq -r ".test_cases[$i].prompt" "$EVAL_FILE")
  CASE_EXPECTED=$(jq -r ".test_cases[$i].expected_behavior" "$EVAL_FILE")
  # Sanitize CASE_NAME for filesystem use — alphanum, underscore, dash only.
  CASE_NAME=$(printf '%s' "$CASE_NAME_RAW" | tr -c '[:alnum:]_-' '_')

  echo "─── Caso $((i+1))/$NUM_CASES: $CASE_NAME_RAW ───"
  echo "Prompt: $CASE_PROMPT"
  echo "Esperado: $CASE_EXPECTED"

  OUTPUT_FILE="$RESULTS_DIR/case-$((i+1))-$CASE_NAME.txt"

  # Run the agent via Claude Code headless mode. The agent is loaded from
  # the project-scope .claude/agents/ directory automatically when the CLI
  # runs inside the repo; auto-routing on "Use the <agent> subagent on:"
  # prompts triggers invocation. If the parent agent answers without
  # routing, case-specific assertions below will catch it.
  if ! claude -p "$CASE_PROMPT" > "$OUTPUT_FILE" 2>&1; then
    echo "❌ FAIL — claude -p devolvió error. Ver $OUTPUT_FILE"
    FAILED=$((FAILED + 1))
    FAILURES+=("$CASE_NAME_RAW: claude error")
    continue
  fi

  # Global must_not_contain — applies to EVERY case before case-specific
  # routing (e.g., "be helpful and accurate" boilerplate must not appear
  # in any output regardless of mode).
  BAD_TOKEN=$(check_must_not_contain "$OUTPUT_FILE")
  if [[ -n "$BAD_TOKEN" ]]; then
    echo "❌ FAIL — output contiene token prohibido global: '$BAD_TOKEN'"
    FAILED=$((FAILED + 1))
    FAILURES+=("$CASE_NAME_RAW: prohibited token '$BAD_TOKEN'")
    echo ""
    continue
  fi

  # Special handling for case "ambiguous-input-clarify": require an EXPLICIT
  # clarification question. Brainstormer-mode output without a question is
  # NOT acceptable here per the system prompt's "Edge cases §1" contract.
  if [[ "$CASE_NAME_RAW" == "ambiguous-input-clarify" ]]; then
    if grep -qE '\?' "$OUTPUT_FILE" && \
       grep -qiE "(plan estructurado|ideas para|cambios al código|qué (querés|preferís|elegís)|cuál preferís|desambiguar|aclarar)" "$OUTPUT_FILE"; then
      echo "✅ PASS — clarification question detected"
      PASSED=$((PASSED + 1))
    else
      echo "❌ FAIL — no explicit clarification question (Edge case §1 requires asking once before proceeding)"
      FAILED=$((FAILED + 1))
      FAILURES+=("$CASE_NAME_RAW: no clarification question")
    fi
    echo ""
    continue
  fi

  # Special handling for case "defer-to-specialist": must mention the
  # appropriate specialist AND explicitly defer AND not start solving inline.
  if [[ "$CASE_NAME_RAW" == "defer-to-specialist" ]]; then
    MENTIONS_SPECIALIST=false
    DECLARES_DEFERRAL=false
    NO_INLINE_WORK=true

    if grep -qFi "bmc-calc-specialist" "$OUTPUT_FILE" || grep -qFi "bmc-fiscal" "$OUTPUT_FILE"; then
      MENTIONS_SPECIALIST=true
    fi
    if grep -qiE "(deferí|deferir|use the (bmc-|specialist)|usá (el specialist|bmc-)|sugiero (usar|invocar)|invoc[aá] (el|al))" "$OUTPUT_FILE"; then
      DECLARES_DEFERRAL=true
    fi
    # Heuristic for "started doing the work itself": references to the calc
    # engine file, IVA debugging numbers, or a code block.
    if grep -qiE "(calculations\.js|22[%]|aplicando .*IVA|el subtotal incluye|^[[:space:]]*\`\`\`)" "$OUTPUT_FILE"; then
      NO_INLINE_WORK=false
    fi

    if $MENTIONS_SPECIALIST && $DECLARES_DEFERRAL && $NO_INLINE_WORK; then
      echo "✅ PASS — defers cleanly (specialist named + deferral declared + no inline work)"
      PASSED=$((PASSED + 1))
    else
      REASON="missing:"
      $MENTIONS_SPECIALIST || REASON="$REASON specialist-name"
      $DECLARES_DEFERRAL || REASON="$REASON deferral-language"
      $NO_INLINE_WORK || REASON="$REASON no-inline(started-solving)"
      echo "❌ FAIL — $REASON"
      FAILED=$((FAILED + 1))
      FAILURES+=("$CASE_NAME_RAW: $REASON")
    fi
    echo ""
    continue
  fi

  # Default: per-case must_contain (FIXED-STRING match). The special token
  # "Next step" also accepts Spanish equivalents — "Próximo paso",
  # "Siguiente paso" — via grep regex for that token specifically.
  CASE_PASSED=true
  CASE_REASON=""

  PER_CASE_MUST_CONTAIN=$(jq -r ".test_cases[$i].must_contain[]?" "$EVAL_FILE")

  while IFS= read -r token; do
    [[ -z "$token" ]] && continue
    if [[ "$token" == "Next step" ]]; then
      if ! grep -qiE "(next step|pr[oó]ximo paso|siguiente paso|decime |respond[eé] |confirm[aá] |arrancá|empezá|¿cuál)" "$OUTPUT_FILE"; then
        CASE_PASSED=false
        CASE_REASON="output no contiene Next step / Próximo paso / Siguiente paso ni cierre accionable"
        break
      fi
    elif ! grep -qFi -- "$token" "$OUTPUT_FILE"; then
      CASE_PASSED=false
      CASE_REASON="output no contiene token requerido: '$token'"
      break
    fi
  done <<< "$PER_CASE_MUST_CONTAIN"

  if $CASE_PASSED; then
    echo "✅ PASS"
    PASSED=$((PASSED + 1))
  else
    echo "❌ FAIL — $CASE_REASON"
    echo "   Output guardado en: $OUTPUT_FILE"
    FAILED=$((FAILED + 1))
    FAILURES+=("$CASE_NAME_RAW: $CASE_REASON")
  fi
  echo ""
done

# -- Summary ------------------------------------------------------------------

echo "═══════════════════════════════════════"
echo "Resumen: $PASSED/$NUM_CASES casos pasaron"
echo "═══════════════════════════════════════"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "Fallas:"
  for f in "${FAILURES[@]}"; do
    echo "  - $f"
  done
  echo ""
  echo "Outputs completos en: $RESULTS_DIR"
  exit 1
fi

echo ""
echo "✅ Todos los casos pasaron. Agente listo."
