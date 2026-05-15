#!/usr/bin/env bash
# Eval runner for the bmc-paneelindev subagent
# Usage: bash .claude/agents/evals/run-bmc-paneelindev.sh
# Requires: claude (Claude Code CLI), jq

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVAL_FILE="$SCRIPT_DIR/bmc-paneelindev.json"
RESULTS_DIR="$SCRIPT_DIR/results/bmc-paneelindev-$(date +%Y%m%d-%H%M%S)"

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
MUST_CONTAIN=$(jq -r '.success_criteria.must_contain[]' "$EVAL_FILE")
MUST_NOT_CONTAIN=$(jq -r '.success_criteria.must_not_contain[]' "$EVAL_FILE")

echo ""
echo "▶ Eval para agente: $AGENT_NAME"
echo "▶ Casos: $NUM_CASES"
echo "▶ Resultados: $RESULTS_DIR"
echo ""

# -- Run each test case -------------------------------------------------------

PASSED=0
FAILED=0
FAILURES=()

for i in $(seq 0 $((NUM_CASES - 1))); do
  CASE_NAME=$(jq -r ".test_cases[$i].name" "$EVAL_FILE")
  CASE_PROMPT=$(jq -r ".test_cases[$i].prompt" "$EVAL_FILE")
  CASE_EXPECTED=$(jq -r ".test_cases[$i].expected_behavior" "$EVAL_FILE")

  echo "─── Caso $((i+1))/$NUM_CASES: $CASE_NAME ───"
  echo "Prompt: $CASE_PROMPT"

  OUTPUT_FILE="$RESULTS_DIR/case-$((i+1))-$CASE_NAME.txt"

  # Run the agent via Claude Code headless mode
  if ! claude -p "$CASE_PROMPT" > "$OUTPUT_FILE" 2>&1; then
    echo "❌ FAIL — claude -p devolvió error. Ver $OUTPUT_FILE"
    FAILED=$((FAILED + 1))
    FAILURES+=("$CASE_NAME: claude error")
    continue
  fi

  # Special handling for case 2 (ambiguous-input-clarify): pass if the agent
  # EITHER asks a single clarification question OR enters brainstormer mode
  # with ≥3 enumerated frentes + a recomendación (both are valid ambiguity
  # handling per the system prompt).
  if [[ "$CASE_NAME" == "ambiguous-input-clarify" ]]; then
    # Path A: ≥3 enumerated options (lettered abc/markdown OR numeric 1/2/3) — any mode
    LETTERED_COUNT=$(grep -cE "(^|[-*\(\| ])\*?\*?\(?[abc]\)" "$OUTPUT_FILE" || true)
    NUMERIC_COUNT=$(grep -cE "(^[[:space:]]*\*?\*?[1-9]\.|\*\*[1-9]\.)" "$OUTPUT_FILE" || true)
    if [ "$LETTERED_COUNT" -ge 3 ] || [ "$NUMERIC_COUNT" -ge 3 ]; then
      echo "✅ PASS — enumerated options detected (letters=$LETTERED_COUNT numeric=$NUMERIC_COUNT)"
      PASSED=$((PASSED + 1))
      echo ""
      continue
    fi
    # Path B: clarification phrasing keywords
    if grep -qiE "(¿cuál|qué (querés|preferís|elegís)|plan estructurado|ideas para|cambios al código|desambiguar)" "$OUTPUT_FILE"; then
      echo "✅ PASS — clarification phrasing detected"
      PASSED=$((PASSED + 1))
      echo ""
      continue
    fi
    echo "❌ FAIL — neither enumerated options nor clarification phrasing detected"
    FAILED=$((FAILED + 1))
    FAILURES+=("$CASE_NAME: no clarification nor brainstormer route")
    echo ""
    continue
  fi

  # Special handling for case 3 (defer-to-specialist): should mention a specialist name
  if [[ "$CASE_NAME" == "defer-to-specialist" ]]; then
    if grep -qiE "(bmc-calc-specialist|bmc-fiscal)" "$OUTPUT_FILE"; then
      echo "✅ PASS — defers to specialist"
      PASSED=$((PASSED + 1))
    else
      echo "❌ FAIL — expected specialist reference but didn't find one"
      FAILED=$((FAILED + 1))
      FAILURES+=("$CASE_NAME: no specialist reference")
    fi
    echo ""
    continue
  fi

  # Default: check must_contain criteria (case-insensitive).
  # Special token "Next step" also accepts Spanish equivalents:
  # "Próximo paso", "Siguiente paso", "Next step".
  CASE_PASSED=true
  CASE_REASON=""

  while IFS= read -r token; do
    [[ -z "$token" ]] && continue
    if [[ "$token" == "Next step" ]]; then
      # Accept English/Spanish "Next step" headers OR an imperative closing
      # call-to-action (Decime / Respondé / Confirmá / Arrancá / Empezá / ¿Cuál...?).
      # These mean the agent ended with a concrete action ask, even without a
      # literal label header — same intent, different surface.
      if ! grep -qiE "(next step|pr[oó]ximo paso|siguiente paso|decime |respond[eé] |confirm[aá] |arrancá|empezá|¿cuál)" "$OUTPUT_FILE"; then
        CASE_PASSED=false
        CASE_REASON="output no contiene Next step / Próximo paso / Siguiente paso ni cierre accionable"
        break
      fi
    elif ! grep -qi -- "$token" "$OUTPUT_FILE"; then
      CASE_PASSED=false
      CASE_REASON="output no contiene token requerido: '$token'"
      break
    fi
  done <<< "$MUST_CONTAIN"

  # Check must_not_contain criteria (case-insensitive)
  if $CASE_PASSED; then
    while IFS= read -r token; do
      [[ -z "$token" ]] && continue
      if grep -qi -- "$token" "$OUTPUT_FILE"; then
        CASE_PASSED=false
        CASE_REASON="output contiene token prohibido: '$token'"
        break
      fi
    done <<< "$MUST_NOT_CONTAIN"
  fi

  if $CASE_PASSED; then
    echo "✅ PASS"
    PASSED=$((PASSED + 1))
  else
    echo "❌ FAIL — $CASE_REASON"
    echo "   Output guardado en: $OUTPUT_FILE"
    FAILED=$((FAILED + 1))
    FAILURES+=("$CASE_NAME: $CASE_REASON")
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
