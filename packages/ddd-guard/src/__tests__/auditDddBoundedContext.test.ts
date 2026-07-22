import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import * as path from "path";
import { auditDddBoundedContext } from "../tools/auditDddBoundedContext";
import { Ruleset } from "@guardian/shared";

const TEST_DIR = path.resolve(__dirname, "__fixtures_context__");

function makeRuleset(boundedContexts: Record<string, string[]>): Ruleset {
  return {
    version: "1.0.0",
    executionMode: "local",
    layers: [],
    testConventions: [],
    excludePaths: [],
    ddd: { boundedContexts },
  };
}

describe("auditDddBoundedContext", () => {
  beforeAll(async () => {
    await mkdir(path.join(TEST_DIR, "src", "orders"), { recursive: true });
    await mkdir(path.join(TEST_DIR, "src", "payments"), { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("detects cross-context import as violation", async () => {
    // Create file in orders context
    await writeFile(
      path.join(TEST_DIR, "src", "orders", "OrderService.ts"),
      `import { PaymentGateway } from "../payments/PaymentGateway";\n\nexport class OrderService {}`,
      "utf-8"
    );

    // Create file in payments context
    await writeFile(
      path.join(TEST_DIR, "src", "payments", "PaymentGateway.ts"),
      `export class PaymentGateway {}`,
      "utf-8"
    );

    const ruleset = makeRuleset({
      orders: ["src/orders/**"],
      payments: ["src/payments/**"],
    });

    const report = await auditDddBoundedContext(
      { directory: TEST_DIR },
      ruleset
    );

    expect(report.status).toBe("failed");
    const violation = report.violations.find(
      (v) => v.rule === "DDD_CROSS_CONTEXT_IMPORT"
    );
    expect(violation).toBeDefined();
    expect(violation!.description).toContain("orders");
    expect(violation!.description).toContain("payments");
  });

  it("allows intra-context import without violation", async () => {
    // Create two files in the same context
    await writeFile(
      path.join(TEST_DIR, "src", "orders", "OrderRepository.ts"),
      `export class OrderRepository {}`,
      "utf-8"
    );

    await writeFile(
      path.join(TEST_DIR, "src", "orders", "OrderHandler.ts"),
      `import { OrderRepository } from "./OrderRepository";\n\nexport class OrderHandler {}`,
      "utf-8"
    );

    const ruleset = makeRuleset({
      orders: ["src/orders/**"],
      payments: ["src/payments/**"],
    });

    const report = await auditDddBoundedContext(
      { directory: TEST_DIR },
      ruleset
    );

    // OrderHandler importing OrderRepository (same context) should not be a violation
    const handlerViolations = report.violations.filter(
      (v) => v.filePath.includes("OrderHandler")
    );
    expect(handlerViolations).toHaveLength(0);
  });

  it("returns clean report when no bounded contexts are configured", async () => {
    const ruleset: Ruleset = {
      version: "1.0.0",
      executionMode: "local",
      layers: [],
      testConventions: [],
      excludePaths: [],
    };

    const report = await auditDddBoundedContext(
      { directory: TEST_DIR },
      ruleset
    );

    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  it("ignores files that don't belong to any bounded context", async () => {
    // Create file outside any context
    await mkdir(path.join(TEST_DIR, "src", "utils"), { recursive: true });
    await writeFile(
      path.join(TEST_DIR, "src", "utils", "helper.ts"),
      `import { PaymentGateway } from "../payments/PaymentGateway";\n\nexport function helper() {}`,
      "utf-8"
    );

    const ruleset = makeRuleset({
      orders: ["src/orders/**"],
      payments: ["src/payments/**"],
    });

    const report = await auditDddBoundedContext(
      { directory: TEST_DIR },
      ruleset
    );

    // helper.ts is not in any bounded context, so it should not produce violations
    const helperViolations = report.violations.filter(
      (v) => v.filePath.includes("helper")
    );
    expect(helperViolations).toHaveLength(0);
  });
});
