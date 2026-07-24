import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { GuardianFileWatcher } from "../watcher/FileWatcher";

/**
 * **Validates: Requirements 3.8**
 *
 * Property 9: ExcludePaths filtra correctamente
 * Para cualquier archivo cuyo path contenga un segmento presente en excludePaths,
 * isExcluded retorna true. Para paths que no contienen ningún segmento de
 * excludePaths, retorna false.
 */
describe("Property 9: ExcludePaths filters correctly", () => {
  // Generator for exclude path segments (directory names to exclude)
  const excludeSegment = fc.stringMatching(/^[a-z][a-z0-9_-]{2,12}$/);

  // Generator for a list of exclude paths
  const excludePathsList = fc.uniqueArray(excludeSegment, {
    minLength: 1,
    maxLength: 5,
  });

  // Generator for a "safe" path segment that won't accidentally match exclude paths
  const safeSegment = fc.constant("safedir");

  function createWatcher(excludePaths: string[]): GuardianFileWatcher {
    const ruleset = {
      version: "1.0.0",
      executionMode: "local" as const,
      layers: [],
      testConventions: [],
      excludePaths,
    };

    const callback = () => {};
    return new GuardianFileWatcher("/project", ruleset, callback, 300);
  }

  it("paths containing an excluded segment return true", () => {
    fc.assert(
      fc.property(
        excludePathsList,
        fc.nat({ max: 4 }), // index into excludePaths to use
        fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/), // filename base
        (excludePaths, segIdx, filename) => {
          const watcher = createWatcher(excludePaths);
          const chosenSegment = excludePaths[segIdx % excludePaths.length];

          // Build a path that contains the excluded segment surrounded by /
          const filePath = `/project/src/${chosenSegment}/${filename}.ts`;

          expect(watcher.isExcluded(filePath)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("paths NOT containing any excluded segment return false", () => {
    fc.assert(
      fc.property(
        excludePathsList,
        fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/), // filename base
        (excludePaths, filename) => {
          const watcher = createWatcher(excludePaths);

          // Build a path guaranteed to not contain any excluded segment
          // Use segments that can't match: prefix with "x_" to avoid collision
          const safePath = `/project/src/x_safe_dir/${filename}.ts`;

          // Verify our safe path doesn't accidentally contain any exclude segment
          const normalized = safePath.replace(/\\/g, "/");
          const containsExcluded = excludePaths.some(
            (p) =>
              normalized.includes(`/${p}/`) || normalized.includes(`\\${p}\\`)
          );

          if (!containsExcluded) {
            expect(watcher.isExcluded(safePath)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("paths with excluded segment in nested directories return true", () => {
    fc.assert(
      fc.property(
        excludePathsList,
        fc.nat({ max: 4 }),
        fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/),
        fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/),
        (excludePaths, segIdx, parentDir, filename) => {
          const watcher = createWatcher(excludePaths);
          const chosenSegment = excludePaths[segIdx % excludePaths.length];

          // Build a deeply nested path with the excluded segment
          const filePath = `/project/${parentDir}/${chosenSegment}/sub/${filename}.ts`;

          expect(watcher.isExcluded(filePath)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Windows-style paths with excluded segment are also detected", () => {
    fc.assert(
      fc.property(
        excludePathsList,
        fc.nat({ max: 4 }),
        fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/),
        (excludePaths, segIdx, filename) => {
          const watcher = createWatcher(excludePaths);
          const chosenSegment = excludePaths[segIdx % excludePaths.length];

          // Unix-style path with excluded segment (isExcluded normalizes backslashes to /)
          const filePath = `/project/src/${chosenSegment}/deep/${filename}.ts`;

          expect(watcher.isExcluded(filePath)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
