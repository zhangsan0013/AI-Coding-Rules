# Repository Guidelines

## Purpose and structure

This repository is a progressively disclosed rule library for AI-assisted embedded
development. Keep these responsibilities separate:

- `rules/` is the only canonical location for normative rules.
- `rules/catalog.json` is the machine-readable metadata source and must stay synchronized
  with module and profile status and paths.
- `rules/INDEX.md` routes tasks to rule modules; it must not duplicate rule text.
- `profiles/` select modules; they must not restate their rules.
- `templates/` adapt the library for consuming projects.
- `examples/` demonstrate individual rules.
- `checks/` verifies repository structure and references.

`CODING_RULES.md` is legacy source material until its rules are reviewed and migrated.

## Rule authoring

Follow `rules/README.md`. Each normative rule must have one stable ID, one strength,
explicit applicability, rationale, verification method, and exception policy. Keep one
independently testable requirement per rule.

Do not silently weaken safety rules. Project-specific exceptions belong in the consuming
project's `PROJECT_RULES.md` and must include a reason.

## Validation

After documentation changes, run:

```powershell
pwsh -File checks/check-structure.ps1
```

Also inspect changed Markdown for readable headings and correctly closed code fences.
When C examples are added, run the formatter, compiler, or static analysis named by the
corresponding rule.

## Change discipline

Keep changes scoped. Avoid generated bundles, custom parsers, or tool-specific adapters
until a real consumer requires them. Use concise imperative commit subjects and report the
validation performed.
