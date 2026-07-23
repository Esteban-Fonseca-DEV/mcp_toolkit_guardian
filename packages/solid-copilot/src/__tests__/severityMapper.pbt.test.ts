import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { mapBedrockSeverity } from "../bedrock/severityMapper";

/**
 * **Validates: Requirements 1.5**
 *
 * Property 3: Mapeo de severidad Bedrock → Guardian
 * - mapBedrockSeverity always returns "error" for "CRITICAL"
 * - mapBedrockSeverity always returns "warning" for "WARNING" or "INFO"
 * - The mapping is deterministic and total (always returns a valid Severity)
 */
describe("SeverityMapper - Property-Based Tests", () => {
  it("Property 3a: CRITICAL always maps to error", () => {
    fc.assert(
      fc.property(fc.constant("CRITICAL"), (severity) => {
        expect(mapBedrockSeverity(severity)).toBe("error");
      }),
      { numRuns: 100 }
    );
  });

  it("Property 3b: WARNING always maps to warning", () => {
    fc.assert(
      fc.property(fc.constant("WARNING"), (severity) => {
        expect(mapBedrockSeverity(severity)).toBe("warning");
      }),
      { numRuns: 100 }
    );
  });

  it("Property 3c: INFO always maps to warning", () => {
    fc.assert(
      fc.property(fc.constant("INFO"), (severity) => {
        expect(mapBedrockSeverity(severity)).toBe("warning");
      }),
      { numRuns: 100 }
    );
  });

  it("Property 3d: deterministic - same input always produces same output", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("CRITICAL", "WARNING", "INFO"),
        (severity) => {
          const result1 = mapBedrockSeverity(severity);
          const result2 = mapBedrockSeverity(severity);
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 3e: total - any string input returns a valid Severity", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 50 }), (severity) => {
        const result = mapBedrockSeverity(severity);
        expect(["error", "warning"]).toContain(result);
      }),
      { numRuns: 100 }
    );
  });
});
