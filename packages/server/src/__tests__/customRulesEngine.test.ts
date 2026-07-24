import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { writeFile, mkdir, rm } from "fs/promises";
import { evaluateCustomRules, validateCustomRule, CustomRule } from "../CustomRulesEngine";
import { Ruleset } from "@guardian/shared";

const TEST_DIR = join(__dirname, "__custom_rules_fixtures__");

const TEST_RULESET: Ruleset = {
  version: "1.0.0",
  executionMode: "local",
  layers: [
    { name: "domain", paths: ["src/domain/**"], allowedDependencies: [] },
    { name: "application", paths: ["src/application/**"], allowedDependencies: ["domain"] },
    { name: "infrastructure", paths: ["src/infrastructure/**"], allowedDependencies: ["domain", "application"] },
  ],
  testConventions: [{ pattern: "**/*.test.ts" }],
  excludePaths: ["node_modules", "dist"],
};

describe("CustomRulesEngine", () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("validateCustomRule", () => {
    it("returns valid for a correct forbidden_imports rule", () => {
      const rule: CustomRule = {
        id: "no-axios",
        type: "forbidden_imports",
        layer: "domain",
        severity: "error",
        message: "No axios in domain",
        forbidden_imports: ["axios"],
      };
      expect(validateCustomRule(rule)).toEqual({ valid: true });
    });

    it("returns valid for a correct max_lines rule", () => {
      const rule: CustomRule = {
        id: "short-methods",
        layer: "all",
        severity: "warning",
        message: "Methods too long",
        max_lines: 20,
      };
      expect(validateCustomRule(rule)).toEqual({ valid: true });
    });

    it("returns valid for a correct required_patterns rule", () => {
      const rule: CustomRule = {
        id: "require-interface",
        type: "required_patterns",
        layer: "domain",
        severity: "warning",
        message: "Must export interface",
        required_patterns: ["export\\s+interface"],
      };
      expect(validateCustomRule(rule)).toEqual({ valid: true });
    });

    it("fails when rule is null or not an object", () => {
      expect(validateCustomRule(null).valid).toBe(false);
      expect(validateCustomRule("string").valid).toBe(false);
      expect(validateCustomRule(123).valid).toBe(false);
    });

    it("fails when id is missing", () => {
      const result = validateCustomRule({ severity: "error", message: "x", max_lines: 5 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("id");
    });

    it("fails when severity is invalid", () => {
      const result = validateCustomRule({ id: "test", severity: "critical", message: "x", max_lines: 5 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("severity");
    });

    it("fails when message is missing", () => {
      const result = validateCustomRule({ id: "test", severity: "error", max_lines: 5 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("message");
    });

    it("fails when explicit type is invalid", () => {
      const result = validateCustomRule({ id: "test", type: "invalid_type", severity: "error", message: "x" });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("type");
    });

    it("fails when no condition field is specified", () => {
      const result = validateCustomRule({ id: "test", severity: "error", message: "x" });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must define one of");
    });

    it("fails when forbidden_imports is empty array", () => {
      const result = validateCustomRule({ id: "test", severity: "error", message: "x", forbidden_imports: [] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("non-empty array");
    });

    it("fails when max_lines is zero or negative", () => {
      const result = validateCustomRule({ id: "test", severity: "error", message: "x", max_lines: 0 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("positive number");
    });

    it("fails when required_patterns is empty array", () => {
      const result = validateCustomRule({ id: "test", severity: "error", message: "x", required_patterns: [] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("non-empty array");
    });

    it("fails when required_patterns contains invalid regex", () => {
      const result = validateCustomRule({ id: "test", severity: "error", message: "x", required_patterns: ["[invalid"] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("invalid regex");
    });
  });

  describe("forbidden_imports", () => {
    it("detects forbidden import in matching layer", async () => {
      const domainDir = join(TEST_DIR, "src", "domain");
      await mkdir(domainDir, { recursive: true });
      await writeFile(
        join(domainDir, "User.ts"),
        `import { pool } from "pg";\n\nexport class User {}\n`
      );

      const rules: CustomRule[] = [
        {
          id: "NO_PG_IN_DOMAIN",
          layer: "domain",
          severity: "error",
          message: "Direct database access forbidden in domain layer",
          forbidden_imports: ["pg"],
        },
      ];

      const report = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(report.status).toBe("failed");
      expect(report.violations).toHaveLength(1);
      expect(report.violations[0].rule).toBe("NO_PG_IN_DOMAIN");
      expect(report.violations[0].severity).toBe("error");
      expect(report.violations[0].description).toContain("database access forbidden");
    });

    it("does not flag imports outside the target layer", async () => {
      const infraDir = join(TEST_DIR, "src", "infrastructure");
      await mkdir(infraDir, { recursive: true });
      await writeFile(
        join(infraDir, "Database.ts"),
        `import { pool } from "pg";\n\nexport class Database {}\n`
      );

      const rules: CustomRule[] = [
        {
          id: "NO_PG_IN_DOMAIN",
          layer: "domain",
          severity: "error",
          message: "Direct database access forbidden in domain layer",
          forbidden_imports: ["pg"],
        },
      ];

      const report = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(report.status).toBe("passed");
      expect(report.violations).toHaveLength(0);
    });

    it("does not flag non-matching imports", async () => {
      const domainDir = join(TEST_DIR, "src", "domain");
      await mkdir(domainDir, { recursive: true });
      await writeFile(
        join(domainDir, "User.ts"),
        `import { v4 } from "uuid";\n\nexport class User {}\n`
      );

      const rules: CustomRule[] = [
        {
          id: "NO_PG_IN_DOMAIN",
          layer: "domain",
          severity: "error",
          message: "Direct database access forbidden",
          forbidden_imports: ["pg"],
        },
      ];

      const report = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(report.status).toBe("passed");
      expect(report.violations).toHaveLength(0);
    });
  });

  describe("max_lines", () => {
    it("detects functions exceeding max line count", async () => {
      const domainDir = join(TEST_DIR, "src", "domain");
      await mkdir(domainDir, { recursive: true });

      const longFunction = `export function longMethod() {
  const a = 1;
  const b = 2;
  const c = 3;
  const d = 4;
  const e = 5;
  const f = 6;
  const g = 7;
  const h = 8;
  const i = 9;
  const j = 10;
  return a + b + c + d + e + f + g + h + i + j;
}
`;
      await writeFile(join(domainDir, "LongService.ts"), longFunction);

      const rules: CustomRule[] = [
        {
          id: "MAX_FUNCTION_LENGTH",
          layer: "domain",
          severity: "warning",
          message: "Function too long",
          max_lines: 5,
        },
      ];

      const report = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(report.violations).toHaveLength(1);
      expect(report.violations[0].rule).toBe("MAX_FUNCTION_LENGTH");
      expect(report.violations[0].description).toContain("longMethod");
      expect(report.violations[0].description).toContain("13 lines");
    });

    it("does not flag short functions", async () => {
      const domainDir = join(TEST_DIR, "src", "domain");
      await mkdir(domainDir, { recursive: true });

      await writeFile(
        join(domainDir, "ShortService.ts"),
        `export function shortMethod() {\n  return 42;\n}\n`
      );

      const rules: CustomRule[] = [
        {
          id: "MAX_FUNCTION_LENGTH",
          layer: "domain",
          severity: "warning",
          message: "Function too long",
          max_lines: 10,
        },
      ];

      const report = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(report.violations).toHaveLength(0);
    });
  });

  describe("required_patterns", () => {
    it("detects missing required patterns", async () => {
      const domainDir = join(TEST_DIR, "src", "domain");
      await mkdir(domainDir, { recursive: true });

      await writeFile(
        join(domainDir, "Service.ts"),
        `export class Service {\n  doWork() { return 1; }\n}\n`
      );

      const rules: CustomRule[] = [
        {
          id: "REQUIRE_JSDOC",
          layer: "domain",
          severity: "warning",
          message: "JSDoc documentation required",
          required_patterns: ["/\\*\\*"],
        },
      ];

      const report = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(report.violations).toHaveLength(1);
      expect(report.violations[0].rule).toBe("REQUIRE_JSDOC");
      expect(report.violations[0].description).toContain("required pattern not found");
    });

    it("passes when required pattern is present", async () => {
      const domainDir = join(TEST_DIR, "src", "domain");
      await mkdir(domainDir, { recursive: true });

      await writeFile(
        join(domainDir, "Service.ts"),
        `/** Documented service */\nexport class Service {\n  doWork() { return 1; }\n}\n`
      );

      const rules: CustomRule[] = [
        {
          id: "REQUIRE_JSDOC",
          layer: "domain",
          severity: "warning",
          message: "JSDoc documentation required",
          required_patterns: ["/\\*\\*"],
        },
      ];

      const report = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(report.violations).toHaveLength(0);
    });
  });

  describe("layer: all", () => {
    it("evaluates rules across all layers", async () => {
      const domainDir = join(TEST_DIR, "src", "domain");
      const appDir = join(TEST_DIR, "src", "application");
      await mkdir(domainDir, { recursive: true });
      await mkdir(appDir, { recursive: true });

      await writeFile(
        join(domainDir, "A.ts"),
        `import { something } from "banned-lib";\nexport const a = 1;\n`
      );
      await writeFile(
        join(appDir, "B.ts"),
        `import { other } from "banned-lib";\nexport const b = 2;\n`
      );

      const rules: CustomRule[] = [
        {
          id: "NO_BANNED_LIB",
          layer: "all",
          severity: "error",
          message: "Banned library import",
          forbidden_imports: ["banned-lib"],
        },
      ];

      const report = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(report.violations).toHaveLength(2);
    });
  });

  describe("invalid rules", () => {
    it("returns error report for rule with missing id", async () => {
      const rules = [{ severity: "error", message: "x", forbidden_imports: ["pg"] }] as unknown as CustomRule[];
      const report = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(report.status).toBe("error");
      expect(report.error).toContain("id");
      expect(report.violations).toHaveLength(0);
    });

    it("returns error report for rule with invalid severity", async () => {
      const rules: CustomRule[] = [
        { id: "bad", layer: "domain", severity: "critical", message: "x", forbidden_imports: ["pg"] },
      ];
      const report = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(report.status).toBe("error");
      expect(report.error).toContain("severity");
    });

    it("returns error report for rule without condition fields", async () => {
      const rules: CustomRule[] = [
        { id: "empty", layer: "domain", severity: "error", message: "No condition" },
      ];
      const report = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(report.status).toBe("error");
      expect(report.error).toContain("must define one of");
    });

    it("does not execute analysis when a rule is invalid", async () => {
      const domainDir = join(TEST_DIR, "src", "domain");
      await mkdir(domainDir, { recursive: true });
      await writeFile(join(domainDir, "File.ts"), `import pg from "pg";\n`);

      const rules: CustomRule[] = [
        { id: "valid-rule", layer: "domain", severity: "error", message: "No pg", forbidden_imports: ["pg"] },
        { id: "broken", layer: "domain", severity: "invalid" as "error", message: "x", forbidden_imports: ["x"] },
      ];

      const report = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      // Should not execute — error returned for the broken rule
      expect(report.status).toBe("error");
      expect(report.violations).toHaveLength(0);
    });
  });

  describe("empty rules", () => {
    it("returns passed report for empty rules array", async () => {
      const report = await evaluateCustomRules(TEST_DIR, [], TEST_RULESET);
      expect(report.status).toBe("passed");
      expect(report.violations).toHaveLength(0);
    });
  });
});
