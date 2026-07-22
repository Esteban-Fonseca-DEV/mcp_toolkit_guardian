import { AuditReport, Violation } from "@guardian/shared";

export function resolveExitCode(
  report: AuditReport,
  failOn: "error" | "warning" = "error"
): number {
  if (report.status === "error") return 2;

  const hasErrors = report.violations.some((v: Violation) => v.severity === "error");
  const hasWarnings = report.violations.some((v: Violation) => v.severity === "warning");

  if (failOn === "warning") {
    return (hasErrors || hasWarnings) ? 1 : 0;
  }
  return hasErrors ? 1 : 0;
}
