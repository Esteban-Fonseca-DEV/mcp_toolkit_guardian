import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { resolveExitCode } from "../exitCodeResolver";
import { AuditReport, Violation, ExecutionStatus } from "@guardian/shared";

/**
 * Property 19: Determinismo del exit code del CLI
 * Generate arbitrary AuditReports and failOn values.
 * Verify exit code is deterministic: 0 (no issues), 1 (violations at threshold), 2 (error status).
 * **Validates: Requirements 11.2, 11.3, 11.5**
 */
describe("Property 19: Determinismo de exit codes", () => {
  const violationArb: fc.Arbitrary<Violation> = fc.record({
    filePath: fc.string({ minLength: 1, maxLength: 30 }),
    line: fc.nat({ max: 1000 }),
    description: fc.string({ minLength: 1, maxLength: 50 }),
    severity: fc.oneof(
      fc.constant("error" as const),
      fc.constant("warning" as const)
    ),
  });

  const reportArb: fc.Arbitrary<AuditReport> = fc.record({
    timestamp: fc.date().map((d) => d.toISOString()),
    agentName: fc.oneof(
      fc.constant("clean-guard"),
      fc.constant("tdd-strict"),
      fc.constant("ddd-guard"),
      fc.constant("guardian")
    ),
    analyzedPath: fc.string({ minLength: 1, maxLength: 30 }),
    status: fc.oneof(
      fc.constant("passed" as ExecutionStatus),
      fc.constant("failed" as ExecutionStatus),
      fc.constant("error" as ExecutionStatus)
    ),
    violations: fc.array(violationArb, { maxLength: 10 }),
    summary: fc.record({
      errorCount: fc.nat({ max: 50 }),
      warningCount: fc.nat({ max: 50 }),
    }),
  });

  const failOnArb = fc.oneof(
    fc.constant("error" as const),
    fc.constant("warning" as const)
  );

  it("returns 2 for any report with status 'error' regardless of failOn", () => {
    fc.assert(
      fc.property(reportArb, failOnArb, (report, failOn) => {
        const errorReport = { ...report, status: "error" as ExecutionStatus };
        const exitCode = resolveExitCode(errorReport, failOn);
        expect(exitCode).toBe(2);
      }),
      { numRuns: 100 }
    );
  });

  it("returns 1 when there are errors and failOn is 'error'", () => {
    fc.assert(
      fc.property(
        reportArb,
        (report) => {
          const withErrors: AuditReport = {
            ...report,
            status: "failed",
            violations: [
              ...report.violations,
              {
                filePath: "test.ts",
                line: 1,
                description: "error",
                severity: "error",
              },
            ],
          };
          const exitCode = resolveExitCode(withErrors, "error");
          expect(exitCode).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns 0 when no errors/warnings exist", () => {
    fc.assert(
      fc.property(
        reportArb,
        failOnArb,
        (report, failOn) => {
          const cleanReport: AuditReport = {
            ...report,
            status: "passed",
            violations: [],
          };
          const exitCode = resolveExitCode(cleanReport, failOn);
          expect(exitCode).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("is deterministic — same input always produces same exit code", () => {
    fc.assert(
      fc.property(reportArb, failOnArb, (report, failOn) => {
        const first = resolveExitCode(report, failOn);
        const second = resolveExitCode(report, failOn);
        expect(first).toBe(second);

        // Verify the exit code matches our invariants
        if (report.status === "error") {
          expect(first).toBe(2);
        } else {
          const hasErrors = report.violations.some(
            (v) => v.severity === "error"
          );
          const hasWarnings = report.violations.some(
            (v) => v.severity === "warning"
          );

          if (failOn === "warning") {
            expect(first).toBe(hasErrors || hasWarnings ? 1 : 0);
          } else {
            expect(first).toBe(hasErrors ? 1 : 0);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
