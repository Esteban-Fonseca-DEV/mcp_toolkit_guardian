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
exports.auditSecurityEnvAccess = auditSecurityEnvAccess;
const promises_1 = require("fs/promises");
const ts = __importStar(require("typescript"));
const minimatch_1 = require("minimatch");
const shared_1 = require("@guardian/shared");
/**
 * Resolves which architectural layer a file belongs to based on the Ruleset.
 */
function resolveLayer(filePath, ruleset) {
    const normalizedPath = filePath.replace(/\\/g, "/");
    for (const layer of ruleset.layers) {
        for (const pattern of layer.paths) {
            if ((0, minimatch_1.minimatch)(normalizedPath, pattern)) {
                return layer.name;
            }
        }
    }
    return null;
}
/**
 * Walks the AST looking for `process.env` property access expressions.
 * Returns the line numbers where these accesses occur.
 */
function findProcessEnvAccesses(sourceFile) {
    const lines = [];
    function visit(node) {
        // Look for property access: process.env.SOMETHING or process.env["SOMETHING"]
        if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
            const expr = ts.isPropertyAccessExpression(node) ? node.expression : node.expression;
            // Check if expression is `process.env`
            if (ts.isPropertyAccessExpression(expr)) {
                const obj = expr.expression;
                const prop = expr.name;
                if (ts.isIdentifier(obj) &&
                    obj.text === "process" &&
                    ts.isIdentifier(prop) &&
                    prop.text === "env") {
                    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
                        .line + 1;
                    lines.push(line);
                    return; // Don't recurse into children of this node
                }
            }
        }
        // Also catch direct `process.env` access without a further property
        if (ts.isPropertyAccessExpression(node)) {
            const obj = node.expression;
            const prop = node.name;
            if (ts.isIdentifier(obj) &&
                obj.text === "process" &&
                ts.isIdentifier(prop) &&
                prop.text === "env") {
                // Check if parent is NOT a property access (i.e., `process.env` used directly)
                const parent = node.parent;
                if (!ts.isPropertyAccessExpression(parent) &&
                    !ts.isElementAccessExpression(parent)) {
                    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
                        .line + 1;
                    lines.push(line);
                    return;
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return lines;
}
async function auditSecurityEnvAccess(args, ruleset) {
    const { filepath } = args;
    let content;
    try {
        content = await (0, promises_1.readFile)(filepath, "utf-8");
    }
    catch (err) {
        return (0, shared_1.buildReport)({
            agentName: "security-guard",
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
    const normalizedPath = filepath.replace(/\\/g, "/");
    const layer = resolveLayer(normalizedPath, ruleset);
    // If the file is in the infrastructure layer, process.env access is allowed
    if (layer === "infrastructure") {
        return (0, shared_1.buildReport)({
            agentName: "security-guard",
            analyzedPath: filepath,
            violations: [],
        });
    }
    const sourceFile = ts.createSourceFile(filepath, content, ts.ScriptTarget.Latest, true);
    const envAccessLines = findProcessEnvAccesses(sourceFile);
    const violations = [];
    for (const line of envAccessLines) {
        const layerDesc = layer ? `'${layer}'` : "unknown";
        violations.push({
            filePath: filepath,
            line,
            description: `Access to 'process.env' outside infrastructure layer (found in ${layerDesc} layer). Move environment access to infrastructure.`,
            severity: "warning",
            rule: "ENV_ACCESS_OUTSIDE_INFRA",
        });
    }
    return (0, shared_1.buildReport)({
        agentName: "security-guard",
        analyzedPath: filepath,
        violations,
    });
}
//# sourceMappingURL=auditSecurityEnvAccess.js.map