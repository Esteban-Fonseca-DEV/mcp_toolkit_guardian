// packages/dashboard/src/calculations.ts
import { AuditReport } from "@guardian/shared";

export interface DashboardData {
  healthScore: number;
  totalFiles: number;
  totalLines: number;
  violations: { errors: number; warnings: number };
  byAgent: Record<string, { errors: number; warnings: number }>;
  radarData: Record<string, number>;
  heatmap: Record<string, { violationCount: number; errorCount: number; warningCount: number; files: string[] }>;
  lastUpdated: string;
}

/**
 * Calculates the health score for a project.
 * Formula: round((1 - errorCount / totalLines) * 100), clamped to [0, 100].
 * Returns 100 if totalLines is 0.
 */
export function calculateHealthScore(errorCount: number, totalLines: number): number {
  if (totalLines <= 0) return 100;
  const raw = (1 - errorCount / totalLines) * 100;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/**
 * Calculates radar chart data from an AuditReport.
 * Returns a record of agent name → compliance percentage (0-100).
 * Compliance is calculated as: 100 - (errors * 10 + warnings * 3), clamped to [0, 100].
 */
export function calculateRadarData(report: AuditReport): Record<string, number> {
  const radar: Record<string, number> = {};
  const agentSummaries = report.summary.byAgent ?? [];

  for (const agent of agentSummaries) {
    const penalty = agent.errorCount * 10 + agent.warningCount * 3;
    radar[agent.agentName] = Math.max(0, Math.min(100, 100 - penalty));
  }

  return radar;
}

/**
 * Calculates the full dashboard data from an AuditReport and total lines of code.
 */
export function calculateDashboardData(report: AuditReport, totalLines: number): DashboardData {
  const byAgent: Record<string, { errors: number; warnings: number }> = {};
  const heatmap: Record<string, { violationCount: number; errorCount: number; warningCount: number; files: string[] }> = {};

  for (const v of report.violations) {
    // By agent — use the report's agentName as default
    const agent = report.agentName;
    if (!byAgent[agent]) byAgent[agent] = { errors: 0, warnings: 0 };
    if (v.severity === "error") byAgent[agent].errors++;
    else byAgent[agent].warnings++;

    // Heatmap by directory
    const dir = v.filePath.replace(/\\/g, "/").split("/").slice(0, -1).join("/") || ".";
    if (!heatmap[dir]) {
      heatmap[dir] = { violationCount: 0, errorCount: 0, warningCount: 0, files: [] };
    }
    heatmap[dir].violationCount++;
    if (v.severity === "error") heatmap[dir].errorCount++;
    else heatmap[dir].warningCount++;

    if (!heatmap[dir].files.includes(v.filePath)) {
      heatmap[dir].files.push(v.filePath);
    }
  }

  // Override byAgent with report summary if available (for audit_all consolidated reports)
  if (report.summary.byAgent) {
    for (const a of report.summary.byAgent) {
      byAgent[a.agentName] = { errors: a.errorCount, warnings: a.warningCount };
    }
  }

  const healthScore = calculateHealthScore(report.summary.errorCount, totalLines);
  const radarData = calculateRadarData(report);

  return {
    healthScore,
    totalFiles: new Set(report.violations.map(v => v.filePath)).size,
    totalLines,
    violations: {
      errors: report.summary.errorCount,
      warnings: report.summary.warningCount,
    },
    byAgent,
    radarData,
    heatmap,
    lastUpdated: new Date().toISOString(),
  };
}
