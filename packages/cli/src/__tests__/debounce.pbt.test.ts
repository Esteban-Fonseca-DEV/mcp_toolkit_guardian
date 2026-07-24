import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { GuardianFileWatcher, FileChangeEvent } from "../watcher/FileWatcher";

/**
 * **Validates: Requirements 3.7**
 *
 * Property 6: Debounce agrupa cambios correctamente
 * Para cualquier secuencia de N eventos de cambio de archivo que ocurren dentro
 * de un intervalo de 300ms, el GuardianFileWatcher invoca el callback exactamente
 * una vez con N paths únicos.
 */
describe("Property 6: Debounce groups changes correctly", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Generator for unique file paths with relevant extensions
  const uniqueFilePaths = fc
    .uniqueArray(
      fc.tuple(
        fc.stringMatching(/^[a-z][a-z0-9]{2,10}$/),
        fc.oneof(
          fc.constant("ts"),
          fc.constant("js"),
          fc.constant("py"),
          fc.constant("go")
        )
      ),
      { minLength: 1, maxLength: 20, comparator: (a, b) => a[0] === b[0] }
    )
    .map((pairs) => pairs.map(([name, ext]) => `/project/src/${name}.${ext}`));

  it("N events within debounce interval produce exactly 1 callback with N unique paths", () => {
    fc.assert(
      fc.property(uniqueFilePaths, (paths) => {
        const receivedEvents: FileChangeEvent[] = [];
        const callback = (event: FileChangeEvent) => {
          receivedEvents.push(event);
        };

        const ruleset = {
          version: "1.0.0",
          executionMode: "local" as const,
          layers: [],
          testConventions: [],
          excludePaths: [],
        };

        const watcher = new GuardianFileWatcher(
          "/project",
          ruleset,
          callback,
          300
        );

        // Simulate file change events (all within debounce interval)
        for (const path of paths) {
          watcher.handleChange(path);
        }

        // Advance time past debounce interval
        vi.advanceTimersByTime(301);

        // Should have exactly 1 callback invocation
        expect(receivedEvents.length).toBe(1);

        // Should contain all N unique paths
        expect(receivedEvents[0].paths.sort()).toEqual([...paths].sort());
        expect(receivedEvents[0].paths.length).toBe(paths.length);
      }),
      { numRuns: 100 }
    );
  });

  it("duplicate paths within debounce interval are deduplicated", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9]{2,8}$/).map((n) => `/project/${n}.ts`),
        fc.integer({ min: 2, max: 10 }),
        (path, repeatCount) => {
          const receivedEvents: FileChangeEvent[] = [];
          const callback = (event: FileChangeEvent) => {
            receivedEvents.push(event);
          };

          const ruleset = {
            version: "1.0.0",
            executionMode: "local" as const,
            layers: [],
            testConventions: [],
            excludePaths: [],
          };

          const watcher = new GuardianFileWatcher(
            "/project",
            ruleset,
            callback,
            300
          );

          // Simulate same file changed multiple times
          for (let i = 0; i < repeatCount; i++) {
            watcher.handleChange(path);
          }

          vi.advanceTimersByTime(301);

          // Should have exactly 1 callback with 1 unique path
          expect(receivedEvents.length).toBe(1);
          expect(receivedEvents[0].paths.length).toBe(1);
          expect(receivedEvents[0].paths[0]).toBe(path);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("events separated by more than debounce interval produce independent callbacks", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9]{2,8}$/).map((n) => `/project/${n}.ts`),
        fc.stringMatching(/^[a-z][a-z0-9]{2,8}$/).map((n) => `/project/${n}.ts`),
        (path1, path2) => {
          // Ensure paths are different for this test
          if (path1 === path2) return;

          const receivedEvents: FileChangeEvent[] = [];
          const callback = (event: FileChangeEvent) => {
            receivedEvents.push(event);
          };

          const ruleset = {
            version: "1.0.0",
            executionMode: "local" as const,
            layers: [],
            testConventions: [],
            excludePaths: [],
          };

          const watcher = new GuardianFileWatcher(
            "/project",
            ruleset,
            callback,
            300
          );

          // First event
          watcher.handleChange(path1);
          vi.advanceTimersByTime(301);

          // Second event after debounce completes
          watcher.handleChange(path2);
          vi.advanceTimersByTime(301);

          // Should have 2 independent callbacks
          expect(receivedEvents.length).toBe(2);
          expect(receivedEvents[0].paths).toContain(path1);
          expect(receivedEvents[1].paths).toContain(path2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
