import { AuditReport, Ruleset, Violation, buildReport } from "@guardian/shared";
import { GitInspector } from "../GitInspector";

/**
 * Session store that tracks which files have had tests committed before implementation.
 * Key: session_id or global, Value: Set of test file paths committed in the session.
 */
export const sessionStore: Map<string, Set<string>> = new Map();

/**
 * Records a test file as committed in the current session.
 * Call this when a test commit is detected.
 */
export function registerTestCommit(sessionId: string, testFiles: string[]): void {
  if (!sessionStore.has(sessionId)) {
    sessionStore.set(sessionId, new Set());
  }
  const store = sessionStore.get(sessionId)!;
  for (const file of testFiles) {
    store.add(file);
  }
}

/**
 * Verifies that no implementation changes exist without a prior test commit
 * registered in the current session. If implementation files are found in the
 * diff without prior test commits, blocks the validation with a Violation error.
 * (Req 3.3)
 */
export async function enforceTestFirstSequence(
  args: { git_diff: string },
  ruleset: Ruleset
): Promise<AuditReport> {
  const { git_diff } = args;
  const violations: Violation[] = [];

  const inspector = new GitInspector();
  const productionFiles = inspector.getDiff(git_diff);

  // Use global session for now (session_id could be extracted from context)
  const sessionId = "default";
  const registeredTests = sessionStore.get(sessionId) ?? new Set<string>();

  for (const prodFile of productionFiles) {
    // Check if any test for this production file was registered in the session
    const hasTestFirst = hasRegisteredTest(prodFile, registeredTests, ruleset);

    if (!hasTestFirst) {
      violations.push({
        filePath: prodFile,
        line: 0,
        description: `Implementation change detected in '${prodFile}' without a prior test commit in the session. TDD requires tests to be written first.`,
        severity: "error",
        rule: "TEST_FIRST_VIOLATION",
      });
    }
  }

  return buildReport({
    agentName: "tdd-strict",
    analyzedPath: "git_diff",
    violations,
  });
}

/**
 * Checks if a production file has a corresponding test file registered in the session store.
 */
function hasRegisteredTest(
  prodFile: string,
  registeredTests: Set<string>,
  ruleset: Ruleset
): boolean {
  // Check each test convention
  for (const convention of ruleset.testConventions) {
    const suffix = extractSuffix(convention.pattern);
    const expectedTestFile = prodFile.replace(/\.ts$/, suffix);

    if (registeredTests.has(expectedTestFile)) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts the test file suffix from a glob pattern.
 */
function extractSuffix(pattern: string): string {
  const match = pattern.match(/\*([._-]\w+\.\w+)$/);
  if (match) return match[1];
  if (pattern.includes(".spec.")) return ".spec.ts";
  if (pattern.includes(".test.")) return ".test.ts";
  return ".test.ts";
}
