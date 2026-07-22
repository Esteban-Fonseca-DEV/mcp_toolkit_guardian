import { IAgent, ToolDefinition, Ruleset, AuditReport, Violation, buildReport } from "@guardian/shared";
import { readFile } from "fs/promises";

/**
 * Py-Async-Guard: Detects Python-specific anti-patterns
 * - Blocking I/O calls in async functions
 * - Circular imports between layers (missing TYPE_CHECKING)
 * - Missing type hints in DTOs
 */
export class PyAsyncGuard implements IAgent {
  readonly name = "py-async-guard";
  readonly version = "1.0.0";
  private ruleset!: Ruleset;

  initialize(ruleset: Ruleset): void { this.ruleset = ruleset; }

  readonly tools: ToolDefinition[] = [{
    name: "audit_python_idioms",
    description: "Detects Python anti-patterns: blocking I/O in async, circular imports, missing type hints",
    schema: { type: "object", properties: { filepath: { type: "string" } }, required: ["filepath"] },
    handler: (args: unknown, ruleset: Ruleset) => this.audit(args as { filepath: string }, ruleset),
  }];

  private async audit(args: { filepath: string }, _ruleset: Ruleset): Promise<AuditReport> {
    if (!args.filepath.endsWith(".py")) {
      return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations: [] });
    }

    let content: string;
    try { content = await readFile(args.filepath, "utf-8"); } catch {
      return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations: [] });
    }

    const violations: Violation[] = [];
    const lines = content.split("\n");
    let inAsyncFunction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Track async function context
      if (/^\s*async\s+def\s+/.test(line)) inAsyncFunction = true;
      if (/^def\s+|^class\s+/.test(line)) inAsyncFunction = false;

      // Rule: Blocking I/O in async function
      if (inAsyncFunction) {
        if (/\bopen\s*\(/.test(line) && !/aiofiles/.test(line)) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "Blocking file I/O (open()) in async function. Use aiofiles or run_in_executor().",
            severity: "error", rule: "PY_BLOCKING_IO_IN_ASYNC",
          });
        }
        if (/\brequests\.(get|post|put|delete|patch)\s*\(/.test(line)) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "Blocking HTTP call (requests) in async function. Use httpx or aiohttp instead.",
            severity: "error", rule: "PY_BLOCKING_IO_IN_ASYNC",
          });
        }
        if (/\btime\.sleep\s*\(/.test(line)) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "Blocking time.sleep() in async function. Use asyncio.sleep() instead.",
            severity: "error", rule: "PY_BLOCKING_IO_IN_ASYNC",
          });
        }
      }

      // Rule: Import from infrastructure in domain without TYPE_CHECKING
      const normalizedPath = args.filepath.replace(/\\/g, "/");
      if (normalizedPath.includes("/domain/") && /^from\s+.*infrastructure/.test(line)) {
        if (!content.includes("TYPE_CHECKING")) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "Domain layer imports from infrastructure at runtime. Use TYPE_CHECKING guard or Protocol for decoupling.",
            severity: "error", rule: "PY_CIRCULAR_IMPORT_RISK",
          });
        }
      }

      // Rule: Class without type hints (potential DTO without validation)
      if (/^class\s+\w+.*:/.test(line) && !/@dataclass|BaseModel|TypedDict/.test(lines.slice(Math.max(0, i - 2), i + 1).join("\n"))) {
        const classBody = lines.slice(i + 1, Math.min(i + 20, lines.length)).join("\n");
        if (/self\.\w+\s*=/.test(classBody) && !/self\.\w+:\s*\w+/.test(classBody)) {
          violations.push({
            filePath: args.filepath, line: lineNum,
            description: "Class has untyped attributes. Use @dataclass, Pydantic BaseModel, or explicit type annotations for DTOs.",
            severity: "warning", rule: "PY_MISSING_TYPE_HINTS",
          });
        }
      }
    }

    return buildReport({ agentName: this.name, analyzedPath: args.filepath, violations });
  }
}
