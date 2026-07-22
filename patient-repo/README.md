# Patient Repo

A demo repository with **intentional architecture violations** used to test the Guardian MCP Toolkit.

## Architecture

This project follows Clean Architecture with four layers:

| Layer          | Path                   | Allowed Dependencies |
|----------------|------------------------|----------------------|
| domain         | `src/domain/**`        | (none)               |
| application    | `src/application/**`   | domain               |
| infrastructure | `src/infrastructure/**`| domain, application  |
| presentation   | `src/presentation/**`  | application          |

## Intentional Violations

### Clean Architecture Violations

#### 1. `src/domain/UserService.ts` — LAYER_VIOLATION

- **Import:** `../infrastructure/UserRepository`
- **Rule broken:** Domain layer has `allowedDependencies: []` — it must not import from any other layer.
- **Expected output:**
  ```json
  {
    "filePath": "src/domain/UserService.ts",
    "line": 2,
    "description": "Layer 'domain' cannot depend on 'infrastructure'",
    "severity": "error",
    "rule": "LAYER_VIOLATION"
  }
  ```

#### 2. `src/domain/OrderService.ts` — LAYER_VIOLATION

- **Import:** `../infrastructure/OrderRepository`
- **Rule broken:** Domain layer has `allowedDependencies: []` — it must not import from any other layer.
- **Expected output:**
  ```json
  {
    "filePath": "src/domain/OrderService.ts",
    "line": 2,
    "description": "Layer 'domain' cannot depend on 'infrastructure'",
    "severity": "error",
    "rule": "LAYER_VIOLATION"
  }
  ```

#### 3. `src/domain/ProductService.ts` — LAYER_VIOLATION

- **Import:** `../infrastructure/ProductRepository`
- **Rule broken:** Domain layer has `allowedDependencies: []` — it must not import from any other layer.
- **Expected output:**
  ```json
  {
    "filePath": "src/domain/ProductService.ts",
    "line": 2,
    "description": "Layer 'domain' cannot depend on 'infrastructure'",
    "severity": "error",
    "rule": "LAYER_VIOLATION"
  }
  ```

### TDD Violations

#### 4. `src/application/PaymentService.ts` — MISSING_TEST

- **Issue:** No corresponding `PaymentService.test.ts` or `PaymentService.spec.ts` exists.
- **Rule broken:** `testConventions` requires every source file to have a matching test file.
- **Expected output:**
  ```json
  {
    "filePath": "src/application/PaymentService.ts",
    "line": 0,
    "description": "No test file found matching conventions: **/*.test.ts, **/*.spec.ts",
    "severity": "warning",
    "rule": "MISSING_TEST"
  }
  ```

### DDD Violations

#### 5. `src/domain/order/Order.ts` — DDD_MUTABLE_PUBLIC_STATE

- **Issue:** Properties `status` and `items` are public and mutable (not `readonly`, not `private`).
- **Rule broken:** Domain entities should encapsulate their state — public properties must be `readonly` or accessed through controlled methods.
- **Expected output:**
  ```json
  {
    "filePath": "src/domain/order/Order.ts",
    "line": 3,
    "description": "Clase 'Order' expone propiedad mutable publica 'status'. Use readonly o un metodo de acceso controlado.",
    "severity": "error",
    "rule": "DDD_MUTABLE_PUBLIC_STATE"
  }
  ```
  ```json
  {
    "filePath": "src/domain/order/Order.ts",
    "line": 4,
    "description": "Clase 'Order' expone propiedad mutable publica 'items'. Use readonly o un metodo de acceso controlado.",
    "severity": "error",
    "rule": "DDD_MUTABLE_PUBLIC_STATE"
  }
  ```

#### 6. `src/application/OrderService.ts` — DDD_DIRECT_INTERNAL_ACCESS

- **Issue:** Imports `OrderItem` directly instead of accessing it through the `Order` aggregate root.
- **Rule broken:** External code must only access an aggregate through its root entity. `OrderItem` is defined as an internal entity of the `Order` aggregate in `.guardian.json`.
- **Expected output:**
  ```json
  {
    "filePath": "src/application/OrderService.ts",
    "line": 2,
    "description": "Acceso directo a entidad interna 'OrderItem.ts' sin pasar por el Aggregate Root 'Order.ts'.",
    "severity": "error",
    "rule": "DDD_DIRECT_INTERNAL_ACCESS"
  }
  ```

