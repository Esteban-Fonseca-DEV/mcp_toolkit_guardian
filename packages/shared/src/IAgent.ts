import { AuditReport, Ruleset } from "./types";

export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, unknown>;  // JSON Schema del input
  handler: (args: unknown, ruleset: Ruleset) => Promise<AuditReport>;
}

export interface IAgent {
  readonly name: string;
  readonly version: string;
  readonly tools: ToolDefinition[];
  initialize(ruleset: Ruleset): void;
}
