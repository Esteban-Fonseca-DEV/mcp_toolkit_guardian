import { AuditReport, Ruleset, Violation } from "@guardian/shared";
/**
 * Detects common concurrency-related anti-patterns in TypeScript source:
 * 1. MUTABLE_EXPORT — `export let` declarations (should be `export const`)
 * 2. TIMER_NO_CLEANUP — setInterval/setTimeout without corresponding clearInterval/clearTimeout
 * 3. EVENT_LISTENER_NO_CLEANUP — addEventListener without removeEventListener in same scope
 * 4. PROMISE_NOT_AWAITED — Promise-returning expressions that aren't awaited/assigned
 */
export declare function auditConcurrency(args: {
    filepath: string;
}, _ruleset: Ruleset): Promise<AuditReport>;
/**
 * Synchronous version — analyzes source text directly (useful for testing).
 */
export declare function auditConcurrencySync(filepath: string, content: string): Violation[];
//# sourceMappingURL=auditConcurrency.d.ts.map