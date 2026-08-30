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
- Verification (agent): Check: compare the stated purpose with the changed-file list and diff; artifact: purpose statement plus diff summary; pass: every changed file has a direct purpose link and no unrelated formatting, rename, dependency, or feature change is present.
- Verification (target): Check: determine whether target execution is applicable to this change-scope rule; artifact: review record linked to the purpose statement and diff summary; pass: for a scope-only change, the record marks target execution not applicable, records the agent-side diff check as complete evidence, and makes no claim about target behavior.
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

Each defensive path added by an AI-assisted change MUST cite the task contract, an existing
interface or caller contract, a test that establishes expected behavior, or a platform,
hardware, or protocol specification.

- Applies when: Generating, modifying, or reviewing AI-assisted code that adds validation, fallback, retry, recovery, or boundary handling.
- Rationale: A cited source makes the reason for a new defensive path reviewable and keeps unsupported behavior from entering the change by implication.
- Verification (agent): Check: inventory every new guard, fallback, retry, and recovery path and resolve its cited source; artifact: defensive-change evidence table with source locations; pass: every added path cites a task contract, caller contract, test, or authoritative specification.
- Verification (target): Check: inspect the cited source and run its named behavioral test or conformance procedure; artifact: source citation, test log, or conformance report; pass: every added defensive path has a retrievable source and recorded result.
- Exceptions: Safety, security, hardware, protocol, and public-interface requirements MAY override local evidence only when the authoritative requirement explicitly requires the behavior; that requirement and the resulting behavior MUST be recorded.

Correct:

```text
Evidence: The packet contract defines lengths above PACKET_MAX_PAYLOAD as invalid.
Behavior: Return STATUS_INVALID_LENGTH before copying any payload bytes.
```

Incorrect:

```text
Evidence: no source citation was recorded for the newly added configuration guard.
```

### CORE-CHG-DEFENSIVE-BEHAVIOR-001 [MUST]

The observable result of each defensive path added by an AI-assisted change MUST match the
behavior required by its cited source; an uncited fallback, retry, recovery, or default MUST
NOT be introduced.

- Applies when: A cited guard, fallback, retry, recovery, or boundary path changes a return status, state transition, timing, output, or externally visible side effect.
- Rationale: Evidence that a failure mode exists does not by itself authorize a new result or recovery policy. Keeping the observed behavior tied to the cited source prevents speculative handling from silently changing callers' contracts.
- Verification (agent): Check: compare each added defensive branch with its cited source and record its return, state, timing, output, and side effects; artifact: defensive-behavior matrix and diff locations; pass: every observable result is authorized by the cited source and no unsupported behavior remains.
- Verification (target): Check: execute the cited boundary, failure, and recovery cases under the production configuration; artifact: behavior trace, test log, or conformance report; pass: each observed result matches the cited source and no unapproved fallback, retry, recovery, or default path is taken.
- Exceptions: An authoritative safety, security, hardware, protocol, or public-interface requirement MAY define a different observable result only when the requirement, owner, and review condition are recorded.

Correct:

```text
Evidence: The packet contract defines lengths above PACKET_MAX_PAYLOAD as invalid.
Behavior: Return STATUS_INVALID_LENGTH before copying any payload bytes.
```

Incorrect:

```text
Evidence: The caller contract requires STATUS_INVALID_LENGTH.
Behavior: Return STATUS_OK after silently truncating the payload and retrying the copy.
```

### CORE-CHG-COMPAT-001 [MUST]

Changes MUST assess compatibility with callers, persisted data, communication protocols,
configuration formats, ABI/API contracts, and externally observable runtime behavior. A
breaking change MUST be declared explicitly and include a migration, versioning, or
approved deprecation strategy.

- Applies when: Changing an interface, data layout, protocol, configuration, status meaning, or externally visible behavior.
- Rationale: Embedded consumers often depend on contracts that are not represented by a conventional API boundary.
- Verification (agent): Check: complete a compatibility matrix for callers, persisted data, protocols, configuration, ABI/API, and observable behavior; artifact: matrix plus version/migration decision; pass: every applicable surface is marked compatible or has an explicit break and migration, versioning, or approved deprecation path.
- Verification (target): Check: run the previous-version compatibility and migration suite; artifact: interoperability, data-migration, or ABI test log; pass: supported old inputs and peers produce the expected result, or the declared break is rejected with the documented migration status.
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
- Verification (agent): Check: search definitions, references, generated outputs, tests, and documentation for each changed declaration; artifact: dependent inventory with search scope and unsearchable consumers; pass: every discovered dependent is updated or re-verified, and every unsearchable consumer is explicitly marked unverified.
- Verification (target): Check: run the checks named for each affected consumer; artifact: consumer build/test logs; pass: all reachable consumers pass and every unreachable consumer remains listed as outstanding.
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

Every change MUST select verification from the project's risk tier so that the required check set is not omitted.

- Applies when: Validating any code, configuration, rule, interface, or documentation change.
- Rationale: A check list chosen without regard to change risk can leave high-impact behavior untested or waste effort without increasing confidence.
- Verification (agent): Classify the change using the repository's risk matrix and compare the selected checks with the tier's required set. Pass when every required check for the recorded tier is selected or an approved exception names the missing check; artifact: risk classification and verification matrix.
- Verification (target): Using the risk tiers, mandatory check sets, and approval policy recorded in `PROJECT_RULES.md` under `change-verification`, inspect one representative record for each applicable tier present in the release record; record `N/A` with a reason for any tier with no change. Pass when every present tier record selects all mandatory checks for its tier and any omission has an approved exception; artifact: `PROJECT_RULES.md` snapshot, verification matrix, and review records.
- Exceptions: A check MAY be omitted only through the project's recorded exception process with owner, reason, and compensating verification.

