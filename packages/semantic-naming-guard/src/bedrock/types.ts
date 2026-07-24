export interface NamingViolationEntry {
  line: number;
  identifier: string;
  rule:
    | "NAMING_BANNED_WORD"
    | "NAMING_EMPTY_VARIABLE"
    | "NAMING_FALSE_BOOLEAN"
    | "NAMING_VERB_INCONSISTENCY";
  description: string;
  suggestion?: string;
}

export interface NamingAnalysisPayload {
  violations: NamingViolationEntry[];
}

export interface NamingAnalysisResult {
  success: boolean;
  payload?: NamingAnalysisPayload;
  error?: string;
}

export interface NamingBedrockConfig {
  modelId: string;
  fallbackModelId: string;
  region: string;
  timeoutMs: number;
  maxRetries: number;
}
