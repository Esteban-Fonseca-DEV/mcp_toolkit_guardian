import * as fs from "fs";
import * as path from "path";

const SUPPORTED_EXTENSIONS = [".go", ".py", ".ts", ".tsx", ".cs"];

/**
 * Recursively collects source files from a directory.
 * Filters by supported extensions and excludes common non-source directories.
 */
export function collectFiles(directory: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", "dist", ".git", "coverage"].includes(entry.name)) {
          walk(fullPath);
        }
      } else if (SUPPORTED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }

  walk(directory);
  return files;
}
