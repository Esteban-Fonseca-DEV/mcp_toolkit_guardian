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
exports.auditConcurrency = auditConcurrency;
exports.auditConcurrencySync = auditConcurrencySync;
const promises_1 = require("fs/promises");
const ts = __importStar(require("typescript"));
const shared_1 = require("@guardian/shared");
/**
 * Detects common concurrency-related anti-patterns in TypeScript source:
 * 1. MUTABLE_EXPORT — `export let` declarations (should be `export const`)
 * 2. TIMER_NO_CLEANUP — setInterval/setTimeout without corresponding clearInterval/clearTimeout
 * 3. EVENT_LISTENER_NO_CLEANUP — addEventListener without removeEventListener in same scope
 * 4. PROMISE_NOT_AWAITED — Promise-returning expressions that aren't awaited/assigned
 */
async function auditConcurrency(args, _ruleset) {
    const { filepath } = args;
    let content;
    try {
        content = await (0, promises_1.readFile)(filepath, "utf-8");
    }
    catch (err) {
        return (0, shared_1.buildReport)({
            agentName: "concurrency-guard",
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
    const violations = auditConcurrencySync(filepath, content);
    return (0, shared_1.buildReport)({
        agentName: "concurrency-guard",
        analyzedPath: filepath,
        violations,
    });
}
/**
 * Synchronous version — analyzes source text directly (useful for testing).
 */
function auditConcurrencySync(filepath, content) {
    const sourceFile = ts.createSourceFile(filepath, content, ts.ScriptTarget.Latest, true);
    const violations = [];
    // Track calls in the file
    const hasRemoveEventListener = content.includes("removeEventListener");
    const hasClearInterval = content.includes("clearInterval");
    const hasClearTimeout = content.includes("clearTimeout");
    function visit(node) {
        // 1. MUTABLE_EXPORT — export let declarations
        if (ts.isVariableStatement(node)) {
            const mods = ts.getModifiers(node);
            const hasExport = mods?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
            if (hasExport) {
                const declList = node.declarationList;
                if (declList.flags & ts.NodeFlags.Let) {
                    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                    violations.push({
                        filePath: filepath,
                        line,
                        description: "Mutable export detected (`export let`). Use `export const` to avoid shared mutable state.",
                        severity: "warning",
                        rule: "MUTABLE_EXPORT",
                    });
                }
            }
        }
        // 2. TIMER_NO_CLEANUP — setInterval/setTimeout without clear*
        if (ts.isCallExpression(node)) {
            const expr = node.expression;
            if (ts.isIdentifier(expr)) {
                const name = expr.text;
                if (name === "setInterval" && !hasClearInterval) {
                    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                    violations.push({
                        filePath: filepath,
                        line,
                        description: "`setInterval` used without corresponding `clearInterval` in the same file.",
                        severity: "warning",
                        rule: "TIMER_NO_CLEANUP",
                    });
                }
                if (name === "setTimeout" && !hasClearTimeout) {
                    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                    violations.push({
                        filePath: filepath,
                        line,
                        description: "`setTimeout` used without corresponding `clearTimeout` in the same file.",
                        severity: "warning",
                        rule: "TIMER_NO_CLEANUP",
                    });
                }
            }
        }
        // 3. EVENT_LISTENER_NO_CLEANUP — addEventListener without removeEventListener
        if (ts.isCallExpression(node)) {
            const expr = node.expression;
            if (ts.isPropertyAccessExpression(expr) &&
                expr.name.text === "addEventListener" &&
                !hasRemoveEventListener) {
                const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                violations.push({
                    filePath: filepath,
                    line,
                    description: "`addEventListener` used without corresponding `removeEventListener` in the same file.",
                    severity: "warning",
                    rule: "EVENT_LISTENER_NO_CLEANUP",
                });
            }
        }
        // 4. PROMISE_NOT_AWAITED — `new Promise(...)` as expression statement (not assigned/awaited)
        if (ts.isExpressionStatement(node)) {
            const expr = node.expression;
            if (ts.isNewExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === "Promise") {
                const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                violations.push({
                    filePath: filepath,
                    line,
                    description: "`new Promise(...)` created but not awaited or assigned. This may lead to unhandled async operations.",
                    severity: "warning",
                    rule: "PROMISE_NOT_AWAITED",
                });
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return violations;
}
//# sourceMappingURL=auditConcurrency.js.map