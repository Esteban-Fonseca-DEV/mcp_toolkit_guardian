import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import * as path from "path";
import { auditSecurityEnvAccess } from "../tools/auditSecurityEnvAccess";
import { Ruleset } from "@guardian/shared";

const TEST_DIR = path.resolve(__dirname, "__fixtures_env__");
const defaultRuleset: Ruleset = {
  version: "1.0.0",
  executionMode: "local",
  layers: [
    {
      name: "domain",
      paths: ["**/src/domain/**"],
      allowedDependencies: [],
    },
    {
      name: "application",
      paths: ["**/src/application/**"],
      allowedDependencies: ["domain"],
    },
    {
      name: "infrastructure",
      paths: ["**/src/infrastructure/**"],
      allowedDependencies: ["domain", "application"],
    },
  ],
  testConventions: [],
  excludePaths: [],
};

describe("auditSecurityEnvAccess", () => {
  beforeAll(async () => {
    await mkdir(path.join(TEST_DIR, "src", "domain"), { recursive: true });
    await mkdir(path.join(TEST_DIR, "src", "infrastructure"), {
      recursive: true,
    });
    await mkdir(path.join(TEST_DIR, "src", "application"), { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("flags process.env access in domain layer as warning", async () => {
    const filePath = path.join(TEST_DIR, "src", "domain", "UserService.ts");
    const content = `
export class UserService {
  getDbUrl(): string {
    return process.env.DATABASE_URL ?? "default";
  }
}
`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditSecurityEnvAccess(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations[0].severity).toBe("warning");
    expect(report.violations[0].rule).toBe("ENV_ACCESS_OUTSIDE_INFRA");
    expect(report.violations[0].description).toContain("process.env");
  });

  it("allows process.env access in infrastructure layer (no violations)", async () => {
    const filePath = path.join(
      TEST_DIR,
      "src",
      "infrastructure",
      "config.ts"
    );
    const content = `
export const config = {
  dbUrl: process.env.DATABASE_URL ?? "localhost",
  port: parseInt(process.env.PORT ?? "3000", 10),
};
`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditSecurityEnvAccess(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  it("flags multiple process.env accesses in application layer", async () => {
    const filePath = path.join(
      TEST_DIR,
      "src",
      "application",
      "AppService.ts"
    );
    const content = `
export class AppService {
  getApiKey(): string {
    return process.env.API_KEY ?? "";
  }

  getSecret(): string {
    return process.env.SECRET ?? "";
  }
}
`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditSecurityEnvAccess(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.violations).toHaveLength(2);
    expect(report.violations.every((v) => v.severity === "warning")).toBe(true);
    expect(
      report.violations.every((v) => v.rule === "ENV_ACCESS_OUTSIDE_INFRA")
    ).toBe(true);
  });

  it("returns clean report for file without process.env access", async () => {
    const filePath = path.join(TEST_DIR, "src", "domain", "clean.ts");
    const content = `
export function add(a: number, b: number): number {
  return a + b;
}
`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditSecurityEnvAccess(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  it("returns warning for non-existent file", async () => {
    const filePath = path.join(TEST_DIR, "nonexistent.ts");

    const report = await auditSecurityEnvAccess(
      { filepath: filePath },
      defaultRuleset
    );

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].severity).toBe("warning");
    expect(report.violations[0].rule).toBe("FILE_READ_ERROR");
  });
});
