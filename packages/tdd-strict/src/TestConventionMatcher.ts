import { TestConvention } from "@guardian/shared";
import { basename, dirname, extname, join } from "path";

/**
 * Given a source file path and a list of test conventions,
 * returns the expected test file name according to the first matching convention.
 *
 * For example, given "src/services/UserService.ts" and convention "**\/*.test.ts",
 * returns "src/services/UserService.test.ts".
 */
export function findExpectedTestFile(
  sourceFile: string,
  conventions: TestConvention[]
): string {
  if (conventions.length === 0) {
    // Default to .test.ts if no conventions provided
    return replaceExtensionWithSuffix(sourceFile, ".test.ts");
  }

  // Use the first convention to determine the test file suffix
  const convention = conventions[0];
  const suffix = extractSuffix(convention.pattern);

  return replaceExtensionWithSuffix(sourceFile, suffix);
}

/**
 * Extracts the test file suffix from a glob pattern.
 * Examples:
 *   "**\/*.test.ts" → ".test.ts"
 *   "**\/*.spec.ts" → ".spec.ts"
 *   "**\/*_test.ts" → "_test.ts"
 */
function extractSuffix(pattern: string): string {
  // Match patterns like *.test.ts, *.spec.ts, *_test.ts
  const match = pattern.match(/\*([._-]\w+\.\w+)$/);
  if (match) {
    return match[1];
  }

  // Fallback: try to extract from common patterns
  if (pattern.includes(".spec.")) return ".spec.ts";
  if (pattern.includes(".test.")) return ".test.ts";
  if (pattern.includes("_test.")) return "_test.ts";

  return ".test.ts";
}

/**
 * Replaces the file extension with the given suffix.
 * "src/foo/Bar.ts" + ".test.ts" → "src/foo/Bar.test.ts"
 */
function replaceExtensionWithSuffix(filePath: string, suffix: string): string {
  const dir = dirname(filePath);
  const ext = extname(filePath);
  const name = basename(filePath, ext);
  return join(dir, `${name}${suffix}`).replace(/\\/g, "/");
}
