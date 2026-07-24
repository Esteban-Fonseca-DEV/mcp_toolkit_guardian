import { IAgent, ToolDefinition, Ruleset, AuditReport } from "@guardian/shared";
import { analyzeAstImports } from "./tools/analyzeAstImports";
import { validateLayerBoundaries } from "./tools/validateLayerBoundaries";
import { generateDependencyGraph } from "./tools/generateDependencyGraph";
import { IAstCache } from "./AstParser";

export class CleanGuardAgent implements IAgent {
  readonly name = "clean-guard";
  readonly version = "1.0.0";
  private ruleset!: Ruleset;
  private cache?: IAstCache;

  /**
   * Creates a CleanGuardAgent instance.
   * @param cache - Optional AST cache instance for reusing parsed ASTs (Req 3.2, 3.3).
   *               If not provided, files are parsed fresh on every invocation.
   */
  constructor(cache?: IAstCache) {
    this.cache = cache;
  }

  initialize(ruleset: Ruleset): void {
    this.ruleset = ruleset;
  }

  readonly tools: ToolDefinition[] = [
    {
      name: "analyze_ast_imports",
      description: "Parsea el AST de un archivo TypeScript y retorna todas sus sentencias import.",
      schema: {
        type: "object",
        properties: { filepath: { type: "string" } },
        required: ["filepath"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        analyzeAstImports(args as { filepath: string }, ruleset, this.cache),
    },
    {
      name: "validate_layer_boundaries",
      description: "Verifica si una dependencia entre capas está permitida por la Ruleset.",
      schema: {
        type: "object",
        properties: {
          source_layer: { type: "string" },
          target_layer: { type: "string" },
        },
        required: ["source_layer", "target_layer"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        validateLayerBoundaries(
          args as { source_layer: string; target_layer: string },
          ruleset
        ),
    },
    {
      name: "generate_dependency_graph",
      description: "Analiza todos los archivos TypeScript de un directorio y retorna el grafo de dependencias.",
      schema: {
        type: "object",
        properties: { directory: { type: "string" } },
        required: ["directory"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        generateDependencyGraph(args as { directory: string }, ruleset, this.cache),
    },
  ];
}
