import { Violation } from "@guardian/shared";
import { LanguageAnalyzer } from "../engines/Level1Engine";
import { SemanticNamingConfig } from "../config";

/**
 * CSharpAnalyzer — Detects C# naming anti-patterns.
 *
 * Rules enforced:
 * - NAMING_TS_INTERFACE_PREFIX: Interfaces should not use "I" prefix followed by uppercase
 *   (only enforced when strict_boolean_predicates is enabled in config)
 */
export class CSharpAnalyzer implements LanguageAnalyzer {
  analyze(filePath: string, content: string, config: SemanticNamingConfig): Violation[] {
    // Only execute if strict_boolean_predicates is enabled
    if (!config.strict_boolean_predicates) return [];

    const violations: Violation[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect interface with "I" prefix followed by uppercase letter
      const interfaceMatch = line.match(/\binterface\s+(I[A-Z]\w*)/);
      if (interfaceMatch) {
        const name = interfaceMatch[1];
        violations.push({
          filePath,
          line: i + 1,
          description: `Interface "${name}" uses "I" prefix: prefer role-based names`,
          severity: "error",
          rule: "NAMING_TS_INTERFACE_PREFIX",
        });
      }
    }

    return violations;
  }
}
