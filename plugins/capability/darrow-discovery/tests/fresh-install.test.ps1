$ErrorActionPreference = "Stop"

$pluginRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$fixture = Join-Path ([System.IO.Path]::GetTempPath()) ("darrow discovery " + [guid]::NewGuid())
$copy = Join-Path $fixture "plugin copy"
$utf8 = [System.Text.UTF8Encoding]::new($false)

function Assert-Bytes([string]$Path, [byte[]]$Expected, [string]$Message) {
    $actual = [System.IO.File]::ReadAllBytes($Path)
    if ([Convert]::ToBase64String($actual) -ne [Convert]::ToBase64String($Expected)) {
        throw $Message
    }
}

function Invoke-Renderer(
    [string]$Backend,
    [string]$WorkingDirectory,
    [string[]]$Arguments,
    [string]$StdoutPath,
    [string]$StderrPath
) {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = (Get-Command uv).Source
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.WorkingDirectory = $WorkingDirectory
    foreach ($argument in @(
        "run", "--quiet", "--frozen", "--no-dev", "--project", $Backend,
        "darrow-render-plan-frontier"
    ) + $Arguments) {
        [void]$startInfo.ArgumentList.Add($argument)
    }

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    $stdoutStream = $null
    $stderrStream = $null
    try {
        if (-not $process.Start()) { throw "renderer process did not start" }
        $stdoutStream = [System.IO.File]::Open(
            $StdoutPath,
            [System.IO.FileMode]::Create,
            [System.IO.FileAccess]::Write,
            [System.IO.FileShare]::None
        )
        $stderrStream = [System.IO.File]::Open(
            $StderrPath,
            [System.IO.FileMode]::Create,
            [System.IO.FileAccess]::Write,
            [System.IO.FileShare]::None
        )
        $stdoutCopy = $process.StandardOutput.BaseStream.CopyToAsync($stdoutStream)
        $stderrCopy = $process.StandardError.BaseStream.CopyToAsync($stderrStream)
        $process.WaitForExit()
        [System.Threading.Tasks.Task]::WaitAll(
            [System.Threading.Tasks.Task[]]@($stdoutCopy, $stderrCopy)
        )
        return $process.ExitCode
    }
    finally {
        if ($null -ne $stdoutStream) { $stdoutStream.Dispose() }
        if ($null -ne $stderrStream) { $stderrStream.Dispose() }
        $process.Dispose()
    }
}

try {
    New-Item -ItemType Directory -Path $fixture | Out-Null
    Copy-Item -LiteralPath $pluginRoot -Destination $copy -Recurse
    $backend = Join-Path $copy "backend"
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

    $stdout = Join-Path $fixture "stdout"
    $stderr = Join-Path $fixture "stderr"
    $expected = @(
        "Evidence: The repository stores records in one region today.",
        "",
        "Q1 — Data region: single-region or multi-region?",
        "",
        "Recommendation: Choose single-region because it limits operational coupling.",
        "",
        "Deferred: storage vendor and migration path. After your answer, I will recompute the next frontier."
    ) -join "`n"

    $exitCode = Invoke-Renderer $backend $fixture @(
        "--evidence", "The repository stores records in one region today.",
        "--question", "Data region: single-region or multi-region?",
        "--option", "single-region", "--option", "multi-region", "--choice", "single-region",
        "--rationale", "it limits operational coupling",
        "--deferred", "storage vendor and migration path"
    ) $stdout $stderr
    if ($exitCode -ne 0) { throw "renderer failed" }
    Assert-Bytes $stdout ($utf8.GetBytes("$expected`n")) "renderer output bytes differed from the public contract"
    Assert-Bytes $stderr ([byte[]]@()) "valid renderer invocation wrote stderr"

    $previousPythonIoEncoding = $env:PYTHONIOENCODING
    $env:PYTHONIOENCODING = "cp1252"
    try {
        $exitCode = Invoke-Renderer $backend $fixture @(
            "--evidence", "Fact", "--question", "Mode: ä or b?",
            "--option", "Ä", "--option", "b", "--choice", "ä",
            "--rationale", "reason", "--deferred", "category"
        ) $stdout $stderr
        if ($exitCode -ne 0) { throw "Unicode renderer invocation failed" }
    }
    finally {
        $env:PYTHONIOENCODING = $previousPythonIoEncoding
    }
    $unicodeExpected = @(
        "Evidence: Fact.",
        "",
        "Q1 — Mode: ä or b?",
        "",
        "Recommendation: Choose ä because reason.",
        "",
        "Deferred: category. After your answer, I will recompute the next frontier."
    ) -join "`n"
    Assert-Bytes $stdout ($utf8.GetBytes("$unicodeExpected`n")) "Unicode renderer output bytes differed"
    Assert-Bytes $stderr ([byte[]]@()) "Unicode renderer invocation wrote stderr"

    $exitCode = Invoke-Renderer $backend $fixture @() $stdout $stderr
    if ($exitCode -ne 2) { throw "invalid renderer invocation did not exit 2" }
    Assert-Bytes $stdout ([byte[]]@()) "invalid renderer invocation wrote stdout"
    Assert-Bytes $stderr ($utf8.GetBytes("every frontier field must be non-empty`n")) "invalid renderer diagnostic bytes differed"

    $usage = "usage: darrow-render-plan-frontier --evidence TEXT --question TEXT --option LABEL --option LABEL [--option LABEL ...] --choice LABEL --rationale TEXT --deferred TEXT`n"
    function Assert-Usage([string[]]$Arguments) {
        $exitCode = Invoke-Renderer $backend $fixture $Arguments $stdout $stderr
        if ($exitCode -ne 2) { throw "malformed renderer invocation did not exit 2" }
        Assert-Bytes $stdout ([byte[]]@()) "malformed renderer invocation wrote stdout"
        Assert-Bytes $stderr ($utf8.GetBytes($usage)) "renderer usage bytes differed"
    }
    Assert-Usage -Arguments @("--evidence")
    Assert-Usage -Arguments @("--unknown", "value")
}
finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force -ErrorAction SilentlyContinue
}
