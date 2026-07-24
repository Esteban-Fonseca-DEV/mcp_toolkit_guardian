#!/bin/bash
# Guardian MCP Toolkit — Script de Grabación de Demo (Live Mode)
# Este script automatiza una sesión de demo para grabación de video.
# Muestra guardian watch detectando violaciones en tiempo real.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PATIENT_REPO="$REPO_ROOT/patient-repo"
DASHBOARD_PORT="${DASHBOARD_PORT:-4000}"
VIOLATION_FILE="$PATIENT_REPO/src/domain/DemoViolation.ts"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # Sin color

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🛡️  Guardian MCP Toolkit — Grabación de Demo Live${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ─── Paso 1: Limpiar estado previo ───────────────────────────────────────────
echo -e "${YELLOW}[1/6] Limpiando estado previo...${NC}"
rm -f "$VIOLATION_FILE"
sleep 1

# ─── Paso 2: Iniciar guardian watch en background ────────────────────────────
echo -e "${YELLOW}[2/6] Iniciando guardian watch con dashboard en puerto $DASHBOARD_PORT...${NC}"
cd "$REPO_ROOT"
npx guardian watch "$PATIENT_REPO" --port "$DASHBOARD_PORT" &
WATCH_PID=$!
sleep 3
echo -e "${GREEN}  ✓ Guardian watch activo (PID: $WATCH_PID)${NC}"
echo -e "${GREEN}  ✓ Dashboard disponible en http://localhost:$DASHBOARD_PORT${NC}"
echo ""

# ─── Paso 3: Abrir dashboard en navegador ────────────────────────────────────
echo -e "${YELLOW}[3/6] Abriendo dashboard en navegador...${NC}"
if command -v xdg-open &> /dev/null; then
  xdg-open "http://localhost:$DASHBOARD_PORT" 2>/dev/null || true
elif command -v open &> /dev/null; then
  open "http://localhost:$DASHBOARD_PORT" 2>/dev/null || true
fi
sleep 2

# ─── Paso 4: Introducir violación arquitectural ─────────────────────────────
echo -e "${YELLOW}[4/6] Introduciendo violación de arquitectura en patient-repo...${NC}"
echo ""
echo -e "${RED}  📝 Creando src/domain/DemoViolation.ts con import ilegal...${NC}"

cat > "$VIOLATION_FILE" << 'EOF'
// ❌ VIOLACIÓN INTENCIONADA: Domain importando de Infrastructure
import { UserRepository } from '../infrastructure/UserRepository';
import { Logger } from '../infrastructure/Logger';

// ❌ VIOLACIÓN: Secret hardcodeado en domain
const API_KEY = 'sk-live-abc123secretkey456';

// ❌ VIOLACIÓN: process.env en domain layer
const config = process.env.DATABASE_URL;

// ❌ VIOLACIÓN SRP: Clase con múltiples responsabilidades
export class DemoViolation {
  public mutableState: string = 'exposed'; // ❌ DDD: estado mutable público

  constructor(private repo: UserRepository) {}

  async authenticate(user: string, pass: string): Promise<boolean> {
    return this.repo.findByCredentials(user, pass) !== null;
  }

  async sendEmail(to: string, body: string): Promise<void> {
    console.log(`Sending email to ${to}`);
  }

  async generateReport(): Promise<string> {
    return 'report';
  }

  async cacheUser(id: string): Promise<void> {
    console.log(`Caching ${id}`);
  }

  async validateInput(data: unknown): Promise<boolean> {
    return data !== null;
  }

  async logActivity(action: string): Promise<void> {
    console.log(action);
  }
}
EOF

sleep 1
echo -e "${GREEN}  ✓ Archivo con violaciones creado${NC}"
echo ""

# ─── Paso 5: Esperar detección y análisis ────────────────────────────────────
echo -e "${YELLOW}[5/6] Esperando detección del FileWatcher (debounce 300ms + análisis)...${NC}"
echo ""
sleep 8

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  📊 Violaciones detectadas en tiempo real ↑${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}  ✓ El dashboard en http://localhost:$DASHBOARD_PORT muestra:${NC}"
echo -e "    • Health Score actualizado"
echo -e "    • Radar Chart con compliance por agente"
echo -e "    • Heatmap con el nuevo archivo marcado"
echo ""

sleep 5

# ─── Paso 6: Cleanup ────────────────────────────────────────────────────────
echo -e "${YELLOW}[6/6] Limpiando...${NC}"
rm -f "$VIOLATION_FILE"
kill "$WATCH_PID" 2>/dev/null || true
wait "$WATCH_PID" 2>/dev/null || true

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Demo completada exitosamente${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Violaciones demostradas:"
echo -e "  • LAYER_VIOLATION — Domain → Infrastructure"
echo -e "  • SECRET_EXPOSED — API key hardcodeada"
echo -e "  • ENV_ACCESS_OUTSIDE_INFRA — process.env en domain"
echo -e "  • SRP_GOD_OBJECT — Clase con 6+ responsabilidades"
echo -e "  • DDD_MUTABLE_PUBLIC_STATE — Propiedad pública mutable"
echo ""
