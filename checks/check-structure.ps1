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
    'rules/catalog.json'
    'profiles/bare-metal-c11.md'
    'templates/AGENTS.md'
    'templates/PROJECT_RULES.md'
    'templates/.clang-format'
)

foreach ($relativePath in $requiredFiles) {
    $fullPath = Join-Path $repositoryRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        $errors.Add("Missing required file: $relativePath")
    }
}

$markdownFiles = Get-ChildItem -LiteralPath $repositoryRoot -Recurse -File -Filter '*.md'
$linkPattern = [regex]'\[[^\]]+\]\((?<target>[^)]+)\)'
$rulePattern = [regex]'(?m)^###\s+(?<id>[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,})\s+\[(?<strength>MUST|SHOULD|MAY)\]\s*$'
$ruleLocations = @{}
# Verification is stated in two parts so an unrunnable target step cannot stand in for the
# agent-side check. CORE-CHG-VERIFY-001 depends on both being present.
$requiredRuleMetadata = @(
    'Applies when:'
    'Rationale:'
    'Verification (agent):'
    'Verification (target):'
    'Exceptions:'
)
# Ordered from most to least reviewed. A profile may not name a module that is less
# reviewed than the profile itself claims to be.
$statusRank = @{ 'active' = 0; 'provisional' = 1; 'draft' = 2 }

