import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { writeFile, mkdir, rm } from "fs/promises";
import { RulesetLoader } from "../RulesetLoader";
import { DEFAULT_RULESET } from "@guardian/shared";

const TEST_DIR = join(__dirname, "__fixtures__");

describe("RulesetLoader", () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should load a valid .guardian.json file successfully", async () => {
    const configPath = join(__dirname, "../../../../.guardian.json");
    const ruleset = await RulesetLoader.load(configPath);

    expect(ruleset.version).toBe("1.0.0");
    expect(ruleset.executionMode).toBe("local");
    expect(ruleset.layers).toHaveLength(4);
    expect(ruleset.layers[0].name).toBe("domain");
    expect(ruleset.testConventions).toHaveLength(2);
    expect(ruleset.excludePaths).toContain("node_modules");
  });

  it("should return DEFAULT_RULESET when file does not exist", async () => {
    const ruleset = await RulesetLoader.load("/nonexistent/path/.guardian.json");

    expect(ruleset).toEqual(DEFAULT_RULESET);
  });

  it("should throw descriptive error for invalid JSON syntax", async () => {
    const badPath = join(TEST_DIR, "bad-syntax.json");
    await writeFile(badPath, "{ invalid json }");

    await expect(RulesetLoader.load(badPath)).rejects.toThrow("Invalid JSON syntax");
  });

  it("should throw descriptive error for invalid schema (missing required field)", async () => {
    const badPath = join(TEST_DIR, "bad-schema.json");
    await writeFile(badPath, JSON.stringify({
      version: "1.0.0",
      executionMode: "local"
      // missing layers, testConventions, excludePaths
    }));

    await expect(RulesetLoader.load(badPath)).rejects.toThrow("Invalid .guardian.json");
  });

  it("should throw descriptive error for invalid executionMode value", async () => {
    const badPath = join(TEST_DIR, "bad-mode.json");
    await writeFile(badPath, JSON.stringify({
      version: "1.0.0",
      executionMode: "invalid_mode",
      layers: [],
      testConventions: [],
      excludePaths: []
    }));

    await expect(RulesetLoader.load(badPath)).rejects.toThrow("Invalid .guardian.json");
  });
});
