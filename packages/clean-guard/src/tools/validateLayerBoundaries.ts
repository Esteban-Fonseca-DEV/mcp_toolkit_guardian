import { AuditReport, Ruleset, buildReport } from "@guardian/shared";

export async function validateLayerBoundaries(
  args: { source_layer: string; target_layer: string },
  ruleset: Ruleset
): Promise<AuditReport> {
  const { source_layer, target_layer } = args;

  // Find the source layer definition in the ruleset
  const sourceLayerDef = ruleset.layers.find(l => l.name === source_layer);

  if (!sourceLayerDef) {
    return buildReport({
      agentName: "clean-guard",
      analyzedPath: `${source_layer} -> ${target_layer}`,
      violations: [{
        filePath: "",
        line: 0,
        description: `Layer '${source_layer}' is not defined in the Ruleset`,
        severity: "error",
        rule: "UNKNOWN_LAYER"
      }]
    });
  }

  // Check if the dependency is allowed
  const isAllowed = sourceLayerDef.allowedDependencies.includes(target_layer);

  if (isAllowed) {
    return buildReport({
      agentName: "clean-guard",
      analyzedPath: `${source_layer} -> ${target_layer}`,
      violations: []
    });
  }

  // Dependency is NOT allowed — register a Violation with severity error
  return buildReport({
    agentName: "clean-guard",
    analyzedPath: `${source_layer} -> ${target_layer}`,
    violations: [{
      filePath: "",
      line: 0,
      description: `Layer '${source_layer}' is not allowed to depend on layer '${target_layer}'. Allowed dependencies: [${sourceLayerDef.allowedDependencies.join(", ")}]`,
      severity: "error",
      rule: "LAYER_BOUNDARY_VIOLATION"
    }]
  });
}
