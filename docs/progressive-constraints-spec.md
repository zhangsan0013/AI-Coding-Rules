# Progressive Constraints Specification

Status: implementation through Phase 5.9 complete; domain-owner review pending

Original baseline commit: `effe308`
Current actionability baseline: `a0d6eba`

## Problem

This repository has a sound progressive-disclosure model, but the current model is
mostly a Markdown convention. An agent must interpret profiles and routing prose, draft
modules can be selected without a coverage signal, and installation can leave the
selected profile inconsistent with `PROJECT_RULES.md`.

The project is currently an RTOS-based embedded C11 rule library, not a domain-neutral
constraint platform. Runtime, architecture, and toolchain concerns are represented as
orthogonal selectors, while bare-metal firmware is outside the supported scope.

## Goals

1. Make profile and module status explicit and fail closed for normal installation.
2. Keep the selected profile consistent across the manifest, `AGENTS.md`, and
   `PROJECT_RULES.md`.
3. Add one small, machine-readable catalog that describes module IDs, activation signals,
   dependencies, and profile inheritance.
4. Provide a deterministic resolver that reports the exact module IDs selected for a
   profile and a set of task signals.
5. Make catalog integrity and the resolver part of the repository's normal validation.
6. Record each completed phase in this file with commands and results.

## Non-goals

- Do not invent normative interrupt, concurrency, DMA, register, memory, RTOS, or
  toolchain rules without a domain review and concrete verification method.
- Do not infer task signals from arbitrary natural-language prompts in this iteration.
- Do not create a profile for every runtime, architecture, and toolchain combination.
- Do not replace `AGENTS.md` with an agent-specific integration layer.
- Do not rewrite user-owned project facts or approved exceptions during an update.
- Do not add runtime dependencies to the package.

## Design

### Constraint layers

The target-project interface remains small and ordered:

1. `PROJECT_RULES.md` supplies verified facts and approved exceptions.
2. The selected profile supplies the static baseline and inherited profile data.
3. `rules/catalog.json` supplies machine-readable module identity, status, activation
   signals, and dependencies.
4. `rules/INDEX.md` explains the routing vocabulary to human maintainers and agents.
5. The resolver returns the exact module set; the Markdown module remains the canonical
   source of normative rule text.

The catalog is metadata, not a second normative rule source. A catalog entry must point to
one Markdown module, and its status must match that module's `Status:` line.

### Catalog interface

`rules/catalog.json` uses schema version `1` and contains:

- `signals`: the allowed task-signal names;
- `modules`: stable `id`, relative `path`, `status`, `loadWhen`, and `dependsOn` values;
- `profiles`: stable `id`, relative `path`, `status`, `inherits`, and `baseline` values.

Runtime adapters, architecture modules, and toolchain modules are separate catalog entries.
They may be composed through signals without creating a cross-product profile.

The resolver interface is:

```text
resolve(profileId, signals, allowDraft) -> ordered module IDs
```

Resolution rules:

- inherited profiles are resolved before the child profile;
- `baseline` and `loadWhen: ["always"]` modules are included;
- a module is included when any supplied signal appears in `loadWhen`;
- dependencies are included transitively;
- duplicate modules are emitted once in catalog order;
- a `draft` profile/module fails unless `allowDraft` is explicit; `active` and `provisional`
  resolve normally;
- unknown signals, profiles, modules, paths, duplicate IDs, and inheritance cycles fail
  with an actionable error.

### Status model

Three statuses, ordered from most to least reviewed:

| Status | Rules complete | Examples | Domain-owner review | Loads by default |
| --- | --- | --- | --- | --- |
| `active` | yes | yes | yes | yes |
| `provisional` | yes | yes | no | yes, reported as unreviewed |
| `draft` | no | no | no | no, requires `--allow-draft` |

`provisional` exists because the two-status model conflated "not written" with "not signed
off", which left completed embedded rules unreachable behind a review gate that no install
could clear. A profile may not reference a module that is less reviewed than the profile
itself claims to be, so promoting a module is a precondition for promoting its profiles.

### Installation interface

Normal `init` and `update` accept `active` and `provisional` profiles. `--allow-draft` is
required only for `draft` profiles or modules during authoring. Both the installer and the
resolver must print an unreviewed-coverage note when the resolved set contains provisional
entries; provisional rules must not be presented as safety coverage.

When an update changes profile, the installer updates only the selected-profile value in
the existing `PROJECT_RULES.md` template section. If that section cannot be identified,
the update fails before replacing `.ai-rules`, preserving user-owned content and avoiding
conflicting instructions.

### Verification interface

The repository check must validate catalog JSON, module/profile paths, status agreement,
catalog coverage of Markdown modules, profile baseline references, and allowed signals.
The Node test suite must cover catalog resolution, draft gating, dependency inclusion, and
profile-switch consistency. CI runs both the Node tests and the PowerShell structure check.

## Execution phases

### Phase 0: specification and record

Create this file with the goals, non-goals, interfaces, acceptance criteria, and a
progress log. This phase is complete when the file exists and the baseline commit is
recorded.

