import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { formatReport } from "../formatter";
import { AuditReport, Violation, ExecutionStatus, AgentSummary } from "@guardian/shared";

/**
 * Property 20: Round-trip JSON del formatter
 * Generate arbitrary AuditReports.
 * Verify formatReport(report, "json") → JSON.parse produces an equivalent object.
 * **Validates: Requirements 11.4**
 */
describe("Property 20: Round-trip JSON formatter", () => {
  const violationArb: fc.Arbitrary<Violation> = fc.record({
    filePath: fc.string({ minLength: 1, maxLength: 30 }),
    line: fc.nat({ max: 1000 }),
    description: fc.string({ minLength: 1, maxLength: 50 }),
    severity: fc.oneof(
      fc.constant("error" as const),
      fc.constant("warning" as const)
    ),
  });

  const agentSummaryArb: fc.Arbitrary<AgentSummary> = fc.record({
    agentName: fc.oneof(
      fc.constant("clean-guard"),
      fc.constant("tdd-strict"),
      fc.constant("ddd-guard")
    ),
    errorCount: fc.nat({ max: 20 }),
    warningCount: fc.nat({ max: 20 }),
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
      fc.constant("failed" as ExecutionStatus)
    ),
    violations: fc.array(violationArb, { maxLength: 5 }),
    summary: fc.record({
      errorCount: fc.nat({ max: 20 }),
      warningCount: fc.nat({ max: 20 }),
      byAgent: fc.option(fc.array(agentSummaryArb, { maxLength: 3 }), {
        nil: undefined,
      }),
    }),
  });

  it("JSON.parse(formatReport(report, 'json')) equals the original report", () => {
    fc.assert(
      fc.property(reportArb, (report) => {
        const jsonStr = formatReport(report, "json");

        // Should be valid JSON
        const parsed = JSON.parse(jsonStr);

        // Should be structurally equivalent to the original report
        expect(parsed.timestamp).toBe(report.timestamp);
        expect(parsed.agentName).toBe(report.agentName);
        expect(parsed.analyzedPath).toBe(report.analyzedPath);
        expect(parsed.status).toBe(report.status);
        expect(parsed.violations).toEqual(report.violations);
        expect(parsed.summary.errorCount).toBe(report.summary.errorCount);
        expect(parsed.summary.warningCount).toBe(report.summary.warningCount);

        // Full deep equality
        expect(parsed).toEqual(report);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it("formatReport with json format always produces valid JSON", () => {
    fc.assert(
      fc.property(reportArb, (report) => {
        const jsonStr = formatReport(report, "json");
        expect(() => JSON.parse(jsonStr)).not.toThrow();
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
