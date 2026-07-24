import { describe, test, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { auditSecuritySecrets } from "../tools/auditSecuritySecrets";
import { Ruleset } from "@guardian/shared";

const DEFAULT_RULESET: Ruleset = {
  version: "1.0.0",
  executionMode: "local",
  layers: [],
  testConventions: [],
  excludePaths: ["node_modules", "dist"],
};

describe("audit_security_secrets", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-sec-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("detects AWS access key", async () => {
    const file = path.join(tempDir, "config.ts");
    fs.writeFileSync(file, `const key = "AKIAIOSFODNN7EXAMPLE";\n`);

    const report = await auditSecuritySecrets({ directory: tempDir }, DEFAULT_RULESET);
    expect(report.status).toBe("failed");
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].rule).toBe("SECURITY_AWS_ACCESS_KEY");
    expect(report.violations[0].severity).toBe("error");
  });

  test("detects GitHub personal access token", async () => {
    const file = path.join(tempDir, "auth.ts");
    fs.writeFileSync(file, `const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";\n`);

    const report = await auditSecuritySecrets({ directory: tempDir }, DEFAULT_RULESET);
    expect(report.status).toBe("failed");
    expect(report.violations[0].rule).toBe("SECURITY_GITHUB_TOKEN");
  });

  test("detects JWT token", async () => {
    const file = path.join(tempDir, "token.ts");
    fs.writeFileSync(file, `const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";\n`);

    const report = await auditSecuritySecrets({ directory: tempDir }, DEFAULT_RULESET);
    expect(report.status).toBe("failed");
    expect(report.violations[0].rule).toBe("SECURITY_JWT_TOKEN");
  });

  test("detects database URL with credentials", async () => {
    const file = path.join(tempDir, "db.ts");
    fs.writeFileSync(file, `const url = "postgres://admin:secretpass@localhost:5432/mydb";\n`);

    const report = await auditSecuritySecrets({ directory: tempDir }, DEFAULT_RULESET);
    expect(report.status).toBe("failed");
    expect(report.violations[0].rule).toBe("SECURITY_DATABASE_URL");
  });

  test("detects private key", async () => {
    const file = path.join(tempDir, "key.pem");
    fs.writeFileSync(file, `-----BEGIN RSA PRIVATE KEY-----\nMIIEpA...\n-----END RSA PRIVATE KEY-----\n`);

    const report = await auditSecuritySecrets({ directory: tempDir }, DEFAULT_RULESET);
    expect(report.status).toBe("failed");
    expect(report.violations[0].rule).toBe("SECURITY_PRIVATE_KEY");
  });

  test("detects generic password assignment", async () => {
    const file = path.join(tempDir, "config.ts");
    fs.writeFileSync(file, `const password = "super_secret_123";\n`);

    const report = await auditSecuritySecrets({ directory: tempDir }, DEFAULT_RULESET);
    expect(report.status).toBe("failed");
    expect(report.violations[0].rule).toBe("SECURITY_GENERIC_PASSWORD");
  });

  test("no false positive for normal strings", async () => {
    const file = path.join(tempDir, "clean.ts");
    fs.writeFileSync(file, `const message = "Hello world";\nconst count = 42;\n`);

    const report = await auditSecuritySecrets({ directory: tempDir }, DEFAULT_RULESET);
    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  test("respects excludePaths", async () => {
    const nodeModules = path.join(tempDir, "node_modules");
    fs.mkdirSync(nodeModules);
    fs.writeFileSync(
      path.join(nodeModules, "lib.js"),
      `const key = "AKIAIOSFODNN7EXAMPLE";\n`
    );

    const report = await auditSecuritySecrets({ directory: tempDir }, DEFAULT_RULESET);
    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  test("returns error for non-existent directory", async () => {
    const report = await auditSecuritySecrets(
      { directory: "/non/existent/path" },
      DEFAULT_RULESET
    );
    expect(report.status).toBe("error");
    expect(report.error).toContain("not found");
  });
});
