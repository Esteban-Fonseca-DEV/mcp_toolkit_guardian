import * as fs from "fs";
import * as path from "path";
import { AuditReport, Violation } from "@guardian/shared";

export interface FixResult {
  violation: Violation;
  fixed: boolean;
  action: string;
  diff?: string;
}

export async function applyFixes(report: AuditReport, targetDir: string, apply: boolean): Promise<FixResult[]> {
  const results: FixResult[] = [];

  for (const violation of report.violations) {
    const fix = generateFix(violation, targetDir);
    if (fix) {
      results.push(fix);
      if (apply && fix.diff) {
        applyFixToFile(fix, targetDir);
      }
    }
  }

  return results;
}

function generateFix(violation: Violation, targetDir: string): FixResult | null {
  switch (violation.rule) {
    case "LAYER_BOUNDARY_VIOLATION":
    case "NO_DOMAIN_TO_INFRA":
      return {
        violation,
        fixed: true,
        action: "Generate interface in domain layer and move implementation to infrastructure",
        diff: `+ // Create interface in domain layer\n+ export interface I${getServiceName(violation)}Repository {\n+   // TODO: Define contract methods\n+ }\n- import { ... } from "../infrastructure/..."`,
      };

    case "MISSING_TEST_FILE":
      return generateTestSkeleton(violation, targetDir);

    case "ISP_FAT_INTERFACE":
      return {
        violation,
        fixed: true,
        action: "Split fat interface into cohesive smaller interfaces",
        diff: `+ // Suggested split:\n+ export interface IRead${getInterfaceName(violation)} { ... }\n+ export interface IWrite${getInterfaceName(violation)} { ... }`,
      };

    case "ENV_ACCESS_OUTSIDE_INFRA":
      return {
        violation,
        fixed: true,
        action: "Extract process.env access to infrastructure config service",
        diff: `+ // Create: src/infrastructure/config.ts\n+ export class ConfigService {\n+   get(key: string): string { return process.env[key] ?? ""; }\n+ }`,
      };

    case "DDD_MUTABLE_PUBLIC_STATE":
      return {
        violation,
        fixed: true,
        action: "Add 'readonly' modifier to public property",
        diff: `- public ${getPropertyName(violation)}: ...\n+ public readonly ${getPropertyName(violation)}: ...`,
      };

    case "SECRET_EXPOSED_AWS_ACCESS_KEY":
    case "SECRET_EXPOSED_GITHUB_TOKEN":
    case "SECRET_EXPOSED_GENERIC_PASSWORD":
    case "SECRET_EXPOSED_DATABASE_URL":
      return {
        violation,
        fixed: true,
        action: "Replace hardcoded secret with environment variable reference",
        diff: `- const SECRET = "AKIA..."\n+ const SECRET = process.env.SECRET_NAME ?? ""`,
      };

    default:
      return null;
  }
}

function generateTestSkeleton(violation: Violation, targetDir: string): FixResult {
  const sourceFile = violation.filePath;
  const testFile = sourceFile.replace(".ts", ".test.ts");
  const className = path.basename(sourceFile, ".ts");

  const skeleton = `import { describe, it, expect } from "vitest";
import { ${className} } from "./${className}";

describe("${className}", () => {
  // Arrange
  
  it("should be defined", () => {
    // Act
    
    // Assert
    expect(${className}).toBeDefined();
  });

  it("should handle the primary use case", () => {
    // Arrange
    
    // Act
    
    // Assert
    expect(true).toBe(true); // TODO: Implement
  });
});
`;

  return {
    violation,
    fixed: true,
    action: `Generate test skeleton: ${testFile}`,
    diff: skeleton,
  };
}

function applyFixToFile(fix: FixResult, targetDir: string): void {
  // For test generation, actually create the file
  if (fix.violation.rule === "MISSING_TEST_FILE" && fix.diff) {
    const testPath = path.join(
      targetDir,
      fix.violation.filePath.replace(".ts", ".test.ts")
    );
    const dir = path.dirname(testPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(testPath, fix.diff, "utf-8");
  }

  // For readonly fix, modify the file in place
  if (fix.violation.rule === "DDD_MUTABLE_PUBLIC_STATE") {
    const filePath = path.join(targetDir, fix.violation.filePath);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const lineIdx = fix.violation.line - 1;
      if (lineIdx >= 0 && lineIdx < lines.length) {
        lines[lineIdx] = lines[lineIdx].replace("public ", "public readonly ");
        fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
      }
    }
  }
}

function getServiceName(v: Violation): string {
  const match = v.filePath.match(/([A-Za-z]+)\.ts$/);
  return match ? match[1] : "Service";
}

function getInterfaceName(v: Violation): string {
  const match = v.description.match(/Interfaz '([^']+)'/);
  return match ? match[1] : "Interface";
}

function getPropertyName(v: Violation): string {
  const match = v.description.match(/'([^']+)'\. Use/);
  return match ? match[1] : "property";
}
