import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildReport } from "../AuditReportBuilder";
import { Violation } from "../types";

/**
 * Property 13: Completitud estructural del AuditReport
 * For any valid input to buildReport, the result always contains
 * timestamp, agentName, analyzedPath, status, violations, summary.errorCount, summary.warningCount.
 * **Validates: Requirements 6.1, 6.4**
 */
describe("Property 13: Completitud estructural del AuditReport", () => {
  const violationArb = fc.record({
    filePath: fc.string(),
    line: fc.nat(),
    description: fc.string(),
    severity: fc.oneof(
      fc.constant("error" as const),
      fc.constant("warning" as const)
    ),
  });

  it("buildReport always produces a report with all required fields", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.array(violationArb),
        (agentName, analyzedPath, violations: Violation[]) => {
          const report = buildReport({
            agentName,
            analyzedPath,
            violations,
          });

          // All required fields must be present
          expect(report.timestamp).toBeDefined();
          expect(typeof report.timestamp).toBe("string");
          expect(report.timestamp.length).toBeGreaterThan(0);
          expect(report.agentName).toBe(agentName);
          expect(report.analyzedPath).toBe(analyzedPath);
          expect(["passed", "failed", "error"]).toContain(report.status);
          expect(Array.isArray(report.violations)).toBe(true);
          expect(typeof report.summary.errorCount).toBe("number");
          expect(typeof report.summary.warningCount).toBe("number");

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
