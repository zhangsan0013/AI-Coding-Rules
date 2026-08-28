# Checks

Run the repository integrity check from the repository root:

```powershell
pwsh -File checks/check-structure.ps1
```

The check verifies required scaffold files, local Markdown links, duplicate normative rule
IDs, module status, catalog coverage, profile baseline references, required rule metadata,
and the presence of correct/incorrect examples in the canonical `core` modules. It does
not assess whether the wording of a rule is technically correct for a particular project.
