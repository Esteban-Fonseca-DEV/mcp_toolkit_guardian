import { IAgent, ToolDefinition, Ruleset, AuditReport, Violation, buildReport } from "@guardian/shared";
import { readFile } from "fs/promises";

/**
 * DotNet-Clean-Guard: Detects C#/.NET-specific anti-patterns
 * - Entity Framework in domain entities
 * - Missing async/await + CancellationToken
 * - Direct DbContext usage outside infrastructure
 */
export class DotNetCleanGuard implements IAgent {
  readonly name = "dotnet-clean-guard";
  readonly version = "1.0.0";
  private ruleset!: Ruleset;

  initialize(ruleset: Ruleset): void { this.ruleset = ruleset; }

  readonly tools: ToolDefinition[] = [{
    name: "audit_csharp_idioms",
    description: "Detects C#/.NET anti-patterns: EF in domain, missing CancellationToken, DbContext leaks",
    schema: { type: "object", properties: { filepath: { type: "string" } }, required: ["filepath"] },
    handler: (args: unknown, ruleset: Ruleset) => this.audit(args as { filepath: string }, ruleset),
  }];

  private async audit(args: { filepath: string }, _ruleset: Ruleset): Promise<AuditReport> {
    if (!args.filepath.endsWith(".cs")) {
      return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations: [] });
    }

    let content: string;
    try { content = await readFile(args.filepath, "utf-8"); } catch {
      return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations: [] });
    }

    const violations: Violation[] = [];
    const lines = content.split("\n");
    const normalizedPath = args.filepath.replace(/\\/g, "/");
    const isInDomain = normalizedPath.includes("/Domain/") || normalizedPath.includes("/domain/");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Rule: Entity Framework attributes/references in domain
      if (isInDomain) {
        if (/\[Table\(|using\s+.*EntityFramework|DbSet<|IQueryable/.test(line)) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "Entity Framework reference in Domain layer. Domain entities must be persistence-ignorant.",
            severity: "error", rule: "DOTNET_EF_IN_DOMAIN",
          });
        }
        if (/\[Key\]|\[Column\(|\[ForeignKey\(|\[Required\]/.test(line) && !/System\.ComponentModel/.test(content)) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "Data annotation attribute in Domain entity. Use Fluent API in Infrastructure for persistence mapping.",
            severity: "warning", rule: "DOTNET_DATA_ANNOTATION_IN_DOMAIN",
          });
        }
      }

      // Rule: Async method without CancellationToken
      if (/public\s+async\s+Task/.test(line) && !line.includes("CancellationToken") && !line.includes("cancellation")) {
        if (!/ToString|Equals|GetHashCode|Dispose/.test(line)) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "Async method without CancellationToken parameter. Required for proper async lifecycle management.",
            severity: "warning", rule: "DOTNET_MISSING_CANCELLATION_TOKEN",
          });
        }
      }

      // Rule: DbContext used outside infrastructure
      if (!normalizedPath.includes("/Infrastructure/") && !normalizedPath.includes("/infrastructure/") && !normalizedPath.includes("/Persistence/")) {
        if (/DbContext|\.SaveChanges|\.Set<|\.Database\./.test(line)) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "DbContext usage outside Infrastructure layer. Access data through repository interfaces.",
            severity: "error", rule: "DOTNET_DBCONTEXT_LEAK",
          });
        }
      }
    }

    return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations });
  }
}
