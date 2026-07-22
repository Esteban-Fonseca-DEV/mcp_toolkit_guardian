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
exports.auditSecuritySecrets = auditSecuritySecrets;
const promises_1 = require("fs/promises");
const path = __importStar(require("path"));
const glob_1 = require("glob");
const shared_1 = require("@guardian/shared");
const patterns_1 = require("../patterns");
/**
 * Checks if a file is binary by looking for null bytes in the first 512 characters.
 */
function isBinaryContent(content) {
    const sample = content.slice(0, 512);
    return sample.includes("\0");
}
async function auditSecuritySecrets(args, ruleset) {
    const { directory } = args;
    const violations = [];
    const excludePaths = ruleset.excludePaths ?? [];
    // Build glob ignore patterns
    const ignorePatterns = excludePaths.map((p) => `**/${p}/**`);
    let files;
    try {
        files = await (0, glob_1.glob)("**/*", {
            cwd: directory,
            absolute: true,
            nodir: true,
            ignore: ignorePatterns,
        });
    }
    catch (err) {
        return (0, shared_1.buildReport)({
            agentName: "security-guard",
            analyzedPath: directory,
            violations: [
                {
                    filePath: directory,
                    line: 0,
                    description: `Cannot scan directory: ${err.message}`,
                    severity: "warning",
                    rule: "DIRECTORY_SCAN_ERROR",
                },
            ],
        });
    }
    const patterns = patterns_1.DEFAULT_SECRET_PATTERNS;
    for (const file of files) {
        let content;
        try {
            content = await (0, promises_1.readFile)(file, "utf-8");
        }
        catch {
            // Skip files that cannot be read (permissions, etc.)
            continue;
        }
        // Skip binary files
        if (isBinaryContent(content)) {
            continue;
        }
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const secretPattern of patterns) {
                if (secretPattern.pattern.test(line)) {
                    const relativePath = path.relative(directory, file).replace(/\\/g, "/");
                    violations.push({
                        filePath: relativePath,
                        line: i + 1,
                        description: `Potential ${secretPattern.description} detected (${secretPattern.name}).`,
                        severity: "error",
                        rule: `SECRET_EXPOSED_${secretPattern.name}`,
                    });
                }
            }
        }
    }
    return (0, shared_1.buildReport)({
        agentName: "security-guard",
        analyzedPath: directory,
        violations,
    });
}
//# sourceMappingURL=auditSecuritySecrets.js.map