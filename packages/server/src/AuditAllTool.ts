import { AuditReport, Ruleset, Violation, AgentSummary, buildReport } from "@guardian/shared";
import { AgentRegistry } from "./AgentRegistry";

/**
 * Orchestrates all registered agents in parallel and produces
 * a consolidated AuditReport with per-agent summaries.
 */
export async function auditAll(
  args: { directory: string; commit_hash?: string },
  ruleset: Ruleset,
  registry: AgentRegistry
): Promise<AuditReport> {
  const { directory, commit_hash } = args;

  // Run architecture analysis always
  const promises: Promise<AuditReport>[] = [
    registry.getTool("generate_dependency_graph").handler({ directory }, ruleset),
  ];

  // Run test coverage delta only when commit_hash is provided
  if (commit_hash) {
    promises.push(
      registry.getTool("check_test_coverage_delta").handler({ commit_hash }, ruleset)
    );
  }

  // Run DDD bounded context analysis
  promises.push(
    registry.getTool("audit_ddd_bounded_context").handler({ directory }, ruleset)
  );

  const results = await Promise.allSettled(promises);

  const allViolations: Violation[] = [];
  const byAgent: AgentSummary[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      const report = result.value;
      allViolations.push(...report.violations);
      byAgent.push({
        agentName: report.agentName,
        errorCount: report.summary.errorCount,
        warningCount: report.summary.warningCount,
      });
    } else {
      // Agent failed internally — record as an error violation
      allViolations.push({
        filePath: "",
        line: 0,
        description: `Agent failed: ${result.reason}`,
        severity: "error",
        rule: "AGENT_EXECUTION_ERROR",
      });
    }
  }

  return buildReport({
    agentName: "guardian",
    analyzedPath: directory,
    violations: allViolations,
    summary: {
      errorCount: allViolations.filter(v => v.severity === "error").length,
      warningCount: allViolations.filter(v => v.severity === "warning").length,
      byAgent,
    },
  });
}
