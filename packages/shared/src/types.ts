// packages/shared/src/types.ts

export type Severity = "error" | "warning";
export type ExecutionStatus = "passed" | "failed" | "error";
export type ExecutionMode = "local" | "cloud";

export interface Violation {
  filePath: string;
  line: number;
  description: string;
  severity: Severity;
  rule?: string;
}

export interface AgentSummary {
  agentName: string;
  errorCount: number;
  warningCount: number;
}

export interface AuditReport {
  timestamp: string;             // ISO 8601
  agentName: string;
  analyzedPath: string;
  status: ExecutionStatus;
  violations: Violation[];
  summary: {
    errorCount: number;
    warningCount: number;
    byAgent?: AgentSummary[];    // solo para audit_all
  };
  error?: string;                // presente si status === "error"
}

export interface LayerRule {
  name: string;                  // e.g., "domain", "application"
  paths: string[];               // e.g., ["src/domain/**"]
  allowedDependencies: string[]; // capas que puede importar
  importPatterns?: string[];     // package-path patterns for languages like Go, Java, Python
}

export interface TestConvention {
  pattern: string;               // e.g., "**/*.spec.ts", "**/*_test.ts"
}

export interface AggregateConfig {
  root: string;
  internals: string[];
}

export interface DddConfig {
  aggregates?: Record<string, AggregateConfig>;
  boundedContexts?: Record<string, string[]>;
}

export interface CustomRuleConfig {
  id: string;
  layer: string;
  severity: string;
  message: string;
  forbidden_imports?: string[];
  max_lines?: number;
  required_patterns?: string[];
}

export interface Ruleset {
  version: string;
  executionMode: ExecutionMode;
  layers: LayerRule[];
  testConventions: TestConvention[];
  excludePaths: string[];
  ddd?: DddConfig;
  rules?: CustomRuleConfig[];
}
