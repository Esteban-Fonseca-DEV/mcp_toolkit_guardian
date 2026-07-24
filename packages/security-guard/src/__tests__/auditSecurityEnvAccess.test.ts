import { describe, test, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { auditSecurityEnvAccess } from "../tools/auditSecurityEnvAccess";
import { Ruleset } from "@guardian/shared";

const DEFAULT_RULESET: Ruleset = {
  version: "1.0.0",
  executionMode: "local",
  layers: [
    { name: "domain", paths: ["src/domain/**"], allowedDependencies: [] },
    { name: "infrastructure", paths: ["src/infrastructure/**"], allowedDependencies: ["domain"] },
  ],
  testConventions: [],
  excludePaths: [],
};

describe("audit_security_env_access", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-env-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("detects process.env access in domain layer", async () => {
    const domainDir = path.join(tempDir, "src", "domain");
    fs.mkdirSync(domainDir, { recursive: true });
    const file = path.join(domainDir, "UserService.ts");
    fs.writeFileSync(file, `const dbUrl = process.env.DATABASE_URL;\n`);

    const report = await auditSecurityEnvAccess({ filepath: file }, DEFAULT_RULESET);
    // Status is "passed" because env violations are severity "warning" (not "error")
    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].severity).toBe("warning");
    expect(report.violations[0].rule).toBe("SECURITY_ENV_ACCESS_VIOLATION");
  });

  test("allows process.env access in infrastructure layer", async () => {
    const infraDir = path.join(tempDir, "src", "infrastructure");
    fs.mkdirSync(infraDir, { recursive: true });
    const file = path.join(infraDir, "DatabaseConfig.ts");
    fs.writeFileSync(file, `const dbUrl = process.env.DATABASE_URL;\n`);

    const report = await auditSecurityEnvAccess({ filepath: file }, DEFAULT_RULESET);
    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  test("detects multiple env accesses", async () => {
    const domainDir = path.join(tempDir, "src", "domain");
    fs.mkdirSync(domainDir, { recursive: true });
    const file = path.join(domainDir, "Config.ts");
    fs.writeFileSync(file, [
      `const host = process.env.HOST;`,
      `const port = process.env.PORT;`,
      `const secret = process.env["JWT_SECRET"];`,
    ].join("\n"));

    const report = await auditSecurityEnvAccess({ filepath: file }, DEFAULT_RULESET);
    expect(report.violations).toHaveLength(3);
  });

  test("skips comment lines", async () => {
    const domainDir = path.join(tempDir, "src", "domain");
    fs.mkdirSync(domainDir, { recursive: true });
    const file = path.join(domainDir, "Service.ts");
    fs.writeFileSync(file, `// process.env.SECRET should not be used here\nconst x = 1;\n`);

    const report = await auditSecurityEnvAccess({ filepath: file }, DEFAULT_RULESET);
    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  test("returns error for non-existent file", async () => {
    const report = await auditSecurityEnvAccess(
      { filepath: "/non/existent/file.ts" },
      DEFAULT_RULESET
    );
    expect(report.status).toBe("error");
    expect(report.error).toContain("not found");
  });
});
