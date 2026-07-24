#!/usr/bin/env node
import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";
import { CleanGuardAgent } from "@guardian/clean-guard";
import { TddStrictAgent } from "@guardian/tdd-strict";
import { DddGuardAgent } from "@guardian/ddd-guard";
import { SecurityGuardAgent } from "@guardian/security-guard";
import { SolidCopilotAgent } from "@guardian/solid-copilot";
import { ConcurrencyGuardAgent } from "@guardian/concurrency-guard";
import { GoIdiomaticGuard, PyAsyncGuard, TsContractGuard, DartArchGuard, DotNetCleanGuard } from "@guardian/lang-specialists";
import { SemanticNamingAgent } from "@guardian/semantic-naming-guard";
import { Ruleset, AuditReport, IAgent, Violation, buildReport, computeStatus, AgentSummary, parseImportsMultiLang, getSupportedExtensions } from "@guardian/shared";
import { minimatch } from "minimatch";
import { formatReport } from "./formatter";
import { resolveExitCode } from "./exitCodeResolver";
import { createWatchCommand } from "./commands/watch";
import { createDashboardCommand } from "./commands/dashboard";

// All available agents
function getAllAgents(): IAgent[] {
  return [
    new CleanGuardAgent(),
    new TddStrictAgent(),
    new DddGuardAgent(),
    new SecurityGuardAgent(),
    new SolidCopilotAgent(),
    new ConcurrencyGuardAgent(),
    new GoIdiomaticGuard(),
    new PyAsyncGuard(),
    new TsContractGuard(),
    new DartArchGuard(),
    new DotNetCleanGuard(),
    new SemanticNamingAgent(),
  ];
}

// Default guardian config including agents
interface GuardianConfig {
  version: string;
  executionMode: string;
  layers: Array<{ name: string; paths: string[]; allowedDependencies: string[] }>;
  testConventions: Array<{ pattern: string }>;
  excludePaths: string[];
  agents: Record<string, { enabled: boolean }>;
}

function getDefaultConfig(): GuardianConfig {
  return {
    version: "1.0.0",
    executionMode: "local",
    layers: [
      { name: "domain", paths: ["src/domain/**"], allowedDependencies: [] },
      { name: "application", paths: ["src/application/**"], allowedDependencies: ["domain"] },
      { name: "infrastructure", paths: ["src/infrastructure/**"], allowedDependencies: ["domain", "application"] },
      { name: "presentation", paths: ["src/presentation/**"], allowedDependencies: ["application"] },
    ],
    testConventions: [{ pattern: "**/*.test.ts" }, { pattern: "**/*.spec.ts" }],
    excludePaths: ["node_modules", "dist", "coverage"],
    agents: {
      "clean-guard": { enabled: true },
      "tdd-strict": { enabled: true },
      "ddd-guard": { enabled: true },
      "security-guard": { enabled: true },
      "solid-copilot": { enabled: true },
      "concurrency-guard": { enabled: true },
    },
  };
}

// Simple inline RulesetLoader for CLI (avoids circular dep on @guardian/server)
async function loadRuleset(configPath: string): Promise<Ruleset> {
  const DEFAULT_RULESET: Ruleset = {
    version: "1.0.0",
    executionMode: "local",
    layers: [
      { name: "domain", paths: ["src/domain/**"], allowedDependencies: [] },
      { name: "application", paths: ["src/application/**"], allowedDependencies: ["domain"] },
      { name: "infrastructure", paths: ["src/infrastructure/**"], allowedDependencies: ["domain", "application"] },
      { name: "presentation", paths: ["src/presentation/**"], allowedDependencies: ["application"] },
    ],
    testConventions: [{ pattern: "**/*.test.ts" }, { pattern: "**/*.spec.ts" }],
    excludePaths: ["node_modules", "dist", "coverage"],
  };

  if (!fs.existsSync(configPath)) {
    // Auto-detect project structure and generate config
    const projectDir = path.dirname(configPath);
    process.stderr.write("  No .guardian.json found. Auto-detecting project structure...\n");

    try {
      const { guardianConfigure } = await import("@guardian/server");
      const result = await guardianConfigure({ directory: projectDir }, DEFAULT_RULESET);

      // The guardianConfigure function writes the file if it doesn't exist
      if (fs.existsSync(configPath)) {
        process.stderr.write(`  Generated .guardian.json (${result.configuration.architecture} architecture, ${result.configuration.detectedLanguages.join(", ")})\n`);
        process.stderr.write(`  Detected layers: ${result.configuration.suggestedLayers.map(l => l.name).join(", ")}\n`);
        process.stderr.write("\n");

        const content = fs.readFileSync(configPath, "utf-8");
        return JSON.parse(content) as Ruleset;
      }
    } catch (err) {
      process.stderr.write(`  Auto-detection failed: ${err instanceof Error ? err.message : String(err)}\n`);
      process.stderr.write("  Using default ruleset.\n\n");
    }

    return DEFAULT_RULESET;
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(content) as Ruleset;
  } catch {
    return DEFAULT_RULESET;
  }
}

