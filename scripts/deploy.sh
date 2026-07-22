#!/bin/bash
# Guardian MCP Toolkit — Deploy to AWS
set -euo pipefail

echo "🚀 Guardian MCP Toolkit — AWS Deploy"
echo "======================================"

MONOREPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$MONOREPO_ROOT"

# Step 1: Build all packages
echo ""
echo "📦 Building packages..."
pnpm build

# Step 2: Bundle Lambda handlers with dependencies
echo ""
echo "📦 Bundling Lambda package..."
bash scripts/bundle-lambda.sh

# Step 3: Prepare Lambda Layer (typescript for AST parsing)
echo ""
echo "📂 Preparing Lambda Layer..."
rm -rf layers/shared
mkdir -p layers/shared/nodejs/node_modules/typescript/lib
cp -L node_modules/typescript/package.json layers/shared/nodejs/node_modules/typescript/
cp -L node_modules/typescript/lib/typescript.js layers/shared/nodejs/node_modules/typescript/lib/

# Step 4: Install infra dependencies
echo ""
echo "📥 Installing CDK dependencies..."
cd infra
npm install

# Step 5: Synth (validate template)
echo ""
echo "🔍 Synthesizing CloudFormation template..."
npx cdk synth --quiet

# Step 6: Deploy
echo ""
echo "🚀 Deploying to AWS..."
npx cdk deploy --require-approval never

echo ""
echo "✅ Deploy complete!"
echo ""
echo "Set the API URL in your .guardian.json:"
echo '  "executionMode": "cloud"'
echo ""
echo "And set the environment variable:"
echo '  export GUARDIAN_API_URL=<ApiUrl from output above>'
