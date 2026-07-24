import * as fs from "fs";
import * as path from "path";
import { AuditReport, Violation, Ruleset, buildReport } from "@guardian/shared";

/**
 * Detects direct access to `process.env` outside of the infrastructure layer.
 * Files in the infrastructure layer are allowed to access process.env.
 * Files in any other layer (domain, application, presentation) generate a warning.
 */
export async function auditSecurityEnvAccess(
  args: { filepath: string },
  ruleset: Ruleset
): Promise<AuditReport> {
  const { filepath } = args;

  if (!fs.existsSync(filepath)) {
    return buildReport({
      agentName: "security-guard",
      analyzedPath: filepath,
      status: "error",
      error: `File not found: ${filepath}`,
    });
  }

  const stat = fs.statSync(filepath);
  if (!stat.isFile()) {
    return buildReport({
      agentName: "security-guard",
      analyzedPath: filepath,
      status: "error",
      error: `Path is not a file: ${filepath}`,
    });
  }

  // Determine if file is in infrastructure layer
  const normalizedPath = filepath.replace(/\\/g, "/");
  const infrastructurePaths = ruleset.layers
    ?.filter((l) => l.name === "infrastructure")
    .flatMap((l) => l.paths) ?? ["src/infrastructure/**"];

  const isInfrastructure = infrastructurePaths.some((p) => {
    const basePath = p.replace("/**", "").replace("/*", "");
    return normalizedPath.includes(basePath);
  });

  // If in infrastructure, env access is allowed
  if (isInfrastructure) {
    return buildReport({
      agentName: "security-guard",
      analyzedPath: filepath,
      violations: [],
    });
  }

  // Scan for process.env access
  const content = fs.readFileSync(filepath, "utf-8");
  const lines = content.split("\n");
  const violations: Violation[] = [];

  const envAccessPattern = /process\.env(?:\[|\.)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

    if (envAccessPattern.test(line)) {
      violations.push({
        filePath: filepath,
        line: i + 1,
        description: `Direct access to process.env outside infrastructure layer. Extract environment configuration to an infrastructure service.`,
        severity: "warning",
        rule: "SECURITY_ENV_ACCESS_VIOLATION",
      });
    }
  }

  return buildReport({
    agentName: "security-guard",
    analyzedPath: filepath,
    violations,
  });
}