function resolveFileLayer(filePath: string, ruleset: Ruleset): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  for (const layer of ruleset.layers) {
    for (const pattern of layer.paths) {
      if (minimatch(normalized, pattern)) {
        return layer.name;
      }
    }
  }
  return null;
}

function resolveImportLayer(importPath: string, sourceFilePath: string, ruleset: Ruleset): string | null {
  const normalized = importPath.replace(/\\/g, "/");

  // For relative imports (TypeScript, Dart), resolve against source file directory
  if (normalized.startsWith(".")) {
    const sourceDir = path.dirname(sourceFilePath).replace(/\\/g, "/");
    const resolvedImport = path.posix.normalize(sourceDir + "/" + normalized);
    for (const layer of ruleset.layers) {
      for (const pattern of layer.paths) {
        if (minimatch(resolvedImport, pattern) || 
            minimatch(resolvedImport + ".ts", pattern) || 
            minimatch(resolvedImport + "/index.ts", pattern)) {
          return layer.name;
        }
      }
    }
    return null;
  }

  // For absolute/package imports (Go, Java, Python, C#, Kotlin, Rust)
  // Strategy 1: Check if import contains the layer name as a path segment
  for (const layer of ruleset.layers) {
    // Check if the import path contains "/<layerName>/" or ends with "/<layerName>"
    const layerPattern = "/" + layer.name;
    if (normalized.includes(layerPattern + "/") || normalized.endsWith(layerPattern)) {
      return layer.name;
    }
    // Also check for common variations
    const variations = [layer.name];
    if (layer.name === "application") variations.push("service", "services", "use_cases", "usecases");
    if (layer.name === "presentation") variations.push("handler", "handlers", "controller", "controllers", "api");
    if (layer.name === "infrastructure") variations.push("infra", "persistence", "repositories");
    
    for (const variant of variations) {
      if (normalized.includes("/" + variant + "/") || normalized.endsWith("/" + variant)) {
        return layer.name;
      }
    }
  }

  // Strategy 2: Check against layer path patterns (strip glob suffixes)
  for (const layer of ruleset.layers) {
    for (const pattern of layer.paths) {
      const base = pattern.replace(/\/\*\*$/, "").replace(/\/\*$/, "");
      // Match last 2 segments of the base against the import
      const segments = base.split("/").filter(s => s.length > 0);
      if (segments.length >= 2) {
        const lastTwo = segments.slice(-2).join("/");
        if (normalized.includes(lastTwo)) {
          return layer.name;
        }
      }
    }
  }

  return null;
}

async function runLayerBoundaryAudit(directory: string, ruleset: Ruleset): Promise<Violation[]> {
  const { glob } = await import("glob");
  const supportedExts = getSupportedExtensions();
  const violations: Violation[] = [];

  // Find all source files
  let files: string[] = [];
  for (const ext of supportedExts) {
    const found = await glob(`**/*${ext}`, {
      cwd: directory,
      absolute: true,
      ignore: ruleset.excludePaths.map(p => `**/${p}/**`).concat(["**/*.d.ts", "**/*.test.*", "**/*.spec.*"]),
    });
    files.push(...found);
  }

  for (const file of files) {
    const relativePath = path.relative(directory, file).replace(/\\/g, "/");
    const sourceLayer = resolveFileLayer(relativePath, ruleset);

    if (!sourceLayer) continue; // File not in any defined layer — skip

    // Get allowed dependencies for this layer
    const layerDef = ruleset.layers.find(l => l.name === sourceLayer);
    if (!layerDef) continue;

    // Parse imports
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch { continue; }

    const imports = parseImportsMultiLang(file, content);
    if (!imports || imports.length === 0) continue;

    for (const imp of imports) {
      const targetLayer = resolveImportLayer(imp.targetModule, relativePath, ruleset);

      if (!targetLayer) continue; // Import target not in any defined layer — skip (stdlib, external packages)
      if (targetLayer === sourceLayer) continue; // Same layer — always OK

      // Check if this dependency is allowed
      if (!layerDef.allowedDependencies.includes(targetLayer)) {
        violations.push({
          filePath: relativePath,
          line: imp.line,
          description: `Layer '${sourceLayer}' cannot depend on layer '${targetLayer}'. Import: '${imp.targetModule}'. Allowed dependencies: [${layerDef.allowedDependencies.join(", ")}]`,
          severity: "error",
          rule: "LAYER_BOUNDARY_VIOLATION",
        });
      }
    }
  }

  return violations;
}

