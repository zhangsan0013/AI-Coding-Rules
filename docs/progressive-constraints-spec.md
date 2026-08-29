# Progressive Constraints Specification

Status: complete for Phases 0-3; Phase 4 implementation complete, domain review pending

Baseline commit: `effe308`

## Problem

This repository has a sound progressive-disclosure model, but the current model is
mostly a Markdown convention. An agent must interpret profiles and routing prose, draft
modules can be selected without a coverage signal, and installation can leave the
selected profile inconsistent with `PROJECT_RULES.md`.

The project is currently an embedded C11 rule library, not a domain-neutral constraint
platform. Runtime, architecture, and toolchain concerns are represented as orthogonal
selectors, while unreviewed hardware and RTOS requirements remain explicitly out of scope.

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
- an inactive or draft profile/module fails unless `allowDraft` is explicit;
- unknown signals, profiles, modules, paths, duplicate IDs, and inheritance cycles fail
  with an actionable error.

### Installation interface

Normal `init` and `update` accept active profiles only. `--allow-draft` is required for
draft profiles or draft modules during authoring and experimentation. Draft resolution
must remain visibly marked as draft; it must not be presented as safety coverage.

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

### Phase 1: installation integrity

Mark only the currently covered bare-metal C11 profile active. Keep FreeRTOS and STM32
profiles draft until their empty safety modules receive domain-reviewed rules. Add draft
gating and synchronize the selected profile during profile-changing updates.

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

## Acceptance criteria

- A normal install cannot select a draft profile.
- A profile-changing update cannot leave a stale selected profile in
  `PROJECT_RULES.md`.
- The catalog and Markdown module statuses cannot diverge without the structure check or
  CLI validation failing.
- The same profile and signal set always produce the same ordered module IDs.
- A signal that requires a draft module fails closed unless `--allow-draft` is present.
- `npm test`, the structure check, and CI all exercise the new behavior.
- No Phase 4 module is represented as active merely because it has a placeholder file.

## Progress log

| Phase | Status | Evidence |
| --- | --- | --- |
| 0. Specification and record | done | This file created against commit `effe308`. |
| 1. Installation integrity | done | `src/cli.js`, `profiles/bare-metal-c11.md`, `README.md`, and `test/cli.test.js` updated. `npm test` passed 6/6; `pwsh -File checks/check-structure.ps1` passed. Draft profiles require `--allow-draft`, and profile-changing updates synchronize `PROJECT_RULES.md`. |
| 2. Deterministic routing | done | Added `rules/catalog.json`, `src/rule-catalog.js`, resolver CLI output, and catalog routing documentation. `node bin/ai-coding-rules.js resolve --profile bare-metal-c11` returned a stable four-module baseline; explicit signals and draft failure behavior were also verified. |
| 3. Verification and CI | done | Added catalog resolver tests, catalog-aware structure validation, `npm run check:structure`, and `.github/workflows/validate.yml`. Local `npm test` passed 11/11 and the structure check passed; hosted CI execution remains unverified in this session. |
| 4. Domain coverage | implementation complete; review pending | All 13 draft modules now contain normative rules with stable IDs and required metadata: the interrupt module has 14 existing rules, and the other 12 modules add 61 rules across memory, MMIO, concurrency, DMA/cache, timeout/error handling, RTOS common and adapters, Arm, RISC-V, and GCC. Every draft module has inline compliant/violating examples and at least one linked paired external example; 14 external example directories are checked. The [domain review register](domain-coverage-review.md) records the remaining owner gates. All draft modules remain draft because domain-owner review is still required, so draft profile and signal resolution still fails closed without `--allow-draft`. |
| Final verification | done locally; hosted review pending | `npm test` passed 14/14; `npm run check:structure` passed with 36 Markdown files and 114 normative rules; `npm run check:examples` passed all 14 paired directories and GCC C11 syntax checks; `git diff --check` passed. Hosted CI execution and domain-owner review remain unverified in this session. |

## Change record format

Each completed phase adds one row to the progress log and records:

- the files changed;
- the exact validation commands;
- the observed result;
- any remaining limitation or deferred dependency.

## Residual limitations

- Task signals are explicit inputs; the resolver does not infer them from natural-language
  prompts or file diffs.
- Rules that link to `examples/` require `examples` to stay in the installer's managed
  paths and in the package `files` list; dropping it makes the installed copy of every
  such rule fail link validation.
- All hardware, architecture, concurrency, memory, DMA, register, timeout, RTOS, and GCC
  modules carry drafted rules but have not passed domain-owner review; none may be treated as
  complete safety coverage yet.
- The draft profiles remain gated because their baseline modules are draft, even though the
  repository-controlled rule and example preparation is complete.
- Hosted CI has been configured but was not executed against a remote provider in this
  session.
