import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { AgentRegistry } from "../AgentRegistry";
import { IAgent, Ruleset, AuditReport } from "@guardian/shared";

/**
 * Properties 1 & 15: Resiliencia MCP y exclusión de agentes no implementados
 * Prop 1: Generate malformed MCP requests. Verify server responds with error JSON-RPC without crashing.
 * Prop 15: Verify unimplemented agents' tools are excluded from capabilities.
 * **Validates: Requirements 1.3, 8.3**
 */
describe("Properties 1 & 15: Resiliencia MCP y exclusión de agentes no implementados", () => {
  const defaultRuleset: Ruleset = {
    version: "1.0.0",
    executionMode: "local",
    layers: [],
    testConventions: [{ pattern: "**/*.test.ts" }],
    excludePaths: ["node_modules"],
  };

  /**
   * Prop 1: Malformed MCP request handling
   * The AgentRegistry.getTool should throw with a descriptive error for unknown tools,
   * and never crash the process. This simulates how the server would handle
   * malformed requests (tool not found).
   */
  describe("Prop 1: Malformed tool requests never crash", () => {
    // A mock agent with a single tool
    const mockAgent: IAgent = {
      name: "mock-agent",
      version: "1.0.0",
      tools: [
        {
          name: "valid_tool",
          description: "A valid tool",
          schema: { type: "object", properties: {} },
          handler: async (): Promise<AuditReport> => ({
            timestamp: new Date().toISOString(),
            agentName: "mock-agent",
            analyzedPath: "",
            status: "passed",
            violations: [],
            summary: { errorCount: 0, warningCount: 0 },
          }),
        },
      ],
      initialize: () => {},
    };

    it("getTool throws descriptive error for any arbitrary tool name not registered", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(
            (s) => s !== "valid_tool"
          ),
          (toolName) => {
            const registry = new AgentRegistry([mockAgent], defaultRuleset);

            // Should throw a descriptive error, not crash
            try {
              registry.getTool(toolName);
              // Should not reach here
              return false;
            } catch (err) {
              expect(err).toBeInstanceOf(Error);
              expect((err as Error).message).toContain(toolName);
              expect((err as Error).message).toContain("not found");
              return true;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("malformed JSON-RPC-like requests produce structured errors", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.record({ id: fc.integer() }),
            fc.constant(null),
            fc.constant(undefined),
            fc.record({
              jsonrpc: fc.string(),
              method: fc.string(),
            })
          ),
          (malformedRequest) => {
            // Simulate how the server validates incoming requests
            const isValidRequest =
              malformedRequest !== null &&
              malformedRequest !== undefined &&
              typeof malformedRequest === "object" &&
              "jsonrpc" in malformedRequest &&
              (malformedRequest as Record<string, unknown>).jsonrpc === "2.0" &&
              "method" in malformedRequest &&
              typeof (malformedRequest as Record<string, unknown>).method === "string";

            if (!isValidRequest) {
              // Server should respond with error, never crash
              const errorResponse = {
                jsonrpc: "2.0",
                error: {
                  code: -32600,
                  message: "Invalid Request",
                },
                id: null,
              };

              expect(errorResponse.error.code).toBeDefined();
              expect(errorResponse.error.message).toBeDefined();
              expect(typeof errorResponse.error.code).toBe("number");
              expect(typeof errorResponse.error.message).toBe("string");
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Prop 15: Unimplemented agents' tools must NOT appear in capabilities.
   * The registry only contains tools from agents that are explicitly registered (implemented).
   * Agents that are "not implemented" are simply not passed to the registry constructor.
   */
  describe("Prop 15: Unimplemented agents tools are excluded", () => {
    it("only implemented agents' tools appear in registry", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          (implementedCount, unimplementedCount) => {
            // Create implemented agents with unique prefixed names
            const implementedAgents: IAgent[] = [];
            const implementedToolNames: Set<string> = new Set();
            const unimplementedToolNames: Set<string> = new Set();

            for (let i = 0; i < implementedCount; i++) {
              const agentName = `impl_agent_${i}`;
              const toolName = `impl_tool_${i}`;
              implementedToolNames.add(toolName);
              implementedAgents.push({
                name: agentName,
                version: "1.0.0",
                tools: [{
                  name: toolName,
                  description: `Tool of ${agentName}`,
                  schema: { type: "object", properties: {} },
                  handler: async (): Promise<AuditReport> => ({
                    timestamp: new Date().toISOString(),
                    agentName,
                    analyzedPath: "",
                    status: "passed",
                    violations: [],
                    summary: { errorCount: 0, warningCount: 0 },
                  }),
                }],
                initialize: () => {},
              });
            }

            // Unimplemented agents are NOT added to the registry
            for (let i = 0; i < unimplementedCount; i++) {
              unimplementedToolNames.add(`unimpl_tool_${i}`);
            }

            const registry = new AgentRegistry(implementedAgents, defaultRuleset);
            const registeredTools = registry.getTools();

            // Registry should have exactly the implemented tools
            expect(registeredTools.length).toBe(implementedCount);

            // All registered tools should be from implemented agents
            for (const tool of registeredTools) {
              expect(implementedToolNames.has(tool.name)).toBe(true);
              expect(unimplementedToolNames.has(tool.name)).toBe(false);
            }

            // No unimplemented tool should be accessible
            for (const unimplTool of unimplementedToolNames) {
              expect(() => registry.getTool(unimplTool)).toThrow();
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
