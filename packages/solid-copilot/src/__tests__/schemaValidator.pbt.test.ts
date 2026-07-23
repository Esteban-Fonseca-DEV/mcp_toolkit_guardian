import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validateSolidPayload } from "../bedrock/schemaValidator";

/**
 * **Validates: Requirements 1.2, 1.3**
 *
 * Property 1: Validación de Schema del SOLID_Analysis_Payload
 * - validateSolidPayload returns true for valid payloads (complexity_score 0-100 integer,
 *   violations array of valid BedrockViolation objects, refactoring_index 0.0-1.0)
 * - validateSolidPayload returns false for any invalid payload
 */
describe("SchemaValidator - Property-Based Tests", () => {
  const validPrinciple = fc.constantFrom("SRP", "OCP", "LSP", "ISP", "DIP");
  const validSeverity = fc.constantFrom("CRITICAL", "WARNING", "INFO");

  const validViolation = fc.record({
    principle: validPrinciple,
    severity: validSeverity,
    reason: fc.string({ minLength: 1, maxLength: 100 }),
    suggested_refactoring: fc.string({ minLength: 1, maxLength: 100 }),
  });

  const validPayload = fc.record({
    complexity_score: fc.integer({ min: 0, max: 100 }),
    violations: fc.array(validViolation, { minLength: 0, maxLength: 5 }),
    refactoring_index: fc.double({ min: 0, max: 1, noNaN: true }),
  });

  it("Property 1a: valid payloads return true", () => {
    fc.assert(
      fc.property(validPayload, (payload) => {
        expect(validateSolidPayload(payload)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("Property 1b: payload with complexity_score out of range returns false", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 101, max: 1000 }),
          fc.integer({ min: -1000, max: -1 })
        ),
        fc.array(validViolation, { minLength: 0, maxLength: 3 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (complexityScore, violations, refactoringIndex) => {
          const payload = {
            complexity_score: complexityScore,
            violations,
            refactoring_index: refactoringIndex,
          };
          expect(validateSolidPayload(payload)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 1c: payload with non-integer complexity_score returns false", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 99.99, noNaN: true }).filter(
          (n) => !Number.isInteger(n)
        ),
        fc.array(validViolation, { minLength: 0, maxLength: 3 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (complexityScore, violations, refactoringIndex) => {
          const payload = {
            complexity_score: complexityScore,
            violations,
            refactoring_index: refactoringIndex,
          };
          expect(validateSolidPayload(payload)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 1d: payload with refactoring_index out of range returns false", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.array(validViolation, { minLength: 0, maxLength: 3 }),
        fc.oneof(
          fc.double({ min: 1.01, max: 100, noNaN: true }),
          fc.double({ min: -100, max: -0.01, noNaN: true })
        ),
        (complexityScore, violations, refactoringIndex) => {
          const payload = {
            complexity_score: complexityScore,
            violations,
            refactoring_index: refactoringIndex,
          };
          expect(validateSolidPayload(payload)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 1e: payload with invalid violation severity returns false", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (s) => !["CRITICAL", "WARNING", "INFO"].includes(s)
        ),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (complexityScore, badSeverity, refactoringIndex) => {
          const payload = {
            complexity_score: complexityScore,
            violations: [
              {
                principle: "SRP",
                severity: badSeverity,
                reason: "test",
                suggested_refactoring: "test",
              },
            ],
            refactoring_index: refactoringIndex,
          };
          expect(validateSolidPayload(payload)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 1f: null, undefined, and non-objects return false", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.string(),
          fc.integer(),
          fc.boolean()
        ),
        (payload) => {
          expect(validateSolidPayload(payload)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
