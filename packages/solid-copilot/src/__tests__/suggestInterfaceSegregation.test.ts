import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import * as path from "path";
import { suggestInterfaceSegregation } from "../tools/suggestInterfaceSegregation";
import { Ruleset } from "@guardian/shared";

const TEST_DIR = path.resolve(__dirname, "__fixtures_isp__");
const defaultRuleset: Ruleset = {
  version: "1.0.0",
  executionMode: "local",
  layers: [],
  testConventions: [],
  excludePaths: [],
};

describe("suggestInterfaceSegregation", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("detects interface with 8 methods as violation", async () => {
    const filePath = path.join(TEST_DIR, "FatInterface.ts");
    const methods = Array.from(
      { length: 8 },
      (_, i) => `  method${i}(): void;`
    ).join("\n");
    const content = `export interface IFatService {\n${methods}\n}\n`;
    await writeFile(filePath, content, "utf-8");

    const report = await suggestInterfaceSegregation(
      { filepath: filePath },
      defaultRuleset
    );

    // ISP violations are severity "warning", so status is "passed" per computeStatus
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].rule).toBe("ISP_FAT_INTERFACE");
    expect(report.violations[0].severity).toBe("warning");
    expect(report.violations[0].description).toContain("8 metodos");
    expect(report.violations[0].description).toContain("umbral: 5");
    expect(report.summary.warningCount).toBe(1);
  });

  it("returns clean report for interface with 3 methods", async () => {
    const filePath = path.join(TEST_DIR, "SmallInterface.ts");
    const content = `export interface ISmallService {
  methodA(): void;
  methodB(): string;
  methodC(x: number): boolean;
}
`;
    await writeFile(filePath, content, "utf-8");

    const report = await suggestInterfaceSegregation(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  it("returns clean report for interface with exactly 5 methods", async () => {
    const filePath = path.join(TEST_DIR, "FiveMethodInterface.ts");
    const methods = Array.from(
      { length: 5 },
      (_, i) => `  method${i}(): void;`
    ).join("\n");
    const content = `export interface IBorderline {\n${methods}\n}\n`;
    await writeFile(filePath, content, "utf-8");

    const report = await suggestInterfaceSegregation(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  it("detects multiple fat interfaces in one file", async () => {
    const filePath = path.join(TEST_DIR, "MultiFat.ts");
    const methods6 = Array.from(
      { length: 6 },
      (_, i) => `  action${i}(): void;`
    ).join("\n");
    const content = `export interface IFirst {\n${methods6}\n}\n\nexport interface ISecond {\n${methods6}\n}\n`;
    await writeFile(filePath, content, "utf-8");

    const report = await suggestInterfaceSegregation(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.violations).toHaveLength(2);
    expect(report.violations[0].description).toContain("IFirst");
    expect(report.violations[1].description).toContain("ISecond");
    expect(report.summary.warningCount).toBe(2);
  });

  it("counts function-type properties as methods", async () => {
    const filePath = path.join(TEST_DIR, "FuncProps.ts");
    const content = `export interface ICallbacks {
  onClick: () => void;
  onHover: () => void;
  onBlur: () => void;
  onFocus: () => void;
  onChange: (val: string) => void;
  onSubmit: (data: unknown) => void;
}
`;
    await writeFile(filePath, content, "utf-8");

    const report = await suggestInterfaceSegregation(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].rule).toBe("ISP_FAT_INTERFACE");
    expect(report.violations[0].severity).toBe("warning");
  });

  it("returns clean report for file without interfaces", async () => {
    const filePath = path.join(TEST_DIR, "NoInterface.ts");
    const content = `export class Service {
  run(): void {}
}
`;
    await writeFile(filePath, content, "utf-8");

    const report = await suggestInterfaceSegregation(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  it("returns warning violation if file does not exist", async () => {
    const filePath = path.join(TEST_DIR, "nonexistent.ts");

    const report = await suggestInterfaceSegregation(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].severity).toBe("warning");
    expect(report.violations[0].rule).toBe("FILE_READ_ERROR");
  });
});
