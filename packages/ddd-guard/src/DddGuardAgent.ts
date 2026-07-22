import { IAgent, ToolDefinition, Ruleset, AuditReport } from "@guardian/shared";
import { auditDddEncapsulation } from "./tools/auditDddEncapsulation";
import { auditDddAggregateAccess } from "./tools/auditDddAggregateAccess";
import { auditDddBoundedContext } from "./tools/auditDddBoundedContext";

export class DddGuardAgent implements IAgent {
  readonly name = "ddd-guard";
  readonly version = "1.0.0";
  private ruleset!: Ruleset;

  initialize(ruleset: Ruleset): void {
    this.ruleset = ruleset;
  }

  readonly tools: ToolDefinition[] = [
    {
      name: "audit_ddd_encapsulation",
      description:
        "Detecta entidades con estado mutable publico (propiedades no-readonly).",
      schema: {
        type: "object",
        properties: { filepath: { type: "string" } },
        required: ["filepath"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        auditDddEncapsulation(args as { filepath: string }, ruleset),
    },
    {
      name: "audit_ddd_aggregate_access",
      description:
        "Detecta imports directos a entidades internas sin pasar por el Aggregate Root.",
      schema: {
        type: "object",
        properties: { directory: { type: "string" } },
        required: ["directory"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        auditDddAggregateAccess(args as { directory: string }, ruleset),
    },
    {
      name: "audit_ddd_bounded_context",
      description:
        "Verifica fronteras de bounded context en imports entre modulos.",
      schema: {
        type: "object",
        properties: { directory: { type: "string" } },
        required: ["directory"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        auditDddBoundedContext(args as { directory: string }, ruleset),
    },
  ];
}
