# Checks

Run the repository integrity check from the repository root:

```powershell
pwsh -File checks/check-structure.ps1
```

The structure check verifies required scaffold files, local Markdown links, duplicate
normative rule IDs, module status, catalog coverage, profile baseline references, required
rule metadata, non-placeholder verification, and exactly one rule-level `Correct:`/`Incorrect:`
pair for each `MUST`. It treats `Guidance` sections as non-normative and does not assess whether
the wording of a rule is technically correct for a particular target.

Run `pwsh -File checks/check-examples.ps1` to verify the declared representative paired
external C examples and, when `gcc` is available, syntax-check both files with
`gcc -std=c11 -Wall -Wextra -fsyntax-only`. Use `-RequireCompiler` when the environment
must provide a compiler.

`npm test` also runs the cross-platform rule-contract tests. These tests cover section
boundaries, missing examples, placeholder evidence, and the current rule-set counts without
requiring PowerShell or GCC.