async function runAuditAll(directory: string, agents: IAgent[], ruleset: Ruleset): Promise<AuditReport> {
  const results: AuditReport[] = [];

  for (const agent of agents) {
    agent.initialize(ruleset);
    // Run relevant tools per agent
    for (const tool of agent.tools) {
      // Run directory-based tools (generate_dependency_graph, audit_ddd_*)
      if (tool.name === "generate_dependency_graph" ||
          tool.name === "audit_ddd_aggregate_access" ||
          tool.name === "audit_ddd_bounded_context") {
        results.push(await tool.handler({ directory }, ruleset));
      }
      // Run file-based tools on all .ts files for encapsulation
      if (tool.name === "audit_ddd_encapsulation") {
        const { glob } = await import("glob");
        const files = await glob("**/*.ts", {
          cwd: directory,
          absolute: true,
          ignore: ["**/node_modules/**", "**/dist/**", "**/*.test.ts", "**/*.spec.ts"],
        });
        for (const file of files) {
          results.push(await tool.handler({ filepath: file }, ruleset));
        }
      }
    }
  }

  // Run file-based language specialist tools on all source files
  const { glob } = await import("glob");
  const supportedExts = getSupportedExtensions();
  let allSourceFiles: string[] = [];
  for (const ext of supportedExts) {
    const found = await glob(`**/*${ext}`, {
      cwd: directory,
      absolute: true,
      ignore: ruleset.excludePaths.map(p => `**/${p}/**`).concat(["**/*.d.ts", "**/*.test.*", "**/*.spec.*", "**/*_test.*"]),
    });
    allSourceFiles.push(...found);
  }

  // Run language-specific idiom checks
  for (const agent of agents) {
    for (const tool of agent.tools) {
      if (tool.name.startsWith("audit_") && tool.name.includes("_idioms") && (tool.schema as Record<string, any>)?.properties?.filepath) {
        for (const file of allSourceFiles) {
          try {
            const report = await tool.handler({ filepath: file }, ruleset);
            if (report.violations.length > 0) {
              results.push(report);
            }
          } catch { /* skip */ }
        }
      }
      // Also run security on the directory
      if (tool.name === "audit_security_secrets") {
        try {
          results.push(await tool.handler({ directory }, ruleset));
        } catch { /* skip */ }
      }
    }
  }

  const allViolations: Violation[] = [];
  const byAgent: AgentSummary[] = [];

  // Run layer boundary validation (the core value of Guardian)
  const layerViolations = await runLayerBoundaryAudit(directory, ruleset);
  if (layerViolations.length > 0) {
    results.push(buildReport({
      agentName: "clean-guard",
      analyzedPath: directory,
      violations: layerViolations,
    }));
  }

  // Group by agent
  const agentMap = new Map<string, { errors: number; warnings: number }>();
  for (const report of results) {
    allViolations.push(...report.violations);
    const existing = agentMap.get(report.agentName) ?? { errors: 0, warnings: 0 };
    existing.errors += report.summary.errorCount;
    existing.warnings += report.summary.warningCount;
    agentMap.set(report.agentName, existing);
  }

  for (const [agentName, counts] of agentMap) {
    byAgent.push({
      agentName,
      errorCount: counts.errors,
      warningCount: counts.warnings,
    });
  }

  return buildReport({
    agentName: "guardian",
    analyzedPath: directory,
    violations: allViolations,
    summary: {
      errorCount: allViolations.filter(v => v.severity === "error").length,
      warningCount: allViolations.filter(v => v.severity === "warning").length,
      byAgent,
    },
  });
}

