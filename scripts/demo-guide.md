# Guía de Demo — Guardian MCP Toolkit

## Prerrequisitos

1. **Node.js 20+** — Verificar con `node --version`
2. **pnpm** — Instalar con `npm install -g pnpm` (versión 9+)

## Instalación

```bash
cd guardian-mcp-toolkit
pnpm install
pnpm build
```

## 1. Ejecutar Demo Local

La forma más rápida de ver Guardian en acción:

```bash
bash scripts/demo.sh
```

Este script:
- Ejecuta `guardian audit` sobre el repositorio paciente (`patient-repo/`)
- Muestra las violaciones detectadas en formato texto
- Luego ejecuta en formato JSON para ver la estructura completa del reporte

## 2. Ejecutar CLI Directamente

```bash
# Formato texto (legible)
npx guardian audit ./patient-repo

# Formato JSON (para CI/CD)
npx guardian audit ./patient-repo --format json

# Fallar también con warnings
npx guardian audit ./patient-repo --fail-on warning
```

### Exit codes:
- `0` — Sin violaciones que superen el umbral
- `1` — Violaciones detectadas
- `2` — Error de configuración o path inválido

## 3. Conectar Servidor MCP al IDE

Agregar a `.kiro/settings/mcp.json` (o configuración equivalente de tu IDE):

```json
{
  "mcpServers": {
    "guardian": {
      "command": "node",
      "args": ["packages/server/dist/main.js"],
      "cwd": "/ruta/a/guardian-mcp-toolkit"
    }
  }
}
```

Una vez conectado, las tools de Guardian aparecen en tu IDE:
- `analyze_ast_imports` — Analizar imports de un archivo
- `validate_layer_boundaries` — Validar dependencia entre capas
- `generate_dependency_graph` — Generar grafo de dependencias
- `check_test_coverage_delta` — Verificar cobertura de tests
- `enforce_test_first_sequence` — Validar secuencia TDD
- `generate_tdd_lifecycle_report` — Generar reporte ciclo TDD
- `audit_ddd_encapsulation` — Detectar estado mutable público
- `audit_ddd_aggregate_access` — Verificar acceso a agregados
- `audit_ddd_bounded_context` — Validar fronteras de contexto
- `audit_all` — Ejecutar todos los agentes

## 4. Violaciones del Patient Repo

El `patient-repo/` contiene violaciones intencionadas:

### Clean Architecture (Clean-Guard):
- `src/domain/UserService.ts` — Importa desde infrastructure (línea 1)
- `src/domain/OrderService.ts` — Importa desde infrastructure (línea 1)
- `src/domain/ProductService.ts` — Importa desde infrastructure (línea 1)

### TDD (TDD-Strict):
- `src/application/PaymentService.ts` — Sin archivo de test correspondiente

### DDD (DDD-Guard):
- `src/domain/Order.ts` — Propiedad `status` mutable pública
- `src/application/OrderService.ts` — Import directo a entidad interna del agregado

## 5. Corregir Violaciones

Para demostrar que Guardian pasa cuando el código está limpio:

1. Eliminar imports de infrastructure en archivos de domain
2. Agregar archivos `.test.ts` para cada servicio
3. Marcar propiedades de dominio como `readonly` o `private`
4. Importar solo el Aggregate Root en lugar de entidades internas

```bash
# Después de corregir:
npx guardian audit ./patient-repo
# Exit code: 0 ✓
```

## 6. Puntos Clave para la Presentación

1. **Arquitectura Extensible** — Sistema de agentes pluggables vía `IAgent`
2. **Análisis Real** — Usa TypeScript Compiler API para AST parsing
3. **10 Tools MCP** — Exposición completa vía Model Context Protocol
4. **Modo Dual** — Ejecución local y cloud (AWS Lambda)
5. **CLI para CI/CD** — `guardian audit` con exit codes estándar
6. **20 Property Tests** — Verificación formal con fast-check
7. **3 Agentes Especializados** — Clean Architecture, TDD, DDD
8. **Zero Config** — Ruleset por defecto + personalizable vía `.guardian.json`
9. **Demo Reproducible** — Patient repo con violaciones documentadas
10. **TypeScript Puro** — Monorepo pnpm con zero runtime dependencies externas pesadas