### Phase 1: installation integrity (historical)

The initial implementation marked the then-covered bare-metal C11 profile active. FreeRTOS and
STM32 profiles stayed draft until their empty safety modules received domain-reviewed rules.
Draft gating and selected-profile synchronization were added during this phase.

> Superseded: the original `freertos-c11`, `stm32-freertos`, `embedded-c11`, and
> `bare-metal-c11` profiles were removed from the supported surface. Vendor and architecture
> concerns are selected orthogonally through task signals (`rtos-freertos`, `architecture-arm`,
> …) on the `rtos-c11` profile rather than through preset product-matrix profiles.

### Phase 2: deterministic routing

Add the catalog, validate it at install time and in the structure check, and add the
resolver CLI. Keep the existing Markdown index as the human-readable explanation.

### Phase 3: verification and CI

Add focused catalog and CLI tests, expose the structure check as an npm script, add CI,
and document the resolver and draft behavior.

### Phase 4: domain coverage (deferred)

For each draft safety module, add independently testable rules with stable IDs, explicit
applicability, verification, exceptions, compliant examples, violating examples, and a
domain-owner review. The repository can complete the rule and evidence preparation, but a
module must not become active before its domain-owner review gate passes.

### Phase 5: delivery correctness

The library exists to constrain embedded work, so completed rules must reach the agent that
needs them. Introduce `provisional` so review status and completeness stop being the same
axis, then remove the defects that survived Phase 4: duplicated rules across modules,
strength inflation, formatting rules that a formatter should own, verification steps no
agent can run, coverage gaps in integer and representation behavior, and routing paths that
no consumer reads.

## Acceptance criteria

- A normal install cannot select a `draft` profile.
- A normal install of the `provisional` `rtos-c11` profile succeeds and reports the coverage as
  unreviewed.
- The supported profile set contains only `rtos-c11`; bare-metal profiles are rejected.
- A profile-changing update cannot leave a stale selected profile in
  `PROJECT_RULES.md`.
- The catalog and Markdown module statuses cannot diverge without the structure check or
  CLI validation failing.
- No profile references a module less reviewed than the profile itself.
- The same profile and signal set always produce the same ordered module IDs.
- A signal that requires a `draft` module fails closed unless `--allow-draft` is present.
- `npm test`, the structure check, and CI all exercise the new behavior.
- No module is represented as active merely because it has a placeholder file.

## Progress log

