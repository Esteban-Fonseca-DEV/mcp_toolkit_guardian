import { readFile } from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import { AuditReport, Ruleset, Violation, buildReport } from "@guardian/shared";
import { DEFAULT_SECRET_PATTERNS, SecretPattern } from "../patterns";

/**
 * Checks if a file is binary by looking for null bytes in the first 512 characters.
 */
function isBinaryContent(content: string): boolean {
  const sample = content.slice(0, 512);
  return sample.includes("\0");
}

export async function auditSecuritySecrets(
  args: { directory: string },
  ruleset: Ruleset
): Promise<AuditReport> {
  const { directory } = args;
  const violations: Violation[] = [];
  const excludePaths = ruleset.excludePaths ?? [];

  // Build glob ignore patterns
  const ignorePatterns = excludePaths.map((p) => `**/${p}/**`);

  let files: string[];
  try {
    files = await glob("**/*", {
      cwd: directory,
      absolute: true,
      nodir: true,
      ignore: ignorePatterns,
    });
  } catch (err) {
    return buildReport({
      agentName: "security-guard",
      analyzedPath: directory,
      violations: [
        {
          filePath: directory,
          line: 0,
          description: `Cannot scan directory: ${(err as Error).message}`,
          severity: "warning",
          rule: "DIRECTORY_SCAN_ERROR",
        },
      ],
    });
  }

  const patterns: SecretPattern[] = DEFAULT_SECRET_PATTERNS;

  for (const file of files) {
    let content: string;
    try {
      content = await readFile(file, "utf-8");
    } catch {
      // Skip files that cannot be read (permissions, etc.)
      continue;
    }

    // Skip binary files
    if (isBinaryContent(content)) {
      continue;
    }

    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const secretPattern of patterns) {
        if (secretPattern.pattern.test(line)) {
          const relativePath = path.relative(directory, file).replace(/\\/g, "/");
          violations.push({
            filePath: relativePath,
            line: i + 1,
            description: `Potential ${secretPattern.description} detected (${secretPattern.name}).`,
            severity: "error",
            rule: `SECRET_EXPOSED_${secretPattern.name}`,
          });
        }
      }
    }
  }

  return buildReport({
    agentName: "security-guard",
    analyzedPath: directory,
    violations,
  });
}
