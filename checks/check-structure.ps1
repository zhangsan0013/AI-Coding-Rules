[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$errors = [System.Collections.Generic.List[string]]::new()

$requiredFiles = @(
    'README.md'
    'AGENTS.md'
    'docs/architecture.md'
    'rules/README.md'
    'rules/INDEX.md'
    'profiles/bare-metal-c11.md'
    'templates/AGENTS.md'
    'templates/PROJECT_RULES.md'
)

foreach ($relativePath in $requiredFiles) {
    $fullPath = Join-Path $repositoryRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        $errors.Add("Missing required file: $relativePath")
    }
}

$markdownFiles = Get-ChildItem -LiteralPath $repositoryRoot -Recurse -File -Filter '*.md' |
    Where-Object { $_.Name -ne 'CODING_RULES.md' }
$linkPattern = [regex]'\[[^\]]+\]\((?<target>[^)]+)\)'
$rulePattern = [regex]'(?m)^###\s+(?<id>[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,})\s+\[(?:MUST|SHOULD|MAY)\]\s*$'
$ruleLocations = @{}

foreach ($file in $markdownFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw

    foreach ($match in $linkPattern.Matches($content)) {
        $target = $match.Groups['target'].Value.Split('#', 2)[0]
        if ([string]::IsNullOrWhiteSpace($target) -or $target -match '^(?:[a-z]+:|#)') {
            continue
        }

        $targetPath = Join-Path $file.DirectoryName $target
        if (-not (Test-Path -LiteralPath $targetPath)) {
            $relativeFile = [System.IO.Path]::GetRelativePath($repositoryRoot, $file.FullName)
            $errors.Add("Broken link in ${relativeFile}: $target")
        }
    }

    foreach ($match in $rulePattern.Matches($content)) {
        $ruleId = $match.Groups['id'].Value
        $relativeFile = [System.IO.Path]::GetRelativePath($repositoryRoot, $file.FullName)
        if ($ruleLocations.ContainsKey($ruleId)) {
            $errors.Add("Duplicate rule ID ${ruleId}: $($ruleLocations[$ruleId]) and $relativeFile")
            continue
        }
        $ruleLocations[$ruleId] = $relativeFile
    }
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host "Structure check passed: $($markdownFiles.Count) Markdown files, $($ruleLocations.Count) normative rules."