Correct:

```text
Risk tier: target-facing concurrency change
Required checks: static analysis, host regression, target stress trace
Selected: static analysis, host regression, target stress trace
```

Incorrect:

```text
Risk tier: target-facing concurrency change
Selected: formatting only
```

### CORE-CHG-VERIFY-RECORD-001 [MUST]

Each verification check that is run MUST record its command or procedure, result, and scope.

- Applies when: Recording agent-side or target-side verification for a change.
- Rationale: A bare statement that tests passed cannot be reproduced or evaluated for what behavior the check actually exercised.
- Verification (agent): Inspect the change record and match each reported check to its command/procedure, result, and covered scope. Pass when every reported check has all three fields and the result is unambiguous; artifact: command/result ledger and coverage map.
- Verification (target): Using the record schema and release evidence location recorded in `PROJECT_RULES.md` under `verification-record`, audit at least 100% of checks attached to the release candidate. Pass when every attached check has a reproducible procedure, observed result, and stated scope; artifact: `PROJECT_RULES.md` snapshot, evidence index, and check outputs.
- Exceptions: A proprietary tool MAY use a named report identifier instead of a command only when the procedure and scope are retrievable by that identifier.

Correct:

```text
Ran: pwsh -File checks/check-structure.ps1
Result: passed; no structural violations reported
Scope: rule metadata, links, and catalog references
```

Incorrect:

```text
Verification passed.
```

### CORE-CHG-VERIFY-OUTSTANDING-001 [MUST]

Every unrun target-dependent check MUST be recorded as outstanding with an owner and a completion condition.

- Applies when: Hardware, target configuration, timing, measurement, or other target-dependent verification cannot run in the current environment.
- Rationale: An unavailable board or configuration is a scheduling and ownership fact, not evidence that the behavior passed.
- Verification (agent): Scan the record for every target-dependent step named by engaged rules. Pass when each unrun step has status `outstanding`, one owner, and a condition that states what result closes it; artifact: outstanding-check register.
- Verification (target): Using the owner directory, completion conditions, and evidence location recorded in `PROJECT_RULES.md` under `verification-outstanding`, inspect all outstanding entries at release review. Pass when 100% of entries identify an owner and a measurable close condition, and closed entries link the observed artifact; artifact: `PROJECT_RULES.md` snapshot, outstanding register, and closure evidence.
- Exceptions: None; an unavailable environment MUST remain an outstanding entry.

Correct:

```text
Not run: target interrupt-latency measurement
Status: outstanding
Owner: firmware validation
Close condition: 1,000 samples at production clock, max <= 20 us, with trace attached
```

Incorrect:

```text
Not run: no board available
```

### CORE-CHG-VERIFY-CLAIM-001 [MUST]

A verification result MUST NOT claim coverage of behavior that its command or procedure cannot reach.

- Applies when: Summarizing test, build, static-analysis, simulation, or target-measurement results.
- Rationale: A successful compile or host test does not prove hardware timing, target memory ordering, or configuration-specific behavior it never executes.
- Verification (agent): Map every claim in the change record to the inputs, configuration, and execution path reached by its evidence. Pass when no claim exceeds the recorded scope and uncovered behavior is marked outstanding; artifact: claim-to-evidence matrix.
- Verification (target): Using the evidence scope and behavior matrix recorded in `PROJECT_RULES.md` under `verification-claims`, review 100% of release claims against their logs and target configuration. Pass when each claim's observed behavior is reachable from its cited procedure and no unreachable behavior is reported as verified; artifact: `PROJECT_RULES.md` snapshot, claim matrix, and evidence logs.
- Exceptions: A static proof MAY cover runtime behavior only when its assumptions, target model, and proof boundary are recorded and reviewed.

Correct:

```text
Host unit test: packet parser accepts/rejects lengths on x86_64.
Claim: parser boundary behavior is covered on the host build.
Outstanding: target DMA ordering remains unverified.
```

Incorrect:

```text
Host unit test passed, so DMA ordering and interrupt latency are verified.
```

### CORE-CHG-EXCEPTION-001 [MUST]

Any deviation from a normative rule MUST record the affected rule ID, scope, reason,
approver or decision record, and compensating verification. Temporary exceptions MUST
also state their owner, review date, or removal condition.

- Applies when: Intentionally deviating from a `MUST` or a project-selected `SHOULD` rule.
- Rationale: Traceable exceptions preserve the rule baseline without hiding project-specific constraints.
- Verification (agent): Check: validate the exception record fields against the affected rule; artifact: exception record or decision entry; pass: rule ID, scope, reason, approver, compensating check, and for temporary exceptions owner plus review/removal condition are all present.
- Verification (target): Check: run the compensating verification named by the exception; artifact: compensating test log or measurement; pass: the stated compensating condition is observed for the exception scope.
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
- Verification (agent): Check: inspect the change record for rollback, forward migration, safe degradation, or an irreversible-boundary procedure; artifact: recovery plan with trigger and owner; pass: every applicable high-risk change names one executable recovery path, or documents why recovery is impossible and how the fault is contained.
- Verification (target): Check: inject the stated interruption or fault at the recovery boundary; artifact: recovery test log, persistent-state dump, or protocol trace; pass: rollback, migration, or degradation reaches the exact documented state without corrupting prior state.
- Exceptions: None; low-risk changes outside the stated applicability do not require a recovery plan.

Correct:

```text
Upgrade writes a version marker last; interrupted upgrades restart from the previous format.
```

Incorrect:

```text
Changed persistent layout with no rollback, migration, or recovery procedure.
```
