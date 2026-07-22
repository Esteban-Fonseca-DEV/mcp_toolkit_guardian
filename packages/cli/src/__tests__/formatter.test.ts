import { describe, it, expect } from "vitest";
import { formatReport } from "../formatter";
import { AuditReport } from "@guardian/shared";

function makeReport(overrides: Partial<AuditReport> = {}): AuditReport {
  return {
    timestamp: "2024-01-01T00:00:00.000Z",
    agentName: "guardian",
    analyzedPath: "/project",
    status: "passed",
    violations: [],
    summary: { errorCount: 0, warningCount: 0 },
    ...overrides,
  };
}

describe("formatReport", () => {
  describe("json format", () => {
    it("produces valid parseable JSON", () => {
      const report = makeReport();
      const output = formatReport(report, "json");
      const parsed = JSON.parse(output);
      expect(parsed).toEqual(report);
    });

    it("includes all violations in JSON output", () => {
      const report = makeReport({
        status: "failed",
        violations: [
          { filePath: "src/domain/User.ts", line: 5, description: "Invalid import", severity: "error" },
        ],
        summary: { errorCount: 1, warningCount: 0 },
      });
      const output = formatReport(report, "json");
      const parsed = JSON.parse(output);
      expect(parsed.violations).toHaveLength(1);
      expect(parsed.violations[0].filePath).toBe("src/domain/User.ts");
    });
  });

  describe("text format", () => {
    it("includes the status", () => {
      const report = makeReport({ status: "failed" });
      const output = formatReport(report, "text");
      expect(output).toContain("FAILED");
    });

    it("includes the analyzed path", () => {
      const report = makeReport({ analyzedPath: "/my/project" });
      const output = formatReport(report, "text");
      expect(output).toContain("/my/project");
    });

    it("shows violation count and file paths", () => {
      const report = makeReport({
        status: "failed",
        violations: [
          { filePath: "src/domain/User.ts", line: 10, description: "Bad import from infra", severity: "error" },
          { filePath: "src/app/Service.ts", line: 3, description: "Missing test", severity: "warning" },
        ],
        summary: { errorCount: 1, warningCount: 1 },
      });
      const output = formatReport(report, "text");
      expect(output).toContain("Errors: 1");
      expect(output).toContain("Warnings: 1");
      expect(output).toContain("src/domain/User.ts:10");
      expect(output).toContain("src/app/Service.ts:3");
      expect(output).toContain("[ERROR]");
      expect(output).toContain("[WARN]");
    });

    it("shows no violations message when clean", () => {
      const report = makeReport();
      const output = formatReport(report, "text");
      expect(output).toContain("No violations found.");
    });

    it("shows agent summary when byAgent is present", () => {
      const report = makeReport({
        summary: {
          errorCount: 2,
          warningCount: 1,
          byAgent: [
            { agentName: "clean-guard", errorCount: 2, warningCount: 0 },
            { agentName: "tdd-strict", errorCount: 0, warningCount: 1 },
          ],
        },
      });
      const output = formatReport(report, "text");
      expect(output).toContain("clean-guard: 2 errors, 0 warnings");
      expect(output).toContain("tdd-strict: 0 errors, 1 warnings");
    });
  });
});
