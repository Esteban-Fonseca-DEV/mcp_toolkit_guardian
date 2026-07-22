import * as fs from "fs";
import { readdir } from "fs/promises";
import { join, relative } from "path";
import { Ruleset, AuditReport, buildReport, detectLanguage, SupportedLanguage } from "@guardian/shared";

export interface ProjectAnalysis {
  detectedLanguages: SupportedLanguage[];
  suggestedLayers: Array<{ name: string; paths: string[]; allowedDependencies: string[] }>;
  suggestedTestConventions: Array<{ pattern: string }>;
  suggestedExcludePaths: string[];
  architecture: "clean" | "hexagonal" | "ddd" | "unknown";
  confidence: "high" | "medium" | "low";
}

// Common architecture patterns by directory name
const LAYER_INDICATORS: Record<string, string> = {
  // Clean Architecture
  "domain": "domain",
  "entities": "domain",
  "models": "domain",
  "core": "domain",
  "application": "application",
  "services": "application",
  "service": "application",
  "use-cases": "application",
  "use_cases": "application",
  "usecases": "application",
  "infrastructure": "infrastructure",
  "infra": "infrastructure",
  "persistence": "infrastructure",
  "repositories": "infrastructure",
  "adapters": "infrastructure",
  "presentation": "presentation",
  "handlers": "presentation",
  "handler": "presentation",
  "controllers": "presentation",
  "controller": "presentation",
  "routes": "presentation",
  "api": "presentation",
  "ui": "presentation",
  "views": "presentation",
  "widgets": "presentation",
  // Hexagonal
  "ports": "application",
  "driven": "infrastructure",
  "driving": "presentation",
};

// Test file patterns by language
const TEST_PATTERNS: Record<SupportedLanguage, string[]> = {
  typescript: ["**/*.test.ts", "**/*.spec.ts"],
  go: ["**/*_test.go"],
  python: ["**/*_test.py", "**/test_*.py"],
  dart: ["**/*_test.dart"],
  java: ["**/*Test.java", "**/*Tests.java"],
  csharp: ["**/*Tests.cs", "**/*Test.cs"],
  kotlin: ["**/*Test.kt"],
  rust: ["**/*_test.rs"],
};

// Exclude patterns by language/framework
const EXCLUDE_PATTERNS: Record<string, string[]> = {
  typescript: ["node_modules", "dist", "build", ".next", "coverage"],
  go: ["vendor", "bin", ".cache"],
  python: ["__pycache__", ".venv", "venv", ".mypy_cache", ".pytest_cache"],
  dart: [".dart_tool", "build", ".flutter-plugins"],
  java: ["target", "build", ".gradle", "bin"],
  csharp: ["bin", "obj", ".vs", "packages"],
  kotlin: ["build", ".gradle"],
  rust: ["target"],
};

async function scanDirectories(dir: string, depth: number = 0, maxDepth: number = 4): Promise<string[]> {
  const dirs: string[] = [];
  if (depth > maxDepth) return dirs;

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "vendor" || entry.name === "__pycache__") continue;

      const fullPath = join(dir, entry.name);
      const relativePath = relative(dir, fullPath).replace(/\\/g, "/");
      dirs.push(relativePath);

      const subDirs = await scanDirectories(fullPath, depth + 1, maxDepth);
      dirs.push(...subDirs.map(s => `${relativePath}/${s}`));
    }
  } catch {
    /* skip unreadable dirs */
  }

  return dirs;
}

async function detectProjectLanguages(dir: string): Promise<SupportedLanguage[]> {
  const languages = new Set<SupportedLanguage>();

  try {
    const entries = await readdir(dir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const lang = detectLanguage(entry.name);
      if (lang) languages.add(lang);
      // Stop early if we've found enough
      if (languages.size >= 3) break;
    }
  } catch {
    // Fallback: check common files
    if (fs.existsSync(join(dir, "go.mod"))) languages.add("go");
    if (fs.existsSync(join(dir, "package.json"))) languages.add("typescript");
    if (fs.existsSync(join(dir, "requirements.txt")) || fs.existsSync(join(dir, "pyproject.toml"))) languages.add("python");
    if (fs.existsSync(join(dir, "pubspec.yaml"))) languages.add("dart");
    if (fs.existsSync(join(dir, "pom.xml")) || fs.existsSync(join(dir, "build.gradle"))) languages.add("java");
    if (fs.existsSync(join(dir, "Cargo.toml"))) languages.add("rust");
  }

  return Array.from(languages);
}

