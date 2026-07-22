"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityGuardAgent = void 0;
const auditSecuritySecrets_1 = require("./tools/auditSecuritySecrets");
const auditSecurityEnvAccess_1 = require("./tools/auditSecurityEnvAccess");
class SecurityGuardAgent {
    name = "security-guard";
    version = "1.0.0";
    ruleset;
    initialize(ruleset) {
        this.ruleset = ruleset;
    }
    tools = [
        {
            name: "audit_security_secrets",
            description: "Scans a directory for hardcoded secrets and credentials (API keys, tokens, passwords, connection strings).",
            schema: {
                type: "object",
                properties: { directory: { type: "string" } },
                required: ["directory"],
            },
            handler: (args, ruleset) => (0, auditSecuritySecrets_1.auditSecuritySecrets)(args, ruleset),
        },
        {
            name: "audit_security_env_access",
            description: "Verifies that process.env access is only used in the infrastructure layer.",
            schema: {
                type: "object",
                properties: { filepath: { type: "string" } },
                required: ["filepath"],
            },
            handler: (args, ruleset) => (0, auditSecurityEnvAccess_1.auditSecurityEnvAccess)(args, ruleset),
        },
    ];
}
exports.SecurityGuardAgent = SecurityGuardAgent;
//# sourceMappingURL=SecurityGuardAgent.js.map