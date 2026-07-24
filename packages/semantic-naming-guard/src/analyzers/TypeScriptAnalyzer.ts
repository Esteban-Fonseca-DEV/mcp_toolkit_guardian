import { Violation } from "@guardian/shared";
import { LanguageAnalyzer } from "../engines/Level1Engine";
import { SemanticNamingConfig } from "../config";

/**
 * TypeScriptAnalyzer — Detects TypeScript naming anti-patterns.
 *
 * Rules enforced:
 * - NAMING_TS_INTERFACE_PREFIX: Interfaces should not use "I" prefix followed by uppercase
 */
export class TypeScriptAnalyzer implements LanguageAnalyzer {
  analyze(filePath: string, content: string, _config: SemanticNamingConfig): Violation[] {
    const violations: Violation[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect interface with "I" prefix followed by uppercase letter
      const interfaceMatch = line.match(/\binterface\s+(I[A-Z]\w*)/);
      if (interfaceMatch) {
        const name = interfaceMatch[1];
        const suggestedName = name.slice(1); // Remove the "I" prefix
        violations.push({
          filePath,
          line: i + 1,
          description: `Interface "${name}" uses "I" prefix: prefer role-based names (e.g., "${suggestedName}")`,
          severity: "error",
          rule: "NAMING_TS_INTERFACE_PREFIX",
        });
      }
    }

    return violations;
  }
}
