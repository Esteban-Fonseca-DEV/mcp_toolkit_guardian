import { IAgent, ToolDefinition, Ruleset } from "@guardian/shared";
export declare class SolidCopilotAgent implements IAgent {
    readonly name = "solid-copilot";
    readonly version = "1.0.0";
    private ruleset;
    initialize(ruleset: Ruleset): void;
    readonly tools: ToolDefinition[];
}
//# sourceMappingURL=SolidCopilotAgent.d.ts.map