/**
 * Construye el prompt de análisis SOLID para Amazon Bedrock.
 * El prompt instruye al modelo a analizar código TypeScript según los 5 principios SOLID
 * y retornar un JSON estructurado con el schema SolidAnalysisPayload.
 */

/**
 * Genera el prompt completo para el análisis SOLID de código fuente.
 *
 * El prompt incluye:
 * - El código fuente completo sin modificaciones
 * - Instrucciones de análisis para los 5 principios SOLID (SRP, OCP, LSP, ISP, DIP)
 * - El schema JSON esperado con campos complexity_score, violations y refactoring_index
 *
 * @param sourceCode - Código fuente TypeScript a analizar
 * @returns Prompt formateado para enviar a Amazon Bedrock
 */
export function buildSolidAnalysisPrompt(sourceCode: string): string {
  return `Analiza el siguiente código TypeScript según los principios SOLID.
Retorna tu análisis ÚNICAMENTE como un JSON válido con el siguiente schema exacto:

{
  "complexity_score": <entero 0-100>,
  "violations": [
    {
      "principle": "<SRP|OCP|LSP|ISP|DIP>",
      "severity": "<CRITICAL|WARNING|INFO>",
      "reason": "<descripción del problema>",
      "suggested_refactoring": "<sugerencia de mejora>"
    }
  ],
  "refactoring_index": <decimal 0.0-1.0>
}

Reglas:
- complexity_score: 0 = código perfecto, 100 = máxima complejidad
- refactoring_index: 0.0 = no necesita refactoring, 1.0 = urgente
- severity CRITICAL: violación grave que causa acoplamiento o dificulta testing
- severity WARNING: violación moderada que reduce mantenibilidad
- severity INFO: oportunidad de mejora menor
- Solo retorna JSON, sin texto adicional.

Código fuente:
\`\`\`typescript
${sourceCode}
\`\`\``;
}
