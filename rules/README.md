# Rule Authoring Guide

Files under this directory are the canonical source of normative constraints.

`catalog.json` is the machine-readable metadata source for module identity, status,
activation signals, dependencies, and profile inheritance. It must point to the Markdown
module that owns the normative text; it must not repeat that text.

## Rule format

Use one independently testable requirement per rule:

````markdown
### <AREA>-<TOPIC>-001 [MUST]

Requirement stated as one direct sentence.

- Applies when: precise activation conditions
- Rationale: why the requirement exists
- Verification (agent): what a reviewer or agent can settle by reading the change and running the toolchain
- Verification (target): what needs hardware, a measurement, or a specific build
- Exceptions: none, or the approval and documentation required

Correct:

```c
/* Minimal compliant example. */
```

Incorrect:

```c
/* Minimal violating example. */
```
````

Use `MUST`, `SHOULD`, or `MAY` consistently. Stable IDs must not be reused after a rule is
removed. Put larger examples under `examples/<RULE-ID>/` and link to them from the rule.

### Writing the two verification fields

The split exists because a single `Verification:` field mixed steps an agent can perform with
steps only a target can answer, which let an unrunnable step read as a reason to skip
verification entirely. `CORE-CHG-VERIFY-001` governs how each half is reported.

`Verification (agent):` must be an action, not a topic. Prefer naming the shape of the defect
so the check has a decidable outcome — "a read-modify-write on a status register is a finding"
rather than "review register accesses". Where the formatter or a compiler flag settles the rule
completely, say so and name the flag. Even when the target side is source-only, write an explicit
explanation and pass criterion; bare `None` or `review` is rejected by the structure check.

`Verification (target):` is where measurement, hardware behavior, and configuration-specific
builds belong. It is not optional — it is deferred, and the change record has to say so.

For each verification record, capture the boundary explicitly:

```text
Evidence: what was checked
Owner: responsible reviewer or team
Configuration: target, RTOS, compiler, linker, and relevant flags
Expected: exact pass criterion or observable state
Observed: actual result
Artifact: command output, map, log, measurement, disassembly, or code location
Outstanding: deferred work and its completion condition
```

### Choosing MUST or SHOULD

`MUST` is for a requirement whose violation makes the code wrong: undefined behavior, a
race, a lost interrupt, a wrong wire format, a resource leak. `SHOULD` is for a requirement
whose violation makes the code worse but not incorrect, including every convention a
formatter can settle.

A rule that mixes both belongs in two rules. `C-STYLE-SWITCH-001` and
`C-STYLE-SWITCHFMT-001` are the worked example: unhandled-value behavior is a correctness
property, label indentation is not, and keeping them together forced one strength onto both.

Every cataloged module must contain at least one normative rule.

Module status is one of three values:

- `draft`: the rules are not written yet. Not loadable without `--allow-draft`.
- `provisional`: the structural/actionability contract is present and every `MUST` carries a
  rule-level `Correct:`/`Incorrect:` pair, but target/domain-owner review may still be open in
  the audit ledger. External examples are tiered evidence: representative high-risk rules
  and rules that need compiler/executable proof have paired directories, while inline examples
  cover the remaining rules. Loadable; must be reported as unreviewed rather than as safety
  coverage.
- `active`: reviewed by the responsible domain owner.

Examples demonstrate a rule but do not substitute for that review, which is what separates
`provisional` from `active`.

## Suggested namespaces

- `CORE-CORR`: correctness
- `CORE-CHG`: change policy
- `C-STYLE`, `C-NAME`, `C-API`, `C-PP`: C11 rules
- `EMB-MEM`, `EMB-MMIO`, `EMB-ISR`, `EMB-CONC`, `EMB-ERR`, `EMB-DMA`: embedded rules
- `ARCH-ARM`, `ARCH-RISCV`: architecture rules
- `RTOS-COMMON`, `RTOS-FREERTOS`, `RTOS-RTTHREAD`, `RTOS-THREADX`: RTOS rules
- `TOOL-GCC`: GCC toolchain rules
