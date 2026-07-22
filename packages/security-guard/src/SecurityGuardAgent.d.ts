import { IAgent, ToolDefinition, Ruleset } from "@guardian/shared";
export declare class SecurityGuardAgent implements IAgent {
    readonly name = "security-guard";
    readonly version = "1.0.0";
    private ruleset;
    initialize(ruleset: Ruleset): void;
    readonly tools: ToolDefinition[];
}
//# sourceMappingURL=SecurityGuardAgent.d.ts.map