import { AuditReport } from "./types";

export interface AnalysisCompleteEvent {
  report: AuditReport;
  healthScore: number;
  radarData: Record<string, number>; // agentName → compliance %
  timestamp: string;
}

export interface ConnectionStatusEvent {
  clientId: string;
  status: "connected" | "disconnected";
}

export interface WatcherErrorEvent {
  path: string;
  error: string;
}

export type GuardianEventMap = {
  "analysis:complete": AnalysisCompleteEvent;
  "connection:status": ConnectionStatusEvent;
  "watcher:error": WatcherErrorEvent;
};
