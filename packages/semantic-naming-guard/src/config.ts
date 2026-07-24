export interface SemanticNamingConfig {
  enabled: boolean;
  engine: "local" | "bedrock";
  model: string;
  strict_boolean_predicates: boolean;
  banned_words: string[];
}

const DEFAULT_BANNED_WORDS = [
  "Manager",
  "Util",
  "Utils",
  "Helper",
  "Helpers",
  "Service",
  "Processor",
  "Handler",
  "Controller",
  "Base",
  "Common",
  "Misc",
  "General",
];

const DEFAULT_CONFIG: SemanticNamingConfig = {
  enabled: true,
  engine: "local",
  model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
  strict_boolean_predicates: false,
  banned_words: DEFAULT_BANNED_WORDS,
};

export function parseSemanticNamingConfig(
  raw: Record<string, unknown>
): SemanticNamingConfig {
  return {
    enabled:
      typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_CONFIG.enabled,
    engine:
      raw.engine === "bedrock"
        ? "bedrock"
        : raw.engine === "local"
          ? "local"
          : DEFAULT_CONFIG.engine,
    model:
      typeof raw.model === "string" ? raw.model : DEFAULT_CONFIG.model,
    strict_boolean_predicates:
      typeof raw.strict_boolean_predicates === "boolean"
        ? raw.strict_boolean_predicates
        : DEFAULT_CONFIG.strict_boolean_predicates,
    banned_words: Array.isArray(raw.banned_words)
      ? raw.banned_words
      : DEFAULT_CONFIG.banned_words,
  };
}

export function serializeSemanticNamingConfig(
  config: SemanticNamingConfig
): Record<string, unknown> {
  return { ...config };
}
