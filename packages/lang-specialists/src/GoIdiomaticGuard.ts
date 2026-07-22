import { IAgent, ToolDefinition, Ruleset, AuditReport, Violation, buildReport } from "@guardian/shared";
import { readFile } from "fs/promises";

/**
 * Go-Idiomatic-Guard: Detects Go-specific anti-patterns
 * - Interfaces declared in provider (should be in consumer/application layer)
 * - Missing context.Context propagation
 * - Goroutine leaks (go func without sync mechanism)
 * - Error wrapping without %w
 */
export class GoIdiomaticGuard implements IAgent {
  readonly name = "go-idiomatic-guard";
  readonly version = "1.0.0";
  private ruleset!: Ruleset;

  initialize(ruleset: Ruleset): void { this.ruleset = ruleset; }

  readonly tools: ToolDefinition[] = [{
    name: "audit_go_idioms",
    description: "Detects Go-specific anti-patterns: interface placement, context propagation, goroutine leaks, error wrapping",
    schema: { type: "object", properties: { filepath: { type: "string" } }, required: ["filepath"] },
    handler: (args: unknown, ruleset: Ruleset) => this.audit(args as { filepath: string }, ruleset),
  }];

  private async audit(args: { filepath: string }, _ruleset: Ruleset): Promise<AuditReport> {
    if (!args.filepath.endsWith(".go")) {
      return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations: [] });
    }

    let content: string;
    try { content = await readFile(args.filepath, "utf-8"); } catch {
      return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations: [] });
    }

    const violations: Violation[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Rule: Goroutine without sync (go func without WaitGroup, channel, or context)
      if (/^\s*go\s+func\s*\(/.test(line) || /^\s*go\s+\w+\(/.test(line)) {
        const context = lines.slice(Math.max(0, i - 5), i + 1).join("\n");
        if (!/sync\.WaitGroup|<-\s*\w+|context\./.test(context)) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "Goroutine launched without visible sync mechanism (WaitGroup, channel, or context). Risk of goroutine leak.",
            severity: "warning", rule: "GO_GOROUTINE_LEAK_RISK",
          });
        }
      }

      // Rule: Missing context.Context in exported functions
      if (/^func\s+[A-Z]\w*\(/.test(line) && !line.includes("context.Context") && !line.includes("ctx ")) {
        if (!/Get|Set|New|String|Error/.test(line)) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "Exported function missing context.Context parameter. Required for cancellation and deadline propagation.",
            severity: "warning", rule: "GO_MISSING_CONTEXT",
          });
        }
      }

      // Rule: Error not wrapped with %w
      if (/fmt\.Errorf\(/.test(line) && !/%w/.test(line) && /err/.test(line)) {
        violations.push({
          filePath: args.filepath, line: lineNum,
          description: "Error wrapped with fmt.Errorf but not using %w verb. Use %w to preserve error chain for errors.Is/As.",
          severity: "warning", rule: "GO_ERROR_WRAP_MISSING",
        });
      }

      // Rule: Interface declared in infrastructure package (should be in consumer)
      if (/^type\s+\w+\s+interface\s*\{/.test(line)) {
        const normalizedPath = args.filepath.replace(/\\/g, "/");
        if (normalizedPath.includes("/infrastructure/") || normalizedPath.includes("/infra/")) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "Interface declared in infrastructure layer. In Go, interfaces should be declared in the consumer (application/domain layer).",
            severity: "error", rule: "GO_INTERFACE_IN_PROVIDER",
          });
        }
      }
    }

    return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations });
  }
}
