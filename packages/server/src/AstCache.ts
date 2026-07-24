/**
 * LRU Cache for parsed TypeScript ASTs.
 * Avoids redundant parsing of unchanged files, providing sub-second response times.
 *
 * - get(filepath, mtime): returns cached AST if same mtime (hit), null if mtime changed (miss)
 * - set(filepath, ast, mtime): stores AST with mtime
 * - invalidate(filepath): removes entry from cache
 * - clear(): empties all entries
 * - Limit configurable (default 500 entries)
 * - Eviction by LRU when limit exceeded
 */
export class AstCache {
  private cache = new Map<string, { ast: any; mtime: number }>();
  private accessOrder: string[] = [];

  constructor(private maxEntries: number = 500) {}

  /**
   * Get a cached AST for a file.
   * Returns the AST if the file hasn't been modified (same mtime), null otherwise.
   * If mtime differs, the entry is invalidated (cache miss forces re-parse).
   */
  get(filepath: string, mtime: number): any | null {
    const entry = this.cache.get(filepath);
    if (!entry) return null;
    if (entry.mtime !== mtime) {
      // File was modified — invalidate cache entry
      this.cache.delete(filepath);
      this.accessOrder = this.accessOrder.filter(k => k !== filepath);
      return null;
    }
    // Move to end (most recently used)
    this.accessOrder = this.accessOrder.filter(k => k !== filepath);
    this.accessOrder.push(filepath);
    return entry.ast;
  }

  /**
   * Store a parsed AST in the cache.
   * Evicts the least recently used entry if the cache is full.
   */
  set(filepath: string, ast: any, mtime: number): void {
    if (this.cache.size >= this.maxEntries && !this.cache.has(filepath)) {
      const lru = this.accessOrder.shift();
      if (lru) this.cache.delete(lru);
    }
    this.cache.set(filepath, { ast, mtime });
    this.accessOrder = this.accessOrder.filter(k => k !== filepath);
    this.accessOrder.push(filepath);
  }

  /**
   * Invalidate (remove) a specific entry from the cache.
   */
  invalidate(filepath: string): void {
    this.cache.delete(filepath);
    this.accessOrder = this.accessOrder.filter(k => k !== filepath);
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get the current number of entries in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get the maximum number of entries allowed (capacity).
   */
  get capacity(): number {
    return this.maxEntries;
  }
}
