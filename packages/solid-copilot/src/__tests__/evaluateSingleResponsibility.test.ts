import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import * as path from "path";
import { evaluateSingleResponsibility } from "../tools/evaluateSingleResponsibility";
import { Ruleset } from "@guardian/shared";

const TEST_DIR = path.resolve(__dirname, "__fixtures_srp__");
const defaultRuleset: Ruleset = {
  version: "1.0.0",
  executionMode: "local",
  layers: [],
  testConventions: [],
  excludePaths: [],
};

describe("evaluateSingleResponsibility", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("detects class with more than 200 lines as violation", async () => {
    const filePath = path.join(TEST_DIR, "LargeClass.ts");
    // Generate a class with 250 lines
    const methodLines = Array.from(
      { length: 240 },
      (_, i) => `  // line ${i + 1}`
    ).join("\n");
    const content = `export class GodObject {\n${methodLines}\n  doSomething(): void {}\n}\n`;
    await writeFile(filePath, content, "utf-8");

    const report = await evaluateSingleResponsibility(
      { filepath: filePath },
      defaultRuleset
    );

    // SRP violations are severity "warning", so status is "passed" per computeStatus
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].rule).toBe("SRP_GOD_OBJECT");
    expect(report.violations[0].severity).toBe("warning");
    expect(report.violations[0].description).toContain("lineas");
    expect(report.violations[0].description).toContain("umbral: 200");
    expect(report.summary.warningCount).toBe(1);
  });

  it("returns clean report for class with 50 lines", async () => {
    const filePath = path.join(TEST_DIR, "SmallClass.ts");
    const lines = Array.from(
      { length: 45 },
      (_, i) => `  // line ${i}`
    ).join("\n");
    const content = `export class SmallService {\n${lines}\n  run(): void {}\n}\n`;
    await writeFile(filePath, content, "utf-8");

    const report = await evaluateSingleResponsibility(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  it("detects class with 12 methods as violation", async () => {
    const filePath = path.join(TEST_DIR, "ManyMethods.ts");
    const methods = Array.from(
      { length: 12 },
      (_, i) => `  method${i}(): void {}`
    ).join("\n");
    const content = `export class TooManyMethods {\n${methods}\n}\n`;
    await writeFile(filePath, content, "utf-8");

    const report = await evaluateSingleResponsibility(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].rule).toBe("SRP_GOD_OBJECT");
    expect(report.violations[0].severity).toBe("warning");
    expect(report.violations[0].description).toContain("12 metodos");
    expect(report.violations[0].description).toContain("umbral: 10");
  });

  it("detects class with 6 constructor parameters as violation", async () => {
    const filePath = path.join(TEST_DIR, "ManyDeps.ts");
    const content = `export class TooManyDeps {
  constructor(
    private a: string,
    private b: string,
    private c: string,
    private d: string,
    private e: string,
    private f: string
  ) {}

  run(): void {}
}
`;
    await writeFile(filePath, content, "utf-8");

    const report = await evaluateSingleResponsibility(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].rule).toBe("SRP_GOD_OBJECT");
    expect(report.violations[0].severity).toBe("warning");
    expect(report.violations[0].description).toContain("6 dependencias inyectadas");
    expect(report.violations[0].description).toContain("umbral: 5");
  });

  it("returns clean report for class below all thresholds", async () => {
    const filePath = path.join(TEST_DIR, "GoodClass.ts");
    const content = `export class GoodService {
  constructor(private dep1: string, private dep2: string) {}

  methodA(): void {}
  methodB(): void {}
  methodC(): void {}
}
`;
    await writeFile(filePath, content, "utf-8");

    const report = await evaluateSingleResponsibility(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  it("returns warning violation if file does not exist", async () => {
    const filePath = path.join(TEST_DIR, "nonexistent.ts");

    const report = await evaluateSingleResponsibility(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].severity).toBe("warning");
    expect(report.violations[0].rule).toBe("FILE_READ_ERROR");
  });
});
