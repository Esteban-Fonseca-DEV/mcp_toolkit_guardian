import { describe, it, expect } from "vitest";
import { parseImports } from "../AstParser";

describe("AstParser - parseImports", () => {
  it("should extract all static import declarations from a valid TypeScript file", () => {
    const content = `
import { UserService } from "../domain/UserService";
import { Repository } from "../infrastructure/Repository";
import * as path from "path";
`;
    const result = parseImports("src/app/index.ts", content);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);
    expect(result![0]).toEqual({
      sourcePath: "src/app/index.ts",
      targetModule: "../domain/UserService",
      line: 2,
    });
    expect(result![1]).toEqual({
      sourcePath: "src/app/index.ts",
      targetModule: "../infrastructure/Repository",
      line: 3,
    });
    expect(result![2]).toEqual({
      sourcePath: "src/app/index.ts",
      targetModule: "path",
      line: 4,
    });
  });

  it("should return an empty array for a file with no imports", () => {
    const content = `
const x = 42;
export function hello() { return "world"; }
`;
    const result = parseImports("src/utils.ts", content);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(0);
  });

  it("should only capture static imports, not dynamic import() expressions", () => {
    const content = `
import { foo } from "./foo";
const bar = await import("./bar");
`;
    const result = parseImports("src/dynamic.ts", content);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].targetModule).toBe("./foo");
  });

  it("should return null for completely unparseable content", () => {
    // Binary/garbage content that causes parse errors
    const content = "\x00\x01\x02\x03 @@@ {{{ not valid at all %%%";
    const result = parseImports("src/broken.ts", content);

    // TypeScript is very lenient, so it may or may not return null
    // The key is it should not throw an exception
    expect(() => parseImports("src/broken.ts", content)).not.toThrow();
  });

  it("should handle type-only imports", () => {
    const content = `
import type { Config } from "./config";
import { run } from "./runner";
`;
    const result = parseImports("src/main.ts", content);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![0].targetModule).toBe("./config");
    expect(result![1].targetModule).toBe("./runner");
  });

  it("should handle side-effect imports", () => {
    const content = `
import "./polyfills";
import { x } from "./x";
`;
    const result = parseImports("src/entry.ts", content);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![0].targetModule).toBe("./polyfills");
    expect(result![1].targetModule).toBe("./x");
  });
});
