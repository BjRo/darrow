$ErrorActionPreference = "Stop"

function Test-EnvironmentTrue {
    param([AllowNull()][string]$Value)

    if ($null -eq $Value) {
        return $false
    }
    return @("1", "true", "yes", "on") -contains $Value.Trim().ToLowerInvariant()
}

function Get-StartupFailureCode {
    param([string]$Message)

    if ((Test-EnvironmentTrue $env:DARROW_LANGFUSE_DEBUG) -or
        (Test-EnvironmentTrue $env:DARROW_LANGFUSE_STRICT)) {
        [Console]::Error.WriteLine("darrow-langfuse: $Message")
    }
    if (Test-EnvironmentTrue $env:DARROW_LANGFUSE_STRICT) {
        return 1
    }
    return 0
}

$uv = Get-Command uv -CommandType Application -ErrorAction SilentlyContinue
if ($null -eq $uv) {
    exit (Get-StartupFailureCode "uv is required but was not found")
}

$pluginDirectory = Split-Path -Parent $PSScriptRoot
$statusDirectory = Join-Path ([IO.Path]::GetTempPath()) (
    "darrow-langfuse-status-" + [Guid]::NewGuid().ToString("N")
)
$statusPath = Join-Path $statusDirectory "result"
$hadProgressSetting = Test-Path Env:UV_NO_PROGRESS
$previousProgressSetting = $env:UV_NO_PROGRESS
$result = 0

try {
    New-Item -ItemType Directory -Path $statusDirectory | Out-Null
    $env:UV_NO_PROGRESS = "1"
    $launcher = Join-Path $pluginDirectory "backend/scripts/run_locked.py"
    & $uv.Path run --quiet --no-project $launcher `
        python -m darrow_observability_langfuse.cli --launcher-status $statusPath @args

    if (Test-Path -LiteralPath $statusPath) {
        $resolvedStatus = (Get-Content -LiteralPath $statusPath -Raw).Trim()
        if ($resolvedStatus -in @("0", "1")) {
            $result = [int]$resolvedStatus
        } else {
            $result = Get-StartupFailureCode "backend launch or execution failed"
        }
    } else {
        $result = Get-StartupFailureCode "backend launch or execution failed"
    }
} catch {
    $result = Get-StartupFailureCode "backend launch or execution failed"
} finally {
    if ($hadProgressSetting) {
        $env:UV_NO_PROGRESS = $previousProgressSetting
    } else {
        Remove-Item Env:UV_NO_PROGRESS -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $statusDirectory -Recurse -Force -ErrorAction SilentlyContinue
}

exit $result
