import { IAgent, ToolDefinition, Ruleset, AuditReport, buildReport } from "@guardian/shared";
import { Orchestrator } from "./Orchestrator";
import { parseSemanticNamingConfig, SemanticNamingConfig } from "./config";

/**
 * SemanticNamingAgent — 12th agent of the Guardian MCP Toolkit.
 *
 * Implements IAgent and exposes the `audit_semantic_naming` tool.
 * Combines Level 1 (local syntactic) and Level 2 (Bedrock semantic) analysis
 * to detect naming convention violations across Go, Python, TypeScript, and C#.
 */
export class SemanticNamingAgent implements IAgent {
  readonly name = "semantic-naming-guard";
  readonly version = "1.0.0";
  private config: SemanticNamingConfig = parseSemanticNamingConfig({});

  initialize(ruleset: Ruleset): void {
    const rawConfig = (ruleset as any).semantic_naming ?? {};
    this.config = parseSemanticNamingConfig(rawConfig);
  }

  readonly tools: ToolDefinition[] = [
    {
      name: "audit_semantic_naming",
      description: "Analiza nombrado semántico y sintáctico de código fuente para detectar violaciones de naming conventions.",
      schema: {
        type: "object",
        properties: {
          filepath: { type: "string", description: "Ruta a un archivo individual" },
          directory: { type: "string", description: "Ruta a un directorio para escaneo recursivo" },
        },
      },
      handler: async (args: unknown, _ruleset: Ruleset): Promise<AuditReport> => {
        const { filepath, directory } = args as { filepath?: string; directory?: string };
        const analyzedPath = filepath ?? directory ?? "unknown";

        if (!this.config.enabled) {
          return buildReport({ agentName: this.name, analyzedPath, violations: [] });
        }

        const orchestrator = new Orchestrator(this.config);
        return orchestrator.run(filepath, directory);
      },
    },
  ];
}
