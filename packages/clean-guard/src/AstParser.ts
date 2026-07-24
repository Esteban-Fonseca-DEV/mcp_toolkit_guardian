import * as ts from "typescript";
import { statSync } from "fs";

export interface ImportStatement {
  sourcePath: string;      // the file being analyzed
  targetModule: string;    // the module being imported (e.g., "../infrastructure/db")
  line: number;            // 1-indexed line number
}

/**
 * Interface for an AST cache that stores parsed results keyed by filepath + mtime.
 * This is a lightweight contract so that clean-guard can accept a cache instance
 * without depending on the concrete AstCache class from @guardian/server.
 */
export interface IAstCache {
  get(filepath: string, mtime: number): unknown | null;
  set(filepath: string, ast: unknown, mtime: number): void;
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

/**
 * Cached version of parseImports that checks the AST cache before parsing.
 * If no cache is provided, it behaves identically to parseImports (backward-compatible).
 *
 * Uses the file's mtime (from fs.statSync) to determine cache validity:
 * - Cache hit (same mtime): returns cached result without re-parsing (Req 3.2)
 * - Cache miss (different mtime or not cached): parses and stores result (Req 3.3)
 *
 * @param filepath - Path to the file being analyzed
 * @param content - File content to parse
 * @param cache - Optional AST cache instance
 * @returns Parsed import statements or null if unparseable
 */
export function cachedParseImports(
  filepath: string,
  content: string,
  cache?: IAstCache
): ImportStatement[] | null {
  if (!cache) {
    return parseImports(filepath, content);
  }

  // Get file mtime for cache key
  let mtime: number;
  try {
    const stat = statSync(filepath);
    mtime = stat.mtimeMs;
  } catch {
    // If we can't stat the file, skip caching and parse directly
    return parseImports(filepath, content);
  }

  // Check cache
  const cached = cache.get(filepath, mtime);
  if (cached !== null) {
    return cached as ImportStatement[] | null;
  }

  // Cache miss — parse and store
  const result = parseImports(filepath, content);
  cache.set(filepath, result, mtime);
  return result;
}
