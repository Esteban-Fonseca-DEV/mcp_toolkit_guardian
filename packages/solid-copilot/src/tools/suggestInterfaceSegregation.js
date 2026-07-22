"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestInterfaceSegregation = suggestInterfaceSegregation;
exports.suggestInterfaceSegregationSync = suggestInterfaceSegregationSync;
const promises_1 = require("fs/promises");
const ts = __importStar(require("typescript"));
const shared_1 = require("@guardian/shared");
async function suggestInterfaceSegregation(args, ruleset) {
    const { filepath } = args;
    let content;
    try {
        content = await (0, promises_1.readFile)(filepath, "utf-8");
    }
    catch (err) {
        return (0, shared_1.buildReport)({
            agentName: "solid-copilot",
            analyzedPath: filepath,
            violations: [
                {
                    filePath: filepath,
                    line: 0,
                    description: `Cannot read file: ${err.message}`,
                    severity: "warning",
                    rule: "FILE_READ_ERROR",
                },
            ],
        });
    }
    return (0, shared_1.buildReport)({
        agentName: "solid-copilot",
        analyzedPath: filepath,
        violations: suggestInterfaceSegregationSync(filepath, content),
    });
}
/**
 * Synchronous version for testing with in-memory content.
 * Analyzes interfaces for Interface Segregation Principle violations.
 */
function suggestInterfaceSegregationSync(filepath, content) {
    const sourceFile = ts.createSourceFile(filepath, content, ts.ScriptTarget.Latest, true);
    const violations = [];
    ts.forEachChild(sourceFile, (node) => {
        if (!ts.isInterfaceDeclaration(node))
            return;
        const interfaceName = node.name.getText(sourceFile);
        // Count method signatures and function-type property signatures
        let methodCount = 0;
        node.members.forEach((member) => {
            if (ts.isMethodSignature(member)) {
                methodCount++;
            }
            else if (ts.isPropertySignature(member)) {
                // Check if property type is a function type
                if (member.type && ts.isFunctionTypeNode(member.type)) {
                    methodCount++;
                }
            }
        });
        if (methodCount > 5) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
            violations.push({
                filePath: filepath,
                line,
                description: `Interfaz '${interfaceName}' tiene ${methodCount} metodos (umbral: 5). Considere dividirla en interfaces mas especificas por responsabilidad.`,
                severity: "warning",
                rule: "ISP_FAT_INTERFACE",
            });
        }
    });
    return violations;
}
//# sourceMappingURL=suggestInterfaceSegregation.js.map