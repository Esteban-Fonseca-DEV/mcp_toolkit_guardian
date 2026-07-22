import { AuditReport, Ruleset } from "@guardian/shared";
import { AgentRegistry } from "./AgentRegistry";

/**
 * Strategy interface for executing tool analysis.
 */
interface ExecutionStrategy {
  execute(toolName: string, args: unknown, ruleset: Ruleset): Promise<AuditReport>;
}

/**
 * Executes tools locally by delegating to the AgentRegistry.
 */
class LocalStrategy implements ExecutionStrategy {
  constructor(private registry: AgentRegistry) {}

  async execute(toolName: string, args: unknown, ruleset: Ruleset): Promise<AuditReport> {
    const tool = this.registry.getTool(toolName);
    return tool.handler(args, ruleset);
  }
}

/**
 * Executes tools remotely via AWS API Gateway.
 */
class CloudStrategy implements ExecutionStrategy {
  constructor(private apiGatewayUrl: string) {}

  async execute(toolName: string, args: unknown, ruleset: Ruleset): Promise<AuditReport> {
    const response = await fetch(`${this.apiGatewayUrl}/${toolName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args, ruleset }),
    });

    if (!response.ok) {
      return {
        timestamp: new Date().toISOString(),
        agentName: toolName,
        analyzedPath: "",
        status: "error",
        violations: [],
        summary: { errorCount: 0, warningCount: 0 },
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return response.json() as Promise<AuditReport>;
  }
}

/**
 * Strategy Pattern router that selects local or cloud execution
 * based on the Ruleset's executionMode.
 */
export class ExecutionRouter {
  private strategy: ExecutionStrategy;

  constructor(registry: AgentRegistry, ruleset: Ruleset) {
    this.strategy =
      ruleset.executionMode === "cloud"
        ? new CloudStrategy(process.env.GUARDIAN_API_URL ?? "")
        : new LocalStrategy(registry);
  }

  async dispatch(toolName: string, args: unknown, ruleset: Ruleset): Promise<AuditReport> {
    return this.strategy.execute(toolName, args, ruleset);
  }
}
