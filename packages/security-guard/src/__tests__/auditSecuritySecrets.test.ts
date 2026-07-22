import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import * as path from "path";
import { auditSecuritySecrets } from "../tools/auditSecuritySecrets";
import { Ruleset } from "@guardian/shared";

const TEST_DIR = path.resolve(__dirname, "__fixtures_secrets__");
const defaultRuleset: Ruleset = {
  version: "1.0.0",
  executionMode: "local",
  layers: [],
  testConventions: [],
  excludePaths: ["node_modules", "dist"],
};

describe("auditSecuritySecrets", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("detects AWS Access Key", async () => {
    const filePath = path.join(TEST_DIR, "awsKey.ts");
    const content = `const key = "AKIAIOSFODNN7EXAMPLE";`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditSecuritySecrets({ directory: TEST_DIR }, defaultRuleset);

    expect(report.status).toBe("failed");
    const awsViolation = report.violations.find(
      (v) => v.rule === "SECRET_EXPOSED_AWS_ACCESS_KEY"
    );
    expect(awsViolation).toBeDefined();
    expect(awsViolation!.line).toBe(1);
    expect(awsViolation!.filePath).toContain("awsKey.ts");
  });

  it("detects GitHub Personal Access Token", async () => {
    const filePath = path.join(TEST_DIR, "ghToken.ts");
    const content = `const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditSecuritySecrets({ directory: TEST_DIR }, defaultRuleset);

    const ghViolation = report.violations.find(
      (v) => v.rule === "SECRET_EXPOSED_GITHUB_TOKEN"
    );
    expect(ghViolation).toBeDefined();
    expect(ghViolation!.filePath).toContain("ghToken.ts");
  });

  it("detects JWT tokens", async () => {
    const filePath = path.join(TEST_DIR, "jwt.ts");
    const content = `const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditSecuritySecrets({ directory: TEST_DIR }, defaultRuleset);

    const jwtViolation = report.violations.find(
      (v) => v.rule === "SECRET_EXPOSED_JWT_TOKEN"
    );
    expect(jwtViolation).toBeDefined();
    expect(jwtViolation!.filePath).toContain("jwt.ts");
  });

  it("detects database connection strings", async () => {
    const filePath = path.join(TEST_DIR, "dbUrl.ts");
    const content = `const db = "postgres://admin:secretpass@localhost:5432/mydb";`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditSecuritySecrets({ directory: TEST_DIR }, defaultRuleset);

    const dbViolation = report.violations.find(
      (v) => v.rule === "SECRET_EXPOSED_DATABASE_URL"
    );
    expect(dbViolation).toBeDefined();
    expect(dbViolation!.filePath).toContain("dbUrl.ts");
  });

  it("detects private key markers", async () => {
    const filePath = path.join(TEST_DIR, "privkey.ts");
    const content = `const key = \`-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----\`;`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditSecuritySecrets({ directory: TEST_DIR }, defaultRuleset);

    const keyViolation = report.violations.find(
      (v) => v.rule === "SECRET_EXPOSED_PRIVATE_KEY"
    );
    expect(keyViolation).toBeDefined();
    expect(keyViolation!.filePath).toContain("privkey.ts");
  });

  it("detects generic password assignments", async () => {
    const filePath = path.join(TEST_DIR, "password.ts");
    const content = `const config = { password: "super_secret_123" };`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditSecuritySecrets({ directory: TEST_DIR }, defaultRuleset);

    const pwdViolation = report.violations.find(
      (v) => v.rule === "SECRET_EXPOSED_GENERIC_PASSWORD"
    );
    expect(pwdViolation).toBeDefined();
    expect(pwdViolation!.filePath).toContain("password.ts");
  });

  it("does not flag normal code as false positive", async () => {
    // Clean up previous fixture files first
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR, { recursive: true });

    const filePath = path.join(TEST_DIR, "clean.ts");
    const content = `
import { UserService } from "./services";

export function getUser(id: string): string {
  const name = "John Doe";
  const count = 42;
  return \`User \${name} with id \${id}\`;
}

export const CONFIG = {
  port: 3000,
  host: "localhost",
};
`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditSecuritySecrets({ directory: TEST_DIR }, defaultRuleset);

    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  it("respects excludePaths from ruleset", async () => {
    // Clean up
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(path.join(TEST_DIR, "node_modules"), { recursive: true });

    const excludedFile = path.join(TEST_DIR, "node_modules", "secret.ts");
    const content = `const key = "AKIAIOSFODNN7EXAMPLE";`;
    await writeFile(excludedFile, content, "utf-8");

    const report = await auditSecuritySecrets({ directory: TEST_DIR }, defaultRuleset);

    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  it("skips binary files", async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR, { recursive: true });

    const binaryFile = path.join(TEST_DIR, "binary.bin");
    // Create content with null bytes (simulating binary)
    const content = "AKIAIOSFODNN7EXAMPLE" + "\0".repeat(100);
    await writeFile(binaryFile, content, "utf-8");

    const report = await auditSecuritySecrets({ directory: TEST_DIR }, defaultRuleset);

    expect(report.violations).toHaveLength(0);
  });
});
