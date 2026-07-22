import { readFile } from "fs/promises";
import * as ts from "typescript";
import { AuditReport, Ruleset, Violation, buildReport } from "@guardian/shared";

export async function auditDddEncapsulation(
  args: { filepath: string },
  ruleset: Ruleset
): Promise<AuditReport> {
  const { filepath } = args;

  let content: string;
  try {
    content = await readFile(filepath, "utf-8");
  } catch (err) {
    return buildReport({
      agentName: "ddd-guard",
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

    node.members.forEach((member) => {
      if (!ts.isPropertyDeclaration(member)) return;

      const modifiers = ts.getModifiers(member) ?? [];
      const isPrivate = modifiers.some(
        (m) => m.kind === ts.SyntaxKind.PrivateKeyword
      );
      const isProtected = modifiers.some(
        (m) => m.kind === ts.SyntaxKind.ProtectedKeyword
      );
      const isReadonly = modifiers.some(
        (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
      );

      // Public if not private/protected; violation if also not readonly
      if (!isPrivate && !isProtected && !isReadonly) {
        const propName = member.name.getText(sourceFile);
        const line =
          sourceFile.getLineAndCharacterOfPosition(
            member.getStart(sourceFile)
          ).line + 1;

        violations.push({
          filePath: filepath,
          line,
          description: `Clase '${className}' expone propiedad mutable publica '${propName}'. Use readonly o un metodo de acceso controlado.`,
          severity: "error",
          rule: "DDD_MUTABLE_PUBLIC_STATE",
        });
      }
    });
  });

  return buildReport({
    agentName: "ddd-guard",
    analyzedPath: filepath,
    violations,
  });
}

/**
 * Synchronous version for testing with in-memory content.
 * Parses TypeScript source content and detects mutable public properties.
 */
export function auditDddEncapsulationSync(
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

    node.members.forEach((member) => {
      if (!ts.isPropertyDeclaration(member)) return;

      const modifiers = ts.getModifiers(member) ?? [];
      const isPrivate = modifiers.some(
        (m) => m.kind === ts.SyntaxKind.PrivateKeyword
      );
      const isProtected = modifiers.some(
        (m) => m.kind === ts.SyntaxKind.ProtectedKeyword
      );
      const isReadonly = modifiers.some(
        (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
      );

      if (!isPrivate && !isProtected && !isReadonly) {
        const propName = member.name.getText(sourceFile);
        const line =
          sourceFile.getLineAndCharacterOfPosition(
            member.getStart(sourceFile)
          ).line + 1;

        violations.push({
          filePath: filepath,
          line,
          description: `Clase '${className}' expone propiedad mutable publica '${propName}'. Use readonly o un metodo de acceso controlado.`,
          severity: "error",
          rule: "DDD_MUTABLE_PUBLIC_STATE",
        });
      }
    });
  });

  return violations;
}
