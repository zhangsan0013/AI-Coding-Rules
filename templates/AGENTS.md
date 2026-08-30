# Embedded Project AI Instructions

## Rule loading

Before changing code:

1. Read `PROJECT_RULES.md` for verified project facts, the selected profile, and exceptions.
2. Run `npx @zhangsan0013/ai-coding-rules context --stage summary --budget 6000` with every
   applicable task signal. The result is a bounded navigation view, not a second rule source.
3. Read only the selected rule sections with `--stage rules --rule <RULE-ID>` or
   `--stage rules --module <MODULE-ID>`.
4. Load `--stage evidence` only when examples, detailed verification, or external fixtures are
   needed for the current change.
5. If omitting a safety-related rule is uncertain, load it and state the uncertainty instead of
   silently proceeding.

## Applying rules

- Treat `.ai-rules/rules/` as the canonical general rule source.
- Apply project facts and approved exceptions using the precedence defined in
  `.ai-rules/docs/architecture.md`.
- Cite the IDs of normative rules that materially affected the change.
- Run the verification named by each applied rule when feasible.
- Report validation that was not run; do not present static inspection as runtime evidence.
