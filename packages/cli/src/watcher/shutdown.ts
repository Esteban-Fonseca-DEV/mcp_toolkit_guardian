import * as http from "http";
import { GuardianFileWatcher } from "./FileWatcher";
import { SSEChannel } from "@guardian/dashboard";

/**
 * Sets up graceful shutdown handlers for SIGINT and SIGTERM signals.
 * On signal: stops FileWatcher, closes SSE connections, closes HTTP server,
 * clears timers, and exits with code 0.
 */
export function setupGracefulShutdown(
  watcher: GuardianFileWatcher,
  server: http.Server | null,
  sseChannel: SSEChannel | null
): void {
  const cleanup = () => {
    process.stderr.write("\n  Shutting down Guardian watch...\n");
    watcher.stop();
    sseChannel?.closeAll();
    server?.close();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
