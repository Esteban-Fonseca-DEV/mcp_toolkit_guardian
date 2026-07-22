import * as ts from "typescript";
import { readFile } from "fs/promises";
import { readdir } from "fs/promises";
import { join, relative } from "path";
import { minimatch } from "minimatch";
import { Violation, Ruleset, Severity } from "@guardian/shared";

export interface CustomRule {
  id: string;
  layer: string;        // "domain" | "application" | "all" etc.
  severity: string;     // "error" | "warning"
  message: string;
  forbidden_imports?: string[];
  max_lines?: number;
  required_patterns?: string[];
}

export async function evaluateCustomRules(
  directory: string,
  rules: CustomRule[],
  ruleset: Ruleset
): Promise<Violation[]> {
  const violations: Violation[] = [];

  for (const rule of rules) {
    const ruleViolations = await evaluateRule(directory, rule, ruleset);
    violations.push(...ruleViolations);
  }

  return violations;
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
    const entries = await readdir(dir, { withFileTypes: true });
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
    }
  }

  return violations;
}
