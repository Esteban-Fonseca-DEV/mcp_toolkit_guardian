import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { BedrockConfig, BedrockAnalysisResult, SolidAnalysisPayload } from "./types";
import { buildSolidAnalysisPrompt } from "./promptBuilder";
import { validateSolidPayload } from "./schemaValidator";

/**
 * Cliente para Amazon Bedrock que realiza análisis SOLID de código fuente.
 *
 * Implementa retry con backoff exponencial y fallback a modelo Haiku
 * en el último intento para optimizar costo y disponibilidad.
 */
export class BedrockClient {
  private client: BedrockRuntimeClient;
  private config: BedrockConfig;

  constructor(config: Partial<BedrockConfig> = {}) {
    this.config = {
      modelId: config.modelId ?? "anthropic.claude-3-5-sonnet-20241022-v2:0",
      fallbackModelId: config.fallbackModelId ?? "anthropic.claude-3-haiku-20240307-v1:0",
      region: config.region ?? process.env.AWS_REGION ?? "us-east-1",
      timeoutMs: config.timeoutMs ?? 15000,
      maxRetries: config.maxRetries ?? 2,
    };

    this.client = new BedrockRuntimeClient({
      region: this.config.region,
    });
  }

  /**
   * Analiza código fuente usando Amazon Bedrock con retry y fallback.
   *
   * - Intento 0: modelo principal (Sonnet)
   * - Intento 1..N-1: modelo principal con backoff exponencial
   * - Último intento (N): modelo fallback (Haiku) con backoff exponencial
   *
   * @param sourceCode - Código fuente a analizar
   * @returns Resultado del análisis con success/error
   */
  async analyze(sourceCode: string): Promise<BedrockAnalysisResult> {
    const prompt = buildSolidAnalysisPrompt(sourceCode);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          await this.backoff(attempt);
        }
        // Use fallback model on last attempt
        const modelId = attempt < this.config.maxRetries
          ? this.config.modelId
          : this.config.fallbackModelId;

        const result = await this.invokeModel(modelId, prompt);
        if (validateSolidPayload(result)) {
          return { success: true, payload: result as SolidAnalysisPayload };
        }
        lastError = new Error("Invalid response schema from Bedrock");
      } catch (err) {
        lastError = err as Error;
      }
    }

    return { success: false, error: lastError?.message ?? "Unknown error" };
  }

  /**
   * Invoca el modelo de Bedrock con el prompt dado.
   * Usa el formato de mensajes de Anthropic (bedrock-2023-05-31).
   */
  private async invokeModel(modelId: string, prompt: string): Promise<unknown> {
    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content?.[0]?.text ?? "";
    return JSON.parse(content);
  }

  /**
   * Backoff exponencial: delay = 2^(attempt-1) * 1000 ms
   * Ejemplo: attempt 1 → 1000ms, attempt 2 → 2000ms, attempt 3 → 4000ms
   */
  private backoff(attempt: number): Promise<void> {
    const delay = Math.pow(2, attempt - 1) * 1000;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Retorna una copia inmutable de la configuración actual.
   */
  getConfig(): BedrockConfig {
    return { ...this.config };
  }
}
