import { Violation } from "@guardian/shared";
import { LanguageAnalyzer } from "../engines/Level1Engine";
import { SemanticNamingConfig } from "../config";

/**
 * GoAnalyzer — Detects Go naming convention violations.
 *
 * Rules enforced:
 * - NAMING_GO_INTERFACE_SUFFIX: Single-method interfaces must end in "-er"
 * - NAMING_GO_INTERFACE_SUFFIX: Exported identifiers must not contain underscores (mixedCaps)
 */
export class GoAnalyzer implements LanguageAnalyzer {
  analyze(filePath: string, content: string, _config: SemanticNamingConfig): Violation[] {
    const violations: Violation[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect single-method interfaces without "-er" suffix
      const interfaceMatch = line.match(/^type\s+(\w+)\s+interface\s*\{/);
      if (interfaceMatch) {
        const name = interfaceMatch[1];
        const methodCount = this.countInterfaceMethods(lines, i);
        if (methodCount === 1 && !name.endsWith("er")) {
          violations.push({
            filePath,
            line: i + 1,
            description: `Interface "${name}" has a single method: should end with "-er" suffix (e.g., ${name}er)`,
            severity: "error",
            rule: "NAMING_GO_INTERFACE_SUFFIX",
          });
        }
      }

      // Detect exported identifiers (functions) with underscore
      const funcMatch = line.match(/^func\s+(?:\(\w+\s+\*?\w+\)\s+)?([A-Z]\w*)\s*\(/);
      if (funcMatch) {
        const name = funcMatch[1];
        if (name.includes("_")) {
          violations.push({
            filePath,
            line: i + 1,
            description: `Exported identifier "${name}" uses underscore: Go convention is mixedCaps`,
            severity: "error",
            rule: "NAMING_GO_INTERFACE_SUFFIX",
          });
        }
      }
    }

    return violations;
  }

  /**
   * Counts the number of methods inside an interface block starting at startIdx.
   */
  private countInterfaceMethods(lines: string[], startIdx: number): number {
    let braceCount = 0;
    let methodCount = 0;

    for (let i = startIdx; i < lines.length; i++) {
      if (lines[i].includes("{")) braceCount++;
      if (lines[i].includes("}")) braceCount--;

      // Count methods: lines inside braces that look like method signatures
      if (braceCount > 0 && i > startIdx && lines[i].match(/^\s+\w+\s*\(/)) {
        methodCount++;
      }

      if (braceCount === 0 && i > startIdx) break;
    }

    return methodCount;
  }
}
