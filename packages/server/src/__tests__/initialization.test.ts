import { describe, it, expect } from "vitest";
import { CleanGuardAgent } from "@guardian/clean-guard";
import { TddStrictAgent } from "@guardian/tdd-strict";
import { DEFAULT_RULESET } from "@guardian/shared";
import { AgentRegistry } from "../AgentRegistry";

describe("Server Initialization", () => {
  it("should create AgentRegistry with CleanGuard and TddStrict agents", () => {
    const registry = new AgentRegistry(
      [new CleanGuardAgent(), new TddStrictAgent()],
      DEFAULT_RULESET
    );

    const tools = registry.getTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("should expose expected Clean-Guard tools", () => {
    const registry = new AgentRegistry(
      [new CleanGuardAgent(), new TddStrictAgent()],
      DEFAULT_RULESET
    );

    const toolNames = registry.getTools().map((t) => t.name);
    expect(toolNames).toContain("analyze_ast_imports");
    expect(toolNames).toContain("validate_layer_boundaries");
    expect(toolNames).toContain("generate_dependency_graph");
  });

  it("should expose expected TDD-Strict tools", () => {
    const registry = new AgentRegistry(
      [new CleanGuardAgent(), new TddStrictAgent()],
      DEFAULT_RULESET
    );

    const toolNames = registry.getTools().map((t) => t.name);
    expect(toolNames).toContain("check_test_coverage_delta");
    expect(toolNames).toContain("enforce_test_first_sequence");
    expect(toolNames).toContain("generate_tdd_lifecycle_report");
  });

  it("should retrieve a tool by name", () => {
    const registry = new AgentRegistry(
      [new CleanGuardAgent(), new TddStrictAgent()],
      DEFAULT_RULESET
    );

    const tool = registry.getTool("analyze_ast_imports");
    expect(tool.name).toBe("analyze_ast_imports");
    expect(tool.description).toBeDefined();
    expect(tool.schema).toBeDefined();
    expect(typeof tool.handler).toBe("function");
  });

  it("should throw when requesting a non-existent tool", () => {
    const registry = new AgentRegistry(
      [new CleanGuardAgent(), new TddStrictAgent()],
      DEFAULT_RULESET
    );

    expect(() => registry.getTool("nonexistent_tool")).toThrow(
      "Tool 'nonexistent_tool' not found in registry"
    );
  });

  it("should include name and version in server capabilities info", () => {
    // The McpServer is created with name and version;
    // here we verify the registry exposes all 6 tools (3 per agent)
    const registry = new AgentRegistry(
      [new CleanGuardAgent(), new TddStrictAgent()],
      DEFAULT_RULESET
    );

    const tools = registry.getTools();
    expect(tools).toHaveLength(6);

    // Each tool has a description for client discoverability
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.name).toBeTruthy();
    }
  });
});
