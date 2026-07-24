# Guardian MCP Toolkit — Presentación Ejecutiva

## Resumen del Proyecto

**Guardian MCP Toolkit** es una plataforma de auditoría de código en tiempo real que combina análisis estático con inteligencia artificial semántica para detectar violaciones arquitecturales, de seguridad, DDD, SOLID, concurrencia y TDD — en 8 lenguajes de programación.

---

## El Problema

| Desafío | Impacto |
|---------|---------|
| Erosión arquitectural silenciosa | Deuda técnica acumulada |
| Secretos hardcodeados en código | Vulnerabilidades de seguridad |
| Violaciones DDD no detectadas | Modelos de dominio corruptos |
| Falta de disciplina TDD | Código sin cobertura de tests |
| God Objects y Fat Interfaces | Código difícil de mantener |
| Race conditions en producción | Bugs intermitentes costosos |

> Los linters tradicionales detectan errores de sintaxis, pero **no entienden la semántica** de tu arquitectura.

---

## La Solución

### Análisis Híbrido: Estático + IA Semántica

```
┌───────────────────────────────────────────────────┐
│           Guardian MCP Toolkit                    │
│                                                   │
│  ┌─────────┐    ┌───────────────┐    ┌────────┐ │
│  │   CLI   │───▶│  MCP Server   │───▶│Bedrock │ │
│  │  watch  │    │  (11 Agents)  │    │ Claude │ │
│  └────┬────┘    └───────┬───────┘    └────────┘ │
│       │                 │                         │
│       ▼                 ▼                         │
│  ┌─────────┐    ┌───────────────┐                │
│  │Dashboard│◀──▶│   EventBus    │                │
│  │  React  │SSE │   (real-time) │                │
│  └─────────┘    └───────────────┘                │
└───────────────────────────────────────────────────┘
```

---

## Métricas del Proyecto

