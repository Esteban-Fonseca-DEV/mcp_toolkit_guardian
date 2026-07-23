import { SolidAnalysisPayload, BedrockViolation } from "./types";

/**
 * Valida que un payload desconocido cumple con el schema SolidAnalysisPayload.
 *
 * - complexity_score: entero 0-100
 * - violations: array de BedrockViolation válidos
 * - refactoring_index: decimal 0.0-1.0
 */
export function validateSolidPayload(payload: unknown): payload is SolidAnalysisPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;

  // Validar complexity_score: entero 0-100
  if (typeof p.complexity_score !== "number") return false;
  if (!Number.isInteger(p.complexity_score)) return false;
  if (p.complexity_score < 0 || p.complexity_score > 100) return false;

  // Validar refactoring_index: decimal 0.0-1.0
  if (typeof p.refactoring_index !== "number") return false;
  if (p.refactoring_index < 0 || p.refactoring_index > 1) return false;

  // Validar violations: array de objetos válidos
  if (!Array.isArray(p.violations)) return false;
  for (const v of p.violations) {
    if (!validateBedrockViolation(v)) return false;
  }

  return true;
}

/**
 * Valida que un objeto desconocido cumple con el schema BedrockViolation.
 *
 * - principle: string (SRP, OCP, LSP, ISP, DIP)
 * - severity: "CRITICAL" | "WARNING" | "INFO"
 * - reason: string
 * - suggested_refactoring: string
 */
export function validateBedrockViolation(v: unknown): v is BedrockViolation {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.principle === "string" &&
    typeof obj.severity === "string" &&
    ["CRITICAL", "WARNING", "INFO"].includes(obj.severity as string) &&
    typeof obj.reason === "string" &&
    typeof obj.suggested_refactoring === "string"
  );
}
