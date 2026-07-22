import { describe, it, expect, beforeEach } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import * as path from "path";
import * as os from "os";
import { Ruleset } from "@guardian/shared";
import { GoIdiomaticGuard } from "../GoIdiomaticGuard";
import { PyAsyncGuard } from "../PyAsyncGuard";
import { TsContractGuard } from "../TsContractGuard";
import { DartArchGuard } from "../DartArchGuard";
import { DotNetCleanGuard } from "../DotNetCleanGuard";

const defaultRuleset: Ruleset = {
  version: "1.0.0",
  executionMode: "local",
  layers: [],
  testConventions: [],
  excludePaths: [],
};

const tmpDir = path.join(os.tmpdir(), "guardian-lang-tests-" + Date.now());

async function writeTestFile(relativePath: string, content: string): Promise<string> {
  const fullPath = path.join(tmpDir, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf-8");
  return fullPath;
}

beforeEach(async () => {
  await mkdir(tmpDir, { recursive: true });
});

// ─── Go Idiomatic Guard ────────────────────────────────────
describe("GoIdiomaticGuard", () => {
  let agent: GoIdiomaticGuard;

  beforeEach(() => {
    agent = new GoIdiomaticGuard();
    agent.initialize(defaultRuleset);
  });

  it("detects goroutine leak risk without sync mechanism", async () => {
    const fp = await writeTestFile("main.go", `package main

func main() {
    go func() {
        doWork()
    }()
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations[0].rule).toBe("GO_GOROUTINE_LEAK_RISK");
  });

  it("does not flag goroutine with sync.WaitGroup nearby", async () => {
    const fp = await writeTestFile("synced.go", `package main

import "sync"

func main() {
    var wg sync.WaitGroup
    wg.Add(1)
    go func() {
        defer wg.Done()
        doWork()
    }()
    wg.Wait()
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    const leakViolations = report.violations.filter(v => v.rule === "GO_GOROUTINE_LEAK_RISK");
    expect(leakViolations.length).toBe(0);
  });

  it("detects missing context.Context in exported function", async () => {
    const fp = await writeTestFile("handler.go", `package service

func ProcessOrder(orderID string) error {
    return nil
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "GO_MISSING_CONTEXT")).toBe(true);
  });

  it("detects error wrapping without %w", async () => {
    const fp = await writeTestFile("errors.go", `package service

import "fmt"

func doSomething() error {
    err := something()
    return fmt.Errorf("failed: %v", err)
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "GO_ERROR_WRAP_MISSING")).toBe(true);
  });

  it("detects interface in infrastructure layer", async () => {
    const fp = await writeTestFile("infrastructure/repo.go", `package infrastructure

type UserRepository interface {
    FindByID(id string) (*User, error)
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "GO_INTERFACE_IN_PROVIDER")).toBe(true);
  });
});

// ─── Python Async Guard ────────────────────────────────────
describe("PyAsyncGuard", () => {
  let agent: PyAsyncGuard;

  beforeEach(() => {
    agent = new PyAsyncGuard();
    agent.initialize(defaultRuleset);
  });

  it("detects blocking open() in async function", async () => {
    const fp = await writeTestFile("service.py", `
async def process_file(path):
    data = open(path).read()
    return data
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "PY_BLOCKING_IO_IN_ASYNC")).toBe(true);
  });

  it("detects blocking requests in async function", async () => {
    const fp = await writeTestFile("api.py", `
async def fetch_user(user_id):
    response = requests.get(f"/users/{user_id}")
    return response.json()
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "PY_BLOCKING_IO_IN_ASYNC")).toBe(true);
  });

  it("detects time.sleep in async function", async () => {
    const fp = await writeTestFile("worker.py", `
async def wait_and_retry():
    time.sleep(5)
    return await do_work()
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "PY_BLOCKING_IO_IN_ASYNC")).toBe(true);
  });

  it("detects circular import from domain to infrastructure", async () => {
    const fp = await writeTestFile("domain/service.py", `
from infrastructure.database import get_connection

class OrderService:
    pass
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "PY_CIRCULAR_IMPORT_RISK")).toBe(true);
  });

  it("skips non-py files", async () => {
    const fp = await writeTestFile("readme.txt", "async def test(): open('x')");
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.length).toBe(0);
  });
});

// ─── TypeScript Contract Guard ─────────────────────────────
describe("TsContractGuard", () => {
  let agent: TsContractGuard;

  beforeEach(() => {
    agent = new TsContractGuard();
    agent.initialize(defaultRuleset);
  });

  it("detects any type in domain layer", async () => {
    const fp = await writeTestFile("domain/entity.ts", `
export class User {
  data: any;
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "TS_ANY_IN_DOMAIN")).toBe(true);
  });

  it("detects deep relative imports", async () => {
    const fp = await writeTestFile("src/presentation/page.ts", `
import { UserService } from "../../../domain/services/UserService";
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "TS_DEEP_RELATIVE_IMPORT")).toBe(true);
  });

  it("does not flag any outside domain", async () => {
    const fp = await writeTestFile("infrastructure/adapter.ts", `
export function parse(input: any): string {
  return String(input);
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.filter(v => v.rule === "TS_ANY_IN_DOMAIN").length).toBe(0);
  });
});

// ─── Dart Arch Guard ───────────────────────────────────────
describe("DartArchGuard", () => {
  let agent: DartArchGuard;

  beforeEach(() => {
    agent = new DartArchGuard();
    agent.initialize(defaultRuleset);
  });

  it("detects Flutter import in domain layer", async () => {
    const fp = await writeTestFile("domain/entity.dart", `
import 'package:flutter/material.dart';

class Order {
  final String id;
  Order(this.id);
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "DART_FLUTTER_IN_DOMAIN")).toBe(true);
  });

  it("detects StreamController without dispose", async () => {
    const fp = await writeTestFile("service/events.dart", `
class EventBus {
  final controller = StreamController<String>.broadcast();
  void emit(String event) {
    controller.add(event);
  }
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "DART_STREAM_LEAK")).toBe(true);
  });

  it("detects Navigator in non-presentation layer", async () => {
    const fp = await writeTestFile("application/router.dart", `
class AppRouter {
  void goHome(context) {
    Navigator.pushNamed(context, '/home');
  }
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "DART_UI_LOGIC_LEAK")).toBe(true);
  });
});

// ─── DotNet Clean Guard ────────────────────────────────────
describe("DotNetCleanGuard", () => {
  let agent: DotNetCleanGuard;

  beforeEach(() => {
    agent = new DotNetCleanGuard();
    agent.initialize(defaultRuleset);
  });

  it("detects Entity Framework in domain layer", async () => {
    const fp = await writeTestFile("Domain/Order.cs", `
using Microsoft.EntityFrameworkCore;

[Table("Orders")]
public class Order {
    public int Id { get; set; }
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "DOTNET_EF_IN_DOMAIN")).toBe(true);
  });

  it("detects async method without CancellationToken", async () => {
    const fp = await writeTestFile("Application/OrderService.cs", `
public class OrderService {
    public async Task<Order> CreateOrderAsync(OrderDto dto) {
        return await _repository.SaveAsync(dto);
    }
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "DOTNET_MISSING_CANCELLATION_TOKEN")).toBe(true);
  });

  it("detects DbContext outside infrastructure", async () => {
    const fp = await writeTestFile("Application/Handler.cs", `
public class OrderHandler {
    private readonly AppDbContext _context;
    
    public void Handle() {
        _context.SaveChanges();
    }
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.some(v => v.rule === "DOTNET_DBCONTEXT_LEAK")).toBe(true);
  });

  it("does not flag DbContext inside infrastructure", async () => {
    const fp = await writeTestFile("Infrastructure/Repository.cs", `
public class OrderRepository {
    private readonly AppDbContext _context;
    
    public void Save(Order order) {
        _context.SaveChanges();
    }
}
`);
    const report = await agent.tools[0].handler({ filepath: fp }, defaultRuleset);
    expect(report.violations.filter(v => v.rule === "DOTNET_DBCONTEXT_LEAK").length).toBe(0);
  });
});
