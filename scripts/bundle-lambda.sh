#!/bin/bash
# Bundle Lambda handlers with all their dependencies for AWS deployment
# Handles pnpm monorepo symlink structure by resolving real paths
# Creates a flat node_modules structure for Lambda compatibility
set -euo pipefail

MONOREPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$MONOREPO_ROOT"

BUNDLE_DIR="$MONOREPO_ROOT/lambda-bundle"
PNPM_STORE="$MONOREPO_ROOT/node_modules/.pnpm"

echo "📦 Bundling Lambda deployment package..."

# Clean previous bundle
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR/node_modules/@guardian"

# 1. Copy compiled Lambda handlers
cp packages/lambda/dist/*.js "$BUNDLE_DIR/"
cp packages/lambda/dist/*.js.map "$BUNDLE_DIR/" 2>/dev/null || true

# 2. Copy all @guardian/* packages (compiled dist/ folder + package.json)
for pkg in shared clean-guard tdd-strict ddd-guard security-guard solid-copilot concurrency-guard; do
  mkdir -p "$BUNDLE_DIR/node_modules/@guardian/$pkg/dist"
  cp -r "packages/$pkg/dist/"* "$BUNDLE_DIR/node_modules/@guardian/$pkg/dist/"
  cp "packages/$pkg/package.json" "$BUNDLE_DIR/node_modules/@guardian/$pkg/"
done

# 3. Copy external dependencies into a flat node_modules
# This function copies a package from the .pnpm store into the flat bundle
copy_from_pnpm() {
  local pkg_name="$1"
  local pkg_pattern="$2"  # glob pattern for version folder name

  # Skip if already copied
  if [ -d "$BUNDLE_DIR/node_modules/$pkg_name" ]; then
    return
  fi

  # Find in .pnpm store
  local store_dir
  store_dir=$(find "$PNPM_STORE" -maxdepth 1 -type d -name "${pkg_pattern}" | head -1)
  if [ -n "$store_dir" ] && [ -d "$store_dir/node_modules/$pkg_name" ]; then
    cp -rL "$store_dir/node_modules/$pkg_name" "$BUNDLE_DIR/node_modules/" 2>/dev/null || true
  fi
}

# minimatch and its transitive deps
copy_from_pnpm "minimatch" "minimatch@9*"
copy_from_pnpm "brace-expansion" "brace-expansion@2*"
copy_from_pnpm "balanced-match" "balanced-match@*"

# glob and its transitive deps
GLOB_STORE=$(find "$PNPM_STORE" -maxdepth 1 -type d -name "glob@10*" | head -1)
if [ -n "$GLOB_STORE" ] && [ -d "$GLOB_STORE/node_modules" ]; then
  for dep in $(ls "$GLOB_STORE/node_modules/"); do
    if [ "$dep" != "glob" ] && [ ! -d "$BUNDLE_DIR/node_modules/$dep" ]; then
      cp -rL "$GLOB_STORE/node_modules/$dep" "$BUNDLE_DIR/node_modules/" 2>/dev/null || true
    fi
  done
fi
copy_from_pnpm "glob" "glob@10*"

# path-scurry transitive deps (lru-cache)
PATH_SCURRY_STORE=$(find "$PNPM_STORE" -maxdepth 1 -type d -name "path-scurry@*" | head -1)
if [ -n "$PATH_SCURRY_STORE" ] && [ -d "$PATH_SCURRY_STORE/node_modules" ]; then
  for dep in $(ls "$PATH_SCURRY_STORE/node_modules/"); do
    if [ "$dep" != "path-scurry" ] && [ ! -d "$BUNDLE_DIR/node_modules/$dep" ]; then
      cp -rL "$PATH_SCURRY_STORE/node_modules/$dep" "$BUNDLE_DIR/node_modules/" 2>/dev/null || true
    fi
  done
fi

# simple-git and its transitive deps (used by tdd-strict)
copy_from_pnpm "simple-git" "simple-git@*"

# simple-git sub-packages (scoped under @simple-git)
SIMPLE_GIT_STORE="$PNPM_STORE/simple-git@3*/node_modules"
if [ -d "$(echo $SIMPLE_GIT_STORE)" 2>/dev/null ]; then
  SIMPLE_GIT_STORE_RESOLVED=$(find "$PNPM_STORE" -maxdepth 1 -type d -name "simple-git@3*" | head -1)/node_modules
  if [ -d "$SIMPLE_GIT_STORE_RESOLVED/@simple-git" ]; then
    mkdir -p "$BUNDLE_DIR/node_modules/@simple-git"
    cp -rL "$SIMPLE_GIT_STORE_RESOLVED/@simple-git/"* "$BUNDLE_DIR/node_modules/@simple-git/"
  fi
  if [ -d "$SIMPLE_GIT_STORE_RESOLVED/@kwsites" ]; then
    mkdir -p "$BUNDLE_DIR/node_modules/@kwsites"
    cp -rL "$SIMPLE_GIT_STORE_RESOLVED/@kwsites/"* "$BUNDLE_DIR/node_modules/@kwsites/"
  fi
  if [ -d "$SIMPLE_GIT_STORE_RESOLVED/debug" ]; then
    cp -rL "$SIMPLE_GIT_STORE_RESOLVED/debug" "$BUNDLE_DIR/node_modules/"
  fi
fi

# debug depends on ms
copy_from_pnpm "ms" "ms@*"

# ajv and its transitive deps (used by shared for JSON schema validation)
copy_from_pnpm "ajv" "ajv@8*"
copy_from_pnpm "fast-deep-equal" "fast-deep-equal@*"
copy_from_pnpm "json-schema-traverse" "json-schema-traverse@*"
copy_from_pnpm "uri-js" "uri-js@*"

# typescript (used by clean-guard AST parser, ddd-guard, etc.)
# Only the runtime lib is needed — copy just what's essential
copy_from_pnpm "typescript" "typescript@5*"

echo ""
echo "✅ Bundle created at: $BUNDLE_DIR"
echo "   Size: $(du -sh "$BUNDLE_DIR" | cut -f1)"
echo "   Files: $(find "$BUNDLE_DIR" -type f | wc -l)"
echo ""
echo "   Contents of node_modules/:"
ls "$BUNDLE_DIR/node_modules/" | sed 's/^/     /'
