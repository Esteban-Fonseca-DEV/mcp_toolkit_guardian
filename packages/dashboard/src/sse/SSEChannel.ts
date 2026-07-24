import { IncomingMessage, ServerResponse } from "http";
import { GuardianEventBus, AnalysisCompleteEvent } from "@guardian/shared";

export interface SSEClient {
  id: string;
  response: ServerResponse;
}

export class SSEChannel {
  private clients: Map<string, SSEClient> = new Map();
  private clientCounter = 0;

  constructor(private eventBus: GuardianEventBus) {
    this.eventBus.on("analysis:complete", (data) => this.broadcast(data));
  }

  handleConnection(req: IncomingMessage, res: ServerResponse): void {
    const clientId = `client-${++this.clientCounter}`;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send initial heartbeat comment
    res.write(": connected\n\n");

    this.clients.set(clientId, { id: clientId, response: res });
    this.eventBus.emit("connection:status", { clientId, status: "connected" });

    req.on("close", () => {
      this.clients.delete(clientId);
      this.eventBus.emit("connection:status", { clientId, status: "disconnected" });
    });
  }

  broadcast(data: AnalysisCompleteEvent): void {
    const message = this.serializeSSE("audit-update", data);
    for (const [, client] of this.clients) {
      client.response.write(message);
    }
  }

  serializeSSE(eventType: string, data: unknown): string {
    const json = JSON.stringify(data);
    return `event: ${eventType}\ndata: ${json}\n\n`;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  closeAll(): void {
    for (const [, client] of this.clients) {
      client.response.end();
    }
    this.clients.clear();
  }
}
