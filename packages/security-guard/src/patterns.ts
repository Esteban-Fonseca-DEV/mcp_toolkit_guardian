export interface SecretPattern {
  name: string;
  pattern: RegExp;
  description: string;
}

export const DEFAULT_SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "AWS_ACCESS_KEY",
    pattern: /AKIA[0-9A-Z]{16}/,
    description: "AWS Access Key ID",
  },
  {
    name: "AWS_SECRET_KEY",
    pattern: /(?:aws_secret|secret_access_key|aws_secret_access_key)\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}["']?/i,
    description: "AWS Secret Access Key (preceded by identifying keyword)",
  },
  {
    name: "GITHUB_TOKEN",
    pattern: /ghp_[A-Za-z0-9]{36}/,
    description: "GitHub Personal Access Token",
  },
  {
    name: "GITHUB_OAUTH",
    pattern: /gho_[A-Za-z0-9]{36}/,
    description: "GitHub OAuth Access Token",
  },
  {
    name: "JWT_TOKEN",
    pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/,
    description: "JSON Web Token",
  },
  {
    name: "DATABASE_URL",
    pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s"']+:[^\s"']+@/,
    description: "Database connection string with embedded credentials",
  },
  {
    name: "PRIVATE_KEY",
    pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    description: "Private key (RSA/EC) in PEM format",
  },
  {
    name: "GENERIC_PASSWORD",
    pattern: /(?:password|passwd|pwd|secret)\s*[:=]\s*["'][^"']{4,}["']/i,
    description: "Generic password or secret assignment",
  },
];
