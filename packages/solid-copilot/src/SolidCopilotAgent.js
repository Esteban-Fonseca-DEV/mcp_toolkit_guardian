"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolidCopilotAgent = void 0;
const evaluateSingleResponsibility_1 = require("./tools/evaluateSingleResponsibility");
const suggestInterfaceSegregation_1 = require("./tools/suggestInterfaceSegregation");
class SolidCopilotAgent {
    name = "solid-copilot";
    version = "1.0.0";
    ruleset;
    initialize(ruleset) {
        this.ruleset = ruleset;
    }
    tools = [
        {
            name: "evaluate_single_responsibility",
            description: "Analiza clases en busca de violaciones del Principio de Responsabilidad Unica (SRP) basandose en lineas, metodos y dependencias.",
            schema: {
                type: "object",
                properties: { filepath: { type: "string" } },
                required: ["filepath"],
            },
            handler: (args, ruleset) => (0, evaluateSingleResponsibility_1.evaluateSingleResponsibility)(args, ruleset),
        },
        {
            name: "suggest_interface_segregation",
            description: "Analiza interfaces para detectar violaciones del Principio de Segregacion de Interfaces (ISP), sugiriendo division cuando tienen demasiados metodos.",
            schema: {
                type: "object",
                properties: { filepath: { type: "string" } },
                required: ["filepath"],
            },
            handler: (args, ruleset) => (0, suggestInterfaceSegregation_1.suggestInterfaceSegregation)(args, ruleset),
        },
    ];
}
exports.SolidCopilotAgent = SolidCopilotAgent;
//# sourceMappingURL=SolidCopilotAgent.js.map