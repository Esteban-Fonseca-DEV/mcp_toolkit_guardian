import { describe, it, expect, beforeEach } from "vitest";
import { AstCache } from "../AstCache";

describe("AstCache", () => {
  let cache: AstCache;

  beforeEach(() => {
    cache = new AstCache(500);
  });

  describe("get", () => {
    it("returns cached AST on hit (same filepath + mtime)", () => {
      const ast = { type: "Program", body: [] };
      cache.set("/src/file.ts", ast, 1000);

      const result = cache.get("/src/file.ts", 1000);
      expect(result).toBe(ast);
    });

    it("returns null on miss (different mtime)", () => {
      const ast = { type: "Program", body: [] };
      cache.set("/src/file.ts", ast, 1000);

      const result = cache.get("/src/file.ts", 2000);
      expect(result).toBeNull();
    });

    it("returns null for non-existent entry", () => {
      const result = cache.get("/src/unknown.ts", 1000);
      expect(result).toBeNull();
    });

    it("invalidates entry on mtime mismatch (forces re-parse)", () => {
      const ast = { type: "Program", body: [] };
      cache.set("/src/file.ts", ast, 1000);

      // Miss due to mtime change — entry should be removed
      cache.get("/src/file.ts", 2000);

      // Entry is gone — even old mtime should miss
      expect(cache.get("/src/file.ts", 1000)).toBeNull();
      expect(cache.size).toBe(0);
    });
  });

  describe("set", () => {
    it("stores entry correctly", () => {
      const ast = { type: "Program", body: [] };
      cache.set("/src/file.ts", ast, 1000);
      expect(cache.size).toBe(1);
      expect(cache.get("/src/file.ts", 1000)).toBe(ast);
    });

    it("overwrites existing entry with same key", () => {
      const ast1 = { version: 1 };
      const ast2 = { version: 2 };

      cache.set("/src/file.ts", ast1, 1000);
      cache.set("/src/file.ts", ast2, 2000);

      expect(cache.size).toBe(1);
      expect(cache.get("/src/file.ts", 2000)).toBe(ast2);
    });
  });

  describe("LRU eviction", () => {
    it("evicts LRU entry when exceeding maxEntries", () => {
      const smallCache = new AstCache(3);

      smallCache.set("/a.ts", { a: true }, 1);
      smallCache.set("/b.ts", { b: true }, 2);
      smallCache.set("/c.ts", { c: true }, 3);

      // Access /a.ts to make it recently used
      smallCache.get("/a.ts", 1);

      // Insert fourth entry — should evict /b.ts (least recently used)
      smallCache.set("/d.ts", { d: true }, 4);

      expect(smallCache.size).toBe(3);
      expect(smallCache.get("/b.ts", 2)).toBeNull();
      expect(smallCache.get("/a.ts", 1)).toEqual({ a: true });
      expect(smallCache.get("/c.ts", 3)).toEqual({ c: true });
      expect(smallCache.get("/d.ts", 4)).toEqual({ d: true });
    });

    it("evicts first entry when 501 entries inserted with limit 500", () => {
      const bigCache = new AstCache(500);

      for (let i = 0; i < 501; i++) {
        bigCache.set(`/file${i}.ts`, { index: i }, i);
      }

      expect(bigCache.size).toBe(500);
      // First entry should be evicted
      expect(bigCache.get("/file0.ts", 0)).toBeNull();
      // Last entry should exist
      expect(bigCache.get("/file500.ts", 500)).toEqual({ index: 500 });
    });

    it("does not evict when updating existing entry", () => {
      const smallCache = new AstCache(3);

      smallCache.set("/a.ts", { a: true }, 1);
      smallCache.set("/b.ts", { b: true }, 2);
      smallCache.set("/c.ts", { c: true }, 3);

      // Update existing entry — should NOT trigger eviction
      smallCache.set("/a.ts", { a: "updated" }, 10);

      expect(smallCache.size).toBe(3);
      expect(smallCache.get("/a.ts", 10)).toEqual({ a: "updated" });
      expect(smallCache.get("/b.ts", 2)).toEqual({ b: true });
      expect(smallCache.get("/c.ts", 3)).toEqual({ c: true });
    });
  });

  describe("invalidate", () => {
    it("removes specific entry", () => {
      cache.set("/src/file.ts", { x: 1 }, 100);
      expect(cache.get("/src/file.ts", 100)).toEqual({ x: 1 });

      cache.invalidate("/src/file.ts");
      expect(cache.get("/src/file.ts", 100)).toBeNull();
      expect(cache.size).toBe(0);
    });

    it("does nothing for non-existent entry", () => {
      cache.set("/a.ts", { x: 1 }, 100);
      cache.invalidate("/nonexistent.ts");
      expect(cache.size).toBe(1);
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      cache.set("/a.ts", {}, 1);
      cache.set("/b.ts", {}, 2);
      cache.set("/c.ts", {}, 3);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get("/a.ts", 1)).toBeNull();
    });
  });

  describe("capacity", () => {
    it("reports correct capacity", () => {
      expect(cache.capacity).toBe(500);
    });

    it("defaults to 500 when no argument provided", () => {
      const defaultCache = new AstCache();
      expect(defaultCache.capacity).toBe(500);
    });

    it("supports custom capacity", () => {
      const customCache = new AstCache(1000);
      expect(customCache.capacity).toBe(1000);
    });
  });
});
