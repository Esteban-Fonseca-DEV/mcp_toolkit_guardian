import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { NamingAnalysisPayload, NamingAnalysisResult, NamingBedrockConfig } from "./types";
import { buildNamingPrompt } from "./promptBuilder";

/**
 * Client for Amazon Bedrock that performs semantic naming analysis.
 *
 * Implements retry with exponential backoff and fallback to Haiku model
 * on the last attempt to optimize cost and availability.
 */
export class BedrockNamingClient {
  private client: BedrockRuntimeClient;
  private config: NamingBedrockConfig;

  constructor(config: Partial<NamingBedrockConfig> = {}) {
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
   * Analyzes source code for naming violations using Amazon Bedrock.
   *
   * - Attempt 0: primary model (Sonnet)
   * - Attempt 1..N-1: primary model with exponential backoff
   * - Last attempt (N): fallback model (Haiku) with exponential backoff
   *
   * @param sourceCode - Source code to analyze
   * @param bannedWords - List of banned words to check against
   * @returns Analysis result with success/error
   */
  async analyzeNaming(sourceCode: string, bannedWords: string[]): Promise<NamingAnalysisResult> {
    const prompt = buildNamingPrompt(sourceCode, bannedWords);
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
        return { success: true, payload: result as NamingAnalysisPayload };
      } catch (err) {
        lastError = err as Error;
      }
    }

    return { success: false, error: lastError?.message ?? "Unknown error" };
  }

  /**
   * Invokes the Bedrock model with the given prompt.
   * Uses the Anthropic Messages API format (bedrock-2023-05-31).
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
    const content = responseBody.content?.[0]?.text ?? "{}";
    return JSON.parse(content);
  }

  /**
   * Exponential backoff: delay = 2^(attempt-1) * 1000 ms
   * Example: attempt 1 → 1000ms, attempt 2 → 2000ms, attempt 3 → 4000ms
   */
  private backoff(attempt: number): Promise<void> {
    const delay = Math.pow(2, attempt - 1) * 1000;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Returns an immutable copy of the current configuration.
   */
  getConfig(): NamingBedrockConfig {
    return { ...this.config };
  }
}
