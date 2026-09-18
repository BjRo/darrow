$ErrorActionPreference = "Stop"
$pluginRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
& uv run --quiet --frozen --no-dev --project (Join-Path $pluginRoot "backend") python (Join-Path $pluginRoot "backend/tests/fresh_install.py")
if ($LASTEXITCODE -ne 0) { throw "Fresh Git plugin validation failed: $LASTEXITCODE" }
