import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { BedrockClient } from "../bedrock/BedrockClient";

/**
 * **Validates: Requirements 7.2**
 *
 * Property 10: Configuración de Bedrock respeta .guardian.json
 * Cuando se proveen model_id y fallback_model_id en config,
 * el BedrockClient los usa en lugar de defaults.
 */
describe("BedrockConfig - Property-Based Tests", () => {
  it("Property 10: provided model_id and fallback_model_id are used instead of defaults", () => {
    const modelIdArb = fc.string({ minLength: 5, maxLength: 80 }).filter(
      (s) => s !== "anthropic.claude-3-5-sonnet-20241022-v2:0"
    );
    const fallbackModelIdArb = fc.string({ minLength: 5, maxLength: 80 }).filter(
      (s) => s !== "anthropic.claude-3-haiku-20240307-v1:0"
    );

    fc.assert(
      fc.property(modelIdArb, fallbackModelIdArb, (modelId, fallbackModelId) => {
        const client = new BedrockClient({
          modelId,
          fallbackModelId,
          region: "us-east-1",
        });

        const config = client.getConfig();

        // The client must use the provided values, not defaults
        expect(config.modelId).toBe(modelId);
        expect(config.fallbackModelId).toBe(fallbackModelId);
      }),
      { numRuns: 100 }
    );
  });

  it("Property 10b: defaults are used when no config is provided", () => {
    const client = new BedrockClient({ region: "us-east-1" });
    const config = client.getConfig();

    expect(config.modelId).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0");
    expect(config.fallbackModelId).toBe("anthropic.claude-3-haiku-20240307-v1:0");
  });

  it("Property 10c: region config is respected", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("us-east-1", "us-west-2", "eu-west-1", "ap-northeast-1"),
        (region) => {
          const client = new BedrockClient({ region });
          const config = client.getConfig();
          expect(config.region).toBe(region);
        }
      ),
      { numRuns: 100 }
    );
  });
});
