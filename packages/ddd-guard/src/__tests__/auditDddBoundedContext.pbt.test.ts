import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { writeFile, mkdir, rm } from "fs/promises";
import * as path from "path";
import { auditDddBoundedContext } from "../tools/auditDddBoundedContext";
import { Ruleset } from "@guardian/shared";

/**
 * Property 18: Detección correcta de imports cross-context
 * Generate bounded context configs. Create imports between contexts.
 * Verify violations only for cross-context imports.
 * **Validates: Requirements 10.3**
 */
describe("Property 18: Fronteras de bounded context", () => {
  const BASE_DIR = path.resolve(__dirname, "__fixtures_bc_pbt__");

  it("raises violations only for cross-context imports", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }), // cross-context imports (violations)
        fc.integer({ min: 0, max: 3 }), // intra-context imports (no violations)
        fc.integer({ min: 0, max: 99999 }), // unique run id
        async (numCrossImports, numIntraImports, seed) => {
          const runId = `r${seed}_${Date.now()}`;
          const runDir = path.join(BASE_DIR, runId);

          try {
            // Two bounded contexts: "sales" and "billing"
            const salesDir = path.join(runDir, "sales");
            const billingDir = path.join(runDir, "billing");
            await mkdir(salesDir, { recursive: true });
            await mkdir(billingDir, { recursive: true });

            // Create target files in billing context
            await writeFile(
              path.join(billingDir, "Invoice.ts"),
              `export class Invoice {}\n`
            );

            // Create target files in sales context (for intra-context imports)
            await writeFile(
              path.join(salesDir, "Product.ts"),
              `export class Product {}\n`
            );

            // Create cross-context importing files in sales
            for (let i = 0; i < numCrossImports; i++) {
              await writeFile(
                path.join(salesDir, `CrossImporter${i}.ts`),
                `import { Invoice } from '../billing/Invoice';\nexport class CrossImporter${i} {}\n`
              );
            }

            // Create intra-context importing files in sales
            for (let i = 0; i < numIntraImports; i++) {
              await writeFile(
                path.join(salesDir, `IntraImporter${i}.ts`),
                `import { Product } from './Product';\nexport class IntraImporter${i} {}\n`
              );
            }

            const ruleset: Ruleset = {
              version: "1.0.0",
              executionMode: "local",
              layers: [],
              testConventions: [],
              excludePaths: [],
              ddd: {
                boundedContexts: {
                  sales: ["sales/**"],
                  billing: ["billing/**"],
                },
              },
            };

            const report = await auditDddBoundedContext(
              { directory: runDir },
              ruleset
            );

            // Only cross-context imports should be violations
            expect(report.violations).toHaveLength(numCrossImports);

            for (const v of report.violations) {
              expect(v.rule).toBe("DDD_CROSS_CONTEXT_IMPORT");
              expect(v.severity).toBe("error");
              expect(v.description).toContain("sales");
              expect(v.description).toContain("billing");
            }

            if (numCrossImports > 0) {
              expect(report.status).toBe("failed");
            } else {
              expect(report.status).toBe("passed");
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
