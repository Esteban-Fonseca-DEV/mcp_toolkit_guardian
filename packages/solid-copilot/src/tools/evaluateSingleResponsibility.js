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
exports.evaluateSingleResponsibility = evaluateSingleResponsibility;
exports.evaluateSingleResponsibilitySync = evaluateSingleResponsibilitySync;
const promises_1 = require("fs/promises");
const ts = __importStar(require("typescript"));
const shared_1 = require("@guardian/shared");
async function evaluateSingleResponsibility(args, ruleset) {
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
        violations: evaluateSingleResponsibilitySync(filepath, content),
    });
}
/**
 * Synchronous version for testing with in-memory content.
 * Analyzes classes for Single Responsibility Principle violations.
 */
function evaluateSingleResponsibilitySync(filepath, content) {
    const sourceFile = ts.createSourceFile(filepath, content, ts.ScriptTarget.Latest, true);
    const violations = [];
    ts.forEachChild(sourceFile, (node) => {
        if (!ts.isClassDeclaration(node))
            return;
        const className = node.name?.getText(sourceFile) ?? "<anonymous>";
        // Count methods
        const methods = node.members.filter((m) => ts.isMethodDeclaration(m));
        // Count lines
        const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
        const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
        const lineCount = endLine - startLine + 1;
        // Count constructor params (injected dependencies)
        const constructor = node.members.find((m) => ts.isConstructorDeclaration(m));
        const paramCount = constructor?.parameters.length ?? 0;
        const reasons = [];
        if (lineCount > 200)
            reasons.push(`${lineCount} lineas (umbral: 200)`);
        if (methods.length > 10)
            reasons.push(`${methods.length} metodos (umbral: 10)`);
        if (paramCount > 5)
            reasons.push(`${paramCount} dependencias inyectadas (umbral: 5)`);
        if (reasons.length > 0) {
            violations.push({
                filePath: filepath,
                line: startLine + 1,
                description: `Clase '${className}' posiblemente viola SRP: ${reasons.join(", ")}. Considere dividirla en clases mas cohesivas.`,
                severity: "warning",
                rule: "SRP_GOD_OBJECT",
            });
        }
    });
    return violations;
}
//# sourceMappingURL=evaluateSingleResponsibility.js.map