import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { Violation } from "@guardian/shared";
import { formatViolationsToStderr } from "../commands/watch";

/**
 * **Validates: Requirements 3.3**
 *
 * Property 12: Formato de salida del watch incluye información requerida
 * Para cualquier AuditReport con al menos una violation, el formato de salida
 * a stderr del modo watch contiene para cada violation: el filePath, el line number,
 * y la description. El output nunca pierde violations presentes en el reporte.
 */
describe("Property 12: Watch output format includes required info", () => {
  let stderrOutput: string;

  beforeEach(() => {
    stderrOutput = "";
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
      stderrOutput += chunk.toString();
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Generator for a valid violation
  const validViolation: fc.Arbitrary<Violation> = fc.record({
    filePath: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9/._-]{2,40}$/).map(s => `src/${s}.ts`),
    line: fc.integer({ min: 1, max: 5000 }),
    description: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ,.;:!?()-]{4,80}$/),
    severity: fc.oneof(fc.constant("error" as const), fc.constant("warning" as const)),
    rule: fc.option(fc.stringMatching(/^[A-Z_]{3,20}$/), { nil: undefined }),
  });

  it("every violation's filePath, line, and description appear in stderr output", () => {
    fc.assert(
      fc.property(
        fc.array(validViolation, { minLength: 1, maxLength: 15 }),
        (violations) => {
          stderrOutput = "";
          formatViolationsToStderr(violations);

          for (const v of violations) {
            expect(stderrOutput).toContain(v.filePath);
            expect(stderrOutput).toContain(String(v.line));
            expect(stderrOutput).toContain(v.description);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("output contains filePath:line format for every violation", () => {
    fc.assert(
      fc.property(
        fc.array(validViolation, { minLength: 1, maxLength: 10 }),
        (violations) => {
          stderrOutput = "";
          formatViolationsToStderr(violations);

          for (const v of violations) {
            // Verify the "filePath:line" pattern exists in output
            expect(stderrOutput).toContain(`${v.filePath}:${v.line}`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("no violations are lost — output lines count matches violations count", () => {
    fc.assert(
      fc.property(
        fc.array(validViolation, { minLength: 1, maxLength: 10 }),
        (violations) => {
          stderrOutput = "";
          formatViolationsToStderr(violations);

          // Each violation produces a line containing its description
          for (const v of violations) {
            expect(stderrOutput).toContain(v.description);
          }

          // Count lines that contain violation indicators
          const violationLines = stderrOutput
            .split("\n")
            .filter(line => line.includes("[ERROR]") || line.includes("[WARN]"));

          expect(violationLines.length).toBe(violations.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
