import { Violation, ExecutionStatus } from "./types";

export function computeStatus(violations: Violation[]): ExecutionStatus {
  const hasError = violations.some(v => v.severity === "error");
  return hasError ? "failed" : "passed";
}
