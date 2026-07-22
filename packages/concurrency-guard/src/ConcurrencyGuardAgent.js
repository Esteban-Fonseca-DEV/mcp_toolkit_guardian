"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConcurrencyGuardAgent = void 0;
const auditConcurrency_1 = require("./tools/auditConcurrency");
class ConcurrencyGuardAgent {
    name = "concurrency-guard";
    version = "1.0.0";
    ruleset;
    initialize(ruleset) {
        this.ruleset = ruleset;
    }
    tools = [
        {
            name: "audit_concurrency",
            description: "Detects common concurrency anti-patterns: unhandled promises, event listeners without cleanup, mutable exports, and timers without cleanup.",
            schema: {
                type: "object",
                properties: { filepath: { type: "string" } },
                required: ["filepath"],
            },
            handler: (args, ruleset) => (0, auditConcurrency_1.auditConcurrency)(args, ruleset),
        },
    ];
}
exports.ConcurrencyGuardAgent = ConcurrencyGuardAgent;
//# sourceMappingURL=ConcurrencyGuardAgent.js.map