# Domain Coverage Completion Design

## Goal

Complete the repository-controlled portion of Phase 4 by replacing every empty draft
module with a reviewable normative-rule draft. The work covers the 13 draft modules listed
in `rules/catalog.json`, including the already populated interrupt module. No module is
promoted to `active`; domain-owner approval remains an explicit release gate.

## Approaches considered

1. **Complete all draft modules in one pass (selected).** Add conservative, project-fact-
   driven rules to every draft module, with paired examples and verification metadata. This
   closes the catalog's empty-module gap and gives reviewers a coherent baseline, at the
   cost of a larger review surface.
2. **Complete only embedded fundamentals.** Finish memory, concurrency, DMA, MMIO, and
   timeout rules first. This lowers review risk but leaves the RTOS, architecture, and GCC
   selectors empty and does not satisfy the repository's full Phase 4 objective.
3. **Documentation-only backlog.** Record the missing coverage without adding rules. This
   is safest for unreviewed domains but leaves the primary implementation gap unchanged.

## Design

Each module keeps its current path and `Status: draft`. Rules use the existing stable-ID
namespaces and contain exactly one independently testable requirement, followed by
`Applies when`, `Rationale`, `Verification`, and `Exceptions`. Rules remain generic where
platform facts differ; exact widths, API variants, memory attributes, priorities, and
configuration values stay in `PROJECT_RULES.md`.

The module groups are:

- embedded memory, register access, concurrency, DMA/cache, and timeout/error handling;
- runtime-independent RTOS rules plus FreeRTOS, RT-Thread, and ThreadX adapter seams;
- Arm and RISC-V architecture seams; and
- GCC diagnostics, attributes, optimization, and link-time behavior.

Every completed module receives at least one compliant and one violating example. Larger
examples are stored under `examples/<RULE-ID>/` and linked from the owning rule. A new
example check validates directory pairing, local links, and C syntax when the configured
compiler is available; the result is reported rather than presented as target-hardware
evidence.

The structure check is extended to reject empty draft modules after this migration and to
validate example pairing. Node tests cover catalog resolution and the new example metadata;
the PowerShell check remains the authoritative repository-structure check. Progress
records are updated with exact local commands and the remaining domain-review gate.

## Completion criteria

- No cataloged rule module contains the placeholder “No normative rules”.
- Every new rule has a unique ID, strength, applicability, rationale, verification method,
  exception policy, and paired example.
- Catalog paths/statuses, Markdown links, examples, tests, and structure checks agree.
- `npm test`, `npm run check:structure`, the example syntax check, and `git diff --check`
  pass locally.
- All unreviewed domain modules remain visibly draft and the progress log names domain-owner
  review as the only remaining release gate.
