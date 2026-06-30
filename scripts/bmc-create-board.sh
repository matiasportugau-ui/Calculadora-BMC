#!/usr/bin/env bash
#
# bmc-create-board.sh — one command to stand up the "BMC Dev" kanban board.
#
# Creates the GitHub Projects v2 board, sets the 5 columns, links it to the
# repo, and adds the seeded backlog issues (#416-420) into Backlog. The only
# bits the Projects v2 API does NOT expose — column WIP limits and the
# "auto-add" workflow — are printed at the end as two quick clicks.
#
# Prereqs (one time):
#   gh auth login                       # https://cli.github.com
#   gh auth refresh -s project -h github.com   # add 'project' scope
#
# Run:
#   bash scripts/bmc-create-board.sh
#
# Override defaults via env: BMC_OWNER, BMC_REPO, BMC_TITLE.
# Re-runnable: reuses the board if one with the same title already exists.
#
# Docs: docs/team/AGILE.md §7.
set -euo pipefail

OWNER="${BMC_OWNER:-@me}"                              # project owner (you)
REPO="${BMC_REPO:-matiasportugau-ui/Calculadora-BMC}" # repo to link
TITLE="${BMC_TITLE:-BMC Dev}"
ISSUES=(416 417 418 419 420)

say(){  printf '\n\033[1m%s\033[0m\n' "$*"; }
ok(){   printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '  \033[33m!\033[0m %s\n' "$*"; }

# 0) preflight ---------------------------------------------------------------
command -v gh >/dev/null || { echo "✗ gh CLI not found → https://cli.github.com"; exit 1; }
gh auth status -h github.com >/dev/null 2>&1 || { echo "✗ not logged in → run: gh auth login"; exit 1; }
if ! gh auth status -h github.com 2>&1 | grep -qiE "'project'|\bproject\b"; then
  echo "✗ token is missing the 'project' scope. Run this once, then re-run me:"
  echo "      gh auth refresh -s project -h github.com"
  exit 1
fi

# 1) create or reuse the project --------------------------------------------
say "1/5  Project \"$TITLE\" (owner: $OWNER)"
NUM=$(gh project list --owner "$OWNER" --format json \
        --jq ".projects[] | select(.title==\"$TITLE\") | .number" 2>/dev/null | head -1 || true)
if [ -z "${NUM:-}" ]; then
  NUM=$(gh project create --owner "$OWNER" --title "$TITLE" --format json --jq '.number')
  ok "created project #$NUM"
else
  ok "reusing existing project #$NUM"
fi
PID=$(gh project view "$NUM" --owner "$OWNER" --format json --jq '.id')
URL=$(gh project view "$NUM" --owner "$OWNER" --format json --jq '.url')

# 2) link to the repo --------------------------------------------------------
say "2/5  Link to $REPO"
if gh project link "$NUM" --owner "$OWNER" --repo "$REPO" >/dev/null 2>&1; then
  ok "linked (shows under the repo's Projects tab)"
else
  warn "already linked or insufficient perms — skipped"
fi

# 3) set the 5 columns (Status single-select options) ------------------------
say "3/5  Columns: Backlog · Ready · In Progress · In Review · Done"
FID=$(gh project field-list "$NUM" --owner "$OWNER" --format json \
        --jq '.fields[] | select(.name=="Status") | .id' 2>/dev/null | head -1 || true)
if [ -n "${FID:-}" ]; then
  if gh api graphql -f query='mutation{updateProjectV2Field(input:{fieldId:"'"$FID"'",singleSelectOptions:[
        {name:"Backlog",     color:GRAY,   description:"Idea/issue sin refinar"},
        {name:"Ready",       color:BLUE,   description:"DoR ok, lista para tomar (WIP 8)"},
        {name:"In Progress", color:YELLOW, description:"En curso, 1 asignado (WIP 3)"},
        {name:"In Review",   color:ORANGE, description:"PR abierto / CI (WIP 4)"},
        {name:"Done",        color:GREEN,  description:"Merge a main + gate:local verde"}
      ]}){projectV2Field{__typename}}}' >/dev/null 2>&1; then
    ok "5 columns set"
  else
    warn "API rejected the column edit — open the board and rename the Status"
    warn "options by hand to: Backlog, Ready, In Progress, In Review, Done"
  fi
else
  warn "no Status field found — set the 5 columns by hand on the board"
fi

# 4) add the seeded issues, drop them in Backlog -----------------------------
say "4/5  Add issues ${ISSUES[*]} → Backlog"
BACK=$(gh project field-list "$NUM" --owner "$OWNER" --format json \
        --jq '.fields[] | select(.name=="Status") | .options[]? | select(.name=="Backlog") | .id' 2>/dev/null | head -1 || true)
for n in "${ISSUES[@]}"; do
  IID=$(gh project item-add "$NUM" --owner "$OWNER" \
          --url "https://github.com/$REPO/issues/$n" --format json --jq '.id' 2>/dev/null || true)
  if [ -n "${IID:-}" ]; then
    if [ -n "${BACK:-}" ] && [ -n "${FID:-}" ]; then
      gh project item-edit --id "$IID" --project-id "$PID" \
        --field-id "$FID" --single-select-option-id "$BACK" >/dev/null 2>&1 || true
    fi
    ok "#$n added"
  else
    warn "#$n not added (already on the board?)"
  fi
done

# 5) the two UI-only settings ------------------------------------------------
say "5/5  Two clicks the Projects v2 API can't do — finish on the board:"
echo "  • WIP limits:  board → ⋯ on each column → Set limit  →  Ready=8 · In Progress=3 · In Review=4"
echo "  • Auto-add:    ⋯ → Workflows → \"Auto-add to project\" → filter: is:issue is:open"

say "✅ Done.  Open your board:"
echo "   $URL"
