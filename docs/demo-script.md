# Guión Narrativo — Guardian MCP Toolkit (Demo 3 minutos)

## Estructura del Video

| Segmento | Tiempo | Contenido |
|----------|--------|-----------|
| El Problema | 0:00 – 0:30 | Erosión arquitectural y falta de disciplina TDD |
| La Solución | 0:30 – 1:15 | Guardian CLI, MCP Hub, 11 Agentes Híbridos |
| Live Demo | 1:15 – 2:30 | Edición de código en vivo, detección real-time, Dashboard |
| Métricas y AWS | 2:30 – 3:00 | Stack AWS, números clave, conclusiones |

---

## 🎬 El Problema (0:00 – 0:30)

### Narración

> "En equipos de desarrollo, la arquitectura se erosiona silenciosamente.
> Los imports ilegales se acumulan, los secretos se hardcodean, las clases
> crecen sin control, y nadie se da cuenta hasta que es demasiado tarde."

### Visual

- Mostrar código con violaciones en `patient-repo/`:
  - Domain importando de Infrastructure
  - API keys hardcodeadas en código fuente
  - Clase `UserManager` con 12 métodos (God Object)
- Texto superpuesto: "¿Quién vigila la calidad mientras programas?"

---

## 🛡️ La Solución (0:30 – 1:15)

### Narración

> "Guardian MCP Toolkit es una plataforma de auditoría de código en tiempo real.
> 11 agentes especializados analizan tu código mientras escribes — arquitectura limpia,
> DDD, SOLID, seguridad, concurrencia, TDD — en 8 lenguajes de programación."

### Visual

- Diagrama de arquitectura: CLI → MCP Server → 11 Agentes → Bedrock (análisis semántico)
- Lista de agentes con iconos:
  - 🏗️ Clean-Guard (capas arquitecturales)
  - 🧩 DDD-Guard (agregados, bounded contexts)
  - 📐 SOLID-Copilot (SRP, ISP con Amazon Bedrock)
  - 🔒 Security-Guard (secretos, env access)
  - ⚡ Concurrency-Guard (race conditions, memory leaks)
  - 🧪 TDD-Strict (cobertura, test-first)
  - 🌍 Lang-Specialists (Go, Python, Dart, C#, Kotlin, Rust)
- Texto: "Análisis híbrido: estático + semántico con IA (Amazon Bedrock)"

### Puntos Clave

1. **Model Context Protocol (MCP)** — Integración nativa con cualquier IDE compatible
2. **Análisis Híbrido** — AST estático + análisis semántico con Claude 3.5 Sonnet
3. **Multi-lenguaje** — TypeScript, JavaScript, Go, Python, Dart, C#, Kotlin, Rust
4. **Zero-config** — Auto-detección de proyecto con `guardian configure`

---

## 💻 Live Demo (1:15 – 2:30)

### Preparación

Terminal abierta en la raíz del monorepo.

### Secuencia de Comandos

```bash
# 1. Iniciar modo watch con dashboard
npx guardian watch ./patient-repo --port 4000
```

### Narración durante Live Demo

> "Voy a editar código en vivo. Guardian está observando los archivos
> con un FileWatcher. Cualquier cambio dispara análisis automático."

### Acción en Vivo

1. **Abrir navegador** → `http://localhost:4000` (Dashboard con Health Score, Radar Chart)
2. **Editar archivo** → Crear `src/domain/DemoViolation.ts` con:
   - Import ilegal de Infrastructure
   - Secret hardcodeado
   - Clase con múltiples responsabilidades
3. **Observar terminal** → Violaciones aparecen en stderr en < 2 segundos
4. **Observar dashboard** → Health Score baja, Radar Chart se actualiza, Heatmap marca archivo

### Narración del resultado

> "En menos de 2 segundos: 5 violaciones detectadas. El dashboard se actualiza
> en tiempo real via Server-Sent Events. Cada agente reporta independientemente."

### Visual del Dashboard

- Health Score: gauge descendiendo de 85 a 62
- Radar Chart: ejes por agente mostrando compliance
- Heatmap: nuevo archivo en rojo intenso
- Connection Indicator: verde (conectado)

---

## 📊 Métricas y AWS Stack (2:30 – 3:00)

### Narración

> "Guardian funciona completamente en local para análisis estático,
> y opcionalmente usa Amazon Bedrock para análisis semántico profundo
> de principios SOLID."

### Visual — Stack AWS

```
┌─────────────────────────────────────────────┐
│             Guardian MCP Toolkit             │
├─────────────────────────────────────────────┤
│  CDK Infrastructure                         │
│  ├── API Gateway (REST)                     │
│  ├── Lambda Functions (6 handlers)          │
│  │   ├── clean-guard-handler                │
│  │   ├── ddd-guard-handler                  │
│  │   ├── security-guard-handler             │
│  │   ├── solid-copilot-handler (Bedrock)    │
│  │   ├── concurrency-guard-handler          │
│  │   └── index (orchestrator)               │
│  └── Amazon Bedrock                         │
│      └── Claude 3.5 Sonnet (análisis SOLID) │
└─────────────────────────────────────────────┘
```

### Visual — Números Clave

| Métrica | Valor |
|---------|-------|
| Agentes especializados | 11 |
| Herramientas MCP | 20+ |
| Tests (unit + PBT) | 297+ |
| Lenguajes soportados | 8 |
| Properties verificadas | 27 |
| Tiempo respuesta Lambda | < 10s |

### Cierre

> "Guardian MCP Toolkit: auditoría arquitectural continua, impulsada por IA,
> integrada en tu flujo de trabajo. Calidad de código en tiempo real,
> no como afterthought."

---

## Notas de Producción

### Requisitos para la Grabación

- Terminal con tema oscuro y fuente >= 16px
- Navegador con dashboard abierto en pantalla dividida
- Resolución mínima: 1920x1080
- Grabador de pantalla: OBS o similar

### Tips de Timing

- Usar `sleep` entre comandos para que el espectador procese
- El FileWatcher tiene debounce de 300ms — esperar ~2s para ver resultados
- El dashboard se actualiza via SSE — la animación tarda < 500ms

### Script Automatizado

Para reproducir exactamente esta secuencia:

```bash
./scripts/record-demo.sh
```
