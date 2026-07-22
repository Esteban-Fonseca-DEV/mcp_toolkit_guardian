/**
 * Multi-language import parser.
 * Detects import statements in source files using regex patterns per language.
 * This enables Guardian to audit Clean Architecture boundaries in any language.
 */

export interface ImportStatement {
  sourcePath: string;
  targetModule: string;
  line: number;
}

export type SupportedLanguage = "typescript" | "go" | "python" | "dart" | "java" | "csharp" | "kotlin" | "rust";

interface LanguageConfig {
  extensions: string[];
  importPatterns: RegExp[];
  commentPatterns: RegExp[];
}

const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  typescript: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    importPatterns: [
      /import\s+.*\s+from\s+['"]([^'"]+)['"]/,
      /import\s+['"]([^'"]+)['"]/,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/,
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/,
    ],
    commentPatterns: [/^\s*\/\//, /^\s*\/\*/],
  },
  go: {
    extensions: [".go"],
    importPatterns: [
      /^\s*"([^"]+)"\s*$/,
      /^\s*\w+\s+"([^"]+)"\s*$/,
      /import\s+"([^"]+)"/,
    ],
    commentPatterns: [/^\s*\/\//],
  },
  python: {
    extensions: [".py"],
    importPatterns: [
      /^from\s+([\w.]+)\s+import/,
      /^import\s+([\w.]+)/,
    ],
    commentPatterns: [/^\s*#/],
  },
  dart: {
    extensions: [".dart"],
    importPatterns: [
      /import\s+['"]([^'"]+)['"]/,
      /export\s+['"]([^'"]+)['"]/,
      /part\s+['"]([^'"]+)['"]/,
    ],
    commentPatterns: [/^\s*\/\//],
  },
  java: {
    extensions: [".java"],
    importPatterns: [
      /^import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/,
    ],
    commentPatterns: [/^\s*\/\//, /^\s*\/?\*/],
  },
  csharp: {
    extensions: [".cs"],
    importPatterns: [
      /^using\s+(?:static\s+)?([\w.]+)\s*;/,
      /^using\s+\w+\s*=\s*([\w.]+)\s*;/,
    ],
    commentPatterns: [/^\s*\/\//],
  },
  kotlin: {
    extensions: [".kt", ".kts"],
    importPatterns: [
      /^import\s+([\w.]+(?:\*)?)/,
    ],
    commentPatterns: [/^\s*\/\//],
  },
  rust: {
    extensions: [".rs"],
    importPatterns: [
      /^use\s+([\w:]+(?:::\*)?)\s*;/,
      /^use\s+([\w]+(?:::[\w]+)*)(?:::)\s*\{/,
      /^mod\s+(\w+)/,
    ],
    commentPatterns: [/^\s*\/\//],
  },
};

/**
 * Detects the language of a file based on its extension.
 */
export function detectLanguage(filepath: string): SupportedLanguage | null {
  const ext = filepath.slice(filepath.lastIndexOf(".")).toLowerCase();
  for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
    if (config.extensions.includes(ext)) {
      return lang as SupportedLanguage;
    }
  }
  return null;
}

/**
 * Parses imports from any supported language file using regex.
 * Returns null if the language is not supported.
 */
export function parseImportsMultiLang(
  filepath: string,
  content: string
): ImportStatement[] | null {
  const lang = detectLanguage(filepath);
  if (!lang) return null;

  const config = LANGUAGE_CONFIGS[lang];
  const lines = content.split("\n");
  const imports: ImportStatement[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments
    if (config.commentPatterns.some(p => p.test(line))) continue;

    // Try each import pattern
    for (const pattern of config.importPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        imports.push({
          sourcePath: filepath,
          targetModule: match[1],
          line: i + 1,
        });
        break; // Only match once per line
      }
    }
  }

  return imports;
}

/**
 * Returns the list of supported file extensions.
 */
export function getSupportedExtensions(): string[] {
  return Object.values(LANGUAGE_CONFIGS).flatMap(c => c.extensions);
}

/**
 * Returns language-specific layer resolution patterns.
 * Maps import module paths to architectural layers.
 */
export function resolveLayerFromImport(
  importPath: string,
  _language: SupportedLanguage,
  layers: Array<{ name: string; paths: string[] }>
): string | null {
  // Normalize the import path for matching
  const normalized = importPath.replace(/\\/g, "/");

  for (const layer of layers) {
    for (const pattern of layer.paths) {
      // Direct string matching for package-style imports (Go, Java, Python)
      if (normalized.includes(pattern.replace("/**", "").replace("/*", "").replace("*", ""))) {
        return layer.name;
      }
    }
  }

  return null;
}
