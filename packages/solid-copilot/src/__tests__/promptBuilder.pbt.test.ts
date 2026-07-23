import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildSolidAnalysisPrompt } from "../bedrock/promptBuilder";

/**
 * **Validates: Requirements 1.7**
 *
 * Property 4: Completitud del prompt de análisis
 * Para cualquier string de código fuente no vacío, el prompt contiene:
 * - El código original
 * - Los 5 principios SOLID (SRP, OCP, LSP, ISP, DIP)
 * - Los campos del schema JSON (complexity_score, violations, refactoring_index)
 */
describe("PromptBuilder - Property-Based Tests", () => {
  it("Property 4: prompt contains source code, all 5 SOLID principles, and JSON schema fields", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (sourceCode) => {
          const prompt = buildSolidAnalysisPrompt(sourceCode);

          // Must contain the original source code
          expect(prompt).toContain(sourceCode);

          // Must mention all 5 SOLID principles
          expect(prompt).toContain("SRP");
          expect(prompt).toContain("OCP");
          expect(prompt).toContain("LSP");
          expect(prompt).toContain("ISP");
          expect(prompt).toContain("DIP");

          // Must contain the JSON schema fields
          expect(prompt).toContain("complexity_score");
          expect(prompt).toContain("violations");
          expect(prompt).toContain("refactoring_index");
        }
      ),
      { numRuns: 100 }
    );
  });
});
