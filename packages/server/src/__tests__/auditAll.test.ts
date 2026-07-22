import { describe, it, expect, vi } from "vitest";
import { auditAll } from "../AuditAllTool";
import { AgentRegistry } from "../AgentRegistry";
import { AuditReport, Ruleset, IAgent, ToolDefinition } from "@guardian/shared";

function createMockRuleset(): Ruleset {
  return {
    version: "1.0.0",
    executionMode: "local",
    layers: [],
    testConventions: [{ pattern: "**/*.test.ts" }],
    excludePaths: ["node_modules"],
  };
}

function createMockReport(agentName: string, violations: AuditReport["violations"]): AuditReport {
  return {
    timestamp: new Date().toISOString(),
    agentName,
    analyzedPath: "/test",
    status: violations.some(v => v.severity === "error") ? "failed" : "passed",
    violations,
    summary: {
      errorCount: violations.filter(v => v.severity === "error").length,
      warningCount: violations.filter(v => v.severity === "warning").length,
    },
  };
}

function createMockRegistry(tools: Record<string, (args: unknown, ruleset: Ruleset) => Promise<AuditReport>>): AgentRegistry {
  const toolDefs: ToolDefinition[] = Object.entries(tools).map(([name, handler]) => ({
    name,
    description: `Mock ${name}`,
    schema: {},
    handler,
  }));

  const mockAgent: IAgent = {
    name: "mock-agent",
    version: "1.0.0",
    tools: toolDefs,
    initialize: vi.fn(),
  };

  return new AgentRegistry([mockAgent], createMockRuleset());
}

describe("auditAll", () => {
  it("consolidates violations from multiple agents", async () => {
    const registry = createMockRegistry({
      generate_dependency_graph: async () =>
        createMockReport("clean-guard", [
          { filePath: "src/domain/Foo.ts", line: 1, description: "Bad import", severity: "error", rule: "LAYER_VIOLATION" },
        ]),
      check_test_coverage_delta: async () =>
        createMockReport("tdd-strict", [
          { filePath: "src/app/Bar.ts", line: 0, description: "Missing test", severity: "warning", rule: "MISSING_TEST" },
        ]),
      audit_ddd_bounded_context: async () =>
        createMockReport("ddd-guard", []),
    });

    const result = await auditAll(
      { directory: "/project", commit_hash: "abc123" },
      createMockRuleset(),
      registry
    );

    expect(result.violations).toHaveLength(2);
    expect(result.violations[0].rule).toBe("LAYER_VIOLATION");
    expect(result.violations[1].rule).toBe("MISSING_TEST");
    expect(result.agentName).toBe("guardian");
    expect(result.analyzedPath).toBe("/project");
  });

  it("reports status as failed when any agent reports errors", async () => {
    const registry = createMockRegistry({
      generate_dependency_graph: async () =>
        createMockReport("clean-guard", [
          { filePath: "src/domain/Foo.ts", line: 1, description: "Bad import", severity: "error", rule: "LAYER_VIOLATION" },
        ]),
      check_test_coverage_delta: async () =>
        createMockReport("tdd-strict", []),
      audit_ddd_bounded_context: async () =>
        createMockReport("ddd-guard", []),
    });

    const result = await auditAll(
      { directory: "/project", commit_hash: "abc123" },
      createMockRuleset(),
      registry
    );

    expect(result.status).toBe("failed");
    expect(result.summary.errorCount).toBe(1);
  });

  it("reports status as passed when no errors exist", async () => {
    const registry = createMockRegistry({
      generate_dependency_graph: async () =>
        createMockReport("clean-guard", [
          { filePath: "src/foo.ts", line: 5, description: "Minor issue", severity: "warning", rule: "STYLE" },
        ]),
      check_test_coverage_delta: async () =>
        createMockReport("tdd-strict", []),
      audit_ddd_bounded_context: async () =>
        createMockReport("ddd-guard", []),
    });

    const result = await auditAll(
      { directory: "/project", commit_hash: "abc123" },
      createMockRuleset(),
      registry
    );

    expect(result.status).toBe("passed");
    expect(result.summary.warningCount).toBe(1);
  });

  it("includes summary.byAgent with per-agent breakdown", async () => {
    const registry = createMockRegistry({
      generate_dependency_graph: async () =>
        createMockReport("clean-guard", [
          { filePath: "a.ts", line: 1, description: "err", severity: "error", rule: "X" },
          { filePath: "b.ts", line: 2, description: "warn", severity: "warning", rule: "Y" },
        ]),
      check_test_coverage_delta: async () =>
        createMockReport("tdd-strict", [
          { filePath: "c.ts", line: 0, description: "no test", severity: "warning", rule: "Z" },
        ]),
      audit_ddd_bounded_context: async () =>
        createMockReport("ddd-guard", []),
    });

    const result = await auditAll(
      { directory: "/project", commit_hash: "def456" },
      createMockRuleset(),
      registry
    );

    expect(result.summary.byAgent).toBeDefined();
    expect(result.summary.byAgent).toHaveLength(3);
    expect(result.summary.byAgent![0]).toEqual({
      agentName: "clean-guard",
      errorCount: 1,
      warningCount: 1,
    });
    expect(result.summary.byAgent![1]).toEqual({
      agentName: "tdd-strict",
      errorCount: 0,
      warningCount: 1,
    });
    expect(result.summary.byAgent![2]).toEqual({
      agentName: "ddd-guard",
      errorCount: 0,
      warningCount: 0,
    });
  });

  it("handles agent failures gracefully", async () => {
    const registry = createMockRegistry({
      generate_dependency_graph: async () => {
        throw new Error("Agent crashed");
      },
      check_test_coverage_delta: async () =>
        createMockReport("tdd-strict", []),
      audit_ddd_bounded_context: async () =>
        createMockReport("ddd-guard", []),
    });

    const result = await auditAll(
      { directory: "/project", commit_hash: "xyz" },
      createMockRuleset(),
      registry
    );

    expect(result.status).toBe("failed");
    expect(result.violations.some(v => v.rule === "AGENT_EXECUTION_ERROR")).toBe(true);
    expect(result.violations.find(v => v.rule === "AGENT_EXECUTION_ERROR")!.severity).toBe("error");
  });

  it("skips test coverage check when commit_hash is not provided", async () => {
    const depGraphHandler = vi.fn().mockResolvedValue(
      createMockReport("clean-guard", [])
    );
    const coverageHandler = vi.fn().mockResolvedValue(
      createMockReport("tdd-strict", [])
    );
    const dddHandler = vi.fn().mockResolvedValue(
      createMockReport("ddd-guard", [])
    );

    const registry = createMockRegistry({
      generate_dependency_graph: depGraphHandler,
      check_test_coverage_delta: coverageHandler,
      audit_ddd_bounded_context: dddHandler,
    });

    const result = await auditAll(
      { directory: "/project" },
      createMockRuleset(),
      registry
    );

    expect(depGraphHandler).toHaveBeenCalled();
    expect(coverageHandler).not.toHaveBeenCalled();
    expect(dddHandler).toHaveBeenCalled();
    expect(result.status).toBe("passed");
  });
});
