import { readFile } from "fs/promises";
import * as ts from "typescript";
import * as path from "path";
import { AuditReport, Ruleset, Violation, buildReport } from "@guardian/shared";
import { glob } from "glob";
import { minimatch } from "minimatch";

export async function auditDddBoundedContext(
  args: { directory: string },
  ruleset: Ruleset
): Promise<AuditReport> {
  const contexts = ruleset.ddd?.boundedContexts ?? {};
  const violations: Violation[] = [];

  // If no bounded contexts configured, return clean report
  if (Object.keys(contexts).length === 0) {
    return buildReport({
      agentName: "ddd-guard",
      analyzedPath: args.directory,
      violations: [],
    });
  }

  // Determine which bounded context a file belongs to
  function getContext(filePath: string): string | null {
    const relative = path
      .relative(args.directory, filePath)
      .replace(/\\/g, "/");
    for (const [ctxName, patterns] of Object.entries(contexts)) {
      if (patterns.some((p) => minimatch(relative, p))) {
        return ctxName;
      }
    }
    return null;
  }

  const files = await glob("**/*.ts", {
    cwd: args.directory,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });

  if (files.length === 0) {
    return buildReport({
      agentName: "ddd-guard",
      analyzedPath: args.directory,
      violations: [],
    });
  }

  for (const file of files) {
    const sourceCtx = getContext(file);
    if (!sourceCtx) continue; // file outside any bounded context

    let content: string;
    try {
      content = await readFile(file, "utf-8");
    } catch {
      continue;
    }

    const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

    ts.forEachChild(sf, (node) => {
      if (!ts.isImportDeclaration(node)) return;
      const specifier = (node.moduleSpecifier as ts.StringLiteral).text;

      // Resolve the imported path
      let resolved = path
        .resolve(path.dirname(file), specifier)
        .replace(/\\/g, "/");
      if (!resolved.endsWith(".ts")) {
        resolved = resolved + ".ts";
      }

      const targetCtx = getContext(resolved);

      if (targetCtx && targetCtx !== sourceCtx) {
        const line =
          sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        violations.push({
          filePath: file.replace(/\\/g, "/"),
          line,
          description: `Import cruza frontera de bounded context: '${sourceCtx}' -> '${targetCtx}'. Use una interfaz anticorrupcion.`,
          severity: "error",
          rule: "DDD_CROSS_CONTEXT_IMPORT",
        });
      }
    });
  }

  return buildReport({
    agentName: "ddd-guard",
    analyzedPath: args.directory,
    violations,
  });
}
