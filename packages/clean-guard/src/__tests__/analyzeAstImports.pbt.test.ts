import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseImports } from "../AstParser";

/**
 * Property 2: Completitud del análisis de imports AST
 * Generate TypeScript files with N imports. Verify parseImports returns exactly N entries.
 * **Validates: Requirements 2.1**
 */
describe("Property 2: Completitud del análisis de imports AST", () => {
  /**
   * Generator for TypeScript file content with exactly N import statements.
   * Produces syntactically valid import declarations.
   */
  const tsFileWithImports = (n: number) =>
    fc
      .array(
        fc.string({ minLength: 1, maxLength: 30 }).map((s) =>
          // Sanitize to produce valid module specifier (no quotes/newlines)
          s.replace(/['"\\`\n\r]/g, "x")
        ),
        { minLength: n, maxLength: n }
      )
      .map((modules) =>
        modules.map((m, i) => `import { X${i} } from '${m}';`).join("\n")
      );

  it("parseImports returns exactly N entries for a file with N import statements", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        (n) => {
          const content = Array.from({ length: n }, (_, i) =>
            `import { Item${i} } from './module${i}';`
          ).join("\n");

          const result = parseImports("test-file.ts", content);

          expect(result).not.toBeNull();
          expect(result).toHaveLength(n);

          // Each entry should have the correct targetModule
          if (result) {
            for (let i = 0; i < n; i++) {
              expect(result[i].targetModule).toBe(`./module${i}`);
              expect(result[i].sourcePath).toBe("test-file.ts");
              expect(result[i].line).toBeGreaterThan(0);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
