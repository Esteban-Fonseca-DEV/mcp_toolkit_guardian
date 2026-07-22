import { describe, it, expect, vi, afterEach } from "vitest";
import fc from "fast-check";
import { ExecutionRouter } from "../ExecutionRouter";
import { AgentRegistry } from "../AgentRegistry";
import { Ruleset, IAgent, AuditReport } from "@guardian/shared";

/**
 * Property 12: Manejo correcto de errores HTTP de la Lambda
 * Generate HTTP error codes 400-599. Verify CloudStrategy returns
 * AuditReport { status: "error" }.
 * **Validates: Requirements 5.3**
 */
describe("Property 12: Manejo correcto de errores HTTP de la Lambda", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const cloudRuleset: Ruleset = {
    version: "1.0.0",
    executionMode: "cloud",
    layers: [],
    testConventions: [{ pattern: "**/*.test.ts" }],
    excludePaths: ["node_modules"],
  };

  // A minimal mock agent for the registry
  const mockAgent: IAgent = {
    name: "mock-agent",
    version: "1.0.0",
    tools: [
      {
        name: "test_tool",
        description: "A test tool",
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

  it("any HTTP error code 400-599 returns AuditReport with status 'error'", () => {
    return fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        async (httpStatus, statusText) => {
          // Mock fetch to return an error response
          const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: httpStatus,
            statusText: statusText,
          });
          vi.stubGlobal("fetch", mockFetch);

          const registry = new AgentRegistry([mockAgent], cloudRuleset);
          const router = new ExecutionRouter(registry, cloudRuleset);

          const result = await router.dispatch(
            "test_tool",
            { filepath: "test.ts" },
            cloudRuleset
          );

          // Must return AuditReport with status: "error"
          expect(result.status).toBe("error");
          expect(result.error).toBeDefined();
          expect(result.error).toContain(String(httpStatus));
          expect(result.violations).toEqual([]);
          expect(result.timestamp).toBeDefined();
          expect(result.summary.errorCount).toBe(0);
          expect(result.summary.warningCount).toBe(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
