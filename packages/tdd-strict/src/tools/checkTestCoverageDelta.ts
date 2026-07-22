import { existsSync } from "fs";
import { join, dirname } from "path";
import { AuditReport, Ruleset, Violation, buildReport } from "@guardian/shared";
import { GitInspector } from "../GitInspector";
import { findExpectedTestFile } from "../TestConventionMatcher";

/**
 * Verifies that each production file modified in a commit has its corresponding test file.
 * Returns an AuditReport with Violations for files missing their test counterpart.
 * (Req 3.1, 3.2, 3.5)
 */
export async function checkTestCoverageDelta(
  args: { commit_hash: string },
  ruleset: Ruleset
): Promise<AuditReport> {
  const { commit_hash } = args;
  const violations: Violation[] = [];

  const inspector = new GitInspector();
  let changedFiles: string[];

  try {
    changedFiles = await inspector.getChangedFiles(commit_hash);
  } catch (err) {
    return buildReport({
      agentName: "tdd-strict",
      analyzedPath: commit_hash,
      status: "error",
      violations: [],
      error: `Cannot inspect commit: ${(err as Error).message}`,
    });
  }

  // Filter to only production files (exclude test files and excluded paths)
  const productionFiles = changedFiles.filter((file) => {
    // Exclude test files
    if (isTestFile(file, ruleset)) return false;
    // Exclude paths from ruleset
    if (ruleset.excludePaths.some((p) => file.startsWith(p) || file.includes(`/${p}/`))) {
      return false;
    }
    // Only include TypeScript files
    return file.endsWith(".ts") || file.endsWith(".tsx");
  });

  for (const prodFile of productionFiles) {
    const expectedTestFile = findExpectedTestFile(prodFile, ruleset.testConventions);

    // Check if any convention's test file exists
    const testExists = testFileExists(prodFile, ruleset);

    if (!testExists) {
      violations.push({
        filePath: prodFile,
        line: 0,
        description: `Production file '${prodFile}' does not have a corresponding test file. Expected: '${expectedTestFile}'`,
        severity: "error",
        rule: "MISSING_TEST_FILE",
      });
    }
  }

  return buildReport({
    agentName: "tdd-strict",
    analyzedPath: commit_hash,
    violations,
  });
}

/**
 * Checks whether a file matches test file patterns.
 */
function isTestFile(filePath: string, ruleset: Ruleset): boolean {
  return (
    filePath.includes(".test.") ||
    filePath.includes(".spec.") ||
    filePath.includes("_test.") ||
    filePath.includes("__tests__/")
  );
}

/**
 * Checks if any test convention's expected test file exists on disk.
 */
function testFileExists(prodFile: string, ruleset: Ruleset): boolean {
  for (const convention of ruleset.testConventions) {
    const expectedTest = findExpectedTestFile(prodFile, [convention]);
    if (existsSync(expectedTest)) {
      return true;
    }
  }
  return false;
}
