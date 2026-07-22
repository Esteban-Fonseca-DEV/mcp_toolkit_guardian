# Guardian MCP Toolkit

Real-time architecture audit for Clean Architecture, DDD, SOLID, and TDD — in any language.

## Install

```bash
npm install -g guardian-mcp-toolkit
```

## Usage

```bash
# Audit a project (auto-detects structure)
guardian audit /path/to/project

# Generate configuration
guardian init

# Auto-fix violations
guardian fix /path/to/project

# Start MCP server (for IDE integration)
guardian mcp serve

# View dashboard
guardian dashboard

# Install git hooks
guardian hooks install

# Manage agents
guardian agent list
guardian agent enable security-guard
guardian agent disable solid-copilot
```

## Supported Languages

TypeScript, Go, Python, Dart, Java, C#, Kotlin, Rust

## 11 Agents

| Agent | What it detects |
|-------|----------------|
| clean-guard | Layer boundary violations |
| tdd-strict | Missing tests, TDD sequence |
| ddd-guard | DDD violations (encapsulation, aggregates, bounded contexts) |
| security-guard | Hardcoded secrets, env access |
| solid-copilot | SRP violations, fat interfaces |
| concurrency-guard | Async anti-patterns |
| go-idiomatic-guard | Go-specific: goroutine leaks, missing context |
| py-async-guard | Python-specific: blocking I/O in async |
| ts-contract-guard | TypeScript-specific: any in domain |
| dart-arch-guard | Dart-specific: Flutter in domain |
| dotnet-clean-guard | C#-specific: EF in domain |

## MCP Integration

Add to your IDE's MCP configuration:

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

## License

MIT
