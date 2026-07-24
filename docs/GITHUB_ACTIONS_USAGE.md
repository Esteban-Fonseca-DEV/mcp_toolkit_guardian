# Using Guardian MCP Toolkit in GitHub Actions

## Quick Setup (for any repository)

Add this workflow to your project's `.github/workflows/guardian.yml`:

```yaml
name: Guardian Architecture Audit
on: [pull_request, push]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Guardian CLI
        run: npm install -g guardian-mcp-toolkit

      - name: Run Audit
        run: guardian audit . --format json --fail-on error
        
      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: guardian-report
          path: audit-report.json
```

## Using the Deployed API Gateway (no local install needed)

For teams that don't want to install Guardian locally, you can call the API directly:

```yaml
name: Guardian Cloud Audit
on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Audit via Guardian API
        run: |
          # Send each source file to the clean-guard Lambda
          RESULT=$(curl -s -X POST \
            "https://c7dkqug6kf.execute-api.us-east-2.amazonaws.com/prod/clean-guard" \
            -H "Content-Type: application/json" \
            -d '{
              "toolName": "validate_layer_boundaries",
              "args": { "source_layer": "domain", "target_layer": "infrastructure" },
              "ruleset": {
                "version": "1.0.0",
                "executionMode": "cloud",
                "layers": [
                  {"name": "domain", "paths": ["src/domain/**"], "allowedDependencies": []},
                  {"name": "infrastructure", "paths": ["src/infrastructure/**"], "allowedDependencies": ["domain"]}
                ],
                "testConventions": [{"pattern": "**/*.test.ts"}],
                "excludePaths": ["node_modules"]
              }
            }')
          echo "$RESULT"
          
          # Check if any violations found
          if echo "$RESULT" | grep -q '"status":"failed"'; then
            echo "Architecture violations detected!"
            exit 1
          fi
```

## Using the GitHub Action (composite)

Use `guardian-mcp/action@v1` in your workflow:

```yaml
name: Guardian Governance Audit
on:
  pull_request:
    branches: [main, develop]

jobs:
  audit:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
    steps:
      - uses: actions/checkout@v4

      - uses: guardian-mcp/action@v1
        with:
          path: '.'
          fail-on: 'error'
          format: 'text'
          generate-pr-comment: 'true'
```

### Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `path` | Path to analyze | `.` |
| `fail-on` | Severity level that causes failure: `error` or `warning` | `error` |
| `format` | Output format: `text` or `json` | `text` |
| `generate-pr-comment` | Generate PR comment with results | `true` |

### Action Outputs

| Output | Description |
|--------|-------------|
| `status` | Audit status: `passed`, `failed`, or `error` |
| `violations-count` | Total number of violations found |
| `report` | Full audit report in JSON format |

### Features

- Runs `guardian audit` on PR code without requiring an external MCP server (CLI headless mode)
- Marks check as failure when blocking violations detected
- Generates PR comment with table of Architectural Drift, agent, and suggestions
- Updates existing comment on re-runs instead of creating duplicates

## Configuration

Create a `.guardian.json` in your project root. Guardian will auto-detect your project structure if none exists.

See the main README for configuration options.
