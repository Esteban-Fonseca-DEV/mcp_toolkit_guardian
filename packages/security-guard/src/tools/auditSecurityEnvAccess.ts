import { readFile } from "fs/promises";
import * as ts from "typescript";
import * as path from "path";
import { minimatch } from "minimatch";
import { AuditReport, Ruleset, Violation, buildReport } from "@guardian/shared";

/**
 * Resolves which architectural layer a file belongs to based on the Ruleset.
 */
function resolveLayer(filePath: string, ruleset: Ruleset): string | null {
  const normalizedPath = filePath.replace(/\\/g, "/");
  for (const layer of ruleset.layers) {
    for (const pattern of layer.paths) {
      if (minimatch(normalizedPath, pattern)) {
        return layer.name;
      }
    }
  }
  return null;
}

/**
 * Walks the AST looking for `process.env` property access expressions.
 * Returns the line numbers where these accesses occur.
 */
function findProcessEnvAccesses(sourceFile: ts.SourceFile): number[] {
  const lines: number[] = [];

  function visit(node: ts.Node): void {
    // Look for property access: process.env.SOMETHING or process.env["SOMETHING"]
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const expr = ts.isPropertyAccessExpression(node) ? node.expression : node.expression;
      // Check if expression is `process.env`
      if (ts.isPropertyAccessExpression(expr)) {
        const obj = expr.expression;
        const prop = expr.name;
        if (
          ts.isIdentifier(obj) &&
          obj.text === "process" &&
          ts.isIdentifier(prop) &&
          prop.text === "env"
        ) {
          const line =
            sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
              .line + 1;
          lines.push(line);
          return; // Don't recurse into children of this node
        }
      }
    }

    // Also catch direct `process.env` access without a further property
    if (ts.isPropertyAccessExpression(node)) {
      const obj = node.expression;
      const prop = node.name;
      if (
        ts.isIdentifier(obj) &&
        obj.text === "process" &&
        ts.isIdentifier(prop) &&
        prop.text === "env"
      ) {
        // Check if parent is NOT a property access (i.e., `process.env` used directly)
        const parent = node.parent;
        if (
          !ts.isPropertyAccessExpression(parent) &&
          !ts.isElementAccessExpression(parent)
        ) {
          const line =
            sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
              .line + 1;
          lines.push(line);
          return;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return lines;
}

export async function auditSecurityEnvAccess(
  args: { filepath: string },
  ruleset: Ruleset
): Promise<AuditReport> {
  const { filepath } = args;

  let content: string;
  try {
    content = await readFile(filepath, "utf-8");
  } catch (err) {
    return buildReport({
      agentName: "security-guard",
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

  const normalizedPath = filepath.replace(/\\/g, "/");
  const layer = resolveLayer(normalizedPath, ruleset);

  // If the file is in the infrastructure layer, process.env access is allowed
  if (layer === "infrastructure") {
    return buildReport({
      agentName: "security-guard",
      analyzedPath: filepath,
      violations: [],
    });
  }

  const sourceFile = ts.createSourceFile(
    filepath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const envAccessLines = findProcessEnvAccesses(sourceFile);
  const violations: Violation[] = [];

  for (const line of envAccessLines) {
    const layerDesc = layer ? `'${layer}'` : "unknown";
    violations.push({
      filePath: filepath,
      line,
      description: `Access to 'process.env' outside infrastructure layer (found in ${layerDesc} layer). Move environment access to infrastructure.`,
      severity: "warning",
      rule: "ENV_ACCESS_OUTSIDE_INFRA",
    });
  }

  return buildReport({
    agentName: "security-guard",
    analyzedPath: filepath,
    violations,
  });
}
