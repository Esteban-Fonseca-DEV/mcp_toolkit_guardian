import * as fs from "fs";
import * as path from "path";
import { AuditReport, Violation, Ruleset, buildReport } from "@guardian/shared";
import { resolvePatterns } from "../patterns";

/**
 * Recursively collects all files in a directory, respecting excludePaths.
 */
function collectFiles(directory: string, excludePaths: string[]): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(directory, fullPath).replace(/\\/g, "/");

      // Check exclusions
      const shouldExclude = excludePaths.some(
        (exc) => relativePath.startsWith(exc) || entry.name === exc
      );
      if (shouldExclude) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        // Skip binary files and common non-code files
        const ext = path.extname(entry.name).toLowerCase();
        const skipExtensions = [".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".pdf", ".zip", ".tar", ".gz"];
        if (!skipExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(directory);
  return files;
}

/**
 * Scans a directory for hardcoded secrets and credentials.
 * Returns an AuditReport with Violations for each detected secret.
 */
export async function auditSecuritySecrets(
  args: { directory: string },
  ruleset: Ruleset
): Promise<AuditReport> {
  const { directory } = args;

  if (!fs.existsSync(directory)) {
    return buildReport({
      agentName: "security-guard",
      analyzedPath: directory,
      status: "error",
      error: `Directory not found: ${directory}`,
    });
  }

  const stat = fs.statSync(directory);
  if (!stat.isDirectory()) {
    return buildReport({
      agentName: "security-guard",
      analyzedPath: directory,
      status: "error",
      error: `Path is not a directory: ${directory}`,
    });
  }

  const excludePaths = ruleset.excludePaths ?? ["node_modules", "dist", "coverage", ".git"];
  const patterns = resolvePatterns((ruleset as any).security?.customPatterns);
  const files = collectFiles(directory, excludePaths);
  const violations: Violation[] = [];

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comment lines (basic heuristic)
        const trimmed = line.trim();
        if (trimmed.startsWith("//") && !trimmed.includes("=") && !trimmed.includes(":")) continue;

        for (const pattern of patterns) {
          if (pattern.pattern.test(line)) {
            violations.push({
              filePath: path.relative(directory, filePath).replace(/\\/g, "/"),
              line: i + 1,
              description: `${pattern.description} (type: ${pattern.type})`,
              severity: "error",
              rule: `SECURITY_${pattern.type}`,
            });
            break; // One violation per line max
          }
        }
      }
    } catch {
      // Skip files that can't be read (binary, permissions, etc.)
      continue;
    }
  }

  return buildReport({
    agentName: "security-guard",
    analyzedPath: directory,
    violations,
  });
}
