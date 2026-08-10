#!/usr/bin/env bash
# Configure Claude Code CLI to use the remote Panelin MCP Worker (Bearer auth).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN_FILE="${HOME}/.config/bmc/panelin-mcp-token"
MCP_URL="${PANELIN_MCP_URL:-https://panelin-mcp.matias-portugau.workers.dev/mcp}"
NAME="${PANELIN_MCP_NAME:-panelin}"

if ! command -v claude >/dev/null 2>&1; then
  echo "claude CLI not found. Install Claude Code or use stdio: npm run mcp:panelin"
  exit 1
fi

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "Missing token at $TOKEN_FILE"
  echo "Run from workers/panelin-mcp after deploy, or copy MCP_CLIENT_TOKEN there."
  exit 1
fi

TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
if [[ -z "$TOKEN" ]]; then
  echo "Token file is empty: $TOKEN_FILE"
  exit 1
fi

# Remove stale config if present (idempotent re-run).
claude mcp remove "$NAME" 2>/dev/null || true

claude mcp add --transport http "$NAME" "$MCP_URL" \
  --header "Authorization: Bearer ${TOKEN}"

echo ""
echo "Claude Code MCP '$NAME' → $MCP_URL"
echo "Verify: claude mcp get $NAME"
echo ""
echo "Claude WEB (claude.ai): OAuth is NOT supported by this server."
echo "  • If you see 'Request headers' in Add custom connector:"
echo "      authorization = Bearer <token from $TOKEN_FILE>"
echo "      Leave OAuth Client ID/Secret empty."
echo "  • Otherwise use Claude Code CLI (configured above) or: npm run mcp:panelin"
