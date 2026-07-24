import * as ts from "typescript";
import { readFile } from "fs/promises";
import { readdir } from "fs/promises";
import { join, relative } from "path";
import { minimatch } from "minimatch";
import { Violation, Ruleset, Severity, AuditReport, buildReport } from "@guardian/shared";

/**
 * Custom rule definition as specified in .guardian.json "rules" section.
 */
export interface CustomRule {
  id: string;
  layer: string;        // "domain" | "application" | "all" etc.
  severity: string;     // "error" | "warning"
  message: string;
  type?: "forbidden_imports" | "max_lines" | "required_patterns";
  // Type-specific fields
  forbidden_imports?: string[];
  max_lines?: number;
  required_patterns?: string[];
}

/**
 * Validates a custom rule definition for required fields and correct types.
 * Returns { valid: true } if valid, or { valid: false, error: string } if invalid.
 */
export function validateCustomRule(rule: unknown): { valid: boolean; error?: string } {
  if (!rule || typeof rule !== "object") {
    return { valid: false, error: "Rule must be an object" };
  }
  const r = rule as Record<string, unknown>;

  if (!r.id || typeof r.id !== "string") {
    return { valid: false, error: "Rule missing required field 'id'" };
  }

  if (!r.severity || !["error", "warning"].includes(r.severity as string)) {
    return { valid: false, error: `Rule '${r.id}': invalid severity '${r.severity}'. Must be: error or warning` };
  }

  if (!r.message || typeof r.message !== "string") {
    return { valid: false, error: `Rule '${r.id}': missing required field 'message'` };
  }

  // Determine rule type either from explicit `type` field or inferred from condition fields
  const explicitType = r.type as string | undefined;
  const validTypes = ["forbidden_imports", "max_lines", "required_patterns"];

  if (explicitType && !validTypes.includes(explicitType)) {
    return { valid: false, error: `Rule '${r.id}': invalid type '${explicitType}'. Must be: forbidden_imports, max_lines, or required_patterns` };
  }

  // Determine effective type
  const hasImports = Array.isArray(r.forbidden_imports);
  const hasMaxLines = typeof r.max_lines === "number";
  const hasPatterns = Array.isArray(r.required_patterns);

  const inferredType = explicitType
    ?? (hasImports ? "forbidden_imports" : hasMaxLines ? "max_lines" : hasPatterns ? "required_patterns" : undefined);

  if (!inferredType) {
    return { valid: false, error: `Rule '${r.id}': must define one of: forbidden_imports, max_lines, or required_patterns` };
  }

  // Type-specific validation
  if (inferredType === "forbidden_imports") {
    if (!Array.isArray(r.forbidden_imports) || r.forbidden_imports.length === 0) {
      return { valid: false, error: `Rule '${r.id}': forbidden_imports must be a non-empty array` };
    }
  }
  if (inferredType === "max_lines") {
    if (typeof r.max_lines !== "number" || r.max_lines <= 0) {
      return { valid: false, error: `Rule '${r.id}': max_lines must be a positive number` };
    }
  }
  if (inferredType === "required_patterns") {
    if (!Array.isArray(r.required_patterns) || r.required_patterns.length === 0) {
      return { valid: false, error: `Rule '${r.id}': required_patterns must be a non-empty array` };
    }
    // Validate regex patterns
    for (const pattern of r.required_patterns as string[]) {
      try {
        new RegExp(pattern);
      } catch {
        return { valid: false, error: `Rule '${r.id}': invalid regex pattern '${pattern}'` };
      }
    }
  }

  return { valid: true };
}

/**
 * Evaluate all custom rules against files in a directory.
 * Validates all rules first. If any rule is invalid, returns an AuditReport with error.
 */
export async function evaluateCustomRules(
  directory: string,
  rules: CustomRule[],
  ruleset: Ruleset
): Promise<AuditReport> {
  // Validate all rules first
  for (const rule of rules) {
    const validation = validateCustomRule(rule);
    if (!validation.valid) {
      return buildReport({
        agentName: "custom-rules",
        analyzedPath: directory,
        status: "error",
        violations: [],
        error: validation.error,
      });
    }
  }

  const violations: Violation[] = [];

  for (const rule of rules) {
    const ruleViolations = await evaluateRule(directory, rule, ruleset);
    violations.push(...ruleViolations);
  }

  return buildReport({
    agentName: "custom-rules",
    analyzedPath: directory,
    violations,
  });
}

