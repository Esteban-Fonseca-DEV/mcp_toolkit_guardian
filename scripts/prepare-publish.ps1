# Prepares guardian-mcp-toolkit for npm publication (Windows)
$ErrorActionPreference = "Stop"

$MonorepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $MonorepoRoot) { $MonorepoRoot = (Get-Location).Path }
Set-Location $MonorepoRoot

Write-Host "📦 Preparing guardian-mcp-toolkit for npm publication..."

# 1. Build everything
pnpm -r run build

# 2. Create publish directory
$PublishDir = Join-Path $MonorepoRoot "publish"
if (Test-Path $PublishDir) { Remove-Item -Recurse -Force $PublishDir }
New-Item -ItemType Directory -Path "$PublishDir\dist\node_modules\@guardian" -Force | Out-Null

# 3. Copy CLI dist
Copy-Item -Recurse "packages\cli\dist\*" "$PublishDir\dist\"

# 4. Copy all @guardian/* packages
$packages = @("shared","clean-guard","tdd-strict","ddd-guard","security-guard","solid-copilot","concurrency-guard","server","dashboard","lang-specialists")
foreach ($pkg in $packages) {
    $dest = "$PublishDir\dist\node_modules\@guardian\$pkg"
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Copy-Item -Recurse "packages\$pkg\dist\*" "$dest\"
    Copy-Item "packages\$pkg\package.json" "$dest\"
}

# 5. Copy README
Copy-Item "packages\cli\README.md" "$PublishDir\"

# 6. Create clean package.json
$packageJson = @{
    name = "guardian-mcp-toolkit"
    version = "1.0.1"
    description = "Real-time architecture audit toolkit for Clean Architecture, DDD, SOLID, and TDD — supports 8 languages via MCP"
    main = "dist/index.js"
    bin = @{ guardian = "dist/index.js" }
    keywords = @("architecture","clean-architecture","ddd","solid","tdd","mcp","audit","linter")
    repository = @{ type = "git"; url = "https://github.com/Estebanfonseca/mcp_toolkit_guardian" }
    license = "MIT"
    engines = @{ node = ">=20.0.0" }
    dependencies = @{
        commander = "^12.0.0"
        glob = "^10.0.0"
        minimatch = "^9.0.0"
        typescript = "^5.7.0"
        "simple-git" = "^3.22.0"
        ajv = "^8.12.0"
        "@modelcontextprotocol/sdk" = "^1.0.0"
        "vscode-languageserver" = "^9.0.0"
        "vscode-languageserver-textdocument" = "^1.0.0"
        zod = "^4.0.0"
    }
} | ConvertTo-Json -Depth 4

$packageJson | Set-Content "$PublishDir\package.json" -Encoding UTF8

Write-Host "✅ Publish package ready at: $PublishDir"
Write-Host "   Run: cd publish; npm publish --access public"
