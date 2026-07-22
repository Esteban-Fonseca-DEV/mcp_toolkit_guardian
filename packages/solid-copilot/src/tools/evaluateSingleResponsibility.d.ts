import { AuditReport, Ruleset, Violation } from "@guardian/shared";
export declare function evaluateSingleResponsibility(args: {
    filepath: string;
}, ruleset: Ruleset): Promise<AuditReport>;
/**
 * Synchronous version for testing with in-memory content.
 * Analyzes classes for Single Responsibility Principle violations.
 */
export declare function evaluateSingleResponsibilitySync(filepath: string, content: string): Violation[];
//# sourceMappingURL=evaluateSingleResponsibility.d.ts.map