async function evaluateRule(
  directory: string,
  rule: CustomRule,
  ruleset: Ruleset
): Promise<Violation[]> {
  if (rule.forbidden_imports) {
    return evaluateForbiddenImports(directory, rule, ruleset);
  }
  if (rule.max_lines !== undefined) {
    return evaluateMaxLines(directory, rule, ruleset);
  }
  if (rule.required_patterns) {
    return evaluateRequiredPatterns(directory, rule, ruleset);
  }
  return [];
}

async function getFilesForLayer(
  directory: string,
  layerName: string,
  ruleset: Ruleset
): Promise<string[]> {
  const files: string[] = [];
  const layerDef = ruleset.layers.find(l => l.name === layerName);

  if (!layerDef && layerName !== "all") return files;

  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = relative(directory, full).replace(/\\/g, "/");

      if (ruleset.excludePaths.some(p => minimatch(rel, p) || minimatch(entry.name, p))) continue;

      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        if (layerName === "all") {
          files.push(full);
        } else if (layerDef) {
          if (layerDef.paths.some(p => minimatch(rel, p))) {
            files.push(full);
          }
        }
      }
    }
  }

  await walk(directory);
  return files;
}

async function evaluateForbiddenImports(
  directory: string,
  rule: CustomRule,
  ruleset: Ruleset
): Promise<Violation[]> {
  const violations: Violation[] = [];
  const files = await getFilesForLayer(directory, rule.layer, ruleset);

  for (const file of files) {
    const content = await readFile(file, "utf-8");
    const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

    ts.forEachChild(sf, (node) => {
      if (ts.isImportDeclaration(node)) {
        const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
        for (const forbidden of rule.forbidden_imports!) {
          if (specifier.includes(forbidden) || minimatch(specifier, forbidden)) {
            const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
            violations.push({
              filePath: relative(directory, file).replace(/\\/g, "/"),
              line,
              description: rule.message,
              severity: rule.severity as Severity,
              rule: rule.id,
            });
          }
        }
      }
    });
  }

  return violations;
}

async function evaluateMaxLines(
  directory: string,
  rule: CustomRule,
  ruleset: Ruleset
): Promise<Violation[]> {
  const violations: Violation[] = [];
  const files = await getFilesForLayer(directory, rule.layer, ruleset);

  for (const file of files) {
    const content = await readFile(file, "utf-8");
    const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

    function visit(node: ts.Node) {
      if (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) {
        const startLine = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
        const endLine = sf.getLineAndCharacterOfPosition(node.getEnd()).line;
        const lineCount = endLine - startLine + 1;

        if (lineCount > rule.max_lines!) {
          const name = node.name?.getText(sf) ?? "<anonymous>";
          violations.push({
            filePath: relative(directory, file).replace(/\\/g, "/"),
            line: startLine + 1,
            description: `${rule.message} (${name}: ${lineCount} lines, max: ${rule.max_lines})`,
            severity: rule.severity as Severity,
            rule: rule.id,
          });
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sf);
  }

  return violations;
}

async function evaluateRequiredPatterns(
  directory: string,
  rule: CustomRule,
  ruleset: Ruleset
): Promise<Violation[]> {
  const violations: Violation[] = [];
  const files = await getFilesForLayer(directory, rule.layer, ruleset);

  for (const file of files) {
    const content = await readFile(file, "utf-8");

    for (const pattern of rule.required_patterns!) {
      try {
        const regex = new RegExp(pattern);
        if (!regex.test(content)) {
          violations.push({
            filePath: relative(directory, file).replace(/\\/g, "/"),
            line: 1,
            description: `${rule.message} (required pattern not found: ${pattern})`,
            severity: rule.severity as Severity,
            rule: rule.id,
          });
        }
      } catch {
        // Invalid regex is caught by validateCustomRule upstream
      }
    }
  }

  return violations;
}