| Métrica | Valor |
|---------|-------|
| **Agentes especializados** | 11 |
| **Herramientas MCP** | 20+ |
| **Tests automatizados** | 297+ (unit + property-based) |
| **Correctness properties (PBT)** | 27 propiedades verificadas |
| **Lenguajes soportados** | 8 (TS, JS, Go, Python, Dart, C#, Kotlin, Rust) |
| **Archivos de test** | 53 |
| **Tiempo de desarrollo** | 4 días (sprint) |

---

## Stack AWS

### Servicios Utilizados

| Servicio | Uso |
|----------|-----|
| **AWS Lambda** | 6 handlers (uno por agente principal) |
| **Amazon Bedrock** | Claude 3.5 Sonnet para análisis semántico SOLID |
| **AWS CDK** | Infrastructure as Code (TypeScript) |
| **API Gateway** | REST API para invocación cloud |

### Arquitectura Cloud

- **Modelo de ejecución dual**: Local (análisis estático AST) + Cloud (análisis semántico Bedrock)
- **Fallback determinístico**: Si Bedrock falla → análisis local garantizado
- **Retry con backoff exponencial**: `2^(K-1) * 1000ms` con fallback a modelo Haiku
- **Lambda response time**: < 10 segundos

---

## 11 Agentes Especializados

| # | Agente | Función |
|---|--------|---------|
| 1 | **Clean-Guard** | Validación de capas arquitecturales (Clean Architecture) |
| 2 | **DDD-Guard** | Encapsulación, Aggregate Roots, Bounded Contexts |
| 3 | **SOLID-Copilot** | SRP, ISP con Amazon Bedrock (análisis semántico) |
| 4 | **Security-Guard** | Detección de secretos, env access fuera de infra |
| 5 | **Concurrency-Guard** | Race conditions, memory leaks, mutable exports |
| 6 | **TDD-Strict** | Cobertura de tests, test-first sequence |
| 7 | **Lang-Go** | Idioms de Go (interfaces, context, goroutine leaks) |
| 8 | **Lang-Python** | Anti-patterns Python (blocking async, circular imports) |
| 9 | **Lang-Dart** | Flutter patterns (disposed streams, UI logic leaks) |
| 10 | **Lang-CSharp** | .NET patterns (EF en domain, CancellationToken) |
| 11 | **Lang-TypeScript** | TS patterns (explicit any, unhandled promises) |

---

## Diferenciadores Competitivos

### vs. ESLint / SonarQube

| Capacidad | ESLint | SonarQube | **Guardian** |
|-----------|--------|-----------|--------------|
| Análisis de capas arquitecturales | ❌ | Parcial | ✅ Completo |
| DDD (Aggregates, Bounded Contexts) | ❌ | ❌ | ✅ |
| Análisis semántico con IA | ❌ | ❌ | ✅ Bedrock |
| Dashboard en tiempo real | ❌ | Diferido | ✅ SSE live |
| Live Mode (watch) | ❌ | ❌ | ✅ FileWatcher |
| Multi-lenguaje (8) | Parcial | ✅ | ✅ |
| MCP Protocol nativo | ❌ | ❌ | ✅ |
| Property-Based Testing | ❌ | ❌ | ✅ 27 props |

### Ventajas Únicas

1. **Análisis Híbrido** — Combina precisión de AST estático con comprensión semántica de Amazon Bedrock
2. **Dashboard Real-Time** — Visualización instantánea via Server-Sent Events, no polling
3. **Live Mode** — FileWatcher con debounce inteligente detecta cambios en < 2 segundos
4. **MCP Nativo** — Se integra directamente con cualquier IDE que soporte Model Context Protocol
5. **Zero-Config** — Auto-detección de proyecto con `guardian configure`

---

## Funcionalidades Principales

### 1. CLI Completa

```bash
# Auditoría completa de un proyecto
npx guardian audit ./my-project

# Modo watch con dashboard en vivo
npx guardian watch ./my-project --port 4000

# Auto-configuración del proyecto
npx guardian configure ./my-project

# Dashboard standalone
npx guardian dashboard --port 4000
```

### 2. Dashboard Interactivo (React + Chart.js)

- **Health Score** — Gauge animado 0-100
- **Radar Chart** — Compliance por agente
- **Heatmap Grid** — Densidad de violaciones por módulo
- **Connection Indicator** — Estado de conexión SSE
- **Actualización en tiempo real** — < 500ms de latencia

### 3. Live Mode

- **FileWatcher** — Chokidar con debounce de 300ms
- **Smart Router** — Solo ejecuta agentes relevantes según ubicación del archivo
- **EventBus** — Distribución de eventos a N suscriptores sin pérdida
- **SSE Channel** — Broadcast a todos los clientes conectados

---

## GitHub Actions Integration

```yaml
- uses: guardian-mcp-toolkit/action@v1
  with:
    directory: ./src
    fail-on-error: true
```

- Ejecuta auditoría en CI/CD
- Falla el pipeline si detecta violaciones críticas
- Reporte inline en el PR

---

## Roadmap

| Fase | Estado | Descripción |
|------|--------|-------------|
| Sprint 1 | ✅ | Core: 11 agentes, CLI, MCP Server |
| Sprint 2 | ✅ | Bedrock integration, Dashboard, Live Mode |
| Futuro | 🔄 | VS Code Extension, más lenguajes, métricas históricas |

---

## Equipo y Proyecto

- **Hackathon**: AWS + Kiro
- **Duración**: 4 días de sprint
- **Tech Stack**: TypeScript, React, Chart.js, AWS CDK, Amazon Bedrock
- **Monorepo**: pnpm workspaces con 8 paquetes
- **Testing**: Vitest + fast-check (Property-Based Testing)
- **CI/CD**: GitHub Actions con deploy automático a AWS

---

## Conclusión

Guardian MCP Toolkit demuestra que la calidad de código puede ser **continua, automatizada y en tiempo real** — combinando la precisión del análisis estático con la comprensión semántica de la IA generativa, todo integrado nativamente en el flujo de trabajo del desarrollador via Model Context Protocol.
