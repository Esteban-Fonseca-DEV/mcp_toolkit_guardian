import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
  generateMermaidDiagram,
  recordTddEvent,
  sessionEvents,
  TddEvent,
  TddPhase,
} from "../tools/generateTddLifecycleReport";

/**
 * Property 9: Completitud del diagrama Mermaid del ciclo TDD
 * Generate sessions with K events. Verify output contains Mermaid structure
 * with K events and black text.
 * **Validates: Requirements 3.4**
 */
describe("Property 9: Completitud del diagrama Mermaid del ciclo TDD", () => {
  beforeEach(() => {
    sessionEvents.clear();
  });

  const tddPhaseArb: fc.Arbitrary<TddPhase> = fc.oneof(
    fc.constant("Red" as const),
    fc.constant("Green" as const),
    fc.constant("Refactor" as const)
  );

  const tddEventArb: fc.Arbitrary<TddEvent> = fc.record({
    phase: tddPhaseArb,
    timestamp: fc.date().map((d) => d.toISOString()),
    description: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-zA-Z0-9 ]+$/.test(s)),
  });

  it("Mermaid diagram contains stateDiagram-v2 header and black color for any K events", () => {
    fc.assert(
      fc.property(
        fc.array(tddEventArb, { minLength: 0, maxLength: 15 }),
        (events: TddEvent[]) => {
          const diagram = generateMermaidDiagram(events);

          // Must always start with stateDiagram-v2
          expect(diagram).toContain("stateDiagram-v2");

          // Must always have black text color (#000000)
          expect(diagram).toContain("#000000");

          if (events.length === 0) {
            // Empty session should have an Idle state
            expect(diagram).toContain("Idle");
          } else {
            // Should contain the first event's phase
            expect(diagram).toContain(events[0].phase);

            // Should contain [*] as start marker
            expect(diagram).toContain("[*]");
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("diagram transitions correspond to K events (K-1 transitions for K > 1)", () => {
    fc.assert(
      fc.property(
        fc.array(tddEventArb, { minLength: 1, maxLength: 10 }),
        (events: TddEvent[]) => {
          const diagram = generateMermaidDiagram(events);
          const lines = diagram.split("\n");

          // Count transition lines (lines containing " --> " but not starting with [*] or ending with [*])
          const transitionLines = lines.filter(
            (l) => l.includes("-->") && l.trim() !== ""
          );

          // For K events, we expect:
          //   1 line: [*] --> first_phase
          //   (K-1) lines: phase_i --> phase_{i+1}
          //   1 line: last_phase --> [*]
          // Total: K+1 transitions
          if (events.length === 1) {
            // [*] --> Phase, Phase --> [*]
            expect(transitionLines.length).toBe(2);
          } else {
            // [*] --> first, (K-1) transitions, last --> [*]
            expect(transitionLines.length).toBe(events.length + 1);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
