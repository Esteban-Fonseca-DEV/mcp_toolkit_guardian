import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseImports } from "../AstParser";

/**
 * Property 6: Robustez ante código TypeScript inválido
 * Generate arbitrary strings (not valid TypeScript).
 * Verify parseImports returns null or an array (never throws).
 * **Validates: Requirements 2.6**
 */
describe("Property 6: Robustez ante código TypeScript inválido", () => {
  it("parseImports never throws for arbitrary string input", () => {
    fc.assert(
      fc.property(fc.string(), (content) => {
        // parseImports should NEVER throw an unhandled exception
        let result: ReturnType<typeof parseImports> | undefined;
        expect(() => {
          result = parseImports("arbitrary-file.ts", content);
        }).not.toThrow();

        // Result must be either null (unparseable) or an array (parsed successfully)
        expect(result === null || Array.isArray(result)).toBe(true);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it("parseImports never throws for strings with special characters and binary content", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.uint8Array({ minLength: 1, maxLength: 200 }).map((arr) =>
            Buffer.from(arr).toString("utf-8")
          ),
          fc.constant("\x00\x01\x02\x03"),
          fc.constant("{{{{"),
          fc.constant("import from 'broken"),
          fc.constant("export default @@@")
        ),
        (content) => {
          let result: ReturnType<typeof parseImports> | undefined;
          expect(() => {
            result = parseImports("garbage.ts", content);
          }).not.toThrow();

          expect(result === null || Array.isArray(result)).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
