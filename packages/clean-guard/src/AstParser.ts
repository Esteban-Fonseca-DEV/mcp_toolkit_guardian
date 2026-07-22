import * as ts from "typescript";

export interface ImportStatement {
  sourcePath: string;      // the file being analyzed
  targetModule: string;    // the module being imported (e.g., "../infrastructure/db")
  line: number;            // 1-indexed line number
}

/**
 * Parses a TypeScript file's content and extracts all static import declarations.
 * Returns null if the file cannot be parsed (signal for Violation warning — Req 2.6).
 */
export function parseImports(filepath: string, content: string): ImportStatement[] | null {
  let sourceFile: ts.SourceFile;

  try {
    sourceFile = ts.createSourceFile(
      filepath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
  } catch {
    return null;
  }

  // Check for critical parse errors.
  // TypeScript's createSourceFile is lenient and produces a partial AST even with errors,
  // but we can check the parseDiagnostics for fatal syntax errors.
  const diagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics;
  if (diagnostics && diagnostics.length > 0) {
    const hasFatalError = diagnostics.some(
      (d: ts.Diagnostic) => d.category === ts.DiagnosticCategory.Error
    );
    if (hasFatalError) {
      return null;
    }
  }

  const imports: ImportStatement[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        imports.push({
          sourcePath: filepath,
          targetModule: moduleSpecifier.text,
          line,
        });
      }
    }
  });

  return imports;
}
