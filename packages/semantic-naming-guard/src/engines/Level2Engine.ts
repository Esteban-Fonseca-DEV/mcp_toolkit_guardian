import { Violation } from "@guardian/shared";
import { SemanticNamingConfig } from "../config";
import { BedrockNamingClient } from "../bedrock/BedrockNamingClient";
import { NamingAnalysisPayload } from "../bedrock/types";

/**
 * Level2Engine — Semantic validation engine using Amazon Bedrock.
 *
 * Invokes Claude via BedrockNamingClient to detect:
 * - Banned words (trash can words)
 * - Empty/ambiguous variables
 * - False booleans (noun-named booleans)
 * - Verb inconsistency within interfaces/classes
 *
 * All violations are returned with severity "warning".
 * Throws on failure so the Orchestrator can apply fallback.
 */
export class Level2Engine {
  private client: BedrockNamingClient;
  private config: SemanticNamingConfig;

  constructor(config: SemanticNamingConfig) {
    this.config = config;
    this.client = new BedrockNamingClient({ modelId: config.model, maxRetries: 2 });
  }

  async analyze(filePath: string, content: string): Promise<Violation[]> {
    const result = await this.client.analyzeNaming(content, this.config.banned_words);

    if (!result.success || !result.payload) {
      throw new Error(result.error ?? "Bedrock analysis failed");
    }

    return this.mapPayloadToViolations(filePath, result.payload);
  }

  private mapPayloadToViolations(filePath: string, payload: NamingAnalysisPayload): Violation[] {
    return payload.violations.map(v => ({
      filePath,
      line: v.line,
      description: v.suggestion
        ? `${v.description}. Sugerencia: ${v.suggestion}`
        : v.description,
      severity: "warning" as const,
      rule: v.rule,
    }));
  }
}
