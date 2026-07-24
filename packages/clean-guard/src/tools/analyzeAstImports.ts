import { readFile } from "fs/promises";
import { AuditReport, Ruleset, buildReport } from "@guardian/shared";
import { cachedParseImports, IAstCache } from "../AstParser";

export interface ImportMapping {
  sourceModule: string;
  targetModule: string;
  line: number;
}

export interface AnalyzeAstImportsResult extends AuditReport {
  metadata?: {
    imports: ImportMapping[];
  };
}

export async function analyzeAstImports(
  args: { filepath: string },
  ruleset: Ruleset,
  cache?: IAstCache
): Promise<AnalyzeAstImportsResult> {
  const { filepath } = args;

  let content: string;
  try {
    content = await readFile(filepath, "utf-8");
  } catch (err) {
    return buildReport({
      agentName: "clean-guard",
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

  const imports = cachedParseImports(filepath, content, cache);

  // If file is unparseable, return a warning violation (Req 2.6)
  if (imports === null) {
    return buildReport({
      agentName: "clean-guard",
      analyzedPath: filepath,
      violations: [
        {
          filePath: filepath,
          line: 0,
          description: `File cannot be parsed as TypeScript: ${filepath}`,
          severity: "warning",
          rule: "PARSE_ERROR",
        },
      ],
    });
  }

  // Map each import to { sourceModule, targetModule, line }
  const importMappings: ImportMapping[] = imports.map((imp) => ({
    sourceModule: imp.sourcePath,
    targetModule: imp.targetModule,
    line: imp.line,
  }));

  // Return successful report with imports as metadata (Req 2.1)
  // Status will be "passed" since no error violations
  const report = buildReport({
    agentName: "clean-guard",
    analyzedPath: filepath,
    violations: [],
  });

  return {
    ...report,
    metadata: {
      imports: importMappings,
    },
  };
}
