# AI Coding Rules

A progressively disclosed rule library for AI-assisted embedded software development.

The repository contains the canonical constraints and an npm CLI for installing them into
target projects. Rule modules define the constraints, profiles select a project baseline,
and a small routing index tells an AI agent which additional modules to load for the task.

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

## Install with npm

The package includes the rules, profiles, templates, and validation logic. It does not
require a local checkout of this repository or a runtime connection to GitHub.

From the target project directory, run:

```bash
npx @zhangsan0013/ai-coding-rules init
```

The default profile is `bare-metal-c11`. Choose another profile explicitly when needed:

```bash
npx @zhangsan0013/ai-coding-rules init --profile freertos-c11 --allow-draft
```

FreeRTOS and STM32 profiles are currently draft because their runtime-specific modules
are still being reviewed. Use `--allow-draft` only for authoring or experimentation; a
draft profile is not a claim of complete safety coverage.

The command creates `.ai-rules/`, a managed block in `AGENTS.md`, and
`PROJECT_RULES.md` when it does not already exist. Existing project instructions and
project rules are preserved. Preview changes with `--dry-run`.

Update a previously installed ruleset with:

```bash
npx @zhangsan0013/ai-coding-rules update
```

Use `--force` only when managed files under `.ai-rules/` were intentionally changed.

Inspect the exact modules selected for a profile and explicit task signals:

```bash
npx @zhangsan0013/ai-coding-rules resolve \
  --profile bare-metal-c11 \
  --signal public-interface
```

The resolver reports stable module IDs and status in deterministic order. A signal that
selects a draft module fails unless `--allow-draft` is supplied.

## Manual installation

1. Copy this repository, or vendor it, as `.ai-rules/` in the target project.
2. Adapt `templates/AGENTS.md` into the target project's agent instructions.
3. Copy `templates/PROJECT_RULES.md` to the target project root and fill in known facts.
4. Select one profile from `profiles/`.
5. Run `pwsh -File .ai-rules/checks/check-structure.ps1`.

`CODING_RULES.md` is retained as source material for future migration. It is not yet the
canonical rule library and should be split, reviewed, and assigned stable rule IDs before
its contents move under `rules/`.
