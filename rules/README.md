# Rule Authoring Guide

Files under this directory are the canonical source of normative constraints.

## Rule format

Use one independently testable requirement per rule:

````markdown
### <AREA>-<TOPIC>-001 [MUST]

Requirement stated as one direct sentence.

- Applies when: precise activation conditions
- Rationale: why the requirement exists
- Verification: formatter, compiler, static analysis, test, or review
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

## Suggested namespaces

- `CORE-CORR`: correctness
- `CORE-CHG`: change policy
- `C-STYLE`, `C-NAME`, `C-API`, `C-PP`: C11 rules
- `EMB-MEM`, `EMB-MMIO`, `EMB-ISR`, `EMB-CONC`, `EMB-ERR`, `EMB-DMA`: embedded rules
- `RTOS-COMMON`, `RTOS-FREERTOS`: RTOS rules
- `TOOL-GCCARM`: GCC Arm toolchain rules