foreach ($file in $markdownFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw
    $relativeFile = [System.IO.Path]::GetRelativePath($repositoryRoot, $file.FullName).Replace('\', '/')

    if ($relativeFile -like 'rules/*' -and $file.Name -notin @('README.md', 'INDEX.md')) {
        $statusMatch = [regex]::Match($content, '(?m)^Status:\s*(?<status>\S+)\s*$')
        if (-not $statusMatch.Success) {
            $errors.Add("Missing module status: $relativeFile")
        }

        $moduleRules = @($rulePattern.Matches($content))
        if ($moduleRules.Count -eq 0) {
            $errors.Add("Rule module has no normative rules: $relativeFile")
        }
        if ($statusMatch.Groups['status'].Value -in @('draft', 'provisional')) {
            if ($content -notmatch '(?m)^Correct:\s*$') {
                $errors.Add("Unreviewed rule module has no compliant example: $relativeFile")
            }
            if ($content -notmatch '(?m)^Incorrect:\s*$') {
                $errors.Add("Unreviewed rule module has no violating example: $relativeFile")
            }
        }
        foreach ($ruleMatch in $moduleRules) {
            $nextHeadingMatch = [regex]::Match(
                $content.Substring($ruleMatch.Index + 4),
                '(?m)^##\s'
            )
            $nextRuleHeading = $content.IndexOf('### ', $ruleMatch.Index + 4)
            if ($nextHeadingMatch.Success) {
                $nextHeading = $ruleMatch.Index + 4 + $nextHeadingMatch.Index
                if ($nextRuleHeading -ge 0 -and $nextRuleHeading -lt $nextHeading) {
                    $nextHeading = $nextRuleHeading
                }
            } elseif ($nextRuleHeading -ge 0) {
                $nextHeading = $nextRuleHeading
            } else {
                $nextHeading = $content.Length
            }
            $ruleSection = $content.Substring($ruleMatch.Index, $nextHeading - $ruleMatch.Index)
            foreach ($metadata in $requiredRuleMetadata) {
                if ($ruleSection -notmatch [regex]::Escape($metadata)) {
                    $errors.Add("Missing rule metadata ${metadata} in ${relativeFile}: $($ruleMatch.Groups['id'].Value)")
                }
            }

            $ruleId = $ruleMatch.Groups['id'].Value
            $strength = $ruleMatch.Groups['strength'].Value
            $correctExamples = @([regex]::Matches($ruleSection, '(?m)^Correct:\s*$'))
            $incorrectExamples = @([regex]::Matches($ruleSection, '(?m)^Incorrect:\s*$'))
            if ($strength -eq 'MUST') {
                if ($correctExamples.Count -ne 1) {
                    $errors.Add("MUST rule must have exactly one rule-level Correct example in ${relativeFile}: ${ruleId}")
                }
                if ($incorrectExamples.Count -ne 1) {
                    $errors.Add("MUST rule must have exactly one rule-level Incorrect example in ${relativeFile}: ${ruleId}")
                }
            }

            foreach ($verificationField in @('Verification (agent):', 'Verification (target):')) {
                $verificationMatch = [regex]::Match(
                    $ruleSection,
                    "(?m)^- $([regex]::Escape($verificationField))\s*(?<value>.*)$"
                )
                if (-not $verificationMatch.Success) {
                    continue
                }

                $verificationValue = $verificationMatch.Groups['value'].Value.Trim()
                if ([string]::IsNullOrWhiteSpace($verificationValue) -or
                    $verificationValue -match '(?i)^(?:tbd|todo|n/?a|to be determined|review|confirm|verify)\.?$') {
                    $errors.Add("Placeholder ${verificationField} in ${relativeFile}: ${ruleId}")
                }
                if ($verificationValue -match '(?i)^none\.?$') {
                    $errors.Add("Bare None ${verificationField} must explain why it is not applicable in ${relativeFile}: ${ruleId}")
                }
                if ($verificationValue -notmatch '(?i)\bpass\b') {
                    $errors.Add("Missing pass criterion in ${verificationField} in ${relativeFile}: ${ruleId}")
                }
                if ($verificationValue -notmatch '(?i)\bartifact\b') {
                    $errors.Add("Missing artifact in ${verificationField} in ${relativeFile}: ${ruleId}")
                }
            }

            if ($relativeFile -like 'rules/core/*.md') {
                if ($ruleSection -notmatch '(?m)^Correct:\s*$') {
                    $errors.Add("Missing correct example in ${relativeFile}: ${ruleId}")
                }
                if ($ruleSection -notmatch '(?m)^Incorrect:\s*$') {
                    $errors.Add("Missing incorrect example in ${relativeFile}: ${ruleId}")
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

    # Rule IDs are unique within the canonical rule library only.
    if ($relativeFile -like 'rules/*') {
        foreach ($match in $rulePattern.Matches($content)) {
            $ruleId = $match.Groups['id'].Value
            if ($ruleLocations.ContainsKey($ruleId)) {
                $errors.Add("Duplicate rule ID ${ruleId}: $($ruleLocations[$ruleId]) and $relativeFile")
                continue
            }
            $ruleLocations[$ruleId] = $relativeFile
        }
    }
}

$catalogPath = Join-Path $repositoryRoot 'rules/catalog.json'
$catalog = $null
try {
    $catalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json
} catch {
    $errors.Add("Cannot parse rule catalog: $($_.Exception.Message)")
}

if ($null -ne $catalog) {
    if ($catalog.schemaVersion -ne 1) {
        $errors.Add('Rule catalog schemaVersion must be 1')
    }

    $catalogSignals = @{}
    foreach ($signal in @($catalog.signals)) {
        $signalName = [string]$signal
        if ([string]::IsNullOrWhiteSpace($signalName)) {
            $errors.Add('Rule catalog signals must be non-empty strings')
        } elseif ($catalogSignals.ContainsKey($signalName)) {
            $errors.Add("Duplicate rule catalog signal: $signalName")
        } else {
            $catalogSignals[$signalName] = $true
        }
    }

    $catalogModuleIds = @{}
    $catalogModulePaths = @{}
    $rulesRoot = Join-Path $repositoryRoot 'rules'
    $rulesRootFull = [System.IO.Path]::GetFullPath($rulesRoot)
    foreach ($module in @($catalog.modules)) {
        $moduleId = [string]$module.id
        $modulePath = [string]$module.path
        if ([string]::IsNullOrWhiteSpace($moduleId)) {
            $errors.Add('Rule catalog module has no id')
            continue
        }
        if ($catalogModuleIds.ContainsKey($moduleId)) {
            $errors.Add("Duplicate rule catalog module id: $moduleId")
        } else {
            $catalogModuleIds[$moduleId] = $module
        }
        if ([string]::IsNullOrWhiteSpace($modulePath)) {
            $errors.Add("Rule catalog module has no path: $moduleId")
            continue
        }
        if ($catalogModulePaths.ContainsKey($modulePath)) {
            $errors.Add("Duplicate rule catalog module path: $modulePath")
        } else {
            $catalogModulePaths[$modulePath] = $moduleId
        }

        if ($module.status -notin $statusRank.Keys) {
            $errors.Add("Unsupported rule catalog module status ${moduleId}: $($module.status)")
        }
        $loadWhen = @($module.loadWhen)
        if ($loadWhen.Count -eq 0) {
            $errors.Add("Rule catalog module has no loadWhen: $moduleId")
        }
        foreach ($signal in $loadWhen) {
            $signalName = [string]$signal
            if ($signalName -ne 'always' -and -not $catalogSignals.ContainsKey($signalName)) {
                $errors.Add("Unknown rule catalog signal ${signalName}: $moduleId")
            }
        }
        if ($loadWhen -contains 'always' -and $loadWhen.Count -ne 1) {
            $errors.Add("Rule catalog module combines always with another signal: $moduleId")
        }
        $moduleFullPath = [System.IO.Path]::GetFullPath((Join-Path $rulesRoot $modulePath))
        $relativeToRules = [System.IO.Path]::GetRelativePath($rulesRootFull, $moduleFullPath)
        if ($relativeToRules -eq '..' -or $relativeToRules.StartsWith('../') -or $relativeToRules.StartsWith('..\') -or [System.IO.Path]::IsPathRooted($relativeToRules)) {
            $errors.Add("Rule catalog module path escapes rules/: $modulePath")
        } elseif (-not (Test-Path -LiteralPath $moduleFullPath -PathType Leaf)) {
            $errors.Add("Rule catalog module path does not exist: $modulePath")
        } else {
            $moduleContent = Get-Content -LiteralPath $moduleFullPath -Raw
            $moduleStatusMatch = [regex]::Match($moduleContent, '(?m)^Status:\s*(?<status>\S+)\s*$')
            if (-not $moduleStatusMatch.Success -or $moduleStatusMatch.Groups['status'].Value -ne [string]$module.status) {
                $errors.Add("Rule catalog module status mismatch: $modulePath")
            }
        }
    }

    foreach ($module in @($catalog.modules)) {
        $moduleId = [string]$module.id
        foreach ($dependency in @($module.dependsOn)) {
            if (-not $catalogModuleIds.ContainsKey([string]$dependency)) {
                $errors.Add("Unknown rule catalog module dependency ${dependency}: $moduleId")
            }
        }
    }

    $catalogProfileIds = @{}
    $catalogProfilePaths = @{}
    $profilesRoot = Join-Path $repositoryRoot 'profiles'
    $profilesRootFull = [System.IO.Path]::GetFullPath($profilesRoot)
    foreach ($profile in @($catalog.profiles)) {
        $profileId = [string]$profile.id
        $profilePath = [string]$profile.path
        if ([string]::IsNullOrWhiteSpace($profileId)) {
            $errors.Add('Rule catalog profile has no id')
            continue
        }
        if ($catalogProfileIds.ContainsKey($profileId)) {
            $errors.Add("Duplicate rule catalog profile id: $profileId")
        } else {
            $catalogProfileIds[$profileId] = $profile
        }
        if ([string]::IsNullOrWhiteSpace($profilePath)) {
            $errors.Add("Rule catalog profile has no path: $profileId")
            continue
        }
        if ($catalogProfilePaths.ContainsKey($profilePath)) {
            $errors.Add("Duplicate rule catalog profile path: $profilePath")
        } else {
            $catalogProfilePaths[$profilePath] = $profileId
        }
        if ($profile.status -notin $statusRank.Keys) {
            $errors.Add("Unsupported rule catalog profile status ${profileId}: $($profile.status)")
        }
        foreach ($moduleId in @($profile.baseline)) {
            if (-not $catalogModuleIds.ContainsKey([string]$moduleId)) {
                $errors.Add("Unknown rule catalog baseline module ${moduleId}: $profileId")
            } elseif ($statusRank.ContainsKey($profile.status) -and
                      $statusRank.ContainsKey($catalogModuleIds[[string]$moduleId].status) -and
                      $statusRank[$catalogModuleIds[[string]$moduleId].status] -gt $statusRank[$profile.status]) {
                $errors.Add("Profile baseline contains a less-reviewed module ${moduleId}: $profileId")
            }
        }

        $profileFullPath = [System.IO.Path]::GetFullPath((Join-Path $profilesRoot $profilePath))
        $relativeToProfiles = [System.IO.Path]::GetRelativePath($profilesRootFull, $profileFullPath)
        if ($relativeToProfiles -eq '..' -or $relativeToProfiles.StartsWith('../') -or $relativeToProfiles.StartsWith('..\') -or [System.IO.Path]::IsPathRooted($relativeToProfiles)) {
            $errors.Add("Rule catalog profile path escapes profiles/: $profilePath")
        } elseif (-not (Test-Path -LiteralPath $profileFullPath -PathType Leaf)) {
            $errors.Add("Rule catalog profile path does not exist: $profilePath")
        } else {
            $profileContent = Get-Content -LiteralPath $profileFullPath -Raw
            $profileStatusMatch = [regex]::Match($profileContent, '(?m)^Status:\s*(?<status>\S+)\s*$')
            if (-not $profileStatusMatch.Success -or $profileStatusMatch.Groups['status'].Value -ne [string]$profile.status) {
                $errors.Add("Rule catalog profile status mismatch: $profilePath")
            }
        }
    }

    foreach ($profile in @($catalog.profiles)) {
        $profileId = [string]$profile.id
        foreach ($parent in @($profile.inherits)) {
            if (-not $catalogProfileIds.ContainsKey([string]$parent)) {
                $errors.Add("Unknown rule catalog profile parent ${parent}: $profileId")
            } elseif ($statusRank.ContainsKey($profile.status) -and
                      $statusRank.ContainsKey($catalogProfileIds[[string]$parent].status) -and
                      $statusRank[$catalogProfileIds[[string]$parent].status] -gt $statusRank[$profile.status]) {
                $errors.Add("Profile inherits a less-reviewed profile ${parent}: $profileId")
            }
        }
    }

    foreach ($file in Get-ChildItem -LiteralPath $rulesRoot -Recurse -File -Filter '*.md') {
        if ($file.Name -in @('README.md', 'INDEX.md')) {
            continue
        }
        $relativeFile = [System.IO.Path]::GetRelativePath($rulesRoot, $file.FullName).Replace('\', '/')
        if (-not $catalogModulePaths.ContainsKey($relativeFile)) {
            $errors.Add("Rule module is missing from catalog: $relativeFile")
        }
    }

    foreach ($file in Get-ChildItem -LiteralPath $profilesRoot -File -Filter '*.md') {
        $relativeFile = [System.IO.Path]::GetRelativePath($profilesRoot, $file.FullName).Replace('\', '/')
        if (-not $catalogProfilePaths.ContainsKey($relativeFile)) {
            $errors.Add("Profile is missing from catalog: $relativeFile")
        }
    }
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host "Structure check passed: $($markdownFiles.Count) Markdown files, $($ruleLocations.Count) normative rules."
