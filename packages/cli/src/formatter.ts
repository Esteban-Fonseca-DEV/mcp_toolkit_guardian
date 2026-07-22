import { AuditReport } from "@guardian/shared";

export function formatReport(report: AuditReport, format: "json" | "text"): string {
  if (format === "json") {
    return JSON.stringify(report, null, 2);
  }

  const lines: string[] = [];
  lines.push("");
  lines.push("  Guardian Audit Report");
  lines.push(`  Path: ${report.analyzedPath}`);
  lines.push(`  Status: ${report.status.toUpperCase()}`);
  lines.push(`  Errors: ${report.summary.errorCount} | Warnings: ${report.summary.warningCount}`);
  lines.push("");

  if (report.violations.length > 0) {
    lines.push("  Violations:");
    for (const v of report.violations) {
      const icon = v.severity === "error" ? "[ERROR]" : "[WARN]";
      lines.push(`    ${icon} ${v.filePath}:${v.line}`);
      lines.push(`          ${v.description}`);
    }
  } else {
    lines.push("  No violations found.");
  }

  lines.push("");

  if (report.summary.byAgent && report.summary.byAgent.length > 0) {
    lines.push("  Summary by agent:");
    for (const agent of report.summary.byAgent) {
      lines.push(`    ${agent.agentName}: ${agent.errorCount} errors, ${agent.warningCount} warnings`);
    }
  }

  return lines.join("\n");
}
