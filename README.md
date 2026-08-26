# AI Coding Rules

A progressively disclosed rule library for AI-assisted embedded software development.

The repository is currently a scaffold. Rule modules define the canonical constraints,
profiles select a project baseline, and a small routing index tells an AI agent which
additional modules to load for the task at hand.

## How it works

1. A target project installs this repository under `.ai-rules/`.
2. The target project's `AGENTS.md` points the AI agent to `.ai-rules/rules/INDEX.md`.
3. `PROJECT_RULES.md` records project facts, the selected profile, and approved exceptions.
4. The selected profile establishes the static baseline.
5. `rules/INDEX.md` loads task-specific modules only when they apply.

See [the architecture](docs/architecture.md) for responsibilities and precedence.

## Repository layout

- `rules/`: canonical rule modules and the routing index
- `profiles/`: reusable selections of rule modules
- `templates/`: files copied or adapted by consuming projects
- `examples/`: compliant and violating examples, grouped by rule ID
- `checks/`: repository integrity checks
- `docs/`: design and contributor documentation

## Start using the scaffold

1. Copy this repository, or vendor it, as `.ai-rules/` in the target project.
2. Adapt `templates/AGENTS.md` into the target project's agent instructions.
3. Copy `templates/PROJECT_RULES.md` to the target project root and fill in known facts.
4. Select one profile from `profiles/`.
5. Run `pwsh -File .ai-rules/checks/check-structure.ps1`.

`CODING_RULES.md` is retained as source material for future migration. It is not yet the
canonical rule library and should be split, reviewed, and assigned stable rule IDs before
its contents move under `rules/`.
