$ErrorActionPreference = "Stop"
$contextPath = Join-Path $PSScriptRoot "context.txt"
[Console]::Out.Write([IO.File]::ReadAllText($contextPath, [Text.Encoding]::UTF8))
