import { IAgent, ToolDefinition, Ruleset } from "@guardian/shared";
import { auditSecuritySecrets } from "./tools/auditSecuritySecrets";
import { auditSecurityEnvAccess } from "./tools/auditSecurityEnvAccess";

/**
 * Security Guard Agent
 *
 * Detects exposed secrets (API keys, tokens, passwords, connection strings)
 * and enforces that environment variable access is confined to the infrastructure layer.
 *
 * Part of the Guardian Governance Platform — detects Architectural_Drift related to security.
 */
export class SecurityGuardAgent implements IAgent {
  readonly name = "security-guard";
  readonly version = "1.0.0";
  private ruleset!: Ruleset;

  initialize(ruleset: Ruleset): void {
    this.ruleset = ruleset;
  }

  readonly tools: ToolDefinition[] = [
    {
      name: "audit_security_secrets",
      description:
        "Scans a directory for hardcoded secrets and credentials (API keys, tokens, passwords, connection strings).",
      schema: {
        type: "object",
        properties: {
          directory: {
            type: "string",
            description: "Directory path to scan recursively for secrets",
          },
        },
        required: ["directory"],
      },
      handler: (args, ruleset) =>
        auditSecuritySecrets(args as { directory: string }, ruleset),
    },
    {
      name: "audit_security_env_access",
      description:
        "Verifies that process.env access is only used in the infrastructure layer.",
      schema: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "File path to check for process.env access",
          },
        },
        required: ["filepath"],
      },
      handler: (args, ruleset) =>
        auditSecurityEnvAccess(args as { filepath: string }, ruleset),
    },
  ];
}
