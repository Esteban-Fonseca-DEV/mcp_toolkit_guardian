import { readFile } from "fs/promises";
import { existsSync } from "fs";
import Ajv from "ajv";
import { Ruleset, DEFAULT_RULESET } from "@guardian/shared";

const RULESET_SCHEMA = {
  type: "object",
  properties: {
    version: { type: "string" },
    executionMode: { type: "string", enum: ["local", "cloud"] },
    layers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          paths: { type: "array", items: { type: "string" } },
          allowedDependencies: { type: "array", items: { type: "string" } }
        },
        required: ["name", "paths", "allowedDependencies"]
      }
    },
    testConventions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pattern: { type: "string" }
        },
        required: ["pattern"]
      }
    },
    excludePaths: { type: "array", items: { type: "string" } }
  },
  required: ["version", "executionMode", "layers", "testConventions", "excludePaths"],
  additionalProperties: false
};

export class RulesetLoader {
  private static ajv = new Ajv({ allErrors: true });
  private static validate = RulesetLoader.ajv.compile(RULESET_SCHEMA);

  static async load(configPath: string): Promise<Ruleset> {
    if (!existsSync(configPath)) {
      return DEFAULT_RULESET;
    }

    const content = await readFile(configPath, "utf-8");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      throw new Error(`Invalid JSON syntax in ${configPath}: ${(e as Error).message}`);
    }

    const valid = RulesetLoader.validate(parsed);
    if (!valid) {
      const errors = RulesetLoader.validate.errors ?? [];
      const details = errors
        .map(err => `${err.instancePath || "/"} ${err.message}`)
        .join("; ");
      throw new Error(`Invalid .guardian.json: ${details}`);
    }

    return parsed as Ruleset;
  }
}
