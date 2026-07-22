import { IAgent, ToolDefinition, Ruleset } from "@guardian/shared";

/**
 * Registry that manages all agents and their tools.
 * Initializes agents with the active Ruleset and provides
 * a unified interface to access all available tools.
 */
export class AgentRegistry {
  private toolMap: Map<string, ToolDefinition> = new Map();

  constructor(private agents: IAgent[], private ruleset: Ruleset) {
    for (const agent of agents) {
      agent.initialize(ruleset);
      for (const tool of agent.tools) {
        this.toolMap.set(tool.name, tool);
      }
    }
  }

  /**
   * Returns all tool definitions from all registered agents.
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.toolMap.values());
  }

  /**
   * Returns a specific tool by name. Throws if not found.
   */
  getTool(name: string): ToolDefinition {
    const tool = this.toolMap.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found in registry`);
    }
    return tool;
  }
}
