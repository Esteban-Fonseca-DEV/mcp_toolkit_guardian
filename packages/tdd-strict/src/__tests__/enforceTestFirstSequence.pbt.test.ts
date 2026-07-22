import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { enforceTestFirstSequence, sessionStore } from "../tools/enforceTestFirstSequence";
import { Ruleset } from "@guardian/shared";

/**
 * Property 8: Enforcement consistente de la secuencia TDD
 * Generate git diffs with implementation changes and no prior test commit.
 * Verify enforcement always blocks.
 * **Validates: Requirements 3.3**
 */
describe("Property 8: Enforcement consistente de la secuencia TDD", () => {
  const ruleset: Ruleset = {
    version: "1.0.0",
    executionMode: "local",
    layers: [],
    testConventions: [
      { pattern: "**/*.test.ts" },
      { pattern: "**/*.spec.ts" },
    ],
    excludePaths: ["node_modules", "dist"],
  };

  beforeEach(() => {
    // Clear the session store before each test run
    sessionStore.clear();
  });

  /**
   * Generate a git diff string that contains production file changes.
   * Format: "diff --git a/path/to/file.ts b/path/to/file.ts"
   */
  const prodFileNameArb = fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s));

  const gitDiffArb = fc
    .array(prodFileNameArb, { minLength: 1, maxLength: 5 })
    .map((files) => {
      // Ensure files are NOT test files (no .test. or .spec. in name)
      return files
        .map(
          (f) =>
            `diff --git a/src/${f}.ts b/src/${f}.ts\n--- a/src/${f}.ts\n+++ b/src/${f}.ts\n@@ -1,3 +1,4 @@\n+const x = 1;\n`
        )
        .join("\n");
    });

  it("always blocks when implementation changes have no prior test commit", () => {
    return fc.assert(
      fc.asyncProperty(gitDiffArb, async (gitDiff) => {
        // No test commits registered in session - should always block
        const report = await enforceTestFirstSequence({ git_diff: gitDiff }, ruleset);

        // Should always produce violations (block)
        expect(report.status).toBe("failed");
        expect(report.violations.length).toBeGreaterThan(0);

        // Every violation should be severity "error"
        for (const v of report.violations) {
          expect(v.severity).toBe("error");
          expect(v.rule).toBe("TEST_FIRST_VIOLATION");
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
