import { describe, it, expect } from "vitest";
import { resolveExitCode } from "../exitCodeResolver";
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

describe("resolveExitCode", () => {
  it("returns 0 when no errors and failOn is 'error'", () => {
    const report = makeReport({ status: "passed", violations: [] });
    expect(resolveExitCode(report, "error")).toBe(0);
  });

  it("returns 0 when only warnings and failOn is 'error'", () => {
    const report = makeReport({
      status: "passed",
      violations: [
        { filePath: "a.ts", line: 1, description: "warn", severity: "warning" },
      ],
    });
    expect(resolveExitCode(report, "error")).toBe(0);
  });

  it("returns 1 when errors exist and failOn is 'error'", () => {
    const report = makeReport({
      status: "failed",
      violations: [
        { filePath: "a.ts", line: 1, description: "error found", severity: "error" },
      ],
    });
    expect(resolveExitCode(report, "error")).toBe(1);
  });

  it("returns 1 when warnings exist and failOn is 'warning'", () => {
    const report = makeReport({
      status: "passed",
      violations: [
        { filePath: "a.ts", line: 1, description: "warn", severity: "warning" },
      ],
    });
    expect(resolveExitCode(report, "warning")).toBe(1);
  });

  it("returns 1 when errors exist and failOn is 'warning'", () => {
    const report = makeReport({
      status: "failed",
      violations: [
        { filePath: "a.ts", line: 1, description: "error found", severity: "error" },
      ],
    });
    expect(resolveExitCode(report, "warning")).toBe(1);
  });

  it("returns 2 when report status is 'error' (internal error)", () => {
    const report = makeReport({
      status: "error",
      error: "Something went wrong",
    });
    expect(resolveExitCode(report, "error")).toBe(2);
  });

  it("returns 0 when no violations and failOn is 'warning'", () => {
    const report = makeReport({ status: "passed", violations: [] });
    expect(resolveExitCode(report, "warning")).toBe(0);
  });
});
