import { readdir, readFile } from "fs/promises";
import { join, relative } from "path";
import { minimatch } from "minimatch";
import { AuditReport, Ruleset, Violation, buildReport, getSupportedExtensions, parseImportsMultiLang } from "@guardian/shared";
import { parseImports } from "../AstParser";

export interface DependencyGraph {
  nodes: string[];
  edges: { from: string; to: string }[];
}

export interface GenerateDependencyGraphResult extends AuditReport {
  graph: DependencyGraph;
}

/**
 * Recursively collects all supported source files in a directory, excluding paths matched by excludePaths patterns.
 * Skips .d.ts files (type declarations).
 */
async function getSourceFiles(dir: string, excludePaths: string[]): Promise<string[]> {
  const files: string[] = [];
  const supportedExts = getSupportedExtensions();

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      const relativePath = relative(dir, fullPath).replace(/\\/g, "/");

      // Check if path should be excluded
      const isExcluded = excludePaths.some(
        (pattern) => minimatch(relativePath, pattern) || minimatch(entry.name, pattern)
      );

      if (isExcluded) continue;

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && supportedExts.some(ext => entry.name.endsWith(ext)) && !entry.name.endsWith(".d.ts")) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * Analyzes all TypeScript files in a directory and returns the dependency graph.
 * Respects excludePaths from the Ruleset. Files that cannot be parsed emit a warning
 * Violation but do not halt analysis (Req 2.3, 2.6).
 */
export async function generateDependencyGraph(
  args: { directory: string },
  ruleset: Ruleset
): Promise<GenerateDependencyGraphResult> {
  const { directory } = args;
  const violations: Violation[] = [];

  let tsFiles: string[];
  try {
    tsFiles = await getSourceFiles(directory, ruleset.excludePaths);
  } catch (err) {
    const report = buildReport({
      agentName: "clean-guard",
      analyzedPath: directory,
      status: "error",
      violations: [],
      error: `Cannot read directory: ${(err as Error).message}`,
    });
    return {
      ...report,
      graph: { nodes: [], edges: [] },
    };
  }

  const graph: DependencyGraph = {
    nodes: [],
    edges: [],
  };

  for (const filePath of tsFiles) {
    const relativePath = relative(directory, filePath).replace(/\\/g, "/");
    graph.nodes.push(relativePath);

    let content: string;
    try {
      content = await readFile(filePath, "utf-8");
    } catch (err) {
      violations.push({
        filePath: relativePath,
        line: 0,
        description: `Cannot read file: ${(err as Error).message}`,
        severity: "warning",
        rule: "FILE_READ_ERROR",
      });
      continue;
    }

    const imports = parseImports(filePath, content);

    if (imports === null) {
      // Try multi-language parser as fallback for non-TypeScript files
      const multiLangImports = parseImportsMultiLang(filePath, content);
      if (multiLangImports !== null) {
        for (const imp of multiLangImports) {
          graph.edges.push({
            from: relativePath,
            to: imp.targetModule,
          });
        }
        continue;
      }

      violations.push({
        filePath: relativePath,
        line: 0,
        description: `File cannot be parsed as TypeScript: ${relativePath}`,
        severity: "warning",
        rule: "PARSE_ERROR",
      });
      continue;
    }

    for (const imp of imports) {
      graph.edges.push({
        from: relativePath,
        to: imp.targetModule,
      });
    }
  }

  const report = buildReport({
    agentName: "clean-guard",
    analyzedPath: directory,
    violations,
  });

  return {
    ...report,
    graph,
  };
}
