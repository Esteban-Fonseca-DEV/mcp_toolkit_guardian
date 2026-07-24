import express, { Request, Response } from "express";
import path from "path";
import http from "http";
import { GuardianEventBus, AuditReport } from "@guardian/shared";
import { SSEChannel } from "./sse/SSEChannel";
import { calculateDashboardData, DashboardData } from "./calculations";

export class DashboardServer {
  private app = express();
  private server: http.Server | null = null;
  private sseChannel: SSEChannel;
  private currentReport: AuditReport | null = null;
  private currentData: DashboardData | null = null;
  private totalLines: number = 0;

  constructor(
    private eventBus: GuardianEventBus,
    private port: number = 4000
  ) {
    this.sseChannel = new SSEChannel(eventBus);
    this.setupRoutes();
    this.setupEventListeners();
  }

  private setupRoutes(): void {
    // Serve React SPA static assets
    this.app.use(express.static(path.join(__dirname, "../public")));

    // API REST routes
    this.app.get("/api/audit-data", (req: Request, res: Response) => {
      if (!this.currentReport) {
        return res.status(404).json({ error: "No audit data available. Run an analysis first." });
      }
      res.json(this.currentReport);
    });

    this.app.get("/api/health-score", (req: Request, res: Response) => {
      if (!this.currentData) {
        return res.status(404).json({ error: "No health score available. Run an analysis first." });
      }
      res.json({ healthScore: this.currentData.healthScore });
    });

    this.app.get("/api/dashboard-data", (req: Request, res: Response) => {
      if (!this.currentData) {
        return res.status(404).json({ error: "No dashboard data available. Run an analysis first." });
      }
      res.json(this.currentData);
    });

    // SSE endpoint for real-time events
    this.app.get("/api/events", (req: Request, res: Response) => {
      this.sseChannel.handleConnection(req, res);
    });

    // SPA fallback — serve index.html for all unmatched routes
    this.app.get("*", (req: Request, res: Response) => {
      const indexPath = path.join(__dirname, "../public/index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          res.status(404).json({ error: "Dashboard UI not built. Run the frontend build first." });
        }
      });
    });
  }

  private setupEventListeners(): void {
    this.eventBus.on("analysis:complete", (event) => {
      this.currentReport = event.report;
      this.currentData = calculateDashboardData(event.report, this.totalLines);
    });
  }

  /** Start the Express server */
  start(totalLines: number = 0): http.Server {
    this.totalLines = totalLines;
    this.server = this.app.listen(this.port, () => {
      process.stderr.write(`  Dashboard: http://localhost:${this.port}\n`);
    });
    return this.server;
  }

  /** Stop the server gracefully */
  stop(): void {
    this.sseChannel.closeAll();
    this.server?.close();
    this.server = null;
  }

  /** Get the underlying Express app (useful for testing) */
  getApp(): express.Application {
    return this.app;
  }

  /** Get the SSE channel instance */
  getSSEChannel(): SSEChannel {
    return this.sseChannel;
  }

  /** Update the total lines metric */
  setTotalLines(totalLines: number): void {
    this.totalLines = totalLines;
  }
}
