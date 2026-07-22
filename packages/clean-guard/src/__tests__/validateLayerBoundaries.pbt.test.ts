import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateLayerBoundaries } from "../tools/validateLayerBoundaries";
import { Ruleset, LayerRule } from "@guardian/shared";

/**
 * Properties 3 & 4: Totalidad y coherencia de validate_layer_boundaries
 * Prop 3: For any (source_layer, target_layer) pair with valid Ruleset, result is always
 * "allowed" or "Violation error" (never exception/empty).
 * Prop 4: Response is coherent with Ruleset.
 * **Validates: Requirements 2.2, 2.4, 2.5**
 */
describe("Properties 3 & 4: Totalidad y coherencia de validate_layer_boundaries", () => {
  const layerNameArb = fc.string({ minLength: 1, maxLength: 15 }).filter(
    (s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)
  );

  const layerRuleArb = (layerNames: string[]) =>
    fc.record({
      name: fc.constantFrom(...layerNames),
      paths: fc.array(fc.constant("src/**"), { minLength: 1, maxLength: 1 }),
      allowedDependencies: fc.subarray(layerNames),
    });

  // Generate a valid Ruleset with a fixed set of layer names
  const rulesetWithLayersArb = fc
    .array(layerNameArb, { minLength: 2, maxLength: 6 })
    .chain((names) => {
      // Ensure unique names
      const uniqueNames = [...new Set(names)];
      if (uniqueNames.length < 2) return fc.constant(null);

      return fc
        .array(
          fc.record({
            name: fc.constantFrom(...uniqueNames),
            paths: fc.constant([`src/**`]),
            allowedDependencies: fc.subarray(uniqueNames),
          }),
          { minLength: uniqueNames.length, maxLength: uniqueNames.length }
        )
        .map((layers) => {
          // Ensure each unique name appears exactly once
          const seen = new Set<string>();
          const dedupedLayers: LayerRule[] = [];
          for (const layer of layers) {
            if (!seen.has(layer.name)) {
              seen.add(layer.name);
              dedupedLayers.push(layer);
            }
          }
          // Fill missing names
          for (const name of uniqueNames) {
            if (!seen.has(name)) {
              dedupedLayers.push({ name, paths: ["src/**"], allowedDependencies: [] });
            }
          }
          const ruleset: Ruleset = {
            version: "1.0.0",
            executionMode: "local",
            layers: dedupedLayers,
            testConventions: [{ pattern: "**/*.test.ts" }],
            excludePaths: ["node_modules"],
          };
          return { ruleset, layerNames: uniqueNames };
        });
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  it("Prop 3: validateLayerBoundaries never throws and always returns a valid AuditReport", () => {
    return fc.assert(
      fc.asyncProperty(rulesetWithLayersArb, async ({ ruleset, layerNames }) => {
        // Pick two random layer names
        const sourceIdx = Math.floor(Math.random() * layerNames.length);
        const targetIdx = Math.floor(Math.random() * layerNames.length);
        const source_layer = layerNames[sourceIdx];
        const target_layer = layerNames[targetIdx];

        // Should never throw
        const report = await validateLayerBoundaries(
          { source_layer, target_layer },
          ruleset
        );

        // Must always return a valid report
        expect(report).toBeDefined();
        expect(report.status).toBeDefined();
        expect(["passed", "failed"]).toContain(report.status);
        expect(Array.isArray(report.violations)).toBe(true);
        expect(report.agentName).toBe("clean-guard");

        // Either passed (allowed) or failed with a violation error
        if (report.status === "passed") {
          expect(report.violations.length).toBe(0);
        } else {
          expect(report.violations.length).toBeGreaterThan(0);
          expect(report.violations[0].severity).toBe("error");
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it("Prop 4: response is coherent with Ruleset (allowed deps → passed, else → violation)", () => {
    return fc.assert(
      fc.asyncProperty(rulesetWithLayersArb, async ({ ruleset, layerNames }) => {
        const sourceIdx = Math.floor(Math.random() * layerNames.length);
        const targetIdx = Math.floor(Math.random() * layerNames.length);
        const source_layer = layerNames[sourceIdx];
        const target_layer = layerNames[targetIdx];

        const report = await validateLayerBoundaries(
          { source_layer, target_layer },
          ruleset
        );

        // Find the source layer in the ruleset
        const sourceLayerDef = ruleset.layers.find((l) => l.name === source_layer);

        if (!sourceLayerDef) {
          // Unknown layer should produce a violation
          expect(report.status).toBe("failed");
        } else {
          const isAllowed = sourceLayerDef.allowedDependencies.includes(target_layer);
          if (isAllowed) {
            expect(report.status).toBe("passed");
            expect(report.violations.length).toBe(0);
          } else {
            expect(report.status).toBe("failed");
            expect(report.violations.length).toBeGreaterThan(0);
            expect(report.violations[0].severity).toBe("error");
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
