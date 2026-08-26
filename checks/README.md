# Checks

Run the repository integrity check from the repository root:

```powershell
pwsh -File checks/check-structure.ps1
```

The check verifies required scaffold files, local Markdown links, and duplicate normative
rule IDs. It deliberately does not interpret rule semantics.
