[CmdletBinding()]
param(
    [string]$Compiler = 'gcc',
    [switch]$RequireCompiler
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$errors = [System.Collections.Generic.List[string]]::new()
$rulePattern = [regex]'(?m)^###\s+(?<id>[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,})\s+\[(?:MUST|SHOULD|MAY)\]\s*$'
$ruleLocations = @{}
$unreviewedModules = @{}
$rulesRoot = Join-Path $repositoryRoot 'rules'
$examplesRoot = Join-Path $repositoryRoot 'examples'

foreach ($file in Get-ChildItem -LiteralPath $rulesRoot -Recurse -File -Filter '*.md') {
    if ($file.Name -in @('README.md', 'INDEX.md')) {
        continue
    }

    $relativeFile = [System.IO.Path]::GetRelativePath($repositoryRoot, $file.FullName).Replace('\', '/')
    $content = Get-Content -LiteralPath $file.FullName -Raw
    $statusMatch = [regex]::Match($content, '(?m)^Status:\s*(?<status>\S+)\s*$')
    if ($statusMatch.Success -and $statusMatch.Groups['status'].Value -in @('draft', 'provisional')) {
        $unreviewedModules[$relativeFile] = $true
    }
    foreach ($ruleMatch in $rulePattern.Matches($content)) {
        $ruleLocations[$ruleMatch.Groups['id'].Value] = $relativeFile
    }
}

$exampleIds = @{}
foreach ($directory in Get-ChildItem -LiteralPath $examplesRoot -Directory) {
    $exampleId = $directory.Name
    if ($exampleIds.ContainsKey($exampleId)) {
        $errors.Add("Duplicate example directory: $exampleId")
        continue
    }
    $exampleIds[$exampleId] = $true
    if (-not $ruleLocations.ContainsKey($exampleId)) {
        $errors.Add("Example directory does not match a canonical rule ID: $exampleId")
    }
    foreach ($name in @('compliant.c', 'violation.c')) {
        $filePath = Join-Path $directory.FullName $name
        if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
            $errors.Add("Missing $name for example $exampleId")
        }
    }
}

# A module that has not passed domain-owner review must carry at least one compilable
# external example, so the unreviewed rules have machine-checked evidence behind them.
foreach ($modulePath in $unreviewedModules.Keys) {
    $hasExample = $false
    foreach ($ruleId in $ruleLocations.Keys) {
        if ($ruleLocations[$ruleId] -eq $modulePath -and $exampleIds.ContainsKey($ruleId)) {
            $hasExample = $true
            break
        }
    }
    if (-not $hasExample) {
        $errors.Add("Unreviewed rule module has no paired external example: $modulePath")
    }
}

$compilerCommand = Get-Command -Name $Compiler -ErrorAction SilentlyContinue
if ($null -eq $compilerCommand) {
    if ($RequireCompiler) {
        $errors.Add("C compiler was not found: $Compiler")
    } else {
        Write-Warning "C compiler was not found: $Compiler. Pairing was checked; syntax was not compiled."
    }
} else {
    foreach ($directory in Get-ChildItem -LiteralPath $examplesRoot -Directory) {
        foreach ($name in @('compliant.c', 'violation.c')) {
            $filePath = Join-Path $directory.FullName $name
            if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
                continue
            }
            & $compilerCommand.Source -std=c11 -Wall -Wextra -fsyntax-only $filePath
            if ($LASTEXITCODE -ne 0) {
                $errors.Add("C syntax check failed: $([System.IO.Path]::GetRelativePath($repositoryRoot, $filePath).Replace('\', '/'))")
            }
        }
    }
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}

$compilerStatus = if ($null -eq $compilerCommand) { 'not run' } else { $Compiler }
Write-Host "Example check passed: $($exampleIds.Count) paired directories; compiler=$compilerStatus."
