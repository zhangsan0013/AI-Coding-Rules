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
$requiredRuleMetadata = @('Applies when:', 'Rationale:', 'Verification:', 'Exceptions:')

foreach ($file in $markdownFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw
    $relativeFile = [System.IO.Path]::GetRelativePath($repositoryRoot, $file.FullName).Replace('\', '/')

    if ($relativeFile -like 'rules/*' -and $file.Name -notin @('README.md', 'INDEX.md')) {
        $statusMatch = [regex]::Match($content, '(?m)^Status:\s*(?<status>\S+)\s*$')
        if (-not $statusMatch.Success) {
            $errors.Add("Missing module status: $relativeFile")
        }

        $moduleRules = @($rulePattern.Matches($content))
        if ($statusMatch.Groups['status'].Value -eq 'active' -and $moduleRules.Count -eq 0) {
            $errors.Add("Active rule module has no normative rules: $relativeFile")
        }
        if ($relativeFile -in @('rules/core/correctness.md', 'rules/core/change-policy.md') -and $moduleRules.Count -eq 0) {
            $errors.Add("Core rule module has no normative rules: $relativeFile")
        }

        foreach ($ruleMatch in $moduleRules) {
            $nextHeading = $content.IndexOf('### ', $ruleMatch.Index + 4)
            if ($nextHeading -lt 0) {
                $nextHeading = $content.Length
            }
            $ruleSection = $content.Substring($ruleMatch.Index, $nextHeading - $ruleMatch.Index)
            foreach ($metadata in $requiredRuleMetadata) {
                if ($ruleSection -notmatch [regex]::Escape($metadata)) {
                    $errors.Add("Missing rule metadata ${metadata} in ${relativeFile}: $($ruleMatch.Groups['id'].Value)")
                }
            }
            if ($relativeFile -like 'rules/core/*.md') {
                if ($ruleSection -notmatch '(?m)^Correct:\s*$') {
                    $errors.Add("Missing correct example in ${relativeFile}: $($ruleMatch.Groups['id'].Value)")
                }
                if ($ruleSection -notmatch '(?m)^Incorrect:\s*$') {
                    $errors.Add("Missing incorrect example in ${relativeFile}: $($ruleMatch.Groups['id'].Value)")
                }
            }
        }
    }

    foreach ($match in $linkPattern.Matches($content)) {
        $target = $match.Groups['target'].Value.Split('#', 2)[0]
        if ([string]::IsNullOrWhiteSpace($target) -or $target -match '^(?:[a-z]+:|#)') {
            continue
        }

        $targetPath = Join-Path $file.DirectoryName $target
        if (-not (Test-Path -LiteralPath $targetPath)) {
            $errors.Add("Broken link in ${relativeFile}: $target")
        }
    }

    foreach ($match in $rulePattern.Matches($content)) {
        $ruleId = $match.Groups['id'].Value
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
