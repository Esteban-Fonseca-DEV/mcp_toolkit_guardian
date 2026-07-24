import { Violation } from "@guardian/shared";
import { LanguageAnalyzer } from "../engines/Level1Engine";
import { SemanticNamingConfig } from "../config";

const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;

/**
 * PythonAnalyzer — Detects Python PEP 8 naming convention violations.
 *
 * Rules enforced:
 * - NAMING_PYTHON_CASE: Functions and variables must use snake_case
 * - NAMING_PYTHON_CASE: Classes must use PascalCase
 * - Excludes dunder methods (prefix `__`) from validation
 */
export class PythonAnalyzer implements LanguageAnalyzer {
  analyze(filePath: string, content: string, _config: SemanticNamingConfig): Violation[] {
    const violations: Violation[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Functions must use snake_case
      const funcMatch = line.match(/^def\s+(\w+)\s*\(/);
      if (funcMatch) {
        const name = funcMatch[1];
        // Exclude dunder methods
        if (!name.startsWith("__") && !SNAKE_CASE.test(name)) {
          violations.push({
            filePath,
            line: i + 1,
            description: `Function "${name}" does not use snake_case (PEP 8)`,
            severity: "error",
            rule: "NAMING_PYTHON_CASE",
          });
        }
      }

      // Classes must use PascalCase
      const classMatch = line.match(/^class\s+(\w+)/);
      if (classMatch) {
        const name = classMatch[1];
        if (!PASCAL_CASE.test(name)) {
          violations.push({
            filePath,
            line: i + 1,
            description: `Class "${name}" does not use PascalCase (PEP 8)`,
            severity: "error",
            rule: "NAMING_PYTHON_CASE",
          });
        }
      }

      // Variables (simple assignment at top level) must use snake_case
      const varMatch = line.match(/^(\w+)\s*=/);
      if (varMatch && !line.match(/^(class|def|import|from|if|for|while|return)/)) {
        const name = varMatch[1];
        // Exclude dunder names and PascalCase constants/classes
        if (!name.startsWith("__") && !SNAKE_CASE.test(name) && !PASCAL_CASE.test(name)) {
          violations.push({
            filePath,
            line: i + 1,
            description: `Variable "${name}" does not use snake_case (PEP 8)`,
            severity: "error",
            rule: "NAMING_PYTHON_CASE",
          });
        }
      }
    }

    return violations;
  }
}
