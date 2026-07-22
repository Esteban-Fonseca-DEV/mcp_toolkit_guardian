import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyFixes, FixResult } from "../fixEngine";
import { AuditReport, Violation } from "@guardian/shared";
import * as fs from "fs";
import * as path from "path";

function makeReport(violations: Violation[]): AuditReport {
  return {
    timestamp: "2024-01-01T00:00:00.000Z",
    agentName: "guardian",
    analyzedPath: "/project",
    status: "failed",
    violations,
    summary: {
      errorCount: violations.filter(v => v.severity === "error").length,
      warningCount: violations.filter(v => v.severity === "warning").length,
    },
  };
}

const TEST_DIR = path.join(__dirname, "__fix_fixtures__");

describe("fixEngine", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("returns empty array when no violations", async () => {
    const report = makeReport([]);
    const results = await applyFixes(report, TEST_DIR, false);
    expect(results).toHaveLength(0);
  });

  it("returns empty array when violations have no applicable fix", async () => {
    const report = makeReport([
      { filePath: "src/foo.ts", line: 1, description: "Unknown rule", severity: "warning", rule: "UNKNOWN_RULE" },
    ]);
    const results = await applyFixes(report, TEST_DIR, false);
    expect(results).toHaveLength(0);
  });

  it("generates fix for LAYER_BOUNDARY_VIOLATION", async () => {
    const report = makeReport([
      { filePath: "src/domain/UserService.ts", line: 3, description: "Forbidden import", severity: "error", rule: "LAYER_BOUNDARY_VIOLATION" },
    ]);
    const results = await applyFixes(report, TEST_DIR, false);
    expect(results).toHaveLength(1);
    expect(results[0].fixed).toBe(true);
    expect(results[0].action).toContain("interface");
    expect(results[0].diff).toBeDefined();
  });

  it("generates fix for MISSING_TEST_FILE", async () => {
    const report = makeReport([
      { filePath: "src/domain/Order.ts", line: 1, description: "Missing test", severity: "warning", rule: "MISSING_TEST_FILE" },
    ]);
    const results = await applyFixes(report, TEST_DIR, false);
    expect(results).toHaveLength(1);
    expect(results[0].fixed).toBe(true);
    expect(results[0].action).toContain("test skeleton");
    expect(results[0].diff).toContain("describe");
  });

  it("generates fix for ISP_FAT_INTERFACE", async () => {
    const report = makeReport([
      { filePath: "src/domain/IRepo.ts", line: 5, description: "Interfaz 'IUserRepo' too many methods", severity: "warning", rule: "ISP_FAT_INTERFACE" },
    ]);
    const results = await applyFixes(report, TEST_DIR, false);
    expect(results).toHaveLength(1);
    expect(results[0].fixed).toBe(true);
    expect(results[0].action).toContain("Split fat interface");
  });

  it("generates fix for ENV_ACCESS_OUTSIDE_INFRA", async () => {
    const report = makeReport([
      { filePath: "src/domain/Config.ts", line: 2, description: "process.env access", severity: "error", rule: "ENV_ACCESS_OUTSIDE_INFRA" },
    ]);
    const results = await applyFixes(report, TEST_DIR, false);
    expect(results).toHaveLength(1);
    expect(results[0].action).toContain("config service");
  });

  it("generates fix for DDD_MUTABLE_PUBLIC_STATE", async () => {
    const report = makeReport([
      { filePath: "src/domain/User.ts", line: 3, description: "'name'. Use readonly", severity: "error", rule: "DDD_MUTABLE_PUBLIC_STATE" },
    ]);
    const results = await applyFixes(report, TEST_DIR, false);
    expect(results).toHaveLength(1);
    expect(results[0].action).toContain("readonly");
  });

  it("generates fix for SECRET_EXPOSED_AWS_ACCESS_KEY", async () => {
    const report = makeReport([
      { filePath: "src/config.ts", line: 1, description: "Exposed secret", severity: "error", rule: "SECRET_EXPOSED_AWS_ACCESS_KEY" },
    ]);
    const results = await applyFixes(report, TEST_DIR, false);
    expect(results).toHaveLength(1);
    expect(results[0].action).toContain("environment variable");
  });

  it("applies MISSING_TEST_FILE fix when --apply is true", async () => {
    // Create the source directory
    const srcDir = path.join(TEST_DIR, "src", "domain");
    fs.mkdirSync(srcDir, { recursive: true });

    const report = makeReport([
      { filePath: "src/domain/Order.ts", line: 1, description: "Missing test", severity: "warning", rule: "MISSING_TEST_FILE" },
    ]);
    const results = await applyFixes(report, TEST_DIR, true);
    expect(results).toHaveLength(1);

    const expectedTestPath = path.join(TEST_DIR, "src", "domain", "Order.test.ts");
    expect(fs.existsSync(expectedTestPath)).toBe(true);
    const content = fs.readFileSync(expectedTestPath, "utf-8");
    expect(content).toContain("describe");
    expect(content).toContain("Order");
  });

  it("applies DDD_MUTABLE_PUBLIC_STATE fix when --apply is true", async () => {
    // Create a file with a mutable public property
    const srcDir = path.join(TEST_DIR, "src", "domain");
    fs.mkdirSync(srcDir, { recursive: true });
    const filePath = path.join(srcDir, "User.ts");
    fs.writeFileSync(filePath, "class User {\n  constructor() {}\n  public name: string;\n}\n", "utf-8");

    const report = makeReport([
      { filePath: "src/domain/User.ts", line: 3, description: "'name'. Use readonly", severity: "error", rule: "DDD_MUTABLE_PUBLIC_STATE" },
    ]);
    const results = await applyFixes(report, TEST_DIR, true);
    expect(results).toHaveLength(1);

    const updatedContent = fs.readFileSync(filePath, "utf-8");
    expect(updatedContent).toContain("public readonly name");
  });
});
