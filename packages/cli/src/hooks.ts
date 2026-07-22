import * as fs from "fs";
import * as path from "path";

const PRE_COMMIT_SCRIPT = `#!/bin/sh
# Guardian MCP Toolkit — Pre-commit hook
# Runs architecture audit on staged TypeScript files

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\\.ts$' | grep -v '\\.test\\.ts$' | grep -v '\\.spec\\.ts$')

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

echo "Guardian: Auditing staged files..."

# Run guardian audit on the project directory
npx guardian audit . --fail-on error

if [ $? -ne 0 ]; then
  echo "Guardian: Violations detected. Fix them before committing."
  exit 1
fi

echo "Guardian: All checks passed."
exit 0
`;

const PRE_PUSH_SCRIPT = `#!/bin/sh
# Guardian MCP Toolkit — Pre-push hook
# Runs full audit before push

echo "Guardian: Running full audit before push..."

npx guardian audit . --fail-on error

if [ $? -ne 0 ]; then
  echo "Guardian: Violations detected. Fix them before pushing."
  exit 1
fi

echo "Guardian: All checks passed."
exit 0
`;

export function installHooks(projectDir: string): { created: string[]; appended: string[] } {
  const gitDir = path.join(projectDir, ".git");
  const hooksDir = path.join(gitDir, "hooks");

  if (!fs.existsSync(gitDir)) {
    throw new Error("Not a git repository (no .git directory found)");
  }

  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const created: string[] = [];
  const appended: string[] = [];

  // Install pre-commit
  const preCommitPath = path.join(hooksDir, "pre-commit");
  if (fs.existsSync(preCommitPath)) {
    const existing = fs.readFileSync(preCommitPath, "utf-8");
    if (!existing.includes("guardian audit")) {
      fs.appendFileSync(preCommitPath, "\n" + PRE_COMMIT_SCRIPT);
      appended.push("pre-commit");
    }
  } else {
    fs.writeFileSync(preCommitPath, PRE_COMMIT_SCRIPT, { mode: 0o755 });
    created.push("pre-commit");
  }

  // Install pre-push
  const prePushPath = path.join(hooksDir, "pre-push");
  if (fs.existsSync(prePushPath)) {
    const existing = fs.readFileSync(prePushPath, "utf-8");
    if (!existing.includes("guardian audit")) {
      fs.appendFileSync(prePushPath, "\n" + PRE_PUSH_SCRIPT);
      appended.push("pre-push");
    }
  } else {
    fs.writeFileSync(prePushPath, PRE_PUSH_SCRIPT, { mode: 0o755 });
    created.push("pre-push");
  }

  return { created, appended };
}
