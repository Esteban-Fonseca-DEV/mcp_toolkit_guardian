import { IAgent, ToolDefinition, Ruleset, AuditReport } from "@guardian/shared";
import { auditSecuritySecrets } from "./tools/auditSecuritySecrets";
import { auditSecurityEnvAccess } from "./tools/auditSecurityEnvAccess";

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
        properties: { directory: { type: "string" } },
        required: ["directory"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        auditSecuritySecrets(args as { directory: string }, ruleset),
    },
    {
      name: "audit_security_env_access",
      description:
        "Verifies that process.env access is only used in the infrastructure layer.",
      schema: {
        type: "object",
        properties: { filepath: { type: "string" } },
        required: ["filepath"],
      },
      handler: (args: unknown, ruleset: Ruleset): Promise<AuditReport> =>
        auditSecurityEnvAccess(args as { filepath: string }, ruleset),
    },
  ];
}