| Phase | Status | Evidence |
| --- | --- | --- |
| 0. Specification and record | done | This file created against commit `effe308`. |
| 1. Installation integrity | done | `src/cli.js`, `profiles/rtos-c11.md`, `README.md`, and `test/cli.test.js` updated. `npm test` passed 6/6; `pwsh -File checks/check-structure.ps1` passed. Draft profiles require `--allow-draft`, and profile-changing updates synchronize `PROJECT_RULES.md`. |
| 2. Deterministic routing | done | Added `rules/catalog.json`, `src/rule-catalog.js`, resolver CLI output, and catalog routing documentation. `node bin/ai-coding-rules.js resolve --profile rtos-c11` returned a stable baseline; explicit signals and draft failure behavior were also verified. |
| 3. Verification and CI | done | Added catalog resolver tests, catalog-aware structure validation, `npm run check:structure`, and `.github/workflows/validate.yml`. Local `npm test` passed 11/11 and the structure check passed; hosted CI execution remains unverified in this session. |
| 4. Domain coverage | implementation complete; review pending | The embedded, RTOS, architecture, and GCC modules now contain 171 normative rules with stable IDs and required metadata. Their inline examples and representative external fixtures are checked, while domain-owner target review remains open in the [domain review register](domain-coverage-review.md). |
| Final verification | superseded by Phase 5.9 | The older 114-rule snapshot is retained as historical evidence; the current command results are recorded below. |
| 5.1 Status model unlocked | done | Added the `provisional` status to `src/rule-catalog.js`, `src/cli.js`, `checks/check-structure.ps1`, and `checks/check-examples.ps1`; moved 13 modules and 5 profiles onto it; added the embedded-memory and hardware baselines during the earlier profile split. A default `init` now delivers 6 modules instead of 4. Profile-to-module status comparison is by review rank, so a profile cannot reference a less-reviewed module. `npm test` passed 16/16; both checks passed. |
| 5.2 Deduplication | done | Merged `EMB-ISR-MASK-001` into `EMB-CONC-CRITICAL-001` (example dir renamed) and `EMB-ISR-STACK-001` into `EMB-MEM-STACK-001`; narrowed `EMB-ISR-DURATION-001` to latency-budget composition and `EMB-ISR-SHARED-001` to the interrupt-boundary delta; rewrote the three RTOS vendor modules as thin bindings to `rtos.common`, dropping 8 restated rules. 114 → 105 normative rules. |
| 5.3 Strength recalibration | done | Split formatting from correctness across `c11/style.md`, `c11/naming.md`, `c11/public-interface.md`, `c11/preprocessor.md`: formatting rules became SHOULD pointing at the formatter (`C-STYLE-SWITCHFMT-001` split out of `SWITCH-001`, `C-NAME-RESERVED-001` split out of `SNAKE-001`), while `C-STYLE-INCREMENT-001` rose to MUST as undefined behavior. Embedded/RTOS/architecture/toolchain modules stayed MUST after review; each names corruption, a hang, or data loss rather than a preference. `templates/.clang-format` comments updated. MUST is 90 of 108, not the ~40 first estimated. |
| 5.4 INIT rule fix | done | Rewrote `C-STYLE-INIT-001` to MISRA-9.1 semantics (assigned-before-read MUST; static/thread explicit initializer MUST) and added `C-STYLE-INIT-002` (initialize at declaration when known; a placeholder-only initializer is a finding). Corrected the interrupt-module examples that read uninitialized ring indices. |
| 5.5 Verification split | done | Split every rule's `Verification:` into `Verification (agent):` (readable/toolchain, must run) and `Verification (target):` (hardware/measurement, deferred and recorded). `CORE-CHG-VERIFY-001` rewritten to govern the two; `rules/README.md` documents the format and the MUST/SHOULD test; `checks/check-structure.ps1` now requires both fields. |
| 5.6 Coverage gaps | done | Added `c11.arithmetic` (promotion, shift, signed/unsigned conversion, signed overflow), `embedded.representation` (wire byte order, unaligned access, fixed-width fields vs bit-fields), and `embedded.startup` (`.data`/`.bss` readiness, progress-gated watchdog, bring-up ordering). Two new signals (`arithmetic`, `representation`, `startup`); startup is signal-selected for the RTOS profile. Three new paired example directories. 105 → 118 rules. |
| 5.7 Routing unified | done | Added a signal-derivation table to `rules/INDEX.md` mapping what a change touches to the signal and module, covering all areas including the three new ones. The catalog step in the managed AGENTS.md block is retained; the table closes the gap between knowing an area and knowing its signal name. |
| 5.8 Actionability contract | implementation complete; domain-owner review pending | Added the rule actionability design, rule-level `Correct:`/`Incorrect:` requirements for every retained `MUST`, explicit verification artifact/pass criteria, non-placeholder structure gates, a cross-platform Node contract test, and the [rule audit ledger](rule-audit-ledger.md). Current inventory is 171 rules (163 `MUST`, 8 `SHOULD`, 0 `MAY`) across 22 modules; all 171 are `contract-pass` after compound rules were split or narrowed. Local validation is recorded in the final verification section below. |
| 5.9 RTOS-only scope | done | Removed the `embedded-c11` and `bare-metal-c11` public profiles, made `rtos-c11` the direct six-module baseline and CLI default, rejected removed profile IDs, and synchronized the catalog, structure check, tests, README, architecture guide, and migration note. RTOS hardware modules remain available through explicit task signals. |
| 5.10 Bounded context views | done | Added `src/rule-context.js` and the `context` CLI command with `route`, `summary`, `rules`, and `evidence` stages. Summary output is navigation-only, selected rule reads omit evidence by default, and a 6,000-token default with an 8,000-token hard maximum fails closed instead of silently dropping rules. Updated the consuming-project template, routing index, profile guidance, README, architecture guide, and tests. |

### Current verification snapshot

The current tree has 38 Markdown files, 171 normative rules, and 17 representative paired
external example directories. `npm test`, the PowerShell structure check, the external example
check, and `git diff --check` must be rerun after any rule or ledger change. Hosted CI, target
hardware measurements, target RTOS/ABI checks, and domain-owner sign-off remain outstanding.

Local verification on 2026-08-30: `npm test` passed 30/30 tests; `npm run check:structure`
passed with 38 Markdown files and 171 rules; `npm run check:examples` passed all 17 paired
directories with GCC (including the expected lifetime violation warning); and `git diff --check`
reported no whitespace errors (only Git's LF-to-CRLF advisory for the working tree).

## Change record format

Each completed phase adds one row to the progress log and records:

- the files changed;
- the exact validation commands;
- the observed result;
- any remaining limitation or deferred dependency.

## Residual limitations

- Task signals are explicit inputs; the resolver does not infer them from natural-language
  prompts or file diffs.
- The context budget defaults to 6,000 estimated tokens and cannot exceed 8,000. It is a
  deterministic UTF-8 byte estimate, not the exact tokenizer cost of a specific model. System
  prompts, Skills, MCP tools, plugins, target source, history, and tool output remain outside
  this repository's budget and must be measured by the consuming agent.
- Rules that link to `examples/` require `examples` to stay in the installer's managed
  paths and in the package `files` list; dropping it makes the installed copy of every
  such rule fail link validation.
- All hardware, architecture, concurrency, memory, DMA, register, timeout, RTOS, and GCC
  modules are `provisional`: they carry complete rules and examples but have not passed
  domain-owner review, so they load by default and must be reported as unreviewed rather than
  as complete safety coverage.
- Because those modules appear in the RTOS baseline, the `rtos-c11` profile is also
  `provisional`. No profile in the repository is currently `active`.
- Hosted CI has been configured but was not executed against a remote provider in this
  session.
