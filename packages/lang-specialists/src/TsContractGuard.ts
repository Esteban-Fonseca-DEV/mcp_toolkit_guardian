import { IAgent, ToolDefinition, Ruleset, AuditReport, Violation, buildReport } from "@guardian/shared";
import { readFile } from "fs/promises";

/**
 * TS-Contract-Guard: Detects TypeScript-specific anti-patterns
 * - Explicit/implicit `any` in domain layer
 * - Unhandled promise rejections
 * - Deep relative path imports instead of path aliases
 */
export class TsContractGuard implements IAgent {
  readonly name = "ts-contract-guard";
  readonly version = "1.0.0";
  private ruleset!: Ruleset;

  initialize(ruleset: Ruleset): void { this.ruleset = ruleset; }

  readonly tools: ToolDefinition[] = [{
    name: "audit_typescript_idioms",
    description: "Detects TypeScript anti-patterns: explicit any, unhandled promises, missing path aliases",
    schema: { type: "object", properties: { filepath: { type: "string" } }, required: ["filepath"] },
    handler: (args: unknown, ruleset: Ruleset) => this.audit(args as { filepath: string }, ruleset),
  }];

  private async audit(args: { filepath: string }, _ruleset: Ruleset): Promise<AuditReport> {
    if (!args.filepath.endsWith(".ts") && !args.filepath.endsWith(".tsx")) {
      return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations: [] });
    }

    let content: string;
    try { content = await readFile(args.filepath, "utf-8"); } catch {
      return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations: [] });
    }

    const violations: Violation[] = [];
    const lines = content.split("\n");
    const normalizedPath = args.filepath.replace(/\\/g, "/");
    const isInDomain = normalizedPath.includes("/domain/");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Rule: `any` type in domain layer
      if (isInDomain && /:\s*any\b|<any>|as\s+any/.test(line) && !/\/\//.test(line.split(/:\s*any|<any>|as\s+any/)[0])) {
        violations.push({
          filePath: args.filepath, line: lineNum,
          description: "Explicit 'any' type in domain layer. Use proper types or generics to maintain type safety.",
          severity: "error", rule: "TS_ANY_IN_DOMAIN",
        });
      }

      // Rule: Deep relative imports (more than 2 levels up)
      if (/from\s+['"]\.\.\/\.\.\/\.\./.test(line)) {
        violations.push({
          filePath: args.filepath, line: lineNum,
          description: "Deep relative import (3+ levels). Use path aliases (@domain/, @app/, @infra/) for cleaner imports.",
          severity: "warning", rule: "TS_DEEP_RELATIVE_IMPORT",
        });
      }

      // Rule: Unhandled promise (calling async without await/then/catch)
      if (/\.\w+\([^)]*\)\s*;?\s*$/.test(line) && !line.includes("await") && !line.includes(".then") && !line.includes(".catch")) {
        if (/Async|fetch|save|send|create|update|delete/i.test(line) && !/void|console|log|return/.test(line)) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "Potentially unhandled async call. Use await, .then(), or .catch() to handle the promise.",
            severity: "warning", rule: "TS_UNHANDLED_PROMISE",
          });
        }
      }
    }

    return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations });
  }
}
