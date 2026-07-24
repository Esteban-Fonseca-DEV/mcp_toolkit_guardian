import { Violation, SupportedLanguage, detectLanguage } from "@guardian/shared";
import { SemanticNamingConfig } from "../config";

/**
 * Interface that all language-specific analyzers must implement.
 * Each analyzer detects naming convention violations for a given language.
 */
export interface LanguageAnalyzer {
  analyze(filePath: string, content: string, config: SemanticNamingConfig): Violation[];
}

/**
 * Level1Engine — Local syntactic validation engine.
 * Detects naming convention violations using regex-based analysis per language.
 * Executes in <500ms without network calls (Requirement 13.2).
 */
export class Level1Engine {
  private analyzers: Map<string, LanguageAnalyzer>;

  constructor(private config: SemanticNamingConfig) {
    this.analyzers = new Map();
    // Analyzers will be registered by the Orchestrator or externally
  }

  /**
   * Register a language-specific analyzer.
   */
  registerAnalyzer(language: string, analyzer: LanguageAnalyzer): void {
    this.analyzers.set(language, analyzer);
  }

  /**
   * Analyze a file for naming violations.
   * Detects the language from the file extension and delegates to the appropriate analyzer.
   */
  analyze(filePath: string, content: string): Violation[] {
    const language = detectLanguage(filePath);
    if (!language) return [];

    const analyzer = this.analyzers.get(language);
    if (!analyzer) return [];

    return analyzer.analyze(filePath, content, this.config);
  }
}
