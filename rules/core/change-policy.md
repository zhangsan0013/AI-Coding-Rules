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
- Verification: Review the stated purpose and explain why every changed file is necessary.
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
- Verification: For each new defensive behavior, the change MUST identify its triggering condition, the evidence requiring it, the intended observable behavior, and the verification coverage.
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
- Verification: Review direct consumers, persisted formats, protocol definitions, and compatibility or migration tests.
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
- Verification: Search for callers and consumers, review the dependency impact list, and run affected checks.
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

Every change MUST run verification proportionate to its risk and impact, and MUST record
the commands, results, and checks that were not run. Static review, a local compile, or a
partial test MUST NOT be reported as evidence for behavior it does not cover.

- Applies when: Validating any code, configuration, rule, interface, or documentation change.
- Rationale: Honest, risk-matched evidence prevents false confidence and makes residual risk explicit.
- Verification: Review the validation record against the changed behavior and the verification named by each applicable rule.
- Exceptions: If the required environment is unavailable, record the blocker, the unrun check, and the next verification owner.

Correct:

```text
Ran parser regression tests and static analysis; target-hardware timing test not run because the board was unavailable.
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
- Verification: Review the exception record for all required fields and run the stated compensating checks.
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
- Verification: Review the recovery design and test rollback, migration, degradation, or documented irreversibility handling.
- Exceptions: None; low-risk changes outside the stated applicability do not require a recovery plan.

Correct:

```text
Upgrade writes a version marker last; interrupted upgrades restart from the previous format.
```

Incorrect:

```text
Changed persistent layout with no rollback, migration, or recovery procedure.
```
