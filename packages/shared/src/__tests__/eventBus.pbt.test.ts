import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { GuardianEventBus } from "../EventBus";
import { AnalysisCompleteEvent } from "../events";
import { AuditReport, Violation } from "../types";

/**
 * **Validates: Requirements 6.1, 6.2, 6.5**
 *
 * Property 8: EventBus distribuye a todos los suscriptores sin pérdida
 * Para cualquier número N de suscriptores registrados (N >= 1) y cualquier evento
 * `analysis:complete` emitido, cada uno de los N suscriptores recibe exactamente
 * una copia del evento con los campos report, healthScore, y radarData intactos.
 */
describe("Property 8: EventBus distributes to all subscribers without loss", () => {
  // Generator for a valid violation
  const validViolation: fc.Arbitrary<Violation> = fc.record({
    filePath: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9/._-]{2,30}$/),
    line: fc.integer({ min: 1, max: 5000 }),
    description: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{4,50}$/),
    severity: fc.oneof(fc.constant("error" as const), fc.constant("warning" as const)),
    rule: fc.option(fc.stringMatching(/^[A-Z_]{3,15}$/), { nil: undefined }),
  });

  // Generator for a valid AuditReport
  const validReport: fc.Arbitrary<AuditReport> = fc.record({
    timestamp: fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }).map(d => d.toISOString()),
    agentName: fc.oneof(
      fc.constant("clean-guard"),
      fc.constant("solid-copilot"),
      fc.constant("ddd-guard"),
      fc.constant("guardian")
    ),
    analyzedPath: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9/._-]{2,30}$/),
    status: fc.oneof(fc.constant("passed" as const), fc.constant("failed" as const)),
    violations: fc.array(validViolation, { minLength: 0, maxLength: 5 }),
    summary: fc.record({
      errorCount: fc.nat({ max: 20 }),
      warningCount: fc.nat({ max: 20 }),
    }),
  });

  // Generator for AnalysisCompleteEvent
  const validAnalysisEvent: fc.Arbitrary<AnalysisCompleteEvent> = fc.record({
    report: validReport,
    healthScore: fc.integer({ min: 0, max: 100 }),
    radarData: fc.dictionary(
      fc.stringMatching(/^[a-z][a-z-]{2,15}$/),
      fc.integer({ min: 0, max: 100 }),
      { minKeys: 1, maxKeys: 5 }
    ),
    timestamp: fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }).map(d => d.toISOString()),
  });

  it("N subscribers each receive exactly one copy of the emitted event", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        validAnalysisEvent,
        (subscriberCount, event) => {
          const eventBus = new GuardianEventBus();
          const received: AnalysisCompleteEvent[] = [];

          // Register N subscribers
          const handlers: Array<(data: AnalysisCompleteEvent) => void> = [];
          for (let i = 0; i < subscriberCount; i++) {
            const handler = (data: AnalysisCompleteEvent) => {
              received.push(data);
            };
            handlers.push(handler);
            eventBus.on("analysis:complete", handler);
          }

          // Emit event
          eventBus.emit("analysis:complete", event);

          // Each subscriber received exactly one event
          expect(received.length).toBe(subscriberCount);

          // Each received event has report, healthScore, radarData intact
          for (const receivedEvent of received) {
            expect(receivedEvent.report).toEqual(event.report);
            expect(receivedEvent.healthScore).toBe(event.healthScore);
            expect(receivedEvent.radarData).toEqual(event.radarData);
          }

          // Cleanup
          for (const handler of handlers) {
            eventBus.off("analysis:complete", handler);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("report, healthScore, and radarData fields are preserved intact through EventBus", () => {
    fc.assert(
      fc.property(validAnalysisEvent, (event) => {
        const eventBus = new GuardianEventBus();
        let receivedEvent: AnalysisCompleteEvent | null = null;

        const handler = (data: AnalysisCompleteEvent) => {
          receivedEvent = data;
        };
        eventBus.on("analysis:complete", handler);

        eventBus.emit("analysis:complete", event);

        expect(receivedEvent).not.toBeNull();
        expect(receivedEvent!.report).toEqual(event.report);
        expect(receivedEvent!.healthScore).toBe(event.healthScore);
        expect(receivedEvent!.radarData).toEqual(event.radarData);
        expect(receivedEvent!.timestamp).toBe(event.timestamp);

        eventBus.off("analysis:complete", handler);
      }),
      { numRuns: 100 }
    );
  });

  it("unsubscribed handlers do not receive events", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        validAnalysisEvent,
        (subscriberCount, event) => {
          const eventBus = new GuardianEventBus();
          const received: AnalysisCompleteEvent[] = [];

          // Register handlers then unsubscribe one
          const handlers: Array<(data: AnalysisCompleteEvent) => void> = [];
          for (let i = 0; i < subscriberCount; i++) {
            const handler = (data: AnalysisCompleteEvent) => {
              received.push(data);
            };
            handlers.push(handler);
            eventBus.on("analysis:complete", handler);
          }

          // Unsubscribe the first handler
          eventBus.off("analysis:complete", handlers[0]);

          eventBus.emit("analysis:complete", event);

          // One fewer subscriber receives the event
          expect(received.length).toBe(subscriberCount - 1);

          // Cleanup remaining
          for (let i = 1; i < handlers.length; i++) {
            eventBus.off("analysis:complete", handlers[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
