import { IAgent, ToolDefinition, Ruleset, AuditReport, Violation, buildReport } from "@guardian/shared";
import { readFile } from "fs/promises";

/**
 * Dart-Arch-Guard: Detects Dart/Flutter-specific anti-patterns
 * - Flutter imports in domain/application layers
 * - Stream/Controller without close/dispose
 * - Business logic in widgets
 */
export class DartArchGuard implements IAgent {
  readonly name = "dart-arch-guard";
  readonly version = "1.0.0";
  private ruleset!: Ruleset;

  initialize(ruleset: Ruleset): void { this.ruleset = ruleset; }

  readonly tools: ToolDefinition[] = [{
    name: "audit_dart_idioms",
    description: "Detects Dart/Flutter anti-patterns: Flutter in domain, undisposed streams, UI logic leaks",
    schema: { type: "object", properties: { filepath: { type: "string" } }, required: ["filepath"] },
    handler: (args: unknown, ruleset: Ruleset) => this.audit(args as { filepath: string }, ruleset),
  }];

  private async audit(args: { filepath: string }, _ruleset: Ruleset): Promise<AuditReport> {
    if (!args.filepath.endsWith(".dart")) {
      return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations: [] });
    }

    let content: string;
    try { content = await readFile(args.filepath, "utf-8"); } catch {
      return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations: [] });
    }

    const violations: Violation[] = [];
    const lines = content.split("\n");
    const normalizedPath = args.filepath.replace(/\\/g, "/");
    const isInDomain = normalizedPath.includes("/domain/") || normalizedPath.includes("/use_cases/");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Rule: Flutter package imported in domain/application
      if (isInDomain && /import\s+'package:flutter\//.test(line)) {
        violations.push({
          filePath: args.filepath, line: lineNum,
          description: "Flutter SDK imported in domain/use_cases layer. Domain must be framework-agnostic.",
          severity: "error", rule: "DART_FLUTTER_IN_DOMAIN",
        });
      }

      // Rule: StreamController without close/dispose in the file
      if (/StreamController/.test(line) && !content.includes("close()") && !content.includes("dispose()")) {
        violations.push({
          filePath: args.filepath, line: lineNum,
          description: "StreamController created without close()/dispose(). Risk of memory leak.",
          severity: "warning", rule: "DART_STREAM_LEAK",
        });
      }

      // Rule: Navigator or BuildContext in non-presentation layer
      if (!normalizedPath.includes("/presentation/") && !normalizedPath.includes("/ui/") && !normalizedPath.includes("/widgets/")) {
        if (/Navigator\.|BuildContext|showDialog|ScaffoldMessenger/.test(line)) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "UI/Navigation code outside presentation layer. Move to a widget or presenter.",
            severity: "error", rule: "DART_UI_LOGIC_LEAK",
          });
        }
      }
    }

    return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations });
  }
}
