# Change Policy Rules

Status: active

## Scope

Universal requirements for change scope, compatibility, caller impact, and validation.

## Load when

Always.

## Rules

### CORE-CHG-SCOPE-001 [MUST]

Each change MUST have one clear purpose and remain the smallest complete set of files and
behavior needed to achieve that purpose. Unrelated refactoring, formatting, dependency
upgrades, or feature work MUST be split into separate changes.

- Applies when: Planning, implementing, reviewing, or merging any repository change.
- Rationale: A focused diff makes behavior, risk, and verification auditable.
- Verification (agent): Confirm every changed file serves the one stated purpose. Formatting, renames, or dependency updates mixed into a behavior change are findings.
- Verification (target): None; this is a change-structure property.
- Exceptions: Generated-file updates and required mechanical migrations MAY accompany the source change when their relationship is recorded.

Correct:

```text
Change purpose: reject invalid packet lengths.
Changed files: parser, its regression test, and the parser contract.
```

Incorrect:

```text
Fix packet lengths, rename unrelated modules, and reformat the entire repository.
```

### CORE-CHG-DEFENSIVE-001 [MUST]

AI-assisted changes MUST add defensive handling only when supported by the task
contract, an existing interface or caller contract, a test that establishes expected
behavior, or a platform, hardware, or protocol specification. Hypothetical failure modes
MUST NOT introduce guards, fallbacks, retries, recovery paths, or other behavior without
supporting evidence.

- Applies when: Generating, modifying, or reviewing AI-assisted code that adds validation, fallback, retry, recovery, or boundary handling.
- Rationale: Speculative defenses increase code size and state space, can change observable behavior, hide contract gaps, and make verification less reliable without protecting a demonstrated failure mode.
- Verification (agent): For each new guard, fallback, retry, or recovery path, name the contract, test, or specification that requires it. One with no cited evidence is a finding.
- Verification (target): Confirm the cited evidence covers the behavior added.
- Exceptions: Safety, security, hardware, protocol, and public-interface requirements MAY override local evidence only when the authoritative requirement explicitly requires the behavior; that requirement and the resulting behavior MUST be recorded.

Correct:

```text
Evidence: The packet contract defines lengths above PACKET_MAX_PAYLOAD as invalid.
Behavior: Return STATUS_INVALID_LENGTH before copying any payload bytes.
```

Incorrect:

```text
Evidence: No contract, caller, test, or platform rule permits a missing configuration.
Behavior: Add a null guard that silently selects defaults, then retry any failure three times.
```

### CORE-CHG-COMPAT-001 [MUST]

Changes MUST assess compatibility with callers, persisted data, communication protocols,
configuration formats, ABI/API contracts, and externally observable runtime behavior. A
breaking change MUST be declared explicitly and include a migration, versioning, or
approved deprecation strategy.

- Applies when: Changing an interface, data layout, protocol, configuration, status meaning, or externally visible behavior.
- Rationale: Embedded consumers often depend on contracts that are not represented by a conventional API boundary.
- Verification (agent): Confirm the change identifies its effect on callers, persisted data, protocols, configuration, and ABI, and that a break is declared with a migration path.
- Verification (target): Run compatibility or migration tests against the previous version.
- Exceptions: A project MAY intentionally break compatibility when the affected contract, impact, and approval are recorded.

Correct:

```text
The packet field changes from v1 to v2; the decoder accepts both during migration.
```

Incorrect:

```text
Changed the serialized field order; existing stored data and peers were not checked.
```

### CORE-CHG-IMPACT-001 [MUST]

When changing an interface, shared state, data structure, or status semantic, the change
MUST identify direct and indirect dependents and update or re-verify affected
implementations, tests, documentation, and configuration. Unknown dependents MUST be
marked unverified rather than assumed absent.

- Applies when: Modifying shared declarations, messages, configuration keys, state machines, or cross-module behavior.
- Rationale: Definitions and consumers frequently live in different modules, repositories, or generated artifacts.
- Verification (agent): Search for direct and indirect dependents of each changed declaration, and mark unsearchable consumers unverified rather than absent.
- Verification (target): Run the affected consumers' checks.
- Exceptions: None for a known consumer; an unsearchable external consumer requires a documented compatibility boundary.

