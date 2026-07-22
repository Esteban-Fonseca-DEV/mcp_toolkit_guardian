import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { writeFile, mkdir, rm } from "fs/promises";
import { evaluateCustomRules, CustomRule } from "../CustomRulesEngine";
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

  describe("forbidden_imports", () => {
    it("detects forbidden import in matching layer", async () => {
      // Create domain file with a forbidden import
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

      const violations = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("NO_PG_IN_DOMAIN");
      expect(violations[0].severity).toBe("error");
      expect(violations[0].description).toContain("database access forbidden");
    });

    it("does not flag imports outside the target layer", async () => {
      // Create infrastructure file with the import (should be allowed)
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

      const violations = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(violations).toHaveLength(0);
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

      const violations = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(violations).toHaveLength(0);
    });
  });

  describe("max_lines", () => {
    it("detects functions exceeding max line count", async () => {
      const domainDir = join(TEST_DIR, "src", "domain");
      await mkdir(domainDir, { recursive: true });

      // Create a file with a long function (12 lines)
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

      const violations = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("MAX_FUNCTION_LENGTH");
      expect(violations[0].description).toContain("longMethod");
      expect(violations[0].description).toContain("13 lines");
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

      const violations = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(violations).toHaveLength(0);
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

      const violations = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("REQUIRE_JSDOC");
      expect(violations[0].description).toContain("required pattern not found");
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

      const violations = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(violations).toHaveLength(0);
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

      const violations = await evaluateCustomRules(TEST_DIR, rules, TEST_RULESET);
      expect(violations).toHaveLength(2);
    });
  });

  describe("empty rules", () => {
    it("returns no violations for empty rules array", async () => {
      const violations = await evaluateCustomRules(TEST_DIR, [], TEST_RULESET);
      expect(violations).toHaveLength(0);
    });
  });
});
