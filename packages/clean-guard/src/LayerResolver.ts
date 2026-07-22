import { minimatch } from "minimatch";
import { Ruleset } from "@guardian/shared";

/**
 * Resolves which architectural layer a file belongs to based on the Ruleset's layer definitions.
 * Returns the layer name if the file matches any layer's glob patterns, or null otherwise.
 */
export function resolveLayer(filePath: string, ruleset: Ruleset): string | null {
  // Normalize path separators to forward slashes for consistent glob matching
  const normalizedPath = filePath.replace(/\\/g, "/");

  for (const layer of ruleset.layers) {
    for (const pattern of layer.paths) {
      if (minimatch(normalizedPath, pattern)) {
        return layer.name;
      }
    }
  }

  return null;
}
