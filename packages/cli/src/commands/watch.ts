import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import { Ruleset, AuditReport, IAgent, Violation, buildReport, AgentSummary, GuardianEventBus, AnalysisCompleteEvent } from "@guardian/shared";
import { GuardianFileWatcher, FileChangeEvent } from "../watcher/FileWatcher";
import { SSEChannel } from "@guardian/dashboard";

export interface WatchCommandDeps {
  loadRuleset: (configPath: string) => Promise<Ruleset>;
  getAllAgents: () => IAgent[];
}

/**
 * Format violations to stderr with filePath, line and description.
 */
export function formatViolationsToStderr(violations: Violation[]): void {
  if (violations.length === 0) return;

  process.stderr.write("\n");
  for (const v of violations) {
    const icon = v.severity === "error" ? "[ERROR]" : "[WARN]";
    process.stderr.write(`  ${icon} ${v.filePath}:${v.line} — ${v.description}\n`);
  }
  process.stderr.write("\n");
}

/**
 * Run analysis on specific file paths using Smart Router logic.
 * Selects relevant agents based on file type and runs their tools.
 */
async function runAnalysisOnFiles(
  filePaths: string[],
  agents: IAgent[],
  ruleset: Ruleset,
  directory: string
): Promise<AuditReport> {
  const results: AuditReport[] = [];

  for (const agent of agents) {
    agent.initialize(ruleset);

    for (const tool of agent.tools) {
      // Run file-based tools on the changed files
      if (tool.name.startsWith("audit_") || tool.name.startsWith("evaluate_")) {
        const schema = tool.schema as Record<string, unknown>;
        const properties = schema?.properties as Record<string, unknown> | undefined;

        if (properties?.filepath) {
          // File-based tool
          for (const filePath of filePaths) {
            try {
              const report = await tool.handler({ filepath: filePath }, ruleset);
              if (report.violations.length > 0) {
                results.push(report);
              }
            } catch {
              // Skip individual file errors
            }
          }
        } else if (properties?.directory) {
          // Directory-based tool — run on the project directory
          try {
            const report = await tool.handler({ directory }, ruleset);
            if (report.violations.length > 0) {
              results.push(report);
            }
          } catch {
            // Skip errors
          }
        }
      }
    }
  }

  // Consolidate results
  const allViolations: Violation[] = [];
  const agentMap = new Map<string, { errors: number; warnings: number }>();

  for (const report of results) {
    allViolations.push(...report.violations);
    const existing = agentMap.get(report.agentName) ?? { errors: 0, warnings: 0 };
    existing.errors += report.summary.errorCount;
    existing.warnings += report.summary.warningCount;
    agentMap.set(report.agentName, existing);
  }

  const byAgent: AgentSummary[] = [];
  for (const [agentName, counts] of agentMap) {
    byAgent.push({ agentName, errorCount: counts.errors, warningCount: counts.warnings });
  }

  return buildReport({
    agentName: "guardian",
    analyzedPath: directory,
    violations: allViolations,
    summary: {
      errorCount: allViolations.filter((v) => v.severity === "error").length,
      warningCount: allViolations.filter((v) => v.severity === "warning").length,
      byAgent,
    },
  });
}

/**
 * Calculate radar data (compliance % per agent) from a report.
 */
function calculateRadarData(report: AuditReport): Record<string, number> {
  const radar: Record<string, number> = {};
  const agentSummaries = report.summary.byAgent ?? [];

  for (const agent of agentSummaries) {
    const penalty = agent.errorCount * 10 + agent.warningCount * 3;
    radar[agent.agentName] = Math.max(0, Math.min(100, 100 - penalty));
  }

  return radar;
}

/**
 * Calculate health score from error count and total lines.
 */
function calculateHealthScore(errorCount: number, totalLines: number): number {
  if (totalLines <= 0) return 100;
  const raw = (1 - errorCount / totalLines) * 100;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/**
 * Create and register the `guardian watch` command.
 */
export function createWatchCommand(deps: WatchCommandDeps): Command {
  const watchCmd = new Command("watch")
    .argument("[path]", "Directorio a vigilar", ".")
    .description("Iniciar modo live: vigilar cambios y analizar en tiempo real")
    .option("--port <number>", "Puerto para el SSE Channel y Dashboard", "4000")
    .action(async (targetPath: string, options: { port: string }) => {
      const resolvedPath = path.resolve(targetPath);

      if (!fs.existsSync(resolvedPath)) {
        process.stderr.write(`Error: El path '${resolvedPath}' no existe.\n`);
        process.exit(2);
      }

      const configPath = path.join(resolvedPath, ".guardian.json");
      const ruleset = await deps.loadRuleset(configPath);
      const agents = deps.getAllAgents();
      const port = parseInt(options.port, 10);

      // Initialize agents
      for (const agent of agents) {
        agent.initialize(ruleset);
      }

      // Instantiate EventBus
      const eventBus = new GuardianEventBus();

      // Instantiate SSEChannel
      const sseChannel = new SSEChannel(eventBus);

      // Create a minimal HTTP server for SSE
      const server = http.createServer((req, res) => {
        if (req.url === "/api/events") {
          sseChannel.handleConnection(req, res);
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not found" }));
        }
      });

      server.listen(port, () => {
        process.stderr.write(`\n  Guardian Watch Mode\n`);
        process.stderr.write(`  Watching: ${resolvedPath}\n`);
        process.stderr.write(`  SSE endpoint: http://localhost:${port}/api/events\n`);
        process.stderr.write(`  Press Ctrl+C to stop.\n\n`);
      });

      // Watcher callback: run analysis, emit events, format violations
      const onFileChange = async (event: FileChangeEvent): Promise<void> => {
        const { paths: changedPaths } = event;
        const fileNames = changedPaths.map((p) => path.relative(resolvedPath, p)).join(", ");
        process.stderr.write(`  [watch] Change detected: ${fileNames}\n`);

        try {
          const report = await runAnalysisOnFiles(changedPaths, agents, ruleset, resolvedPath);

          // Calculate metrics
          const healthScore = calculateHealthScore(
            report.summary.errorCount,
            1000 // approximate; full line counting is expensive per change
          );
          const radarData = calculateRadarData(report);

          // Emit analysis:complete event to EventBus
          const analysisEvent: AnalysisCompleteEvent = {
            report,
            healthScore,
            radarData,
            timestamp: new Date().toISOString(),
          };
          eventBus.emit("analysis:complete", analysisEvent);

          // Format violations to stderr
          formatViolationsToStderr(report.violations);

          if (report.violations.length === 0) {
            process.stderr.write(`  [watch] No violations found.\n`);
          } else {
            process.stderr.write(`  [watch] ${report.summary.errorCount} errors, ${report.summary.warningCount} warnings\n`);
          }
        } catch (err) {
          process.stderr.write(`  [watch] Analysis error: ${err instanceof Error ? err.message : String(err)}\n`);
          eventBus.emit("watcher:error", {
            path: changedPaths[0] ?? resolvedPath,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      };

      // Instantiate FileWatcher
      const watcher = new GuardianFileWatcher(resolvedPath, ruleset, onFileChange);
      watcher.start();

      // Graceful shutdown
      const cleanup = () => {
        process.stderr.write("\n  Shutting down Guardian watch...\n");
        watcher.stop();
        sseChannel.closeAll();
        server.close();
        process.exit(0);
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);
    });

  return watchCmd;
}
