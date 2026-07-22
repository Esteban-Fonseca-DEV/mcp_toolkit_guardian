import { IAgent, ToolDefinition, Ruleset } from "@guardian/shared";
export declare class ConcurrencyGuardAgent implements IAgent {
    readonly name = "concurrency-guard";
    readonly version = "1.0.0";
    private ruleset;
    initialize(ruleset: Ruleset): void;
    readonly tools: ToolDefinition[];
}
//# sourceMappingURL=ConcurrencyGuardAgent.d.ts.map