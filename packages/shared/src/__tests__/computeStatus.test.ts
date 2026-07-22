import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeStatus } from "../utils";
import { Violation } from "../types";

/**
 * Property 14: Determinismo del cálculo de status
 * For any Violation[], if any has severity: "error" → "failed", else → "passed".
 * **Validates: Requirements 6.2, 6.3**
 */
describe("Property 14: Determinismo del cálculo de status", () => {
  const violationArb = fc.record({
    filePath: fc.string(),
    line: fc.nat(),
    description: fc.string(),
    severity: fc.oneof(
      fc.constant("error" as const),
      fc.constant("warning" as const)
    ),
  });

  it("status is 'failed' when there is at least one error, 'passed' otherwise", () => {
    fc.assert(
      fc.property(fc.array(violationArb), (violations: Violation[]) => {
        const status = computeStatus(violations);
        const hasError = violations.some((v) => v.severity === "error");
        return hasError ? status === "failed" : status === "passed";
      }),
      { numRuns: 100 }
    );
  });
});
