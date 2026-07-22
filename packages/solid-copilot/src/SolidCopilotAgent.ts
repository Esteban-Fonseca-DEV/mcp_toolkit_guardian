import { IAgent, ToolDefinition, Ruleset, AuditReport } from "@guardian/shared";
import { evaluateSingleResponsibility } from "./tools/evaluateSingleResponsibility";
import { suggestInterfaceSegregation } from "./tools/suggestInterfaceSegregation";

export class SolidCopilotAgent implements IAgent {
  readonly name = "solid-copilot";
  readonly version = "1.0.0";
  private ruleset!: Ruleset;

  initialize(ruleset: Ruleset): void {
    this.ruleset = ruleset;
  }

  readonly tools: ToolDefinition[] = [
    {
      name: "evaluate_single_responsibility",
      description:
        "Analiza clases en busca de violaciones del Principio de Responsabilidad Unica (SRP) basandose en lineas, metodos y dependencias.",
      schema: {
        type: "object",
        properties: { filepath: { type: "string" } },
        required: ["filepath"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        evaluateSingleResponsibility(args as { filepath: string }, ruleset),
    },
    {
      name: "suggest_interface_segregation",
      description:
        "Analiza interfaces para detectar violaciones del Principio de Segregacion de Interfaces (ISP), sugiriendo division cuando tienen demasiados metodos.",
      schema: {
        type: "object",
        properties: { filepath: { type: "string" } },
        required: ["filepath"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        suggestInterfaceSegregation(args as { filepath: string }, ruleset),
    },
  ];
}
