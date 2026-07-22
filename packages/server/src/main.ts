import { startServer } from "./server";

// Error handling: keep the process alive on uncaught exceptions (Req 1.3)
process.on("uncaughtException", (err) => {
  console.error("[guardian-mcp-toolkit] Uncaught exception:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("[guardian-mcp-toolkit] Unhandled rejection:", reason);
});

// Entry point: start the MCP server
const configPath = process.env.GUARDIAN_CONFIG ?? ".guardian.json";
startServer(configPath).catch((err) => {
  console.error("[guardian-mcp-toolkit] Failed to start server:", err.message);
  process.exit(1);
});
