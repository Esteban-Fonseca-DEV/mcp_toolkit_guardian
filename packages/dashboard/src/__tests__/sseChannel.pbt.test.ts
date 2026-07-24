import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { SSEChannel } from "../sse/SSEChannel";
import { GuardianEventBus, AnalysisCompleteEvent } from "@guardian/shared";

/**
 * **Validates: Requirements 3.5, 6.3**
 *
 * Property 7: Serialización SSE es formato válido y parseable (round-trip)
 * Para cualquier objeto AnalysisCompleteEvent válido, `serializeSSE("audit-update", event)`
 * produce un string con formato exacto `event: audit-update\ndata: <json>\n\n`
 * donde <json> parsed con JSON.parse produce un objeto equivalente al original.
 */
describe("Property 7: SSE serialization round-trip", () => {
  function createChannel(): SSEChannel {
    const eventBus = new GuardianEventBus();
    return new SSEChannel(eventBus);
  }

  // Generator for valid AnalysisCompleteEvent
  const validViolation = fc.record({
    filePath: fc.string({ minLength: 1, maxLength: 50 }),
    line: fc.integer({ min: 1, max: 5000 }),
    description: fc.string({ minLength: 1, maxLength: 200 }),
    severity: fc.oneof(fc.constant("error" as const), fc.constant("warning" as const)),
    rule: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  });

  const validAuditReport = fc.record({
    timestamp: fc.date().map((d) => d.toISOString()),
    agentName: fc.oneof(
      fc.constant("clean-guard"),
      fc.constant("solid-copilot"),
      fc.constant("ddd-guard"),
      fc.constant("guardian")
    ),
    analyzedPath: fc.string({ minLength: 1, maxLength: 100 }),
    status: fc.oneof(
      fc.constant("passed" as const),
      fc.constant("failed" as const)
    ),
    violations: fc.array(validViolation, { minLength: 0, maxLength: 5 }),
    summary: fc.record({
      errorCount: fc.nat({ max: 50 }),
      warningCount: fc.nat({ max: 50 }),
    }),
  });

  const validAnalysisEvent: fc.Arbitrary<AnalysisCompleteEvent> = fc.record({
    report: validAuditReport,
    healthScore: fc.integer({ min: 0, max: 100 }),
    radarData: fc.dictionary(
      fc.stringMatching(/^[a-z][a-z0-9-]{2,15}$/),
      fc.integer({ min: 0, max: 100 })
    ),
    timestamp: fc.date().map((d) => d.toISOString()),
  });

  it("serialized output has exact SSE format: event: <type>\\ndata: <json>\\n\\n", () => {
    const channel = createChannel();

    fc.assert(
      fc.property(validAnalysisEvent, (event) => {
        const serialized = channel.serializeSSE("audit-update", event);

        // Must start with "event: audit-update\n"
        expect(serialized.startsWith("event: audit-update\n")).toBe(true);

        // Split by newline
        const lines = serialized.split("\n");

        // Format: "event: audit-update", "data: ...", "", ""
        expect(lines[0]).toBe("event: audit-update");
        expect(lines[1]).toMatch(/^data: .+$/);
        expect(lines[2]).toBe("");
        expect(lines[3]).toBe("");
        expect(lines.length).toBe(4);
      }),
      { numRuns: 100 }
    );
  });

  it("round-trip: JSON.parse of the data field equals original event", () => {
    const channel = createChannel();

    fc.assert(
      fc.property(validAnalysisEvent, (event) => {
        const serialized = channel.serializeSSE("audit-update", event);

        // Extract data line
        const lines = serialized.split("\n");
        const dataLine = lines[1];
        const jsonStr = dataLine.replace("data: ", "");

        // Parse and compare
        const parsed = JSON.parse(jsonStr);
        expect(parsed).toEqual(event);
      }),
      { numRuns: 100 }
    );
  });

  it("serialized output is always a valid string (no undefined or null)", () => {
    const channel = createChannel();

    fc.assert(
      fc.property(validAnalysisEvent, (event) => {
        const serialized = channel.serializeSSE("audit-update", event);
        expect(typeof serialized).toBe("string");
        expect(serialized.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
