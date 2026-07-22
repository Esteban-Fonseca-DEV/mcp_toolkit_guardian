import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CleanGuardAgent } from "@guardian/clean-guard";
import { TddStrictAgent } from "@guardian/tdd-strict";
import { DddGuardAgent } from "@guardian/ddd-guard";
import { SecurityGuardAgent } from "@guardian/security-guard";
import { SolidCopilotAgent } from "@guardian/solid-copilot";
import { ConcurrencyGuardAgent } from "@guardian/concurrency-guard";
import { Ruleset } from "@guardian/shared";
import { AgentRegistry } from "./AgentRegistry";
import { RulesetLoader } from "./RulesetLoader";
import { ExecutionRouter } from "./ExecutionRouter";
import { auditAll } from "./AuditAllTool";
import { z } from "zod";

/**
 * Starts the Guardian MCP Server.
 *
 * 1. Loads the Ruleset from the config file.
 * 2. Creates the AgentRegistry with all available agents.
 * 3. Creates the ExecutionRouter (Strategy Pattern for local/cloud).
 * 4. Registers each tool with the McpServer.
 * 5. Connects via StdioServerTransport.
 */
export async function startServer(configPath: string): Promise<void> {
  const ruleset: Ruleset = await RulesetLoader.load(configPath);

  const registry = new AgentRegistry(
    [
      new CleanGuardAgent(),
      new TddStrictAgent(),
      new DddGuardAgent(),
      new SecurityGuardAgent(),
      new SolidCopilotAgent(),
      new ConcurrencyGuardAgent(),
    ],
    ruleset
  );

  const router = new ExecutionRouter(registry, ruleset);

  const server = new McpServer({
    name: "guardian-mcp-toolkit",
    version: "1.0.0",
  });

  // Register each tool from the AgentRegistry with the MCP server
  for (const tool of registry.getTools()) {
    // Convert JSON schema properties to a Zod shape for the MCP SDK
    const schemaProperties = (tool.schema as { properties?: Record<string, { type: string }> }).properties ?? {};
    const zodShape: Record<string, ReturnType<typeof z.string>> = {};
    for (const [key, prop] of Object.entries(schemaProperties)) {
      if (prop.type === "string") {
        zodShape[key] = z.string();
      }
    }

    server.tool(
      tool.name,
      tool.description,
      zodShape,
      async (args) => {
        try {
          const report = await router.dispatch(tool.name, args, ruleset);
          return {
            content: [{ type: "text", text: JSON.stringify(report) }],
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  code: -32603,
                  message: err instanceof Error ? err.message : String(err),
                }),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register the audit_all orchestration tool
  server.tool(
    "audit_all",
    "Run all Guardian agents in parallel and return a consolidated audit report",
    {
      directory: z.string(),
      commit_hash: z.string().optional(),
    },
    async (args) => {
      try {
        const report = await auditAll(
          { directory: args.directory, commit_hash: args.commit_hash },
          ruleset,
          registry
        );
        return {
          content: [{ type: "text", text: JSON.stringify(report) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                code: -32603,
                message: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
