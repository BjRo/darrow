$ErrorActionPreference = "Stop"
$contextPath = Join-Path $PSScriptRoot "context.txt"
$skillPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "../skills/code-review/SKILL.md"))
$skillStream = [IO.File]::OpenRead($skillPath)
$skillStream.Dispose()
[Console]::Out.WriteLine("DARROW_REVIEW_SKILL_PATH_V1: For matching review or repair-verification requests, read this complete skill file: $skillPath")
[Console]::Out.Write([IO.File]::ReadAllText($contextPath, [Text.Encoding]::UTF8))
