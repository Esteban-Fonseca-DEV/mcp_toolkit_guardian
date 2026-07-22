import { readFile } from "fs/promises";
import * as ts from "typescript";
import { AuditReport, Ruleset, Violation, buildReport } from "@guardian/shared";

export async function suggestInterfaceSegregation(
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
    violations: suggestInterfaceSegregationSync(filepath, content),
  });
}

/**
 * Synchronous version for testing with in-memory content.
 * Analyzes interfaces for Interface Segregation Principle violations.
 */
export function suggestInterfaceSegregationSync(
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
    if (!ts.isInterfaceDeclaration(node)) return;
    const interfaceName = node.name.getText(sourceFile);

    // Count method signatures and function-type property signatures
    let methodCount = 0;
    node.members.forEach((member) => {
      if (ts.isMethodSignature(member)) {
        methodCount++;
      } else if (ts.isPropertySignature(member)) {
        // Check if property type is a function type
        if (member.type && ts.isFunctionTypeNode(member.type)) {
          methodCount++;
        }
      }
    });

    if (methodCount > 5) {
      const line = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile)
      ).line + 1;

      violations.push({
        filePath: filepath,
        line,
        description: `Interfaz '${interfaceName}' tiene ${methodCount} metodos (umbral: 5). Considere dividirla en interfaces mas especificas por responsabilidad.`,
        severity: "warning",
        rule: "ISP_FAT_INTERFACE",
      });
    }
  });

  return violations;
}
