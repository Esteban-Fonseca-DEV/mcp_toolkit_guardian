/**
 * Mapeo de severidades de Bedrock al sistema de severidad de Guardian.
 * Convierte las violations retornadas por el modelo de IA al formato estándar.
 */
import { Violation, Severity } from "@guardian/shared";
import { BedrockViolation } from "./types";

/**
 * Mapea la severidad de Bedrock al tipo Severity de Guardian.
 * CRITICAL → "error", WARNING/INFO → "warning"
 */
export function mapBedrockSeverity(bedrockSeverity: string): Severity {
  return bedrockSeverity === "CRITICAL" ? "error" : "warning";
}

/**
 * Convierte un array de BedrockViolation al formato Violation de Guardian.
 * Cada violation incluye el filePath proporcionado, line 1 (Bedrock no retorna línea específica),
 * descripción formateada con principio, razón y sugerencia, y la regla SOLID correspondiente.
 */
export function mapBedrockViolations(
  bedrockViolations: BedrockViolation[],
  filePath: string
): Violation[] {
  return bedrockViolations.map((bv) => ({
    filePath,
    line: 1,
    description: `[${bv.principle}] ${bv.reason}. Sugerencia: ${bv.suggested_refactoring}`,
    severity: mapBedrockSeverity(bv.severity),
    rule: `SOLID_${bv.principle.toUpperCase()}`,
  }));
}
