import { AuditReport, Ruleset, buildReport } from "@guardian/shared";

export type TddPhase = "Red" | "Green" | "Refactor";

export interface TddEvent {
  phase: TddPhase;
  timestamp: string;
  description: string;
}

/**
 * Session events store. Key: session_id, Value: array of TDD lifecycle events.
 */
export const sessionEvents: Map<string, TddEvent[]> = new Map();

/**
 * Records a TDD lifecycle event for a session.
 */
export function recordTddEvent(sessionId: string, event: TddEvent): void {
  if (!sessionEvents.has(sessionId)) {
    sessionEvents.set(sessionId, []);
  }
  sessionEvents.get(sessionId)!.push(event);
}

/**
 * Generates a Mermaid stateDiagram-v2 documenting the Red-Green-Refactor cycle
 * for a given session. Text is rendered in black (#000000) for legibility.
 * (Req 3.4)
 */
export async function generateTddLifecycleReport(
  args: { session_id: string },
  ruleset: Ruleset
): Promise<AuditReport> {
  const { session_id } = args;
  const events = sessionEvents.get(session_id) ?? [];

  const mermaidDiagram = generateMermaidDiagram(events);

  return buildReport({
    agentName: "tdd-strict",
    analyzedPath: session_id,
    violations: [],
  });
}

/**
 * Builds a Mermaid stateDiagram-v2 string from TDD events with black text.
 */
export function generateMermaidDiagram(events: TddEvent[]): string {
  const lines: string[] = [
    "stateDiagram-v2",
    "  classDef default fill:#fff,color:#000000,stroke:#333",
  ];

  if (events.length === 0) {
    lines.push("  [*] --> Idle");
    return lines.join("\n");
  }

  // First event starts from [*]
  lines.push(`  [*] --> ${events[0].phase}`);

  // Add transitions between consecutive events
  for (let i = 0; i < events.length - 1; i++) {
    const from = events[i].phase;
    const to = events[i + 1].phase;
    lines.push(`  ${from} --> ${to} : ${events[i + 1].description}`);
  }

  // Last event goes to [*] (end)
  const lastEvent = events[events.length - 1];
  lines.push(`  ${lastEvent.phase} --> [*]`);

  // Add state descriptions with black text
  lines.push('  state "Red: Write failing test" as Red');
  lines.push('  state "Green: Make test pass" as Green');
  lines.push('  state "Refactor: Clean code" as Refactor');

  return lines.join("\n");
}
