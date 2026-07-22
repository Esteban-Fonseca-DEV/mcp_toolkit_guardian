import { IAgent, ToolDefinition, Ruleset, AuditReport } from "@guardian/shared";
import { auditConcurrency } from "./tools/auditConcurrency";

export class ConcurrencyGuardAgent implements IAgent {
  readonly name = "concurrency-guard";
  readonly version = "1.0.0";
  private ruleset!: Ruleset;

  initialize(ruleset: Ruleset): void {
    this.ruleset = ruleset;
  }

  readonly tools: ToolDefinition[] = [
    {
      name: "audit_concurrency",
      description:
        "Detects common concurrency anti-patterns: unhandled promises, event listeners without cleanup, mutable exports, and timers without cleanup.",
      schema: {
        type: "object",
        properties: { filepath: { type: "string" } },
        required: ["filepath"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        auditConcurrency(args as { filepath: string }, ruleset),
    },
  ];
}
