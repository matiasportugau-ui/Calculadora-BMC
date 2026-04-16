#!/usr/bin/env zsh
# Optional shell helpers for Calculadora-BMC (aligned with AGENTS.md / package.json).
# Usage: add one line to ~/.zshrc (adjust path):
#   source "/Users/you/.../Calculadora-BMC/scripts/shell-aliases-calculadora-bmc.zsh"

emulate -L zsh
local _here=${${(%):-%x}:A}
export CALCULADORA_BMC_ROOT="${CALCULADORA_BMC_ROOT:-${_here:h:h}}"
alias calc="cd \"\$CALCULADORA_BMC_ROOT\""
alias calcls="ls -la \"\$CALCULADORA_BMC_ROOT\""
alias calcdev='(cd "$CALCULADORA_BMC_ROOT" && npm run dev:full)'
alias calcdevvite='(cd "$CALCULADORA_BMC_ROOT" && npm run dev)'
alias calcapionly='(cd "$CALCULADORA_BMC_ROOT" && npm run start:api)'
alias calcbuild='(cd "$CALCULADORA_BMC_ROOT" && npm run build)'
alias calctest='(cd "$CALCULADORA_BMC_ROOT" && npm test)'
alias calclint='(cd "$CALCULADORA_BMC_ROOT" && npm run lint)'
alias calcgate='(cd "$CALCULADORA_BMC_ROOT" && npm run gate:local)'
alias calcgatefull='(cd "$CALCULADORA_BMC_ROOT" && npm run gate:local:full)'
alias calcsetup='(cd "$CALCULADORA_BMC_ROOT" && npm run workspace:start)'
alias cursoropen='cursor "$CALCULADORA_BMC_ROOT"'
