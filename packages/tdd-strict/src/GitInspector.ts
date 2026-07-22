import simpleGit, { SimpleGit } from "simple-git";

/**
 * Inspects git history and diffs to extract changed file information.
 */
export class GitInspector {
  private git: SimpleGit;

  constructor(workingDir?: string) {
    this.git = simpleGit(workingDir);
  }

  /**
   * Returns the list of files changed in a given commit.
   */
  async getChangedFiles(commitHash: string): Promise<string[]> {
    const result = await this.git.diff(["--name-only", `${commitHash}~1`, commitHash]);
    return result
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /**
   * Parses a git diff string and extracts production file paths
   * (excludes test files matching common patterns).
   */
  getDiff(gitDiff: string): string[] {
    const lines = gitDiff.split("\n");
    const files = new Set<string>();

    for (const line of lines) {
      // Match diff header lines like "diff --git a/path/to/file b/path/to/file"
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      if (match) {
        const filePath = match[2];
        // Only include production files (exclude test files)
        if (!isTestFile(filePath)) {
          files.add(filePath);
        }
      }
    }

    return Array.from(files);
  }
}

/**
 * Checks if a file path corresponds to a test file.
 */
function isTestFile(filePath: string): boolean {
  return (
    filePath.includes(".test.") ||
    filePath.includes(".spec.") ||
    filePath.includes("_test.") ||
    filePath.includes("__tests__/")
  );
}
