import { describe, it, expect, afterEach } from "vitest";
import fc from "fast-check";
import { join } from "path";
import { writeFile, mkdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { generateDependencyGraph } from "../tools/generateDependencyGraph";
import { Ruleset } from "@guardian/shared";

/**
 * Property 5: Grafo de dependencias como round-trip
 * Generate directories with N files and M known dependencies.
 * Verify graph has N nodes and M edges.
 * **Validates: Requirements 2.3**
 */
describe("Property 5: Grafo de dependencias como round-trip", () => {
  const testDirs: string[] = [];

  afterEach(async () => {
    for (const dir of testDirs) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    testDirs.length = 0;
  });

  const ruleset: Ruleset = {
    version: "1.0.0",
    executionMode: "local",
    layers: [],
    testConventions: [],
    excludePaths: ["node_modules", "dist"],
  };

  it("graph contains exactly N nodes and M edges for N files with M dependencies", () => {
    return fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 8 }),
        (numFiles) => {
          return (async () => {
            const dir = join(tmpdir(), `dep-graph-pbt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            testDirs.push(dir);
            await mkdir(dir, { recursive: true });

            // Create N files, each importing from the previous one (creating a chain)
            // This gives us N nodes and (N-1) edges
            const fileNames: string[] = [];
            for (let i = 0; i < numFiles; i++) {
              fileNames.push(`file${i}.ts`);
            }

            let expectedEdges = 0;
            for (let i = 0; i < numFiles; i++) {
              let content = "";
              if (i > 0) {
                // Each file imports from the previous one
                content = `import { something } from './file${i - 1}';\n`;
                expectedEdges++;
              }
              content += `export const val${i} = ${i};\n`;
              await writeFile(join(dir, fileNames[i]), content);
            }

            const result = await generateDependencyGraph({ directory: dir }, ruleset);

            expect(result.graph.nodes).toHaveLength(numFiles);
            expect(result.graph.edges).toHaveLength(expectedEdges);

            return true;
          })();
        }
      ),
      { numRuns: 100 }
    );
  });
});
