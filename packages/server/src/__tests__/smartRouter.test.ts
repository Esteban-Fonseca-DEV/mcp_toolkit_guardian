import { describe, it, expect } from "vitest";
import { determineRelevantAgents } from "../SmartRouter";
import { Ruleset } from "@guardian/shared";

const testRuleset: Ruleset = {
  version: "1.0.0",
  executionMode: "local",
  layers: [
    { name: "domain", paths: ["src/domain/**"], allowedDependencies: [] },
    { name: "application", paths: ["src/application/**"], allowedDependencies: ["domain"] },
    { name: "infrastructure", paths: ["src/infrastructure/**"], allowedDependencies: ["domain", "application"] },
    { name: "presentation", paths: ["src/presentation/**"], allowedDependencies: ["application"] },
  ],
  testConventions: [{ pattern: "**/*.test.ts" }],
  excludePaths: ["node_modules", "dist"],
};

describe("SmartRouter - determineRelevantAgents", () => {
  it("file in domain layer includes clean-guard, ddd-guard, solid-copilot, security-guard, concurrency-guard", () => {
    const result = determineRelevantAgents("src/domain/User.ts", testRuleset);

    expect(result.agents).toContain("clean-guard");
    expect(result.agents).toContain("ddd-guard");
    expect(result.agents).toContain("solid-copilot");
    expect(result.agents).toContain("security-guard");
    expect(result.agents).toContain("concurrency-guard");
    expect(result.reason).toBe("File in 'domain' layer");
  });

  it("file in infrastructure layer includes clean-guard, security-guard, concurrency-guard but not ddd/solid", () => {
    const result = determineRelevantAgents("src/infrastructure/DB.ts", testRuleset);

    expect(result.agents).toContain("clean-guard");
    expect(result.agents).toContain("security-guard");
    expect(result.agents).toContain("concurrency-guard");
    expect(result.agents).not.toContain("ddd-guard");
    expect(result.agents).not.toContain("solid-copilot");
    expect(result.reason).toBe("File in 'infrastructure' layer");
  });

  it("file in application layer includes all relevant agents", () => {
    const result = determineRelevantAgents("src/application/Service.ts", testRuleset);

    expect(result.agents).toContain("clean-guard");
    expect(result.agents).toContain("ddd-guard");
    expect(result.agents).toContain("tdd-strict");
    expect(result.agents).toContain("solid-copilot");
    expect(result.agents).toContain("security-guard");
    expect(result.agents).toContain("concurrency-guard");
    expect(result.reason).toBe("File in 'application' layer");
  });

  it("file in presentation layer includes clean-guard, security-guard, concurrency-guard", () => {
    const result = determineRelevantAgents("src/presentation/Controller.ts", testRuleset);

    expect(result.agents).toContain("clean-guard");
    expect(result.agents).toContain("security-guard");
    expect(result.agents).toContain("concurrency-guard");
    expect(result.agents).not.toContain("ddd-guard");
    expect(result.agents).not.toContain("solid-copilot");
    expect(result.reason).toBe("File in 'presentation' layer");
  });

  it("file in unknown location returns all agents", () => {
    const result = determineRelevantAgents("lib/utils/helper.ts", testRuleset);

    expect(result.agents).toContain("clean-guard");
    expect(result.agents).toContain("ddd-guard");
    expect(result.agents).toContain("tdd-strict");
    expect(result.agents).toContain("solid-copilot");
    expect(result.agents).toContain("security-guard");
    expect(result.agents).toContain("concurrency-guard");
    expect(result.reason).toBe("File in unknown layer (all agents)");
  });

  it("normalizes Windows backslashes", () => {
    const result = determineRelevantAgents("src\\domain\\User.ts", testRuleset);

    expect(result.agents).toContain("ddd-guard");
    expect(result.reason).toBe("File in 'domain' layer");
  });
});