const program = new Command();

program
  .name("guardian")
  .description("Guardian MCP Toolkit — CLI para auditoria de codigo")
  .version("1.0.0");

// --- guardian audit ---
program
  .command("audit")
  .argument("[path]", "Directorio a analizar", ".")
  .description("Ejecutar auditoria completa sobre un directorio")
  .option("--format <type>", "Formato de salida: json | text", "text")
  .option("--fail-on <level>", "Umbral de fallo: error | warning", "error")
  .action(async (targetPath: string, options: { format: string; failOn: string }) => {
    const resolvedPath = path.resolve(targetPath);

    if (!fs.existsSync(resolvedPath)) {
      process.stderr.write(`Error: El path '${resolvedPath}' no existe.\n`);
      process.exit(2);
    }

    try {
      const configPath = path.join(resolvedPath, ".guardian.json");
      const ruleset = await loadRuleset(configPath);

      const agents: IAgent[] = getAllAgents();

      const report = await runAuditAll(resolvedPath, agents, ruleset);

      const output = formatReport(report, options.format as "json" | "text");
      if (options.format === "json") {
        process.stdout.write(output + "\n");
      } else {
        process.stderr.write(output + "\n");
      }

      const exitCode = resolveExitCode(report, options.failOn as "error" | "warning");
      process.exit(exitCode);
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(2);
    }
  });

// --- guardian fix ---
program
  .command("fix")
  .argument("[path]", "Directorio a reparar", ".")
  .description("Auto-reparar violaciones detectadas")
  .option("--apply", "Aplicar cambios sin confirmación", false)
  .action(async (targetPath: string, options: { apply: boolean }) => {
    const resolvedPath = path.resolve(targetPath);
    if (!fs.existsSync(resolvedPath)) {
      process.stderr.write(`Error: El path '${resolvedPath}' no existe.\n`);
      process.exit(2);
    }
    try {
      const configPath = path.join(resolvedPath, ".guardian.json");
      const ruleset = await loadRuleset(configPath);
      const agents: IAgent[] = getAllAgents();
      const report = await runAuditAll(resolvedPath, agents, ruleset);

      const { applyFixes } = await import("./fixEngine");
      const fixes = await applyFixes(report, resolvedPath, options.apply);

      if (fixes.length === 0) {
        process.stderr.write("  No auto-fixes available for detected violations.\n");
        process.exit(0);
      }

      process.stderr.write(`\n  Guardian Fix — ${fixes.length} fixes available:\n\n`);
      for (const fix of fixes) {
        const icon = fix.fixed ? "[FIX]" : "[SKIP]";
        process.stderr.write(`  ${icon} ${fix.violation.filePath}:${fix.violation.line}\n`);
        process.stderr.write(`        Action: ${fix.action}\n`);
        if (fix.diff) {
          process.stderr.write(`        ${fix.diff.split("\n").slice(0, 3).join("\n        ")}\n`);
        }
        process.stderr.write("\n");
      }

      if (options.apply) {
        process.stderr.write(`  Applied ${fixes.filter(f => f.fixed).length} fixes.\n`);
      } else {
        process.stderr.write("  Use --apply to apply fixes automatically.\n");
      }

      process.exit(0);
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(2);
    }
  });

// --- guardian init ---
program
  .command("init")
  .description("Inicializa configuracion .guardian.json en el directorio actual")
  .action(() => {
    const configPath = path.resolve(".guardian.json");

    if (fs.existsSync(configPath)) {
      process.stderr.write(`El archivo .guardian.json ya existe en ${path.dirname(configPath)}\n`);
      process.exit(1);
    }

    const config = getDefaultConfig();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    process.stderr.write(`Configuracion creada: ${configPath}\n`);
    process.stderr.write(`  - 6 agentes habilitados\n`);
    process.stderr.write(`  - 4 capas definidas (domain, application, infrastructure, presentation)\n`);
    process.stderr.write(`  - Modo: local\n`);
  });

// --- guardian agent ---
const agentCmd = program
  .command("agent")
  .description("Gestionar agentes de Guardian");

