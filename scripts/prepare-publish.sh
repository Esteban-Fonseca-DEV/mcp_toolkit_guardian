#!/bin/bash
# Prepares the guardian-mcp-toolkit package for npm publication
# Bundles all internal @guardian/* packages into the CLI's dist/
set -euo pipefail

MONOREPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$MONOREPO_ROOT"

echo "📦 Preparing guardian-mcp-toolkit for npm publication..."

# 1. Build everything
pnpm -r run build

# 2. Create a publish directory
PUBLISH_DIR="$MONOREPO_ROOT/publish"
rm -rf "$PUBLISH_DIR"
mkdir -p "$PUBLISH_DIR/dist/node_modules/@guardian"

# 3. Copy CLI dist
cp -r packages/cli/dist/* "$PUBLISH_DIR/dist/"

# 4. Copy all @guardian/* packages into bundled node_modules
for pkg in shared clean-guard tdd-strict ddd-guard security-guard solid-copilot concurrency-guard server dashboard lang-specialists; do
  mkdir -p "$PUBLISH_DIR/dist/node_modules/@guardian/$pkg"
  cp -r "packages/$pkg/dist/"* "$PUBLISH_DIR/dist/node_modules/@guardian/$pkg/"
  cp "packages/$pkg/package.json" "$PUBLISH_DIR/dist/node_modules/@guardian/$pkg/"
done

# 5. Copy README and create a clean package.json
cp packages/cli/README.md "$PUBLISH_DIR/"

# 6. Create the publish package.json WITHOUT workspace deps
cat > "$PUBLISH_DIR/package.json" << 'EOF'
{
  "name": "guardian-mcp-toolkit",
  "version": "1.0.1",
  "description": "Real-time architecture audit toolkit for Clean Architecture, DDD, SOLID, and TDD — supports 8 languages via MCP",
  "main": "dist/index.js",
  "bin": { "guardian": "dist/index.js" },
  "keywords": ["architecture", "clean-architecture", "ddd", "solid", "tdd", "mcp", "audit", "linter", "typescript", "golang", "python", "dart", "csharp"],
  "repository": {
    "type": "git",
    "url": "https://github.com/Estebanfonseca/mcp_toolkit_guardian"
  },
  "license": "MIT",
  "engines": { "node": ">=20.0.0" },
  "dependencies": {
    "commander": "^12.0.0",
    "glob": "^10.0.0",
    "minimatch": "^9.0.0",
    "typescript": "^5.7.0",
    "simple-git": "^3.22.0",
    "ajv": "^8.12.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "vscode-languageserver": "^9.0.0",
    "vscode-languageserver-textdocument": "^1.0.0",
    "zod": "^4.0.0"
  }
}
EOF

echo "✅ Publish package ready at: $PUBLISH_DIR"
echo "   Run: cd publish && npm publish --access public"
