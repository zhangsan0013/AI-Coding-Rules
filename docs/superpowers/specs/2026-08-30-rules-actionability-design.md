# Rule Actionability and Evidence Design

Status: contract and semantic split implemented; domain-owner review pending

## Goal

Make every normative rule in `rules/` a useful, auditable engineering constraint rather than
an unbounded recommendation. The repository now contains 171 rules across 22 modules. At the
start of this design, many rules relied on shared examples, subjective review language, or
verification statements without a fixed output or pass threshold.

This design establishes the acceptance contract for every rule, adds evidence and review
boundaries, and introduces automated gates for the objective parts. It does not make the
canonical rule library depend on one hardware target, RTOS port, compiler version, or linker.

Design baseline: commit `a0d6eba`.

## Approaches considered

1. **Documentation-only cleanup.** Add examples and clarify prose without adding a review
   record or stronger checks. This is cheap, but reviewers can still mark vague statements as
   verified without reproducible evidence.
2. **Rule contract, review ledger, and CI gates (selected).** Keep Markdown as the canonical
   rule source, require one testable requirement per rule, standardize rule-level evidence,
   record target-specific results outside the canonical rules, and automate structural checks.
   This gives the project a defensible release boundary without coupling rules to one target.
3. **Full executable corpus.** Give every rule an external fixture and target test. This gives
   the strongest evidence, but creates unnecessary hardware and toolchain coupling and makes
   example count a proxy for quality.

## Design

### Rule contract

Each normative rule must describe one independently testable requirement with:

- one concrete object and applicability condition;
- one observable violation shape;
- one strength (`MUST`, `SHOULD`, or `MAY`);
- `Applies when`, `Rationale`, `Verification (agent)`, `Verification (target)`, and
  `Exceptions` fields;
- a rule-level `Correct:` and `Incorrect:` example for every `MUST` rule;
- a rule-level example for a `SHOULD` or `MAY` rule when its boundary is not self-evident.

Compound rules are split. A rule must not hide independent formatting, semantic, lifecycle,
ownership, or verification requirements in one paragraph or list. Split, merge, demote, or
delete operations never reuse an old rule ID; migration relationships are recorded explicitly.

`MUST` rules cannot be accepted on rationale alone. A pure static rule may use agent-side
evidence if the rule explicitly states why target verification is not applicable. A rule that
depends on hardware, RTOS behavior, ABI, compiler output, timing, or memory layout requires
target evidence before it can be promoted to `active`.

### Strength policy

- `MUST` describes a correctness, safety, compatibility, resource, or failure-handling
  condition. It requires a deterministic check and a pass criterion.
- `SHOULD` and `MAY` remain normative only when a reviewer can apply a stable pass/fail rule.
  Otherwise they move to a non-normative `Guidance` section or are removed.
- `MAY` must grant a bounded option under explicit preconditions. It cannot be an unbounded
  list of preferred techniques or a way to bypass a `MUST` exception.

### Verification and evidence boundary

Canonical rules define the expected check and required evidence, but never store a consuming
project's observed result. A consuming project records target-specific evidence in
`PROJECT_RULES.md` or a separate review ledger. The repository's module-promotion record stays
in `docs/domain-coverage-review.md` or a future machine-readable ledger.

Every verification record must be able to provide:

```text
Evidence       what was checked
Owner          responsible reviewer
Configuration  hardware, RTOS, compiler, linker, and relevant flags
Expected       exact pass criterion or observable state
Observed       actual result
Artifact       command output, map, log, measurement, disassembly, or code location
Outstanding    deferred work and its completion condition
```

Target verification must use a quantitative threshold where one is meaningful. Otherwise it
must name an exact observable state transition, ownership state, ordering property, or error
result. Phrases such as `review and confirm` or `test and verify` are insufficient by
themselves.

### Examples

Every `MUST` receives a minimal inline pair tied to that rule. External `examples/<RULE-ID>/`
fixtures are tiered evidence: they are mandatory for rules that need compiler or executable
proof and for representative high-risk scenarios in every module, but are not required for all
171 rules. External examples are labeled as rule-level or representative module coverage and
never substitute for target evidence.

### Audit statuses and ordering

The audit ledger assigns each rule one of:

- `contract-pass` — contract, examples, verification, and repository evidence requirements are complete;
- `needs-rewrite` — historical status used during the split; no current rule remains in this
  state;
- `demote` — useful guidance exists but cannot be a stable normative constraint;
- `delete` — no distinct, defensible engineering benefit remains.

Review proceeds by risk:

1. P0: core correctness/change policy and all embedded, RTOS, architecture, ABI, and toolchain
   `MUST` rules.
2. P1: C11 `MUST` rules that affect undefined behavior, interface contracts, or resources.
3. P2: style and maintenance `SHOULD`/`MAY` rules.

Modules remain `provisional` until their domain-owner review and target evidence are complete.

### Automated gates

The structure check and CI enforce objective portions of the contract:

- unique rule IDs, catalog/path/status agreement, and local links;
- required metadata and non-placeholder verification fields;
- one rule section per ID with rule-level examples for `MUST` rules;
- paired external examples where the module/rule declares them;
- no unqualified placeholder evidence such as an empty verification or an unowned exception.

Semantic correctness, hardware assumptions, and target measurements remain human/domain-owner
responsibilities and are recorded in the review ledger. CI must not claim that a Markdown or C
syntax check proves target safety.

### Scope boundaries

In scope:

- all 22 canonical rule modules and the current 171 normative rule sections;
- `rules/catalog.json`, `rules/INDEX.md`, rule authoring guidance, examples, checks, tests, and
  domain-review documentation;
- migration notes for split, merged, demoted, or deleted rule IDs.

Out of scope:

- inventing target-specific rules without a domain owner and concrete verification method;
- replacing `PROJECT_RULES.md` with a repository-specific hardware database;
- requiring a separate external fixture for every rule when inline evidence is sufficient;
- changing the orthogonal profile/signal model or adding vendor matrix profiles.

## Testing and verification

The implementation must preserve and extend these commands:

```text
npm test
npm run check:structure
npm run check:examples
```

Tests must cover rule-section parsing, missing or placeholder evidence, missing rule-level
examples, the audit-ledger status boundary, and existing CLI/catalog behavior. The final audit
report must also state which target-specific checks were not run. Hosted CI remains a separate
verification of the same commands and does not replace domain-owner review.

## Completion criteria

- Every retained normative rule satisfies the structural rule contract and has an independently
  testable boundary recorded in the ledger.
- Every `MUST` rule has a rule-level `Correct` and `Incorrect` example and a deterministic
  agent-side check plus target evidence or a documented static-only rationale.
- Subjective style rules are rewritten with thresholds or moved to guidance.
- Review records contain owner, configuration, expected, observed, artifact, and outstanding
  fields where applicable.
- Automated checks fail on structural omissions without pretending to prove semantic safety.
- Catalog, profiles, examples, documentation, tests, and CI agree on the resulting rule set.
- All local validation commands pass, and no module or profile is promoted to `active` without
  the required domain-owner review.
