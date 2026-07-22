import { IAgent, ToolDefinition, Ruleset, AuditReport } from "@guardian/shared";
import { checkTestCoverageDelta } from "./tools/checkTestCoverageDelta";
import { enforceTestFirstSequence } from "./tools/enforceTestFirstSequence";
import { generateTddLifecycleReport } from "./tools/generateTddLifecycleReport";

/**
 * TDD-Strict Agent — Orchestrates the Red-Green-Refactor cycle verification.
 * Verifies that developer workflow follows TDD discipline by inspecting git diffs
 * and commit history.
 */
export class TddStrictAgent implements IAgent {
  readonly name = "tdd-strict";
  readonly version = "1.0.0";
  private ruleset!: Ruleset;

  /** In-memory session store for tracking test-first sequence */
  private sessionStore: Map<string, Set<string>> = new Map();

  initialize(ruleset: Ruleset): void {
    this.ruleset = ruleset;
  }

  readonly tools: ToolDefinition[] = [
    {
      name: "check_test_coverage_delta",
      description:
        "Verifica que cada archivo modificado en un commit tiene su contraparte de test.",
      schema: {
        type: "object",
        properties: { commit_hash: { type: "string" } },
        required: ["commit_hash"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        checkTestCoverageDelta(args as { commit_hash: string }, ruleset),
    },
    {
      name: "enforce_test_first_sequence",
      description:
        "Verifica que los cambios de implementación tienen un commit de test previo en la sesión.",
      schema: {
        type: "object",
        properties: { git_diff: { type: "string" } },
        required: ["git_diff"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        enforceTestFirstSequence(args as { git_diff: string }, ruleset),
    },
    {
      name: "generate_tdd_lifecycle_report",
      description:
        "Exporta un diagrama Mermaid del ciclo Red-Green-Refactor de la sesión.",
      schema: {
        type: "object",
        properties: { session_id: { type: "string" } },
        required: ["session_id"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        generateTddLifecycleReport(args as { session_id: string }, ruleset),
    },
  ];
}