### Security Guard Violations

#### 7. `src/domain/config.ts` — SECRET_EXPOSED_AWS_ACCESS_KEY

- **Issue:** Hardcoded AWS access key and database connection string with credentials in source code.
- **Rule broken:** Secrets must never be committed to version control. Use environment variables or a secrets manager.
- **Expected output:**
  ```json
  {
    "filePath": "src/domain/config.ts",
    "line": 3,
    "description": "Hardcoded AWS access key detected: AKIAIOSFODNN7EXAMPLE",
    "severity": "error",
    "rule": "SECRET_EXPOSED_AWS_ACCESS_KEY"
  }
  ```

#### 8. `src/domain/EnvViolation.ts` — ENV_ACCESS_OUTSIDE_INFRA

- **Issue:** `process.env` accessed directly in the domain layer instead of being abstracted through the infrastructure layer.
- **Rule broken:** Environment access should be encapsulated in infrastructure services and injected into domain/application layers.
- **Expected output:**
  ```json
  {
    "filePath": "src/domain/EnvViolation.ts",
    "line": 5,
    "description": "Direct process.env access in domain layer — should be in infrastructure",
    "severity": "error",
    "rule": "ENV_ACCESS_OUTSIDE_INFRA"
  }
  ```

### SOLID-Copilot Violations

#### 9. `src/domain/GodObject.ts` — SRP_GOD_OBJECT

- **Issue:** `UserManager` class has 12+ methods spanning authentication, CRUD, validation, notifications, caching, and reporting.
- **Rule broken:** Single Responsibility Principle — a class should have only one reason to change. This class has 6+ distinct responsibilities.
- **Expected output:**
  ```json
  {
    "filePath": "src/domain/GodObject.ts",
    "line": 5,
    "description": "Class 'UserManager' has 12 methods across 6 responsibilities — violates SRP",
    "severity": "error",
    "rule": "SRP_GOD_OBJECT"
  }
  ```

#### 10. `src/domain/IRepository.ts` — ISP_FAT_INTERFACE

- **Issue:** `IRepository` interface declares 10 methods. Clients that only need read operations are forced to depend on write and bulk methods.
- **Rule broken:** Interface Segregation Principle — no client should be forced to depend on methods it does not use.
- **Expected output:**
  ```json
  {
    "filePath": "src/domain/IRepository.ts",
    "line": 4,
    "description": "Interface 'IRepository' has 10 methods (threshold: 5) — split into focused interfaces",
    "severity": "error",
    "rule": "ISP_FAT_INTERFACE"
  }
  ```

### Concurrency Guard Violations

#### 11. `src/application/EventHandler.ts` — MUTABLE_EXPORT

- **Issue:** `export let eventCount` and `export let lastEvent` create shared mutable state accessible from any importing module.
- **Rule broken:** Exported mutable bindings create race conditions and make state changes unpredictable in concurrent environments.
- **Expected output:**
  ```json
  {
    "filePath": "src/application/EventHandler.ts",
    "line": 4,
    "description": "Mutable export 'eventCount' — use encapsulated state or const",
    "severity": "error",
    "rule": "MUTABLE_EXPORT"
  }
  ```

#### 12. `src/application/EventHandler.ts` — TIMER_NO_CLEANUP

- **Issue:** `setInterval` is called without storing the return value or calling `clearInterval` anywhere in the file.
- **Rule broken:** Timers without cleanup lead to memory leaks and zombie processes in long-running applications.
- **Expected output:**
  ```json
  {
    "filePath": "src/application/EventHandler.ts",
    "line": 9,
    "description": "setInterval without clearInterval — potential memory leak",
    "severity": "error",
    "rule": "TIMER_NO_CLEANUP"
  }
  ```

## Running the Audit

From the monorepo root, connect the MCP server to your IDE and invoke:

```
audit_all({ directory: "./patient-repo" })
```

The expected consolidated report should contain:
- 3 errors from Clean-Guard (layer violations)
- 1 warning from TDD-Strict (missing test)
- 2+ errors from DDD-Guard (mutable public state + direct internal access)
- 2+ errors from Security-Guard (hardcoded secrets + env access in domain)
- 2+ errors from SOLID-Copilot (god object + fat interface)
- 2+ errors from Concurrency-Guard (mutable exports + timer without cleanup)

Overall report status: `failed`.
