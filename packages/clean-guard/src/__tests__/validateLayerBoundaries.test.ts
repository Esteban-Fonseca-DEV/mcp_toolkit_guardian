import { describe, it, expect } from "vitest";
import { validateLayerBoundaries } from "../tools/validateLayerBoundaries";
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

describe("validateLayerBoundaries", () => {
  it("returns status 'passed' when dependency is allowed", async () => {
    const report = await validateLayerBoundaries(
      { source_layer: "application", target_layer: "domain" },
      testRuleset
    );
    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
    expect(report.analyzedPath).toBe("application -> domain");
  });

  it("returns a Violation with severity 'error' when dependency is NOT allowed", async () => {
    const report = await validateLayerBoundaries(
      { source_layer: "domain", target_layer: "infrastructure" },
      testRuleset
    );
    expect(report.status).toBe("failed");
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].severity).toBe("error");
    expect(report.violations[0].rule).toBe("LAYER_BOUNDARY_VIOLATION");
    expect(report.violations[0].description).toContain("domain");
    expect(report.violations[0].description).toContain("infrastructure");
  });

  it("returns a Violation when source_layer is not defined in the Ruleset", async () => {
    const report = await validateLayerBoundaries(
      { source_layer: "unknown_layer", target_layer: "domain" },
      testRuleset
    );
    expect(report.status).toBe("failed");
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].severity).toBe("error");
    expect(report.violations[0].rule).toBe("UNKNOWN_LAYER");
    expect(report.violations[0].description).toContain("unknown_layer");
  });

  it("returns status 'passed' for infrastructure -> domain (allowed)", async () => {
    const report = await validateLayerBoundaries(
      { source_layer: "infrastructure", target_layer: "domain" },
      testRuleset
    );
    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  it("returns Violation for presentation -> domain (not in allowedDependencies)", async () => {
    const report = await validateLayerBoundaries(
      { source_layer: "presentation", target_layer: "domain" },
      testRuleset
    );
    expect(report.status).toBe("failed");
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].severity).toBe("error");
  });

  it("includes agentName 'clean-guard' in the report", async () => {
    const report = await validateLayerBoundaries(
      { source_layer: "application", target_layer: "domain" },
      testRuleset
    );
    expect(report.agentName).toBe("clean-guard");
  });
});
