import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { writeFile, mkdir, rm } from "fs/promises";
import * as path from "path";
import { auditDddAggregateAccess } from "../tools/auditDddAggregateAccess";
import { Ruleset } from "@guardian/shared";

/**
 * Property 17: Detección correcta de acceso directo a entidades internas
 * Generate aggregate configs with root/internals. Create files that import internals.
 * Verify violations are only raised for imports to internals from non-root files.
 * **Validates: Requirements 10.2**
 */
describe("Property 17: Acceso a internals del agregado", () => {
  const BASE_DIR = path.resolve(__dirname, "__fixtures_agg_pbt__");

  it("raises violations only for non-root imports to internals", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }), // number of internals
        fc.integer({ min: 1, max: 3 }), // number of external files importing internals
        fc.integer({ min: 0, max: 2 }), // number of external files NOT importing internals
        fc.integer({ min: 0, max: 99999 }), // unique run id
        async (numInternals, numViolators, numClean, seed) => {
          const runId = `r${seed}_${Date.now()}`;
          const runDir = path.join(BASE_DIR, runId);

          try {
            await mkdir(path.join(runDir, "domain"), { recursive: true });

            // Create root file
            const rootFile = "domain/OrderRoot.ts";
            const rootPath = path.join(runDir, rootFile);
            const internalImports = Array.from(
              { length: numInternals },
              (_, i) => `import { Internal${i} } from './Internal${i}';`
            ).join("\n");
            await writeFile(rootPath, `${internalImports}\nexport class OrderRoot {}\n`);

            // Create internal files
            const internalFiles: string[] = [];
            for (let i = 0; i < numInternals; i++) {
              const internalFile = `domain/Internal${i}.ts`;
              internalFiles.push(internalFile);
              await writeFile(
                path.join(runDir, internalFile),
                `export class Internal${i} {}\n`
              );
            }

            // Create violating external files (import from internals)
            let expectedViolations = 0;
            for (let i = 0; i < numViolators; i++) {
              const extFile = path.join(runDir, `domain/Violator${i}.ts`);
              // Each violator imports the first internal
              await writeFile(
                extFile,
                `import { Internal0 } from './Internal0';\nexport class Violator${i} {}\n`
              );
              expectedViolations += 1;
            }

            // Create clean external files (no import to internals)
            for (let i = 0; i < numClean; i++) {
              const cleanFile = path.join(runDir, `domain/CleanFile${i}.ts`);
              await writeFile(cleanFile, `export class CleanFile${i} {}\n`);
            }

            // Build ruleset with aggregate config
            const ruleset: Ruleset = {
              version: "1.0.0",
              executionMode: "local",
              layers: [],
              testConventions: [],
              excludePaths: [],
              ddd: {
                aggregates: {
                  Order: {
                    root: rootFile,
                    internals: internalFiles,
                  },
                },
              },
            };

            const report = await auditDddAggregateAccess(
              { directory: runDir },
              ruleset
            );

            // Root importing internals should NOT be a violation
            // Violators importing internals SHOULD be violations
            expect(report.violations).toHaveLength(expectedViolations);

            for (const v of report.violations) {
              expect(v.rule).toBe("DDD_DIRECT_INTERNAL_ACCESS");
              expect(v.severity).toBe("error");
            }
          } finally {
            await rm(runDir, { recursive: true, force: true }).catch(() => {});
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );

    // Final cleanup
    await rm(BASE_DIR, { recursive: true, force: true }).catch(() => {});
  });
});
