/**
 * Default regex patterns for detecting exposed secrets and credentials.
 * Each pattern includes a type identifier and the regex to match.
 */

export interface SecretPattern {
  type: string;
  description: string;
  pattern: RegExp;
}

/**
 * Default set of secret detection patterns.
 * Covers: AWS keys, GitHub tokens, JWT, database URLs, private keys, generic passwords.
 */
export const DEFAULT_SECRET_PATTERNS: SecretPattern[] = [
  // AWS Access Key ID
  {
    type: "AWS_ACCESS_KEY",
    description: "AWS Access Key ID detected",
    pattern: /(?:^|[^A-Z0-9])(?:AKIA[0-9A-Z]{16})(?:[^A-Z0-9]|$)/,
  },
  // AWS Secret Access Key (base64-like 40 chars after assignment)
  {
    type: "AWS_SECRET_KEY",
    description: "AWS Secret Access Key detected",
    pattern: /(?:aws_secret_access_key|secret_access_key|aws_secret)\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/i,
  },
  // GitHub Personal Access Token
  {
    type: "GITHUB_TOKEN",
    description: "GitHub Personal Access Token detected",
    pattern: /(?:^|[^a-zA-Z0-9_])(?:ghp_[A-Za-z0-9]{36,})(?:[^a-zA-Z0-9_]|$)/,
  },
  // GitHub OAuth App Token
  {
    type: "GITHUB_OAUTH",
    description: "GitHub OAuth Token detected",
    pattern: /(?:^|[^a-zA-Z0-9_])(?:gho_[A-Za-z0-9]{36,})(?:[^a-zA-Z0-9_]|$)/,
  },
  // JWT Token (three base64url parts separated by dots)
  {
    type: "JWT_TOKEN",
    description: "JWT Token detected",
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  },
  // Database connection string with credentials
  {
    type: "DATABASE_URL",
    description: "Database connection string with credentials detected",
    pattern: /(?:mongodb|postgres|postgresql|mysql|redis|amqp):\/\/[^:\s]+:[^@\s]+@[^\s]+/i,
  },
  // Private key (PEM format header)
  {
    type: "PRIVATE_KEY",
    description: "Private key (PEM format) detected",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
  // Generic password assignment
  {
    type: "GENERIC_PASSWORD",
    description: "Hardcoded password assignment detected",
    pattern: /(?:password|passwd|pwd|secret|token|api_key|apikey)\s*[=:]\s*["'][^"']{4,}["']/i,
  },
  // Generic API key assignment
  {
    type: "API_KEY",
    description: "Hardcoded API key assignment detected",
    pattern: /(?:api[_-]?key|access[_-]?key|auth[_-]?token)\s*[=:]\s*["'][A-Za-z0-9_\-]{16,}["']/i,
  },
  // Slack webhook URL
  {
    type: "SLACK_WEBHOOK",
    description: "Slack Webhook URL detected",
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[a-zA-Z0-9]+/,
  },
];

/**
 * Merge custom patterns from Governance_Policy with defaults.
 * Custom patterns override defaults with same type.
 */
export function resolvePatterns(customPatterns?: SecretPattern[]): SecretPattern[] {
  if (!customPatterns || customPatterns.length === 0) return DEFAULT_SECRET_PATTERNS;

  const mergedMap = new Map<string, SecretPattern>();
  for (const p of DEFAULT_SECRET_PATTERNS) {
    mergedMap.set(p.type, p);
  }
  for (const p of customPatterns) {
    mergedMap.set(p.type, p);
  }
  return [...mergedMap.values()];
}
