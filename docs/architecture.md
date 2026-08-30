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

The context command adds a bounded presentation layer without changing that ownership:
`route` and `summary` are navigation views, `rules` is a selected normative section without
evidence, and `evidence` is loaded only for verification or explanation. The Markdown modules
remain the only normative source.

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

A profile performs static selection. The `rtos-c11` profile supplies the C11, embedded-memory,
and generic RTOS baseline. Vendor adapters, architecture, and toolchain modules can be selected
independently.

The supported surface is RTOS-only: there is no bare-metal profile. RTOS firmware still uses
hardware-facing modules when a task signal shows that registers, interrupts, DMA, startup,
representation, architecture, or toolchain behavior is involved.

The catalog and resolver perform dynamic selection from explicit task signals. They add DMA
rules only to work marked with the `dma` signal, public-interface rules only when a public
header or exported symbol change is marked with `public-interface`, and a vendor adapter
only when its runtime signal is present.

The resolver returns module IDs for compatibility. `ai-coding-rules context` consumes that
ordered set and enforces a 6,000-token default budget with an 8,000-token hard maximum while
exposing only the requested stage and selected rule IDs. A budget overflow is an explicit
error; it never silently drops a safety rule.

The intended selection shape is orthogonal rather than a profile for every product matrix:

| Dimension | Generic selector | Concrete selectors |
| --- | --- | --- |
| Runtime | `rtos` | `rtos-freertos`, `rtos-rt-thread`, `rtos-threadx` |
| Architecture | project-defined | `architecture-arm`, `architecture-riscv` |
| Toolchain | project-defined | `toolchain-gcc` and future compiler adapters |

An adapter adds behavior that varies at its seam; it must not copy the generic module's
rules. Exact versions, ISA extensions, core variants, ports, cache state, and linker layout
remain verified project facts in `PROJECT_RULES.md`.
