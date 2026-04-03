#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="$REPO_ROOT/scripts/knowledge-antenna-env-ensure.sh"

echo "[knowledge-env-regression] target: $TARGET"

# 1) Structural guard: keep explicit repo-root cd in install branch.
if ! awk '
  /ensure_repo_deps\(\)/ { in_fn=1 }
  in_fn && /\(\s*$/ { in_subshell=1 }
  in_fn && in_subshell && /cd "\$REPO_ROOT"/ { seen_cd=1 }
  in_fn && in_subshell && /npm (ci|install) --silent/ && !seen_cd { bad=1 }
  in_fn && /^}/ { in_fn=0; in_subshell=0 }
  END { exit(bad ? 1 : 0) }
' "$TARGET"; then
  echo "[knowledge-env-regression][error] npm install branch is not anchored to \$REPO_ROOT." >&2
  exit 1
fi

echo "[knowledge-env-regression] structural guard OK"

# 2) Runtime guard: script must pass when invoked from uncontrolled CWD.
(
  cd /
  bash "$TARGET" check
)

echo "[knowledge-env-regression] runtime guard OK"
