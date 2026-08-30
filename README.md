# AI Coding Rules

A progressively disclosed rule library for AI-assisted RTOS-based embedded software development.

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

The package supports RTOS-based firmware only. The default and currently only public profile
is `rtos-c11`:

```bash
npx @zhangsan0013/ai-coding-rules init --profile rtos-c11
```

Runtime adapters, architectures, and toolchains are independent selectors; for example:

```bash
npx @zhangsan0013/ai-coding-rules resolve \
  --profile rtos-c11 \
  --signal rtos-rt-thread \
  --signal architecture-riscv \
  --signal toolchain-gcc
```

### Review status

Modules and profiles carry one of three statuses:

| Status | Meaning | Installs by default |
| --- | --- | --- |
| `active` | Reviewed by a domain owner. | yes |
| `provisional` | Structural contract and examples are present; semantic/domain-owner review is pending. | yes, labeled unreviewed |
| `draft` | Rules not written yet. | no, needs `--allow-draft` |

All embedded, RTOS, architecture, and toolchain modules are currently `provisional`, which
makes the RTOS profile `provisional` too. The installer and resolver both say so in
their output. Apply those rules, and do not present them as complete safety coverage; the
[domain review register](docs/domain-coverage-review.md) tracks what each module still needs.

Use `--allow-draft` only for authoring rules that are not finished.

The command creates `.ai-rules/`, a managed block in `AGENTS.md`, and
`PROJECT_RULES.md` when it does not already exist. Existing project instructions and
project rules are preserved. Preview changes with `--dry-run`.

Update a previously installed ruleset with:

```bash
npx @zhangsan0013/ai-coding-rules update
```

Projects installed with an older removed profile must migrate explicitly with
`update --profile rtos-c11`.

Use `--force` only when managed files under `.ai-rules/` were intentionally changed.

Inspect the exact modules selected for a profile and explicit task signals:

```bash
npx @zhangsan0013/ai-coding-rules resolve \
  --profile rtos-c11 \
  --signal public-interface
```

The resolver reports stable module IDs and status in deterministic order, and notes how many
of them are provisional. A signal that selects a `draft` module fails unless `--allow-draft`
is supplied. `provisional` means the structure and evidence contract is present, not that a
target-specific safety review has been completed.

Build a bounded context in stages instead of loading every selected module in full:

```bash
npx @zhangsan0013/ai-coding-rules context \
  --profile rtos-c11 \
  --stage summary \
  --budget 6000 \
  --signal interrupt

npx @zhangsan0013/ai-coding-rules context \
  --profile rtos-c11 \
  --stage rules \
  --rule EMB-ISR-NOWAIT-001
```

`summary` is navigation metadata, `rules` omits examples and detailed verification, and
`evidence` loads those fields only when they are needed. The default project-rule budget is
6,000 estimated tokens, and the CLI rejects budgets above 8,000. The estimate is based on
UTF-8 bytes and is intentionally separate from the model's system, tool, and code context.

## Verification tooling

Several rules name a tool in their verification fields. `templates/.clang-format` is the
formatter configuration for consuming projects; copy it to the project root and run:

```bash
clang-format --dry-run --Werror src/counter.c
```

It encodes the formatter-backed boundaries named by the style rules and guidance:
`C-STYLE-FORMAT-001`, `C-STYLE-BRACES-001`, `C-STYLE-SWITCHFMT-001`, and the pointer-layout
guidance. It stays silent on anything the rules leave to review, such as declaration order,
`sizeof` semantics, and trailing commas in aggregate initializers. A configuration encoding
requirements the rules do not state would be a second, hidden rule source.

The repository does not bundle a consuming project's Doxygen, static-analysis, compiler,
linker, or target configuration. Rules declare the action, artifact, and pass criterion;
the consuming project must run those checks and record any unrun target work. The repository
checks can be run together with:

```bash
npm test
npm run check:structure
npm run check:examples
```

## Manual installation

1. Copy this repository, or vendor it, as `.ai-rules/` in the target project.
2. Adapt `templates/AGENTS.md` into the target project's agent instructions.
3. Copy `templates/PROJECT_RULES.md` to the target project root and fill in known facts.
4. Use the `rtos-c11` profile from `profiles/`.
5. Run `pwsh -File .ai-rules/checks/check-structure.ps1`.
