import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import * as path from "path";
import { auditDddAggregateAccess } from "../tools/auditDddAggregateAccess";
import { Ruleset } from "@guardian/shared";

const TEST_DIR = path.resolve(__dirname, "__fixtures_aggregate__");

function makeRuleset(aggregates: Record<string, { root: string; internals: string[] }>): Ruleset {
  return {
    version: "1.0.0",
    executionMode: "local",
    layers: [],
    testConventions: [],
    excludePaths: [],
    ddd: { aggregates },
  };
}

describe("auditDddAggregateAccess", () => {
  beforeAll(async () => {
    await mkdir(path.join(TEST_DIR, "domain", "order"), { recursive: true });
    await mkdir(path.join(TEST_DIR, "application"), { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("detects direct import to internal entity as violation", async () => {
    // Create aggregate root
    await writeFile(
      path.join(TEST_DIR, "domain", "order", "Order.ts"),
      `export class Order { public readonly id: string = "1"; }`,
      "utf-8"
    );

    // Create internal entity
    await writeFile(
      path.join(TEST_DIR, "domain", "order", "OrderItem.ts"),
      `export class OrderItem { public readonly id: string = "1"; }`,
      "utf-8"
    );

    // Create file that imports internal entity directly
    await writeFile(
      path.join(TEST_DIR, "application", "OrderService.ts"),
      `import { OrderItem } from "../domain/order/OrderItem";\n\nexport class OrderService {}`,
      "utf-8"
    );

    const ruleset = makeRuleset({
      Order: {
        root: "domain/order/Order.ts",
        internals: ["domain/order/OrderItem.ts"],
      },
    });

    const report = await auditDddAggregateAccess(
      { directory: TEST_DIR },
      ruleset
    );

    expect(report.status).toBe("failed");
    expect(report.violations.length).toBeGreaterThanOrEqual(1);
    const violation = report.violations.find(
      (v) => v.rule === "DDD_DIRECT_INTERNAL_ACCESS"
    );
    expect(violation).toBeDefined();
    expect(violation!.description).toContain("OrderItem.ts");
  });

  it("allows import to aggregate root without violation", async () => {
    // Create a file that imports only the aggregate root
    await writeFile(
      path.join(TEST_DIR, "application", "OrderQuery.ts"),
      `import { Order } from "../domain/order/Order";\n\nexport class OrderQuery {}`,
      "utf-8"
    );

    const ruleset = makeRuleset({
      Order: {
        root: "domain/order/Order.ts",
        internals: ["domain/order/OrderItem.ts"],
      },
    });

    const report = await auditDddAggregateAccess(
      { directory: TEST_DIR },
      ruleset
    );

    // The OrderQuery file should not produce a violation for importing Order (the root)
    const orderQueryViolations = report.violations.filter(
      (v) => v.filePath.includes("OrderQuery")
    );
    expect(orderQueryViolations).toHaveLength(0);
  });

  it("returns clean report when no aggregates are configured", async () => {
    const ruleset: Ruleset = {
      version: "1.0.0",
      executionMode: "local",
      layers: [],
      testConventions: [],
      excludePaths: [],
    };

    const report = await auditDddAggregateAccess(
      { directory: TEST_DIR },
      ruleset
    );

    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });
});
