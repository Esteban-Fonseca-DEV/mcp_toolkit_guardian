import { readFile } from "fs/promises";
import * as ts from "typescript";
import { AuditReport, Ruleset, Violation, buildReport } from "@guardian/shared";

export async function evaluateSingleResponsibility(
  args: { filepath: string },
  ruleset: Ruleset
): Promise<AuditReport> {
  const { filepath } = args;

  let content: string;
  try {
    content = await readFile(filepath, "utf-8");
  } catch (err) {
    return buildReport({
      agentName: "solid-copilot",
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

  return buildReport({
    agentName: "solid-copilot",
    analyzedPath: filepath,
    violations: evaluateSingleResponsibilitySync(filepath, content),
  });
}

/**
 * Synchronous version for testing with in-memory content.
 * Analyzes classes for Single Responsibility Principle violations.
 */
export function evaluateSingleResponsibilitySync(
  filepath: string,
  content: string
): Violation[] {
  const sourceFile = ts.createSourceFile(
    filepath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const violations: Violation[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isClassDeclaration(node)) return;
    const className = node.name?.getText(sourceFile) ?? "<anonymous>";

    // Count methods
    const methods = node.members.filter((m) => ts.isMethodDeclaration(m));

    // Count lines
    const startLine = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile)
    ).line;
    const endLine = sourceFile.getLineAndCharacterOfPosition(
      node.getEnd()
    ).line;
    const lineCount = endLine - startLine + 1;

    // Count constructor params (injected dependencies)
    const constructor = node.members.find((m) =>
      ts.isConstructorDeclaration(m)
    ) as ts.ConstructorDeclaration | undefined;
    const paramCount = constructor?.parameters.length ?? 0;

    const reasons: string[] = [];
    if (lineCount > 200)
      reasons.push(`${lineCount} lineas (umbral: 200)`);
    if (methods.length > 10)
      reasons.push(`${methods.length} metodos (umbral: 10)`);
    if (paramCount > 5)
      reasons.push(`${paramCount} dependencias inyectadas (umbral: 5)`);

    if (reasons.length > 0) {
      violations.push({
        filePath: filepath,
        line: startLine + 1,
        description: `Clase '${className}' posiblemente viola SRP: ${reasons.join(", ")}. Considere dividirla en clases mas cohesivas.`,
        severity: "warning",
        rule: "SRP_GOD_OBJECT",
      });
    }
  });

  return violations;
}
