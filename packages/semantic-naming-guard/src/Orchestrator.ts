import * as fs from "fs";
import { AuditReport, Violation, buildReport } from "@guardian/shared";
import { Level1Engine } from "./engines/Level1Engine";
import { Level2Engine } from "./engines/Level2Engine";
import { SemanticNamingConfig } from "./config";
import { collectFiles } from "./utils/fileCollector";
import { GoAnalyzer } from "./analyzers/GoAnalyzer";
import { PythonAnalyzer } from "./analyzers/PythonAnalyzer";
import { TypeScriptAnalyzer } from "./analyzers/TypeScriptAnalyzer";
import { CSharpAnalyzer } from "./analyzers/CSharpAnalyzer";

/**
 * Orchestrator — Coordinates Level 1 and Level 2 engines.
 *
 * - Validates file/directory existence
 * - Always executes Level 1 (local syntactic validation)
 * - Executes Level 2 (Bedrock semantic) only when engine === "bedrock"
 * - Applies graceful fallback: if Level 2 fails, returns Level 1 + warning
 */
export class Orchestrator {
  private level1: Level1Engine;
  private level2: Level2Engine | null;

  constructor(private config: SemanticNamingConfig) {
    this.level1 = new Level1Engine(config);
    this.level1.registerAnalyzer("go", new GoAnalyzer());
    this.level1.registerAnalyzer("python", new PythonAnalyzer());
    this.level1.registerAnalyzer("typescript", new TypeScriptAnalyzer());
    this.level1.registerAnalyzer("csharp", new CSharpAnalyzer());
    this.level2 = config.engine === "bedrock" ? new Level2Engine(config) : null;
  }

  async run(filepath?: string, directory?: string): Promise<AuditReport> {
    const agentName = "semantic-naming-guard";
    const analyzedPath = filepath ?? directory ?? "unknown";

    // Validate existence
    if (filepath && !fs.existsSync(filepath)) {
      return buildReport({ agentName, analyzedPath, violations: [], status: "error", error: `Archivo no encontrado: ${filepath}` });
    }
    if (directory && !fs.existsSync(directory)) {
      return buildReport({ agentName, analyzedPath, violations: [], status: "error", error: `Directorio no encontrado: ${directory}` });
    }

    const files = filepath ? [filepath] : collectFiles(directory!);
    let allViolations: Violation[] = [];
    let warning: string | undefined;

    // Level 1 — always execute
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const l1Violations = this.level1.analyze(file, content);
        allViolations.push(...l1Violations);
      } catch { /* skip unreadable files */ }
    }

    // Level 2 — only if engine === "bedrock"
    if (this.level2) {
      try {
        for (const file of files) {
          const content = fs.readFileSync(file, "utf-8");
          const l2Violations = await this.level2.analyze(file, content);
          allViolations.push(...l2Violations);
        }
      } catch {
        warning = "Análisis semántico (Level 2) no disponible. Se retornan solo resultados locales.";
      }
    }

    const report = buildReport({ agentName, analyzedPath, violations: allViolations });
    if (warning) (report as any).warning = warning;
    return report;
  }
}
