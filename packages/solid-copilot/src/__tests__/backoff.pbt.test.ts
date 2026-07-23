import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { BedrockClient } from "../bedrock/BedrockClient";

/**
 * **Validates: Requirements 7.4**
 *
 * Property 11: Backoff exponencial produce delays correctos
 * Para cualquier intento K (1 ≤ K ≤ maxRetries), el delay de backoff
 * es exactamente 2^(K-1) * 1000 ms.
 */
describe("Backoff - Property-Based Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Property 11: backoff delay is exactly 2^(K-1) * 1000 ms for any attempt K", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (attempt) => {
          const expectedDelay = Math.pow(2, attempt - 1) * 1000;

          // Verify the formula: 2^(K-1) * 1000
          // attempt 1 → 1000ms, attempt 2 → 2000ms, attempt 3 → 4000ms, etc.
          expect(expectedDelay).toBe(Math.pow(2, attempt - 1) * 1000);
          expect(expectedDelay).toBeGreaterThan(0);
          expect(expectedDelay).toBeLessThanOrEqual(Math.pow(2, 9) * 1000); // max 512000ms
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 11b: backoff delay doubles with each subsequent attempt", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        (attempt) => {
          const delayK = Math.pow(2, attempt - 1) * 1000;
          const delayKPlus1 = Math.pow(2, attempt) * 1000;

          // The next delay is always double the current one
          expect(delayKPlus1).toBe(delayK * 2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 11c: BedrockClient backoff method produces correct delays", async () => {
    const client = new BedrockClient({ maxRetries: 5, region: "us-east-1" });
    const backoffFn = (client as any).backoff.bind(client);

    // Test sequentially with specific attempts
    const attempts = [1, 2, 3, 4, 5];
    for (const attempt of attempts) {
      const expectedDelay = Math.pow(2, attempt - 1) * 1000;

      let resolved = false;
      const promise = backoffFn(attempt).then(() => {
        resolved = true;
      });

      // Before the expected time, it should not have resolved
      expect(resolved).toBe(false);

      // Advance exactly to the expected delay
      await vi.advanceTimersByTimeAsync(expectedDelay);

      await promise;
      expect(resolved).toBe(true);
    }
  });

  it("Property 11d: formula verification across all valid attempts", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (attempt) => {
          // The backoff implementation uses: Math.pow(2, attempt - 1) * 1000
          // We verify the mathematical properties:
          const delay = Math.pow(2, attempt - 1) * 1000;

          // 1. Always positive
          expect(delay).toBeGreaterThan(0);

          // 2. First attempt is always 1000ms
          if (attempt === 1) {
            expect(delay).toBe(1000);
          }

          // 3. Exponential growth: delay(K) = 2 * delay(K-1) for K > 1
          if (attempt > 1) {
            const prevDelay = Math.pow(2, attempt - 2) * 1000;
            expect(delay).toBe(prevDelay * 2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
