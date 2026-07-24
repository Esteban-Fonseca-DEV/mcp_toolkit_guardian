import { describe, test, expect } from "vitest";
import { calculateHealthScore, calculateRadarData, calculateDashboardData } from "../calculations";
import { AuditReport } from "@guardian/shared";

describe("calculateHealthScore", () => {
  test("returns 100 when totalLines is 0", () => {
    expect(calculateHealthScore(5, 0)).toBe(100);
  });

  test("returns 100 when errorCount is 0", () => {
    expect(calculateHealthScore(0, 1000)).toBe(100);
  });

  test("returns 0 when errorCount >= totalLines", () => {
    expect(calculateHealthScore(100, 100)).toBe(0);
    expect(calculateHealthScore(200, 100)).toBe(0);
  });

  test("calculates correctly for typical values", () => {
    // 1 - 10/100 = 0.9 → 90
    expect(calculateHealthScore(10, 100)).toBe(90);
    // 1 - 1/1000 = 0.999 → 100
    expect(calculateHealthScore(1, 1000)).toBe(100);
    // 1 - 50/100 = 0.5 → 50
    expect(calculateHealthScore(50, 100)).toBe(50);
  });

  test("clamps result to [0, 100]", () => {
    expect(calculateHealthScore(1000, 10)).toBe(0);
  });

  test("returns integer", () => {
    const score = calculateHealthScore(3, 7);
    expect(Number.isInteger(score)).toBe(true);
  });
});

describe("calculateRadarData", () => {
  test("returns empty record when no byAgent data", () => {
    const report: AuditReport = {
      timestamp: new Date().toISOString(),
      agentName: "guardian",
      analyzedPath: "/project",
      status: "passed",
      violations: [],
      summary: { errorCount: 0, warningCount: 0 },
    };
    expect(calculateRadarData(report)).toEqual({});
  });

  test("calculates compliance based on penalty formula", () => {
    const report: AuditReport = {
      timestamp: new Date().toISOString(),
      agentName: "guardian",
      analyzedPath: "/project",
      status: "failed",
      violations: [],
      summary: {
        errorCount: 3,
        warningCount: 5,
        byAgent: [
          { agentName: "clean-guard", errorCount: 2, warningCount: 3 },
          { agentName: "solid-copilot", errorCount: 1, warningCount: 2 },
        ],
      },
    };

    const radar = calculateRadarData(report);
    // clean-guard: 100 - (2*10 + 3*3) = 100 - 29 = 71
    expect(radar["clean-guard"]).toBe(71);
    // solid-copilot: 100 - (1*10 + 2*3) = 100 - 16 = 84
    expect(radar["solid-copilot"]).toBe(84);
  });

  test("clamps compliance to [0, 100]", () => {
    const report: AuditReport = {
      timestamp: new Date().toISOString(),
      agentName: "guardian",
      analyzedPath: "/project",
      status: "failed",
      violations: [],
      summary: {
        errorCount: 50,
        warningCount: 50,
        byAgent: [
          { agentName: "bad-agent", errorCount: 20, warningCount: 10 },
        ],
      },
    };

    const radar = calculateRadarData(report);
    // 100 - (20*10 + 10*3) = 100 - 230 = -130 → clamped to 0
    expect(radar["bad-agent"]).toBe(0);
  });
});

describe("calculateDashboardData", () => {
  test("returns complete DashboardData for a report", () => {
    const report: AuditReport = {
      timestamp: "2025-01-20T10:00:00.000Z",
      agentName: "clean-guard",
      analyzedPath: "/project/src",
      status: "failed",
      violations: [
        { filePath: "src/auth/login.ts", line: 10, description: "Too many deps", severity: "error", rule: "SRP" },
        { filePath: "src/auth/login.ts", line: 20, description: "Missing interface", severity: "warning", rule: "DIP" },
        { filePath: "src/utils/helper.ts", line: 5, description: "God class", severity: "error", rule: "SRP" },
      ],
      summary: {
        errorCount: 2,
        warningCount: 1,
        byAgent: [
          { agentName: "clean-guard", errorCount: 2, warningCount: 1 },
        ],
      },
    };

    const data = calculateDashboardData(report, 500);

    expect(data.healthScore).toBe(100); // 1 - 2/500 = 0.996 → 100
    expect(data.totalFiles).toBe(2);
    expect(data.totalLines).toBe(500);
    expect(data.violations).toEqual({ errors: 2, warnings: 1 });
    expect(data.radarData["clean-guard"]).toBe(77); // 100 - (2*10 + 1*3)
    expect(data.heatmap["src/auth"]).toBeDefined();
    expect(data.heatmap["src/auth"].violationCount).toBe(2);
    expect(data.heatmap["src/auth"].errorCount).toBe(1);
    expect(data.heatmap["src/auth"].warningCount).toBe(1);
    expect(data.heatmap["src/utils"]).toBeDefined();
    expect(data.heatmap["src/utils"].violationCount).toBe(1);
    expect(data.lastUpdated).toBeDefined();
  });

  test("handles report with no violations", () => {
    const report: AuditReport = {
      timestamp: "2025-01-20T10:00:00.000Z",
      agentName: "guardian",
      analyzedPath: "/project",
      status: "passed",
      violations: [],
      summary: { errorCount: 0, warningCount: 0 },
    };

    const data = calculateDashboardData(report, 1000);

    expect(data.healthScore).toBe(100);
    expect(data.totalFiles).toBe(0);
    expect(data.violations).toEqual({ errors: 0, warnings: 0 });
    expect(data.radarData).toEqual({});
    expect(Object.keys(data.heatmap)).toHaveLength(0);
  });
});
