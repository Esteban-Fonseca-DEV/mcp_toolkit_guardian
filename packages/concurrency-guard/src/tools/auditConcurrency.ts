import { readFile } from "fs/promises";
import * as ts from "typescript";
import { AuditReport, Ruleset, Violation, buildReport } from "@guardian/shared";

/**
 * Detects common concurrency-related anti-patterns in TypeScript source:
 * 1. MUTABLE_EXPORT — `export let` declarations (should be `export const`)
 * 2. TIMER_NO_CLEANUP — setInterval/setTimeout without corresponding clearInterval/clearTimeout
 * 3. EVENT_LISTENER_NO_CLEANUP — addEventListener without removeEventListener in same scope
 * 4. PROMISE_NOT_AWAITED — Promise-returning expressions that aren't awaited/assigned
 */
export async function auditConcurrency(
  args: { filepath: string },
  _ruleset: Ruleset
): Promise<AuditReport> {
  const { filepath } = args;

  let content: string;
  try {
    content = await readFile(filepath, "utf-8");
  } catch (err) {
    return buildReport({
      agentName: "concurrency-guard",
      analyzedPath: filepath,
      violations: [
        {
          filePath: filepath,
          line: 0,
          description: `Cannot read file: ${(err as Error).message}`,
          severity: "warning",
          rule: "FILE_READ_ERROR",
        },
      ],
    });
  }

  const violations = auditConcurrencySync(filepath, content);

  return buildReport({
    agentName: "concurrency-guard",
    analyzedPath: filepath,
    violations,
  });
}

/**
 * Synchronous version — analyzes source text directly (useful for testing).
 */
export function auditConcurrencySync(filepath: string, content: string): Violation[] {
  const sourceFile = ts.createSourceFile(
    filepath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const violations: Violation[] = [];

  // Track calls in the file
  const hasRemoveEventListener = content.includes("removeEventListener");
  const hasClearInterval = content.includes("clearInterval");
  const hasClearTimeout = content.includes("clearTimeout");

  function visit(node: ts.Node): void {
    // 1. MUTABLE_EXPORT — export let declarations
    if (ts.isVariableStatement(node)) {
      const mods = ts.getModifiers(node);
      const hasExport = mods?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
      if (hasExport) {
        const declList = node.declarationList;
        if (declList.flags & ts.NodeFlags.Let) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          violations.push({
            filePath: filepath,
            line,
            description: "Mutable export detected (`export let`). Use `export const` to avoid shared mutable state.",
            severity: "warning",
            rule: "MUTABLE_EXPORT",
          });
        }
      }
    }

    // 2. TIMER_NO_CLEANUP — setInterval/setTimeout without clear*
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr)) {
        const name = expr.text;
        if (name === "setInterval" && !hasClearInterval) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          violations.push({
            filePath: filepath,
            line,
            description: "`setInterval` used without corresponding `clearInterval` in the same file.",
            severity: "warning",
            rule: "TIMER_NO_CLEANUP",
          });
        }
        if (name === "setTimeout" && !hasClearTimeout) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          violations.push({
            filePath: filepath,
            line,
            description: "`setTimeout` used without corresponding `clearTimeout` in the same file.",
            severity: "warning",
            rule: "TIMER_NO_CLEANUP",
          });
        }
      }
    }

    // 3. EVENT_LISTENER_NO_CLEANUP — addEventListener without removeEventListener
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (
        ts.isPropertyAccessExpression(expr) &&
        expr.name.text === "addEventListener" &&
        !hasRemoveEventListener
      ) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        violations.push({
          filePath: filepath,
          line,
          description: "`addEventListener` used without corresponding `removeEventListener` in the same file.",
          severity: "warning",
          rule: "EVENT_LISTENER_NO_CLEANUP",
        });
      }
    }

    // 4. PROMISE_NOT_AWAITED — `new Promise(...)` as expression statement (not assigned/awaited)
    if (ts.isExpressionStatement(node)) {
      const expr = node.expression;
      if (ts.isNewExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === "Promise") {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        violations.push({
          filePath: filepath,
          line,
          description: "`new Promise(...)` created but not awaited or assigned. This may lead to unhandled async operations.",
          severity: "warning",
          rule: "PROMISE_NOT_AWAITED",
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}
