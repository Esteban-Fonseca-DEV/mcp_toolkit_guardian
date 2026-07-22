import { AuditReport, Ruleset, Violation } from "@guardian/shared";
export declare function suggestInterfaceSegregation(args: {
    filepath: string;
}, ruleset: Ruleset): Promise<AuditReport>;
/**
 * Synchronous version for testing with in-memory content.
 * Analyzes interfaces for Interface Segregation Principle violations.
 */
export declare function suggestInterfaceSegregationSync(filepath: string, content: string): Violation[];
//# sourceMappingURL=suggestInterfaceSegregation.d.ts.map