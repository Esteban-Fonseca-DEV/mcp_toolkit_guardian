# Guardian MCP Toolkit — Métricas Verificables

## Resumen de Métricas

| Categoría | Métrica | Valor | Cómo verificar |
|-----------|---------|-------|----------------|
| Agentes | Agentes especializados | 11 | `packages/*/src/` — cada paquete es un agente |
| Herramientas | Tools MCP registrados | 20+ | `server.tool()` calls en `packages/server/src/server.ts` |
| Testing | Test cases totales | 297+ | `pnpm test -- --reporter=verbose` |
| Testing | Archivos de test | 53 | `find packages -name "*.test.ts" \| wc -l` (excl. node_modules) |
| Testing | Property-Based Tests | 12 archivos PBT | `find packages -name "*.pbt.test.ts"` |
| Testing | Correctness properties | 27 | 12 PBT + 15 propiedades originales del spec |
| Lenguajes | Soportados para análisis | 8 | TS, JS, Go, Python, Dart, C#, Kotlin, Rust |
| Performance | Lambda response time | < 10s | CloudWatch metrics |
| Performance | Dashboard render (SSE) | < 500ms | Animación Chart.js |
| Performance | FileWatcher debounce | 300ms | Configurado en `FileWatcher.ts` |

---

## Detalle por Categoría

### Agentes (11)

| # | Agente | Paquete | Tipo de análisis |
|---|--------|---------|------------------|
| 1 | Clean-Guard | `packages/clean-guard` | Estático (AST) |
| 2 | DDD-Guard | `packages/ddd-guard` | Estático (AST) |
| 3 | SOLID-Copilot | `packages/solid-copilot` | Híbrido (AST + Bedrock) |
| 4 | Security-Guard | `packages/security-guard` | Estático (regex + AST) |
| 5 | Concurrency-Guard | `packages/concurrency-guard` | Estático (AST) |
| 6 | TDD-Strict | `packages/tdd-strict` | Estático (filesystem + git) |
| 7 | Lang-Go | `packages/lang-specialists` | Estático (AST) |
| 8 | Lang-Python | `packages/lang-specialists` | Estático (AST) |
| 9 | Lang-Dart | `packages/lang-specialists` | Estático (AST) |
| 10 | Lang-CSharp | `packages/lang-specialists` | Estático (AST) |
| 11 | Lang-TypeScript | `packages/lang-specialists` | Estático (AST) |

### Herramientas MCP (20+)

| Herramienta | Agente | Descripción |
|-------------|--------|-------------|
| `analyze_ast_imports` | Clean-Guard | Parsea imports de un archivo |
| `validate_layer_boundaries` | Clean-Guard | Valida dependencias entre capas |
| `generate_dependency_graph` | Clean-Guard | Grafo de dependencias completo |
| `check_test_coverage_delta` | TDD-Strict | Verifica tests para archivos modificados |
| `enforce_test_first_sequence` | TDD-Strict | Valida secuencia test-first |
| `generate_tdd_lifecycle_report` | TDD-Strict | Reporte del ciclo Red-Green-Refactor |
| `audit_ddd_encapsulation` | DDD-Guard | Detecta estado mutable público |
| `audit_ddd_aggregate_access` | DDD-Guard | Acceso directo sin Aggregate Root |
| `audit_ddd_bounded_context` | DDD-Guard | Fronteras de bounded context |
| `audit_security_secrets` | Security-Guard | Detecta secretos hardcodeados |
| `audit_security_env_access` | Security-Guard | Verifica process.env en infra |
| `evaluate_single_responsibility` | SOLID-Copilot | Analiza SRP con Bedrock |
| `suggest_interface_segregation` | SOLID-Copilot | Detecta interfaces gordas (ISP) |
| `audit_concurrency` | Concurrency-Guard | Anti-patterns de concurrencia |
| `audit_go_idioms` | Lang-Go | Idioms específicos de Go |
| `audit_python_idioms` | Lang-Python | Anti-patterns de Python |
| `audit_dart_idioms` | Lang-Dart | Patterns de Flutter/Dart |
| `audit_csharp_idioms` | Lang-CSharp | Patterns de .NET/C# |
| `audit_typescript_idioms` | Lang-TypeScript | Patterns de TypeScript |
| `audit_all` | Orchestrator | Auditoría consolidada completa |
| `guardian_configure` | Orchestrator | Auto-configuración del proyecto |
| `guardian_audit_file` | Orchestrator | Auditoría Smart de archivo individual |

