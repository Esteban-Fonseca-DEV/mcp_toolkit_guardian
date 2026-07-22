import { Ruleset } from "@guardian/shared";
import { minimatch } from "minimatch";

export interface RoutingResult {
  agents: string[];
  reason: string;
}

export function determineRelevantAgents(
  filepath: string,
  ruleset: Ruleset
): RoutingResult {
  const normalized = filepath.replace(/\\/g, "/");

  // Determine layer
  let layer: string | null = null;
  for (const l of ruleset.layers) {
    for (const pattern of l.paths) {
      if (minimatch(normalized, pattern)) {
        layer = l.name;
        break;
      }
    }
    if (layer) break;
  }

  // Base agents that always apply
  const agents = new Set<string>(["security-guard", "concurrency-guard"]);

  switch (layer) {
    case "domain":
      agents.add("clean-guard");
      agents.add("ddd-guard");
      agents.add("solid-copilot");
      break;
    case "application":
      agents.add("clean-guard");
      agents.add("ddd-guard");
      agents.add("tdd-strict");
      agents.add("solid-copilot");
      break;
    case "infrastructure":
      agents.add("clean-guard");
      break;
    case "presentation":
      agents.add("clean-guard");
      break;
    default:
      // Unknown layer — apply all
      agents.add("clean-guard");
      agents.add("ddd-guard");
      agents.add("tdd-strict");
      agents.add("solid-copilot");
      break;
  }

  return {
    agents: Array.from(agents),
    reason: layer ? `File in '${layer}' layer` : "File in unknown layer (all agents)",
  };
}
