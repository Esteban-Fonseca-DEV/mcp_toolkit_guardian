import { watch, FSWatcher } from "chokidar";
import { Ruleset } from "@guardian/shared";

export interface FileChangeEvent {
  paths: string[];
  timestamp: number;
}

export type WatcherCallback = (event: FileChangeEvent) => void;

const RELEVANT_EXTENSIONS = ["ts", "js", "go", "py", "dart", "cs", "kt", "rs"];

export class GuardianFileWatcher {
  private watcher: FSWatcher | null = null;
  private pendingPaths: Set<string> = new Set();
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly debounceMs: number;

  constructor(
    private readonly targetPath: string,
    private readonly ruleset: Ruleset,
    private readonly callback: WatcherCallback,
    debounceMs: number = 300
  ) {
    this.debounceMs = debounceMs;
  }

  start(): void {
    const ignored = this.ruleset.excludePaths.map((p) => `**/${p}/**`);

    this.watcher = watch(this.targetPath, {
      ignored: [...ignored, /node_modules/, /dist/, /\.git/],
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on("change", (path: string) => this.handleChange(path));
    this.watcher.on("add", (path: string) => this.handleChange(path));
  }

  stop(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.watcher?.close();
    this.watcher = null;
  }

  handleChange(filePath: string): void {
    if (!this.isRelevantFile(filePath)) return;
    if (this.isExcluded(filePath)) return;

    this.pendingPaths.add(filePath);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const paths = [...this.pendingPaths];
      this.pendingPaths.clear();
      this.callback({ paths, timestamp: Date.now() });
    }, this.debounceMs);
  }

  isRelevantFile(filePath: string): boolean {
    const ext = filePath.split(".").pop()?.toLowerCase();
    return RELEVANT_EXTENSIONS.includes(ext ?? "");
  }

  isExcluded(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, "/");
    return this.ruleset.excludePaths.some(
      (p) => normalized.includes(`/${p}/`) || normalized.includes(`\\${p}\\`)
    );
  }
}