Correct:

```text
Updated the status enum, all switch consumers, integration tests, and the interface note.
```

Incorrect:

```text
Updated the shared header and assumed all consumers still compile correctly.
```

### CORE-CHG-VERIFY-001 [MUST]

Every change MUST run verification proportionate to its risk, and MUST record the commands,
their results, and the checks that were not run. A check that was not run MUST NOT be
reported as evidence, and a check that was run MUST NOT be reported as covering behavior it
does not reach.

Rules in this library state verification in two parts. A `Verification (agent):` step is one
that can be completed by reading the change and running the toolchain, and MUST be performed.
A `Verification (target):` step needs hardware, a specific configuration, or a measurement;
where it cannot be run, the change MUST record it as outstanding and name who owns it.

- Applies when: Validating any code, configuration, rule, interface, or documentation change.
- Rationale: The failure this prevents is not an unrun test — it is an unrun test reported as passed. Separating the two kinds of verification makes the boundary explicit, so an agent-side check cannot be presented as evidence about timing, hardware behavior, or a configuration it never built.
- Verification (agent): Compare the validation record against the `Verification (agent):` step of every rule the change engages, and confirm each outstanding target-side step is listed rather than omitted.
- Verification (target): The recorded target-side steps themselves, run by their named owner.
- Exceptions: None. An unavailable environment is recorded as a blocker with the unrun check and its next owner, which satisfies this rule rather than excusing it.

Correct:

```text
Ran: npm test (16/16), clang-format --dry-run --Werror, -Wall -Wextra build.
Not run: interrupt latency measurement (EMB-ISR-DURATION-001 target step) — no board
available; owner: firmware team, before the release branch.
```

Incorrect:

```text
The file compiled, so the interrupt timing behavior is verified.
```

### CORE-CHG-EXCEPTION-001 [MUST]

Any deviation from a normative rule MUST record the affected rule ID, scope, reason,
approver or decision record, and compensating verification. Temporary exceptions MUST
also state their owner, review date, or removal condition.

- Applies when: Intentionally deviating from a `MUST` or a project-selected `SHOULD` rule.
- Rationale: Traceable exceptions preserve the rule baseline without hiding project-specific constraints.
- Verification (agent): Confirm each deviation records the rule ID, scope, reason, approver, and compensating verification, and that a temporary one names an owner and removal condition.
- Verification (target): Run the stated compensating checks.
- Exceptions: None; emergency deviations MAY be recorded immediately after containment when the owner and deadline are captured.

Correct:

```text
Rule: CORE-CHG-COMPAT-001
Scope: legacy decoder, release 4 only
Reason: mandated protocol cutover
Approval: decision DEC-014
Verification: dual-version interoperability test
```

Incorrect:

```text
Exception: legacy code needs this.
```

### CORE-CHG-RECOVERY-001 [MUST]

High-risk changes that alter persisted state, communication protocols, startup behavior,
critical runtime state, or externally visible behavior MUST define a rollback, forward
migration, or safe-degradation path. When recovery is technically impossible, the change
record MUST state the irreversible boundary and the fault-handling procedure.

- Applies when: Planning or deploying changes with durable state, upgrade, recovery, or safety impact.
- Rationale: A compatibility assessment is incomplete if the project cannot recover after an unexpected failure.
- Verification (agent): Confirm a change to persisted state, a protocol, startup, or externally visible behavior defines a rollback, migration, or degradation path, or records the irreversible boundary.
- Verification (target): Test the rollback, migration, or degradation path.
- Exceptions: None; low-risk changes outside the stated applicability do not require a recovery plan.

Correct:

```text
Upgrade writes a version marker last; interrupted upgrades restart from the previous format.
```

Incorrect:

```text
Changed persistent layout with no rollback, migration, or recovery procedure.
```
