import { Ruleset } from "./types";

export const DEFAULT_RULESET: Ruleset = {
  version: "1.0.0",
  executionMode: "local",
  layers: [
    {
      name: "domain",
      paths: ["src/domain/**"],
      allowedDependencies: []
    },
    {
      name: "application",
      paths: ["src/application/**"],
      allowedDependencies: ["domain"]
    },
    {
      name: "infrastructure",
      paths: ["src/infrastructure/**"],
      allowedDependencies: ["domain", "application"]
    },
    {
      name: "presentation",
      paths: ["src/presentation/**"],
      allowedDependencies: ["application"]
    }
  ],
  testConventions: [
    { pattern: "**/*.test.ts" },
    { pattern: "**/*.spec.ts" }
  ],
  excludePaths: ["node_modules", "dist", "coverage"]
};
