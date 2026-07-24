import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { GuardianFileWatcher, FileChangeEvent } from "../watcher/FileWatcher";
import { Ruleset } from "@guardian/shared";

const mockRuleset: Ruleset = {
  version: "1.0.0",
  executionMode: "local",
  layers: [],
  testConventions: [],
  excludePaths: ["coverage", "build"],
};

describe("GuardianFileWatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isRelevantFile", () => {
    test("accepts TypeScript files", () => {
      const watcher = new GuardianFileWatcher("/project", mockRuleset, vi.fn());
      expect(watcher.isRelevantFile("/src/index.ts")).toBe(true);
    });

    test("accepts JavaScript files", () => {
      const watcher = new GuardianFileWatcher("/project", mockRuleset, vi.fn());
      expect(watcher.isRelevantFile("/src/utils.js")).toBe(true);
    });

    test("accepts Go files", () => {
      const watcher = new GuardianFileWatcher("/project", mockRuleset, vi.fn());
      expect(watcher.isRelevantFile("/cmd/main.go")).toBe(true);
    });

    test("accepts Python files", () => {
      const watcher = new GuardianFileWatcher("/project", mockRuleset, vi.fn());
      expect(watcher.isRelevantFile("/app/server.py")).toBe(true);
    });

    test("accepts Dart files", () => {
      const watcher = new GuardianFileWatcher("/project", mockRuleset, vi.fn());
      expect(watcher.isRelevantFile("/lib/main.dart")).toBe(true);
    });

    test("accepts C# files", () => {
      const watcher = new GuardianFileWatcher("/project", mockRuleset, vi.fn());
      expect(watcher.isRelevantFile("/src/Program.cs")).toBe(true);
    });

    test("accepts Kotlin files", () => {
      const watcher = new GuardianFileWatcher("/project", mockRuleset, vi.fn());
      expect(watcher.isRelevantFile("/src/Main.kt")).toBe(true);
    });

    test("accepts Rust files", () => {
      const watcher = new GuardianFileWatcher("/project", mockRuleset, vi.fn());
      expect(watcher.isRelevantFile("/src/main.rs")).toBe(true);
    });

    test("rejects non-code files", () => {
      const watcher = new GuardianFileWatcher("/project", mockRuleset, vi.fn());
      expect(watcher.isRelevantFile("/docs/readme.md")).toBe(false);
      expect(watcher.isRelevantFile("/assets/logo.png")).toBe(false);
      expect(watcher.isRelevantFile("/config.json")).toBe(false);
      expect(watcher.isRelevantFile("/styles.css")).toBe(false);
    });

    test("is case-insensitive for extensions", () => {
      const watcher = new GuardianFileWatcher("/project", mockRuleset, vi.fn());
      expect(watcher.isRelevantFile("/src/Main.TS")).toBe(true);
      expect(watcher.isRelevantFile("/src/Main.Py")).toBe(true);
    });
  });

  describe("isExcluded", () => {
    test("excludes paths matching excludePaths from ruleset", () => {
      const watcher = new GuardianFileWatcher("/project", mockRuleset, vi.fn());
      expect(watcher.isExcluded("/project/coverage/lcov.info")).toBe(true);
      expect(watcher.isExcluded("/project/build/output.js")).toBe(true);
    });

    test("does not exclude paths not in excludePaths", () => {
      const watcher = new GuardianFileWatcher("/project", mockRuleset, vi.fn());
      expect(watcher.isExcluded("/project/src/index.ts")).toBe(false);
    });

    test("handles Windows-style backslash paths", () => {
      const watcher = new GuardianFileWatcher("/project", mockRuleset, vi.fn());
      expect(watcher.isExcluded("C:\\project\\coverage\\file.ts")).toBe(true);
    });
  });

  describe("handleChange with debounce", () => {
    test("groups multiple changes within debounce interval", () => {
      const callback = vi.fn();
      const watcher = new GuardianFileWatcher("/project", mockRuleset, callback, 300);

      watcher.handleChange("/project/src/a.ts");
      watcher.handleChange("/project/src/b.ts");
      watcher.handleChange("/project/src/c.ts");

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(callback).toHaveBeenCalledTimes(1);
      const event: FileChangeEvent = callback.mock.calls[0][0];
      expect(event.paths).toHaveLength(3);
      expect(event.paths).toContain("/project/src/a.ts");
      expect(event.paths).toContain("/project/src/b.ts");
      expect(event.paths).toContain("/project/src/c.ts");
      expect(event.timestamp).toBeTypeOf("number");
    });

    test("deduplicates same path within debounce interval", () => {
      const callback = vi.fn();
      const watcher = new GuardianFileWatcher("/project", mockRuleset, callback, 300);

      watcher.handleChange("/project/src/a.ts");
      watcher.handleChange("/project/src/a.ts");
      watcher.handleChange("/project/src/a.ts");

      vi.advanceTimersByTime(300);

      expect(callback).toHaveBeenCalledTimes(1);
      const event: FileChangeEvent = callback.mock.calls[0][0];
      expect(event.paths).toHaveLength(1);
      expect(event.paths[0]).toBe("/project/src/a.ts");
    });

    test("fires separate callbacks for changes separated by more than debounce", () => {
      const callback = vi.fn();
      const watcher = new GuardianFileWatcher("/project", mockRuleset, callback, 300);

      watcher.handleChange("/project/src/a.ts");
      vi.advanceTimersByTime(300);

      watcher.handleChange("/project/src/b.ts");
      vi.advanceTimersByTime(300);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback.mock.calls[0][0].paths).toEqual(["/project/src/a.ts"]);
      expect(callback.mock.calls[1][0].paths).toEqual(["/project/src/b.ts"]);
    });

    test("ignores irrelevant file extensions", () => {
      const callback = vi.fn();
      const watcher = new GuardianFileWatcher("/project", mockRuleset, callback, 300);

      watcher.handleChange("/project/README.md");
      watcher.handleChange("/project/package.json");

      vi.advanceTimersByTime(300);

      expect(callback).not.toHaveBeenCalled();
    });

    test("ignores excluded paths", () => {
      const callback = vi.fn();
      const watcher = new GuardianFileWatcher("/project", mockRuleset, callback, 300);

      watcher.handleChange("/project/coverage/report.ts");
      watcher.handleChange("/project/build/output.ts");

      vi.advanceTimersByTime(300);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("stop", () => {
    test("clears pending debounce timer", () => {
      const callback = vi.fn();
      const watcher = new GuardianFileWatcher("/project", mockRuleset, callback, 300);

      watcher.handleChange("/project/src/a.ts");
      watcher.stop();

      vi.advanceTimersByTime(300);

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
