import { readFile } from "fs/promises";
import * as ts from "typescript";
import * as path from "path";
import { AuditReport, Ruleset, Violation, buildReport } from "@guardian/shared";
import { glob } from "glob";

export async function auditDddAggregateAccess(
  args: { directory: string },
  ruleset: Ruleset
): Promise<AuditReport> {
  const aggregates = ruleset.ddd?.aggregates ?? {};
  const violations: Violation[] = [];

  // Build a map: normalized internal path → normalized aggregate root path
  const internalToRoot = new Map<string, string>();
  for (const [, config] of Object.entries(aggregates)) {
    const rootPath = path.resolve(args.directory, config.root).replace(/\\/g, "/");
    for (const internal of config.internals) {
      const internalPath = path.resolve(args.directory, internal).replace(/\\/g, "/");
      internalToRoot.set(internalPath, rootPath);
    }
  }

  // If no aggregates configured, return clean report
  if (internalToRoot.size === 0) {
    return buildReport({
      agentName: "ddd-guard",
      analyzedPath: args.directory,
      violations: [],
    });
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
    const normalizedFile = file.replace(/\\/g, "/");
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

      // Resolve the imported path relative to the importing file
      let resolved = path.resolve(path.dirname(file), specifier).replace(/\\/g, "/");

      // Try with .ts extension if not already there
      if (!resolved.endsWith(".ts")) {
        resolved = resolved + ".ts";
      }

      const aggregateRoot = internalToRoot.get(resolved);
      if (aggregateRoot && normalizedFile !== aggregateRoot) {
        const line =
          sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        violations.push({
          filePath: normalizedFile,
          line,
          description: `Acceso directo a entidad interna '${path.basename(resolved)}' sin pasar por el Aggregate Root '${path.basename(aggregateRoot)}'.`,
          severity: "error",
          rule: "DDD_DIRECT_INTERNAL_ACCESS",
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
