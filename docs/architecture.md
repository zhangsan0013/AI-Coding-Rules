# Architecture

## Processing flow

```text
AI task
  -> target-project AGENTS.md
  -> target-project PROJECT_RULES.md
  -> selected profile
  -> rules/catalog.json resolution
  -> rules/INDEX.md task routing
  -> canonical rule modules
  -> examples and checks
```

The target-project instructions and `rules/INDEX.md` form the small interface presented to
an AI agent. `rules/catalog.json` is the machine-readable routing interface used by the
resolver and checks. Detailed embedded knowledge remains local to the applicable rule
modules.

## Responsibilities

| Part | Responsibility | Must not do |
| --- | --- | --- |
| `README.md` | Explain the repository to people | Define normative rules |
| Root `AGENTS.md` | Govern maintenance of this repository | Govern consuming projects |
| `rules/INDEX.md` | Route tasks to modules | Copy rule text |
| `rules/catalog.json` | Identify modules, signals, dependencies, and profiles | Define normative rule text |
| `rules/` modules | Define canonical constraints | Select project profiles |
| `profiles/` | Select a reusable baseline | Duplicate rules |
| `templates/` | Adapt the library to a consuming project | Become a second rule source |
| `PROJECT_RULES.md` | Record project facts and approved exceptions | Rewrite general defaults |
| `examples/` | Demonstrate one rule at a time | Introduce undocumented rules |
| `checks/` | Detect structural drift | Guess semantic correctness |

## Precedence

When instructions conflict, apply this order:

1. Verified hardware, ABI, and toolchain facts
2. Explicit project decisions and approved exceptions
3. The selected profile
4. General embedded rules
5. Language and style defaults
6. Surrounding code style when no higher rule applies

Safety constraints require an explicit exception and rationale; they are never silently
overridden.

## Static and dynamic selection

A profile performs static selection. For example, a FreeRTOS profile selects C11,
embedded, RTOS-common, and FreeRTOS-specific modules.

The catalog and resolver perform dynamic selection from explicit task signals. They add DMA
rules only to work marked with the `dma` signal, or public-interface rules only when a
public header or exported symbol change is marked with `public-interface`.
