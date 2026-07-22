import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import * as path from "path";
import { auditDddEncapsulation } from "../tools/auditDddEncapsulation";
import { Ruleset } from "@guardian/shared";

const TEST_DIR = path.resolve(__dirname, "__fixtures_encap__");
const defaultRuleset: Ruleset = {
  version: "1.0.0",
  executionMode: "local",
  layers: [],
  testConventions: [],
  excludePaths: [],
};

describe("auditDddEncapsulation", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("detects public mutable properties as violations", async () => {
    const filePath = path.join(TEST_DIR, "MutableEntity.ts");
    const content = `
export class Order {
  public status: string;
  public total: number;
  private internalId: string;
  protected secret: string;
  public readonly id: string;

  constructor() {
    this.status = "pending";
    this.total = 0;
    this.internalId = "123";
    this.secret = "x";
    this.id = "abc";
  }
}
`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditDddEncapsulation({ filepath: filePath }, defaultRuleset);

    expect(report.status).toBe("failed");
    expect(report.violations).toHaveLength(2);
    expect(report.violations[0].rule).toBe("DDD_MUTABLE_PUBLIC_STATE");
    expect(report.violations[0].description).toContain("status");
    expect(report.violations[1].description).toContain("total");
  });

  it("returns clean report for class with only readonly/private properties", async () => {
    const filePath = path.join(TEST_DIR, "ImmutableEntity.ts");
    const content = `
export class User {
  public readonly id: string;
  private name: string;
  protected email: string;
  public readonly createdAt: Date;

  constructor(id: string, name: string, email: string) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.createdAt = new Date();
  }
}
`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditDddEncapsulation({ filepath: filePath }, defaultRuleset);

    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  it("returns clean report for file without classes", async () => {
    const filePath = path.join(TEST_DIR, "noClasses.ts");
    const content = `
export function doSomething(): void {
  console.log("hello");
}
export const value = 42;
`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditDddEncapsulation({ filepath: filePath }, defaultRuleset);

    expect(report.status).toBe("passed");
    expect(report.violations).toHaveLength(0);
  });

  it("detects implicit public properties (no modifier) as violations", async () => {
    const filePath = path.join(TEST_DIR, "ImplicitPublic.ts");
    const content = `
export class Product {
  name: string;
  price: number;
  readonly sku: string;

  constructor(name: string, price: number, sku: string) {
    this.name = name;
    this.price = price;
    this.sku = sku;
  }
}
`;
    await writeFile(filePath, content, "utf-8");

    const report = await auditDddEncapsulation({ filepath: filePath }, defaultRuleset);

    expect(report.status).toBe("failed");
    expect(report.violations).toHaveLength(2);
    expect(report.violations[0].description).toContain("name");
    expect(report.violations[1].description).toContain("price");
  });

  it("returns warning violation if file does not exist", async () => {
    const filePath = path.join(TEST_DIR, "nonexistent.ts");

    const report = await auditDddEncapsulation({ filepath: filePath }, defaultRuleset);

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].severity).toBe("warning");
    expect(report.violations[0].rule).toBe("FILE_READ_ERROR");
  });
});