export async function guardianConfigure(
  args: { directory: string },
  _ruleset: Ruleset
): Promise<AuditReport & { configuration: ProjectAnalysis; generatedConfig: Ruleset }> {
  const { directory } = args;

  // 1. Scan directory structure
  const allDirs = await scanDirectories(directory);

  // 2. Detect languages
  const languages = await detectProjectLanguages(directory);
  const primaryLang = languages[0] ?? "typescript";

  // 3. Detect architecture layers
  const detectedLayers: Map<string, string[]> = new Map();

  for (const dir of allDirs) {
    const parts = dir.split("/");
    for (const part of parts) {
      const layerName = LAYER_INDICATORS[part.toLowerCase()];
      if (layerName) {
        const existing = detectedLayers.get(layerName) ?? [];
        existing.push(`${dir}/**`);
        detectedLayers.set(layerName, existing);
        break; // Only match first layer indicator per path
      }
    }
  }

  // 4. Build suggested layers with correct allowedDependencies
  const DEPENDENCY_RULES: Record<string, string[]> = {
    domain: [],
    application: ["domain"],
    infrastructure: ["domain", "application"],
    presentation: ["application", "domain"],
  };

  const suggestedLayers = Array.from(detectedLayers.entries()).map(([name, paths]) => ({
    name,
    paths: [...new Set(paths)], // deduplicate
    allowedDependencies: DEPENDENCY_RULES[name] ?? [],
  }));

  // 5. Determine architecture type
  let architecture: "clean" | "hexagonal" | "ddd" | "unknown" = "unknown";
  const layerNames = Array.from(detectedLayers.keys());

  if (layerNames.includes("domain") && layerNames.includes("infrastructure")) {
    architecture = "clean";
  }
  if (allDirs.some(d => d.includes("ports") || d.includes("adapters"))) {
    architecture = "hexagonal";
  }
  if (allDirs.some(d => d.includes("bounded") || d.includes("aggregate"))) {
    architecture = "ddd";
  }

  // 6. Build test conventions and excludes
  const testConventions = (TEST_PATTERNS[primaryLang] ?? TEST_PATTERNS.typescript).map(p => ({ pattern: p }));
  const excludePaths = EXCLUDE_PATTERNS[primaryLang] ?? EXCLUDE_PATTERNS.typescript;

  // 7. Confidence level
  const confidence = suggestedLayers.length >= 3 ? "high" : suggestedLayers.length >= 2 ? "medium" : "low";

  // 8. Build the generated config
  const generatedConfig: Ruleset = {
    version: "1.0.0",
    executionMode: "local",
    layers: suggestedLayers.length > 0 ? suggestedLayers : [
      { name: "domain", paths: ["**/domain/**"], allowedDependencies: [] },
      { name: "application", paths: ["**/application/**", "**/service/**", "**/services/**"], allowedDependencies: ["domain"] },
      { name: "infrastructure", paths: ["**/infrastructure/**", "**/infra/**"], allowedDependencies: ["domain", "application"] },
      { name: "presentation", paths: ["**/handler/**", "**/handlers/**", "**/controllers/**", "**/api/**"], allowedDependencies: ["application"] },
    ],
    testConventions,
    excludePaths: [...new Set([...excludePaths, ".git"])],
  };

  const analysis: ProjectAnalysis = {
    detectedLanguages: languages,
    suggestedLayers,
    suggestedTestConventions: testConventions,
    suggestedExcludePaths: excludePaths,
    architecture,
    confidence,
  };

  // 9. Optionally write the config
  const configPath = join(directory, ".guardian.json");
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(generatedConfig, null, 2) + "\n", "utf-8");
  }

  const report = buildReport({
    agentName: "guardian",
    analyzedPath: directory,
    violations: [],
  });

  return {
    ...report,
    configuration: analysis,
    generatedConfig,
  };
}
