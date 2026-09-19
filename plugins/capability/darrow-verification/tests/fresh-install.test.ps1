$ErrorActionPreference = "Stop"

$pluginRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$fixture = Join-Path ([System.IO.Path]::GetTempPath()) ("darrow verification " + [guid]::NewGuid())
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
        "run", "--quiet", "--isolated", "--frozen", "--no-dev", "--project", $Backend,
        "darrow-render-assessment"
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
    $backend = Join-Path $copy "skills/verify-change/backend"
    foreach ($generatedDirectory in @(".venv", ".hypothesis", ".mypy_cache", ".pytest_cache", ".ruff_cache")) {
        Remove-Item -LiteralPath (Join-Path $backend $generatedDirectory) -Recurse -Force -ErrorAction SilentlyContinue
    }
    Get-ChildItem -LiteralPath $backend -Directory -Recurse -Filter "__pycache__" |
        Remove-Item -Recurse -Force
    Get-ChildItem -LiteralPath $backend -File -Filter ".coverage*" |
        Remove-Item -Force
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
    Remove-Item -LiteralPath (Join-Path $backend ".venv") -Recurse -Force

    $outside = Join-Path $fixture "outside"
    New-Item -ItemType Directory -Path $outside | Out-Null
    $assessment = Join-Path $fixture "assessment.md"
    $report = Join-Path $fixture "provider report #%.md"
    $stdout = Join-Path $fixture "stdout"
    $stderr = Join-Path $fixture "stderr"
    $assessmentText = "Conclusion: progress.`n`nF1 remains blocking; A1 is advisory.`n"
    [System.IO.File]::WriteAllText($assessment, $assessmentText, $utf8)
    [System.IO.File]::WriteAllText($report, "Complete provider report, unchanged.`n", $utf8)
    $reportBefore = [System.IO.File]::ReadAllBytes($report)

    $exitCode = Invoke-Renderer $backend $outside @(
        "--assessment", $assessment, "--provider-report", $report
    ) $stdout $stderr
    if ($exitCode -ne 0) { throw "renderer failed" }
    $destination = ([System.IO.Path]::GetFullPath($report)).Replace("%", "%25")
    $destination = $destination.Replace(" ", "%20").Replace("#", "%23")
    $destination = $destination.Replace("?", "%3F").Replace("<", "%3C").Replace(">", "%3E")
    $destination = $destination.Replace("\", "%5C")
    $expected = $assessmentText + "`n`nComplete provider result: [report](<$destination>)`n"
    Assert-Bytes $stdout ($utf8.GetBytes($expected)) "renderer output bytes differed from the public contract"
    Assert-Bytes $stderr ([byte[]]@()) "valid renderer invocation wrote stderr"
    Assert-Bytes $report $reportBefore "renderer changed the provider report"

    $exitCode = Invoke-Renderer $backend $outside @() $stdout $stderr
    if ($exitCode -ne 2) { throw "invalid renderer invocation did not exit 2" }
    Assert-Bytes $stdout ([byte[]]@()) "invalid renderer invocation wrote stdout"
    $usage = "render-assessment: usage: render-assessment --assessment ABSOLUTE_FILE --provider-report ABSOLUTE_FILE`n"
    Assert-Bytes $stderr ($utf8.GetBytes($usage)) "renderer usage bytes differed"

    $exitCode = Invoke-Renderer $backend $outside @(
        "--assessment", $assessment, "--provider-report", "relative.md"
    ) $stdout $stderr
    if ($exitCode -ne 2) { throw "relative report path did not exit 2" }
    Assert-Bytes $stdout ([byte[]]@()) "relative report path wrote stdout"
    $diagnostic = "render-assessment: provider-report requires an absolute path`n"
    Assert-Bytes $stderr ($utf8.GetBytes($diagnostic)) "relative report diagnostic differed"
    if (Test-Path -LiteralPath (Join-Path $backend ".venv")) {
        throw "renderer wrote a virtual environment into the installed skill"
    }
}
finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force -ErrorAction SilentlyContinue
}
