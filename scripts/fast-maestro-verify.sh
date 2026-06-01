#!/usr/bin/env bash
# Fast, targeted verification for Productos Maestro only.
# Use this when full gate:local:full is too slow or times out.
# This is NOT a replacement for the full gate, but a pragmatic tool during development.

set -euo pipefail

echo "=== Productos Maestro — Fast Targeted Verification ==="
echo

echo "1. Linting maestro-related files..."
npm run lint -- \
  src/components/ProductosMaestroEditor.jsx \
  src/components/StockWebHint.jsx \
  src/components/ConfigPanel.jsx \
  src/components/PanelinCalculadoraV3_backup.jsx \
  server/lib/productosMaestro.js \
  server/routes/bmcDashboard.js \
  tests/sheetsCsvGuard.test.js 2>&1 | tail -20

echo
echo "2. Running maestro reconcile..."
npm run productos-maestro:reconcile 2>&1 | tail -10

echo
echo "3. Building (quick check)..."
npm run build 2>&1 | tail -15

echo
echo "=== Fast Maestro Verification Complete ==="
echo "Note: This is a lightweight check. Full gate:local:full is still required for production sign-off."