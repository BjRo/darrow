$ErrorActionPreference = "Stop"

$pluginRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$fixture = Join-Path ([System.IO.Path]::GetTempPath()) ("darrow skill authoring " + [guid]::NewGuid())
$copy = Join-Path $fixture "plugin"

try {
    New-Item -ItemType Directory -Path $fixture | Out-Null
    Copy-Item -LiteralPath $pluginRoot -Destination $copy -Recurse
    $backend = Join-Path $copy "skills/author-agent-skill/backend"
    $skill = Join-Path $copy "skills/author-agent-skill"
    Remove-Item -LiteralPath (Join-Path $backend ".venv") -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $backend ".coverage") -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $backend "coverage.json") -Force -ErrorAction SilentlyContinue

    & uv sync --locked --no-dev --project $backend
    if ($LASTEXITCODE -ne 0) { throw "runtime sync failed" }
    $runtimeTree = (& uv tree --locked --no-dev --project $backend) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "runtime tree failed" }
    foreach ($tool in @("coverage", "hypothesis", "mypy", "pytest", "ruff")) {
        if ($runtimeTree -match "(?m)(^|\s)$tool(\s|$)") {
            throw "development dependency installed at runtime: $tool"
        }
    }

    $inspection = (& uv run --quiet --frozen --no-dev --project $backend inspect-skill inspect $skill $copy) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "inspection failed" }
    if ($inspection -notmatch "(?m)^status\s+valid$") { throw "inspection omitted valid status" }

    $testScript = Join-Path $fixture "passing test.sh"
    "#!/usr/bin/env bash`nexit 0`n" | Set-Content -Path $testScript -NoNewline
    $matrix = (& uv run --quiet --frozen --no-dev --project $backend verify-shell-tests -- $testScript) -join "`n"
    if ($LASTEXITCODE -notin @(0, 3)) { throw "shell matrix failed with $LASTEXITCODE" }
    if ($matrix -notmatch "(?m)^format\s+darrow-shell-test-matrix-v1$") { throw "matrix omitted format" }
}
finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force -ErrorAction SilentlyContinue
}
