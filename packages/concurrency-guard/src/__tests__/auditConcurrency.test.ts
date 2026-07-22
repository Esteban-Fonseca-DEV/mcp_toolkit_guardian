import { describe, it, expect } from "vitest";
import { auditConcurrencySync } from "../tools/auditConcurrency";

describe("auditConcurrency", () => {
  describe("MUTABLE_EXPORT", () => {
    it("should detect `export let` as a mutable export violation", () => {
      const code = `export let x = 1;`;
      const violations = auditConcurrencySync("test.ts", code);

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("MUTABLE_EXPORT");
      expect(violations[0].severity).toBe("warning");
    });

    it("should not flag `export const` declarations", () => {
      const code = `export const x = 1;`;
      const violations = auditConcurrencySync("test.ts", code);

      const mutableExports = violations.filter(v => v.rule === "MUTABLE_EXPORT");
      expect(mutableExports).toHaveLength(0);
    });
  });

  describe("TIMER_NO_CLEANUP", () => {
    it("should detect `setInterval` without `clearInterval`", () => {
      const code = `setInterval(() => { console.log("tick"); }, 1000);`;
      const violations = auditConcurrencySync("test.ts", code);

      expect(violations.some(v => v.rule === "TIMER_NO_CLEANUP")).toBe(true);
    });

    it("should not flag `setInterval` when `clearInterval` is present", () => {
      const code = `
const id = setInterval(() => {}, 1000);
clearInterval(id);
`;
      const violations = auditConcurrencySync("test.ts", code);

      const timerViolations = violations.filter(v => v.rule === "TIMER_NO_CLEANUP");
      expect(timerViolations).toHaveLength(0);
    });

    it("should detect `setTimeout` without `clearTimeout`", () => {
      const code = `setTimeout(() => { console.log("delayed"); }, 500);`;
      const violations = auditConcurrencySync("test.ts", code);

      expect(violations.some(v => v.rule === "TIMER_NO_CLEANUP")).toBe(true);
    });
  });

  describe("EVENT_LISTENER_NO_CLEANUP", () => {
    it("should detect `addEventListener` without `removeEventListener`", () => {
      const code = `document.addEventListener("click", handler);`;
      const violations = auditConcurrencySync("test.ts", code);

      expect(violations.some(v => v.rule === "EVENT_LISTENER_NO_CLEANUP")).toBe(true);
    });

    it("should not flag when `removeEventListener` is present", () => {
      const code = `
document.addEventListener("click", handler);
document.removeEventListener("click", handler);
`;
      const violations = auditConcurrencySync("test.ts", code);

      const listenerViolations = violations.filter(v => v.rule === "EVENT_LISTENER_NO_CLEANUP");
      expect(listenerViolations).toHaveLength(0);
    });
  });

  describe("PROMISE_NOT_AWAITED", () => {
    it("should detect `new Promise(...)` as expression statement (not awaited or assigned)", () => {
      const code = `new Promise((resolve) => { resolve(42); });`;
      const violations = auditConcurrencySync("test.ts", code);

      expect(violations.some(v => v.rule === "PROMISE_NOT_AWAITED")).toBe(true);
    });

    it("should not flag `new Promise(...)` that is assigned to a variable", () => {
      const code = `const p = new Promise((resolve) => { resolve(42); });`;
      const violations = auditConcurrencySync("test.ts", code);

      const promiseViolations = violations.filter(v => v.rule === "PROMISE_NOT_AWAITED");
      expect(promiseViolations).toHaveLength(0);
    });

    it("should not flag awaited promise", () => {
      const code = `await new Promise((resolve) => setTimeout(resolve, 100));`;
      const violations = auditConcurrencySync("test.ts", code);

      const promiseViolations = violations.filter(v => v.rule === "PROMISE_NOT_AWAITED");
      expect(promiseViolations).toHaveLength(0);
    });
  });
});
