import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { Ruleset, IAgent, GuardianEventBus } from "@guardian/shared";
import { DashboardServer, calculateDashboardData } from "@guardian/dashboard";

export interface DashboardCommandDeps {
  loadRuleset: (configPath: string) => Promise<Ruleset>;
  getAllAgents: () => IAgent[];
  runAuditAll: (directory: string, agents: IAgent[], ruleset: Ruleset) => Promise<import("@guardian/shared").AuditReport>;
}

/**
 * Open the user's default browser at a given URL.
 * Platform-aware: uses `start` on Windows, `open` on macOS, `xdg-open` on Linux.
 */
function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;

  if (platform === "win32") {
    command = `start "" "${url}"`;
  } else if (platform === "darwin") {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      process.stderr.write(`  Could not open browser automatically. Visit: ${url}\n`);
    }
  });
}

/**
 * Count total lines of source code in a directory (approximate).
 */
async function countTotalLines(directory: string, excludePaths: string[]): Promise<number> {
  const { glob } = await import("glob");
  const files = await glob("**/*.{ts,js,go,py,dart,cs,kt,rs}", {
    cwd: directory,
    ignore: excludePaths.map((p) => `**/${p}/**`).concat(["**/*.d.ts", "**/*.test.*", "**/*.spec.*"]),
  });

  let totalLines = 0;
  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(directory, f), "utf-8");
      totalLines += content.split("\n").length;
    } catch {
      // Skip unreadable files
    }
  }
  return totalLines;
}

/**
 * Create and register the `guardian dashboard` command.
 */
export function createDashboardCommand(deps: DashboardCommandDeps): Command {
  const dashboardCmd = new Command("dashboard")
    .description("Levantar dashboard interactivo con metricas en tiempo real")
    .option("--port <number>", "Puerto del servidor HTTP del dashboard", "4000")
    .action(async (options: { port: string }) => {
      const resolvedPath = path.resolve(".");
      const configPath = path.join(resolvedPath, ".guardian.json");
      const port = parseInt(options.port, 10);

      process.stderr.write("\n  Guardian Dashboard\n");
      process.stderr.write("  Loading ruleset...\n");

      // 1. Load ruleset
      const ruleset = await deps.loadRuleset(configPath);
      const agents = deps.getAllAgents();

      // 2. Run full audit at startup
      process.stderr.write("  Running full audit...\n");
      const report = await deps.runAuditAll(resolvedPath, agents, ruleset);

      // 3. Count total lines for health score calculation
      const totalLines = await countTotalLines(resolvedPath, ruleset.excludePaths ?? []);

      // 4. Calculate dashboard data
      const dashboardData = calculateDashboardData(report, totalLines);

      // 5. Start DashboardServer with EventBus
      const eventBus = new GuardianEventBus();
      const server = new DashboardServer(eventBus, port);

      // Emit initial data so the server has it available
      eventBus.emit("analysis:complete", {
        report,
        healthScore: dashboardData.healthScore,
        radarData: dashboardData.radarData,
        timestamp: new Date().toISOString(),
      });

      server.start(totalLines);

      const url = `http://localhost:${port}`;
      process.stderr.write(`\n  Dashboard running at ${url}\n`);
      process.stderr.write(`  Health Score: ${dashboardData.healthScore}/100\n`);
      process.stderr.write(`  Violations: ${dashboardData.violations.errors} errors, ${dashboardData.violations.warnings} warnings\n`);
      process.stderr.write(`  Press Ctrl+C to stop.\n\n`);

      // 6. Open browser automatically
      openBrowser(url);

      // 7. Graceful shutdown
      const cleanup = () => {
        process.stderr.write("\n  Shutting down Guardian dashboard...\n");
        server.stop();
        process.exit(0);
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);
    });

  return dashboardCmd;
}
