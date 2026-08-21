#!/usr/bin/env bash
# Eval runner for the bmc-logistica subagent
# Usage: bash .claude/agents/evals/run-bmc-logistica.sh
# Requires: claude (Claude Code CLI), jq

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVAL_FILE="$SCRIPT_DIR/bmc-logistica.json"
RESULTS_DIR="$SCRIPT_DIR/results/bmc-logistica-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$RESULTS_DIR"

if ! command -v claude >/dev/null 2>&1; then
  echo "❌ Claude Code CLI no encontrado. Instalalo desde https://claude.com/code" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq no encontrado. Instalalo: brew install jq" >&2
  exit 1
fi

if [[ ! -f "$EVAL_FILE" ]]; then
  echo "❌ No encuentro $EVAL_FILE" >&2
  exit 1
fi

AGENT_NAME=$(jq -r '.agent_name' "$EVAL_FILE")
NUM_CASES=$(jq '.test_cases | length' "$EVAL_FILE")
MUST_CONTAIN=$(jq -r '.success_criteria.must_contain[]' "$EVAL_FILE")
MUST_NOT_CONTAIN=$(jq -r '.success_criteria.must_not_contain[]' "$EVAL_FILE")

echo ""
echo "▶ Eval para agente: $AGENT_NAME"
echo "▶ Casos: $NUM_CASES"
echo "▶ Resultados: $RESULTS_DIR"
echo ""

PASSED=0
FAILED=0
FAILURES=()

for i in $(seq 0 $((NUM_CASES - 1))); do
  CASE_NAME=$(jq -r ".test_cases[$i].name" "$EVAL_FILE")
  CASE_PROMPT=$(jq -r ".test_cases[$i].prompt" "$EVAL_FILE")

  echo "─── Caso $((i+1))/$NUM_CASES: $CASE_NAME ───"
  echo "Prompt: $CASE_PROMPT"

  OUTPUT_FILE="$RESULTS_DIR/case-$((i+1))-$CASE_NAME.txt"

  if ! claude -p "$CASE_PROMPT" > "$OUTPUT_FILE" 2>&1; then
    echo "❌ FAIL — claude -p devolvió error. Ver $OUTPUT_FILE"
    FAILED=$((FAILED + 1))
    FAILURES+=("$CASE_NAME: claude error")
    continue
  fi

  CASE_PASSED=true
  CASE_REASON=""

  while IFS= read -r token; do
    [[ -z "$token" ]] && continue
    if ! grep -q -- "$token" "$OUTPUT_FILE"; then
      CASE_PASSED=false
      CASE_REASON="output no contiene token requerido: '$token'"
      break
    fi
  done <<< "$MUST_CONTAIN"

  if $CASE_PASSED; then
    while IFS= read -r token; do
      [[ -z "$token" ]] && continue
      if grep -q -- "$token" "$OUTPUT_FILE"; then
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
