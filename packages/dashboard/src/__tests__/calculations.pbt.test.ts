import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { calculateHealthScore } from "../calculations";

/**
 * **Validates: Requirements 2.7**
 *
 * Property 5: Fórmula del Health Score
 * Para cualquier par (errorCount ≥ 0, totalLines ≥ 0), `calculateHealthScore`
 * retorna un entero en [0, 100] calculado como round((1 - errorCount/totalLines) * 100)
 * clamped a [0, 100]. Cuando totalLines es 0, retorna 100.
 */
describe("Health Score - Property-Based Tests", () => {
  it("Property 5a: result is always an integer in [0, 100]", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10000 }),  // errorCount
        fc.nat({ max: 100000 }), // totalLines
        (errorCount, totalLines) => {
          const score = calculateHealthScore(errorCount, totalLines);
          expect(Number.isInteger(score)).toBe(true);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 5b: when totalLines is 0, returns 100", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10000 }), // any errorCount
        (errorCount) => {
          const score = calculateHealthScore(errorCount, 0);
          expect(score).toBe(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 5c: formula is round((1 - errorCount/totalLines) * 100) clamped to [0, 100]", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10000 }),
        fc.integer({ min: 1, max: 100000 }),
        (errorCount, totalLines) => {
          const score = calculateHealthScore(errorCount, totalLines);
          const expected = Math.min(100, Math.max(0,
            Math.round((1 - errorCount / totalLines) * 100)
          ));
          expect(score).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 5d: errorCount=0 always yields 100", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        (totalLines) => {
          const score = calculateHealthScore(0, totalLines);
          expect(score).toBe(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 5e: errorCount >= totalLines always yields 0 (when totalLines > 0)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 0, max: 10000 }),
        (totalLines, extra) => {
          const errorCount = totalLines + extra; // errorCount >= totalLines
          const score = calculateHealthScore(errorCount, totalLines);
          expect(score).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