### Tests (297+)

#### Por paquete

| Paquete | Archivos de test | Tipo |
|---------|-----------------|------|
| `clean-guard` | 7 | Unit + PBT |
| `cli` | 8 | Unit + PBT |
| `concurrency-guard` | 1 | Unit |
| `dashboard` | 3 | Unit + PBT |
| `ddd-guard` | 6 | Unit + PBT |
| `lang-specialists` | 1 | Unit |
| `security-guard` | 2 | Unit |
| `server` | 7 | Unit + PBT |
| `shared` | 5 | Unit + PBT |
| `solid-copilot` | 9 | Unit + PBT |
| `tdd-strict` | 3 | PBT |

#### Property-Based Tests (12 archivos)

| Archivo | Propiedad verificada |
|---------|---------------------|
| `schemaValidator.pbt.test.ts` | Validación de Schema SOLID_Analysis_Payload |
| `fallback.pbt.test.ts` | Fallback determinístico ante errores |
| `severityMapper.pbt.test.ts` | Mapeo de severidad Bedrock → Guardian |
| `promptBuilder.pbt.test.ts` | Completitud del prompt de análisis |
| `calculations.pbt.test.ts` | Fórmula del Health Score |
| `debounce.pbt.test.ts` | Debounce agrupa cambios correctamente |
| `sseChannel.pbt.test.ts` | Serialización SSE round-trip |
| `eventBus.pbt.test.ts` | EventBus broadcast sin pérdida |
| `excludePaths.pbt.test.ts` | ExcludePaths filtra correctamente |
| `bedrockConfig.pbt.test.ts` | Configuración Bedrock respeta .guardian.json |
| `backoff.pbt.test.ts` | Backoff exponencial produce delays correctos |
| `watchOutput.pbt.test.ts` | Formato de salida incluye información requerida |

### Lenguajes Soportados (8)

| Lenguaje | Extensiones | Agente responsable |
|----------|-------------|-------------------|
| TypeScript | `.ts`, `.tsx` | Clean-Guard, SOLID-Copilot, Concurrency, Security |
| JavaScript | `.js`, `.jsx` | Clean-Guard, Concurrency, Security |
| Go | `.go` | Lang-Go |
| Python | `.py` | Lang-Python |
| Dart | `.dart` | Lang-Dart |
| C# | `.cs` | Lang-CSharp |
| Kotlin | `.kt` | Lang-TypeScript (compartido) |
| Rust | `.rs` | Lang-TypeScript (compartido) |

### Performance

| Métrica | Valor | Condiciones |
|---------|-------|-------------|
| Análisis local (AST) | < 1s | Archivo individual, máquina local |
| Análisis Bedrock (SOLID) | < 10s | Lambda cold start + Bedrock inference |
| FileWatcher debounce | 300ms | Intervalo de agrupación de cambios |
| SSE broadcast | < 50ms | Evento → cliente |
| Dashboard Chart.js render | < 500ms | Animación de transición |
| Reconexión SSE | Backoff exponencial | Max 5 intentos |

### Stack AWS

| Recurso | Servicio | Propósito |
|---------|----------|-----------|
| 6 Lambda Functions | AWS Lambda | Un handler por agente principal |
| 1 REST API | API Gateway | Endpoints para invocación cloud |
| 1 modelo IA | Amazon Bedrock | Claude 3.5 Sonnet (análisis SOLID) |
| 1 modelo fallback | Amazon Bedrock | Claude 3 Haiku (retry) |
| IaC completa | AWS CDK | TypeScript, deployable con `cdk deploy` |

---

## Cómo Verificar

```bash
# Contar test cases
pnpm test -- --reporter=verbose 2>&1 | grep -c "✓\|✗"

# Contar archivos de test (excluyendo node_modules)
find packages -name "*.test.ts" -not -path "*/node_modules/*" | wc -l

# Contar PBT files
find packages -name "*.pbt.test.ts" -not -path "*/node_modules/*" | wc -l

# Contar tools MCP
grep -c "server.tool(" packages/server/src/server.ts

# Ver agentes registrados
ls packages/*/src/index.ts

# Ejecutar todos los tests
pnpm test
```
