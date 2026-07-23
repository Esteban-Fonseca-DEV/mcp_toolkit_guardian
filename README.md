# 🛡️ Guardian MCP Toolkit

**Real-time architecture governance for Clean Architecture, DDD, SOLID, TDD, and Security — in 8 languages.**

[![npm version](https://img.shields.io/npm/v/guardian-mcp-toolkit)](https://www.npmjs.com/package/guardian-mcp-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-215%20passed-brightgreen)]()
[![Agents](https://img.shields.io/badge/agents-11-purple)]()

Guardian is an MCP-native toolkit that exposes 11 specialized agents via the Model Context Protocol, enabling IDEs and CI/CD pipelines to enforce architecture rules in real-time.

## 🚀 Quick Start

```bash
# Install globally
npm install -g guardian-mcp-toolkit

# Audit any project (auto-detects structure & language)
guardian audit /path/to/your/project

# Auto-fix violations
guardian fix /path/to/your/project --apply
```

## 🔌 MCP Integration (IDE)

Connect Guardian to your IDE's AI assistant (Kiro, VS Code, Cursor, Claude Desktop):

```json
{
  "mcpServers": {
    "guardian": {
      "command": "guardian",
      "args": ["mcp", "serve"]
    }
  }
}
```

Once connected, ask your AI assistant: *"Audit my project's architecture"* and it will use Guardian's tools automatically.

## 🤖 11 Specialized Agents

### Core Agents (Architecture)
| Agent | What it detects | Languages |
|-------|----------------|-----------|
| **Clean-Guard** | Layer boundary violations | All |
| **TDD-Strict** | Missing tests, TDD sequence | All |
| **DDD-Guard** | Encapsulation, aggregate access, bounded contexts | All |
| **Security-Guard** | Hardcoded secrets, env access | All |
| **SOLID-Copilot** | God Objects (SRP), fat interfaces (ISP) | All |
| **Concurrency-Guard** | Async anti-patterns, mutable exports | All |

### Language Specialists (Idiomatic Rules)
| Agent | Language | What it detects |
|-------|----------|----------------|
| **Go-Idiomatic-Guard** | Go | Goroutine leaks, missing context, error wrapping, interface placement |
| **Py-Async-Guard** | Python | Blocking I/O in async, circular imports, missing type hints |
| **TS-Contract-Guard** | TypeScript | `any` in domain, deep imports, unhandled promises |
| **Dart-Arch-Guard** | Dart/Flutter | Flutter in domain, stream leaks, UI logic leaks |
| **DotNet-Clean-Guard** | C#/.NET | EF in domain, missing CancellationToken, DbContext leaks |

## 🛠️ 20+ MCP Tools

| Tool | Description |
|------|-------------|
| `guardian_configure` | Auto-detect project structure and generate config |
| `guardian_audit_file` | Audit a single file with all relevant agents |
| `audit_all` | Run all agents on a directory |
| `analyze_ast_imports` | Parse file imports (AST) |
| `validate_layer_boundaries` | Check if a dependency is allowed |
| `generate_dependency_graph` | Build full dependency graph |
| `check_test_coverage_delta` | Verify tests exist per commit |
| `enforce_test_first_sequence` | Validate TDD workflow |
| `generate_tdd_lifecycle_report` | Export Mermaid TDD diagram |
| `audit_ddd_encapsulation` | Detect mutable public state |
| `audit_ddd_aggregate_access` | Detect direct internal access |
| `audit_ddd_bounded_context` | Verify context boundaries |
| `audit_security_secrets` | Scan for hardcoded secrets |
| `audit_security_env_access` | Check env access outside infra |
| `evaluate_single_responsibility` | SRP analysis |
| `suggest_interface_segregation` | ISP analysis |
| `audit_concurrency` | Async anti-patterns |
| `audit_go_idioms` | Go-specific rules |
| `audit_python_idioms` | Python-specific rules |
| `audit_typescript_idioms` | TypeScript-specific rules |
| `audit_dart_idioms` | Dart/Flutter-specific rules |
| `audit_csharp_idioms` | C#/.NET-specific rules |

## 💻 CLI Commands

```bash
guardian audit [path]           # Full audit with all 11 agents
guardian fix [path] [--apply]   # Auto-remediate violations
guardian init                   # Generate .guardian.json
guardian agent list             # Show agents and status
guardian agent enable <name>    # Enable an agent
guardian agent disable <name>   # Disable an agent
guardian mcp serve              # Start MCP server for IDE
guardian hooks install          # Install git pre-commit/pre-push
guardian dashboard              # Open web dashboard (Health Score)
```

## 🌐 Supported Languages

| Language | Import Detection | Idiom Rules |
|----------|-----------------|-------------|
| TypeScript/JavaScript | ✅ AST (Compiler API) | ✅ TS-Contract-Guard |
| Go | ✅ Regex | ✅ Go-Idiomatic-Guard |
| Python | ✅ Regex | ✅ Py-Async-Guard |
| Dart | ✅ Regex | ✅ Dart-Arch-Guard |
| C# | ✅ Regex | ✅ DotNet-Clean-Guard |
| Java | ✅ Regex | — |
| Kotlin | ✅ Regex | — |
| Rust | ✅ Regex | — |

## ⚡ GitHub Actions

```yaml
name: Guardian Audit
on: [pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install -g guardian-mcp-toolkit
      - run: guardian audit . --fail-on error
```

## ☁️ AWS Cloud Mode

Guardian can delegate analysis to AWS Lambda for scalability:

```json
{ "executionMode": "cloud" }
```

API Gateway: `https://c7dkqug6kf.execute-api.us-east-2.amazonaws.com/prod/`

Routes: `/clean-guard`, `/tdd-strict`, `/ddd-guard`, `/security-guard`, `/solid-copilot`, `/concurrency-guard`

## 📐 Configuration

Create `.guardian.json` in your project root (or let Guardian auto-generate it):

```json
{
  "version": "1.0.0",
  "executionMode": "local",
  "layers": [
    { "name": "domain", "paths": ["src/domain/**"], "allowedDependencies": [] },
    { "name": "application", "paths": ["src/services/**"], "allowedDependencies": ["domain"] },
    { "name": "infrastructure", "paths": ["src/infrastructure/**"], "allowedDependencies": ["domain", "application"] },
    { "name": "presentation", "paths": ["src/handlers/**"], "allowedDependencies": ["application"] }
  ],
  "testConventions": [{ "pattern": "**/*_test.go" }],
  "excludePaths": ["vendor", "node_modules", ".git"]
}
```

## 🏥 Patient Repo (Demo)

Test Guardian against intentional violations:

```bash
guardian audit ./patient-repo
# Returns 12+ violations across all 6 core agents
```

## 📊 Additional Features

- **Dashboard**: `guardian dashboard` — Health Score (0-100), heatmap, agent breakdown
- **LSP Server**: Real-time diagnostics in IDE (squiggly lines + Quick Fixes)
- **Auto-Fix**: `guardian fix` — Corrects 7 types of violations automatically
- **Custom Rules DSL**: Define `forbidden_imports`, `max_lines`, `required_patterns`
- **Git Hooks**: `guardian hooks install` — Pre-commit/pre-push validation

## 📦 Project Structure

```
guardian-mcp-toolkit/
├── packages/
│   ├── shared/            # Types, interfaces, multi-lang parser
│   ├── server/            # MCP Server, Smart Router, AST Cache
│   ├── clean-guard/       # Clean Architecture agent (3 tools)
│   ├── tdd-strict/        # TDD agent (3 tools)
│   ├── ddd-guard/         # DDD agent (3 tools)
│   ├── security-guard/    # Security agent (2 tools)
│   ├── solid-copilot/     # SOLID agent (2 tools)
│   ├── concurrency-guard/ # Concurrency agent (1 tool)
│   ├── lang-specialists/  # 5 language specialist agents
│   ├── cli/               # CLI (9 commands)
│   ├── lsp/               # LSP Server
│   ├── dashboard/         # Web dashboard
│   └── lambda/            # AWS Lambda handlers
├── infra/                 # CDK Stack (AWS)
├── patient-repo/          # Demo with intentional violations
├── action/                # GitHub Action
└── scripts/               # Deploy & publish scripts
```

## 🧪 Testing

- **215 tests** across 39 test files
- **Property-Based Testing** with fast-check (20+ properties, 100 iterations each)
- **Patient Repo** acceptance tests

## License

MIT — [Edwin Esteban Fonseca](https://github.com/Estebanfonseca)
