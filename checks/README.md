# Checks

Run the repository integrity check from the repository root:

```powershell
pwsh -File checks/check-structure.ps1
```

The structure check verifies required scaffold files, local Markdown links, duplicate
normative rule IDs, module status, catalog coverage, profile baseline references, required
rule metadata, and the presence of correct/incorrect examples in draft modules. It does not
assess whether the wording of a rule is technically correct for a particular project.

Run `pwsh -File checks/check-examples.ps1` to verify that every draft module has a paired
external C example and, when `gcc` is available, syntax-check both files with
`gcc -std=c11 -Wall -Wextra -fsyntax-only`. Use `-RequireCompiler` when the environment
must provide a compiler.
