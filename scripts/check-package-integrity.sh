#!/usr/bin/env bash
# ============================================
# SoulCache Package Integrity Check
# Verifies that no unwanted files leak into
# published packages (tests, tsbuildinfo,
# node_modules, source files)
# ============================================

set -euo pipefail

PACKAGES=(core react devtools devtools-core)
LEAK_FOUND=false

echo "========================================="
echo "  SoulCache Package Integrity Check"
echo "========================================="
echo ""

for pkg in "${PACKAGES[@]}"; do
  echo "Checking package: $pkg"

  PACK_DIR="$(mktemp -d)"
  PACK_OUTPUT="$PACK_DIR/pack-output.txt"

  if npm pack "./packages/$pkg" --dry-run >"$PACK_OUTPUT" 2>&1; then
    echo "  Package $pkg: Pack successful"
  else
    echo "  ERROR: Failed to pack $pkg"
    LEAK_FOUND=true
    rm -rf "$PACK_DIR"
    continue
  fi

  LEAKS="$(grep -iE '\.test\.|\.spec\.|tsbuildinfo|node_modules|src/' "$PACK_OUTPUT" || true)"
  if [ -n "$LEAKS" ]; then
    echo "  LEAK DETECTED in $pkg:"
    echo "$LEAKS"
    LEAK_FOUND=true
  else
    echo "  $pkg: No leaks detected"
  fi

  if ! grep -q "dist/index.js" "$PACK_OUTPUT"; then
    echo "  WARNING: dist/index.js not found in $pkg package"
    LEAK_FOUND=true
  fi
  if ! grep -q "dist/index.d.ts" "$PACK_OUTPUT"; then
    echo "  WARNING: dist/index.d.ts not found in $pkg package"
    LEAK_FOUND=true
  fi

  rm -rf "$PACK_DIR"
  echo ""
done

echo "========================================="
if [ "$LEAK_FOUND" = true ]; then
  echo "  RESULT: LEAKS DETECTED"
  echo "========================================="
  exit 1
else
  echo "  RESULT: All packages clean"
  echo "========================================="
  exit 0
fi
