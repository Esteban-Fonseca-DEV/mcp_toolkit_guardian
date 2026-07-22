# Guardian MCP Toolkit

Real-time code audit platform powered by the [Model Context Protocol](https://modelcontextprotocol.io). Guardian runs architecture and testing validations directly inside your IDE through MCP-compatible tools.

## Features

### Phase 1 (MVP)
- **Clean-Guard Agent** — Validates Clean Architecture layer boundaries via AST analysis
- **TDD-Strict Agent** — Enforces Red-Green-Refactor workflow via git diff inspection
- **MCP Server** — Full Model Context Protocol support (stdio transport)
- **AWS Lambda** — Cloud execution mode via API Gateway
- **Configurable Rules** — `.guardian.json` with JSON Schema validation
- **Structured Reports** — `AuditReport` with violations, severity, and summaries

### Phase 2
- **DDD-Guard Agent** — Detects Domain-Driven Design violations (encapsulation, aggregate access, bounded contexts)
- **CLI (`guardian audit`)** — Run audits from terminal and CI/CD pipelines
- **AWS CDK Deploy** — Infrastructure as Code for Lambda + API Gateway (placeholder)
- **20 Property-Based Tests** — Formal correctness verification with fast-check
- **Patient Repo Demo** — Intentional violations across all 3 agents

## Prerequisites

- Node.js >= 20
- pnpm >= 9

## Installation

```bash
git clone <repo-url> guardian-mcp-toolkit
cd guardian-mcp-toolkit
pnpm install
pnpm build
```

## CLI Usage

```bash
# Audit a directory (text output)
npx guardian audit ./patient-repo

# JSON output for CI/CD
npx guardian audit ./patient-repo --format json

# Fail on warnings too
npx guardian audit ./patient-repo --fail-on warning

# Show help
npx guardian audit --help
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No violations above threshold |
| 1 | Violations detected at configured `--fail-on` level |
| 2 | Internal error (invalid path, bad config) |

## Demo

### Quick Demo

```bash
bash scripts/demo.sh
```

### Manual Steps

1. Install: `pnpm install && pnpm build`
2. Run audit: `npx guardian audit ./patient-repo`
3. See violations from Clean-Guard, TDD-Strict, and DDD-Guard
4. See `scripts/demo-guide.md` for full presentation walkthrough

## MCP Server Connection

### Connecting from VS Code (Kiro / Copilot / Continue)

Add the server to your MCP settings (`.kiro/settings/mcp.json` or equivalent):

```json
{
  "mcpServers": {
    "guardian": {
      "command": "node",
      "args": ["packages/server/dist/main.js", "--config", ".guardian.json"]
    }
  }
}
```

The server starts via stdio and exposes the tools below to any MCP client.

## Tools Reference (10 MCP Tools)

| Tool | Agent | Description |
|------|-------|-------------|
| `analyze_ast_imports` | clean-guard | Parse a file's AST and return its import statements |
| `validate_layer_boundaries` | clean-guard | Check if a dependency between layers is allowed |
| `generate_dependency_graph` | clean-guard | Build full dependency graph with layer violation detection |
| `check_test_coverage_delta` | tdd-strict | Detect source files missing a matching test file |
| `enforce_test_first_sequence` | tdd-strict | Verify test-first workflow in git diff |
| `generate_tdd_lifecycle_report` | tdd-strict | Export Mermaid diagram of TDD cycle |
| `audit_ddd_encapsulation` | ddd-guard | Detect mutable public state in domain entities |
| `audit_ddd_aggregate_access` | ddd-guard | Detect direct access to aggregate internals |
| `audit_ddd_bounded_context` | ddd-guard | Verify bounded context boundaries |
| `audit_all` | guardian | Run all agents in parallel; return consolidated report |

### Tool Schemas

**generate_dependency_graph**
```json
{ "directory": "string (required) — path to analyze" }
```

**validate_layer_boundaries**
```json
{ "source_layer": "string", "target_layer": "string" }
```

**analyze_ast_imports**
```json
{ "filepath": "string (required) — file to parse" }
```

**check_test_coverage_delta**
```json
{ "commit_hash": "string (required) — git commit to diff against" }
```

**audit_ddd_encapsulation**
```json
{ "filepath": "string (required) — file to analyze" }
```

**audit_ddd_aggregate_access**
```json
{ "directory": "string (required) — directory to scan" }
```

**audit_ddd_bounded_context**
```json
{ "directory": "string (required) — directory to scan" }
```

**audit_all**
```json
{
  "directory": "string (required) — path to analyze",
  "commit_hash": "string (optional) — if provided, also runs test coverage check"
}
```

## Patient Repo Demo

The `patient-repo/` directory contains a sample project with intentional architecture violations:

- **3 Clean Architecture violations** — Domain importing from Infrastructure
- **1 TDD violation** — Production file without test counterpart
- **2 DDD violations** — Mutable public state + direct internal access

Run `npx guardian audit ./patient-repo` to see them all detected.

See `patient-repo/README.md` for full documentation of each violation.

## `.guardian.json` Configuration

Place a `.guardian.json` file at the root of the project you want to audit.

### Full Example

```json
{
  "version": "1.0.0",
  "executionMode": "local",
  "layers": [
    { "name": "domain", "paths": ["src/domain/**"], "allowedDependencies": [] },
    { "name": "application", "paths": ["src/application/**"], "allowedDependencies": ["domain"] },
    { "name": "infrastructure", "paths": ["src/infrastructure/**"], "allowedDependencies": ["domain", "application"] },
    { "name": "presentation", "paths": ["src/presentation/**"], "allowedDependencies": ["application"] }
  ],
  "testConventions": [
    { "pattern": "**/*.test.ts" },
    { "pattern": "**/*.spec.ts" }
  ],
  "excludePaths": ["node_modules", "dist", "coverage"],
  "ddd": {
    "aggregates": {
      "Order": {
        "root": "src/domain/order/Order.ts",
        "internals": ["src/domain/order/OrderItem.ts"]
      }
    },
    "boundedContexts": {
      "orders": ["src/domain/order/**"],
      "users": ["src/domain/user/**"]
    }
  }
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | yes | Config version (semver) |
| `executionMode` | string | yes | `"local"` or `"cloud"` |
| `layers` | array | yes | Layer definitions with allowed dependency rules |
| `testConventions` | array | yes | Glob patterns identifying test files |
| `excludePaths` | array | no | Paths to skip during analysis |
| `ddd` | object | no | DDD configuration (aggregates, bounded contexts) |

### Validation

A JSON Schema is available at `.guardian.schema.json` for editor autocompletion and CI validation.

## AWS Deploy (Placeholder)

Infrastructure is defined for CDK deployment with:
- 3 Lambda Functions (clean-guard, tdd-strict, ddd-guard)
- API Gateway REST with routes `/clean-guard`, `/tdd-strict`, `/ddd-guard`
- Lambda Layer with shared dependencies

```bash
# When AWS credentials are configured:
bash scripts/deploy.sh
```

## Project Structure

```
guardian-mcp-toolkit/
  packages/
    shared/        — Types, interfaces, utilities
    clean-guard/   — Architecture validation agent (3 tools)
    tdd-strict/    — Test coverage validation agent (3 tools)
    ddd-guard/     — DDD validation agent (3 tools)
    server/        — MCP server, registry, router
    lambda/        — AWS Lambda handlers (cloud mode)
    cli/           — CLI for terminal and CI/CD
  patient-repo/    — Demo project with violations
  scripts/         — Demo and deploy scripts
  infra/           — CDK Infrastructure (placeholder)
```

## License

MIT
