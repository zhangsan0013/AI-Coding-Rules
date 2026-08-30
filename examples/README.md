# Rule Examples

Store larger examples by rule ID:

```text
examples/
  <RULE-ID>/
    compliant.c
    violation.c
```

Each directory demonstrates one canonical rule and must contain both files. External examples
are tiered evidence: every `MUST` has an inline pair, while directories are required for rules
that need compiler or executable proof and for representative high-risk scenarios in each
module. Examples must not introduce requirements that are absent from the corresponding
canonical rule module.
