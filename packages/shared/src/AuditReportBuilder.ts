import { AuditReport, Violation } from "./types";
import { computeStatus } from "./utils";

export function buildReport(partial: Partial<AuditReport> & { agentName: string; analyzedPath: string }): AuditReport {
  const violations: Violation[] = partial.violations ?? [];
  const errorCount = violations.filter(v => v.severity === "error").length;
  const warningCount = violations.filter(v => v.severity === "warning").length;
  const status = partial.status === "error" ? "error" : computeStatus(violations);

  return {
    timestamp: partial.timestamp ?? new Date().toISOString(),
    agentName: partial.agentName,
    analyzedPath: partial.analyzedPath,
    status,
    violations,
    summary: {
      errorCount,
      warningCount,
      ...partial.summary,
    },
    ...(partial.error && { error: partial.error }),
  };
}
