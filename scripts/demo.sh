#!/bin/bash
# Guardian MCP Toolkit — Demo Script (Local Mode)
set -euo pipefail

echo "🛡️  Guardian MCP Toolkit — Demo (Modo Local)"
echo "============================================="
echo ""
echo "📁 Analizando patient-repo/ con violaciones intencionadas..."
echo ""

cd "$(dirname "$0")/.."

# Run the CLI audit command against the patient repo
npx guardian audit ./patient-repo --format text 2>&1 || true

echo ""
echo "📊 Resultado esperado: FAILED (6+ violations detectadas)"
echo ""
echo "🔍 Ahora ejecutando en formato JSON..."
echo ""

npx guardian audit ./patient-repo --format json 2>/dev/null || true

echo ""
echo "✅ Demo completada."
