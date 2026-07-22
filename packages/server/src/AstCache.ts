export class AstCache {
  private cache = new Map<string, { ast: any; mtime: number }>();
  private accessOrder: string[] = [];

  constructor(private maxEntries: number = 500) {}

  get(filepath: string, mtime: number): any | null {
    const entry = this.cache.get(filepath);
    if (!entry || entry.mtime !== mtime) return null;
    // Move to end (most recently used)
    this.accessOrder = this.accessOrder.filter(k => k !== filepath);
    this.accessOrder.push(filepath);
    return entry.ast;
  }

  set(filepath: string, ast: any, mtime: number): void {
    if (this.cache.size >= this.maxEntries && !this.cache.has(filepath)) {
      const lru = this.accessOrder.shift();
      if (lru) this.cache.delete(lru);
    }
    this.cache.set(filepath, { ast, mtime });
    this.accessOrder = this.accessOrder.filter(k => k !== filepath);
    this.accessOrder.push(filepath);
  }

  invalidate(filepath: string): void {
    this.cache.delete(filepath);
    this.accessOrder = this.accessOrder.filter(k => k !== filepath);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  get size(): number {
    return this.cache.size;
  }
}
