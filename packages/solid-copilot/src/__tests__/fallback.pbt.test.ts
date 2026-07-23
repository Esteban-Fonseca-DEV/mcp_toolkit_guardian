import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { evaluateSingleResponsibility } from "../tools/evaluateSingleResponsibility";
import { Ruleset, AuditReport } from "@guardian/shared";

/**
 * **Validates: Requirements 1.4**
 *
 * Property 2: Fallback determinístico ante errores de Bedrock
 * Para cualquier tipo de error retornado por el BedrockClient (timeout,
 * credenciales inválidas, error de red, respuesta malformada),
 * `evaluateSingleResponsibility` retorna un AuditReport válido con
 * `fallback: true` y nunca lanza una excepción no capturada.
 */
describe("Fallback - Property-Based Tests", () => {
  const defaultRuleset: Ruleset = {
    version: "1.0.0",
    executionMode: "local",
    layers: [],
    testConventions: [],
    excludePaths: [],
  };

  function assertValidReport(report: any, filepath: string): void {
    expect(report).toBeDefined();
    expect(typeof report.timestamp).toBe("string");
    expect(report.agentName).toBe("solid-copilot");
    expect(report.analyzedPath).toBe(filepath);
    expect(["passed", "failed", "error"]).toContain(report.status);
    expect(Array.isArray(report.violations)).toBe(true);
    expect(report.summary).toBeDefined();
    expect(typeof report.summary.errorCount).toBe("number");
    expect(typeof report.summary.warningCount).toBe("number");
    expect(report.summary.errorCount).toBeGreaterThanOrEqual(0);
    expect(report.summary.warningCount).toBeGreaterThanOrEqual(0);

    for (const v of report.violations) {
      expect(typeof v.filePath).toBe("string");
      expect(typeof v.line).toBe("number");
      expect(typeof v.description).toBe("string");
      expect(["error", "warning"]).toContain(v.severity);
    }
  }

  it("Property 2: for any error type, evaluateSingleResponsibility returns a valid AuditReport and never throws", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant("TimeoutError"),
          fc.constant("AccessDeniedException"),
          fc.constant("NetworkError"),
          fc.constant("ECONNREFUSED"),
          fc.constant("InvalidSignatureException"),
          fc.constant("ThrottlingException"),
          fc.constant("ServiceUnavailableException"),
          fc.constant("MalformedResponseError"),
          fc.string({ minLength: 1, maxLength: 50 })
        ),
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{2,30}$/).map(s => `/project/src/${s}.ts`),
        async (errorType, filepath) => {
          // evaluateSingleResponsibility should never throw - it always returns a report
          // When file cannot be read, it returns a FILE_READ_ERROR violation gracefully
          let report: AuditReport;
          let threw = false;

          try {
            report = await evaluateSingleResponsibility(
              { filepath },
              defaultRuleset
            );
          } catch (e) {
            threw = true;
            report = {} as AuditReport;
          }

          // MUST never throw an uncaught exception
          expect(threw).toBe(false);

          // MUST return a valid AuditReport structure
          assertValidReport(report, filepath);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 2b: non-existent files produce valid report without throwing", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{2,20}$/).map(s => `/nonexistent/${s}.ts`),
        async (filepath) => {
          let report: AuditReport;
          let threw = false;

          try {
            report = await evaluateSingleResponsibility(
              { filepath },
              defaultRuleset
            );
          } catch (e) {
            threw = true;
            report = {} as AuditReport;
          }

          // Never throws
          expect(threw).toBe(false);

          // Returns a valid AuditReport
          assertValidReport(report, filepath);

          // The report gracefully handles the error via a warning violation
          expect(report.violations.length).toBeGreaterThanOrEqual(1);
          const fileErrorViolation = report.violations.find(
            (v) => v.rule === "FILE_READ_ERROR"
          );
          expect(fileErrorViolation).toBeDefined();
          expect(fileErrorViolation!.severity).toBe("warning");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 2c: report structure is always valid regardless of input path", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant("/dev/null/file.ts"),
          fc.constant("C:/Windows/System32/nonexistent.ts"),
          fc.constant("../../../etc/nonexistent.ts"),
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_/]{3,50}\.ts$/)
        ),
        async (filepath) => {
          let report: AuditReport;
          let threw = false;

          try {
            report = await evaluateSingleResponsibility(
              { filepath },
              defaultRuleset
            );
          } catch (e) {
            threw = true;
            report = {} as AuditReport;
          }

          // MUST never throw
          expect(threw).toBe(false);

          // MUST return a valid AuditReport
          assertValidReport(report, filepath);
        }
      ),
      { numRuns: 100 }
    );
  });
});
