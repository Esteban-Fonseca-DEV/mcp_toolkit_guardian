/**
 * Tipos para la integración con Amazon Bedrock en SOLID-Copilot.
 * Define el schema de comunicación entre el agente y el servicio de IA.
 */

/**
 * Representa una violación de principio SOLID detectada por Bedrock.
 */
export interface BedrockViolation {
  principle: "SRP" | "OCP" | "LSP" | "ISP" | "DIP";
  severity: "CRITICAL" | "WARNING" | "INFO";
  reason: string;
  suggested_refactoring: string;
}

/**
 * Payload de respuesta de Bedrock con el análisis SOLID completo.
 *
 * - complexity_score: entero 0-100 (0 = código perfecto, 100 = máxima complejidad)
 * - violations: array de violaciones detectadas
 * - refactoring_index: decimal 0.0-1.0 (0.0 = no necesita refactoring, 1.0 = urgente)
 */
export interface SolidAnalysisPayload {
  complexity_score: number;       // entero 0-100
  violations: BedrockViolation[];
  refactoring_index: number;      // decimal 0.0-1.0
}

/**
 * Configuración del cliente de Amazon Bedrock.
 */
export interface BedrockConfig {
  modelId: string;           // default: "anthropic.claude-3-5-sonnet-20241022-v2:0"
  fallbackModelId: string;   // default: "anthropic.claude-3-haiku-20240307-v1:0"
  region: string;            // default: process.env.AWS_REGION ?? "us-east-1"
  timeoutMs: number;         // default: 15000
  maxRetries: number;        // default: 2
}

/**
 * Resultado del análisis de Bedrock, incluyendo estado de éxito/error.
 */
export interface BedrockAnalysisResult {
  success: boolean;
  payload?: SolidAnalysisPayload;
  error?: string;
}