agentCmd
  .command("list")
  .description("Listar agentes disponibles con su estado")
  .action(() => {
    const configPath = path.resolve(".guardian.json");
    let config: GuardianConfig | null = null;

    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as GuardianConfig;
      } catch {
        // ignore parse errors, use defaults
      }
    }

    const agents = getAllAgents();

    // Table header
    const header = `  Agent              Version  Status    Tools`;
    const separator = `  ${"─".repeat(17)}  ${"─".repeat(7)}  ${"─".repeat(8)}  ${"─".repeat(5)}`;

    process.stderr.write(header + "\n");
    process.stderr.write(separator + "\n");

    for (const agent of agents) {
      const name = agent.name.padEnd(17);
      const version = agent.version.padEnd(7);
      const enabled = config?.agents?.[agent.name]?.enabled ?? true;
      const status = (enabled ? "enabled" : "disabled").padEnd(8);
      const toolCount = String(agent.tools.length);
      process.stderr.write(`  ${name}  ${version}  ${status}  ${toolCount}\n`);
    }
  });

agentCmd
  .command("enable")
  .argument("<name>", "Nombre del agente a activar")
  .description("Activar un agente en la configuracion")
  .action((name: string) => {
    const configPath = path.resolve(".guardian.json");

    if (!fs.existsSync(configPath)) {
      process.stderr.write(`Error: No existe .guardian.json. Ejecuta 'guardian init' primero.\n`);
      process.exit(1);
    }

    const validNames = getAllAgents().map(a => a.name);
    if (!validNames.includes(name)) {
      process.stderr.write(`Error: Agente '${name}' no encontrado. Agentes validos: ${validNames.join(", ")}\n`);
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as GuardianConfig;
    if (!config.agents) config.agents = {};
    config.agents[name] = { enabled: true };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    process.stderr.write(`Agente '${name}' activado.\n`);
  });

agentCmd
  .command("disable")
  .argument("<name>", "Nombre del agente a desactivar")
  .description("Desactivar un agente en la configuracion")
  .action((name: string) => {
    const configPath = path.resolve(".guardian.json");

    if (!fs.existsSync(configPath)) {
      process.stderr.write(`Error: No existe .guardian.json. Ejecuta 'guardian init' primero.\n`);
      process.exit(1);
    }

    const validNames = getAllAgents().map(a => a.name);
    if (!validNames.includes(name)) {
      process.stderr.write(`Error: Agente '${name}' no encontrado. Agentes validos: ${validNames.join(", ")}\n`);
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as GuardianConfig;
    if (!config.agents) config.agents = {};
    config.agents[name] = { enabled: false };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    process.stderr.write(`Agente '${name}' desactivado.\n`);
  });

// --- guardian mcp serve ---
const mcpCmd = program
  .command("mcp")
  .description("Comandos del servidor MCP");

mcpCmd
  .command("serve")
  .description("Iniciar el servidor MCP via stdio")
  .action(async () => {
    process.stderr.write("MCP Server listening on stdio...\n");
    const { startServer } = await import("@guardian/server");
    const configPath = process.env.GUARDIAN_CONFIG ?? ".guardian.json";
    await startServer(configPath);
  });

// --- guardian hooks ---
const hooksCmd = program
  .command("hooks")
  .description("Gestionar Git hooks de Guardian");

hooksCmd
  .command("install")
  .description("Instalar pre-commit y pre-push hooks que ejecutan guardian audit")
  .action(() => {
    try {
      const { installHooks } = require("./hooks");
      const result = installHooks(path.resolve("."));

      if (result.created.length > 0) {
        process.stderr.write(`  Hooks creados: ${result.created.join(", ")}\n`);
      }
      if (result.appended.length > 0) {
        process.stderr.write(`  Hooks actualizados: ${result.appended.join(", ")}\n`);
      }
      if (result.created.length === 0 && result.appended.length === 0) {
        process.stderr.write("  Guardian hooks ya estaban instalados.\n");
      }
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(2);
    }
  });

// --- guardian dashboard ---
program.addCommand(
  createDashboardCommand({
    loadRuleset,
    getAllAgents,
    runAuditAll,
  })
);

// --- guardian watch ---
program.addCommand(
  createWatchCommand({
    loadRuleset,
    getAllAgents,
  })
);

program.parse();
