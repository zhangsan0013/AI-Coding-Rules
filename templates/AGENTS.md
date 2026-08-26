# Embedded Project AI Instructions

## Rule loading

Before changing code:

1. Read `PROJECT_RULES.md` for verified project facts, the selected profile, and exceptions.
2. Read the selected profile under `.ai-rules/profiles/`.
3. Read `.ai-rules/rules/INDEX.md`.
4. Load the always-required modules and only the task-specific modules selected by the index.
5. If omitting a safety-related module is uncertain, load it and state the uncertainty.

## Applying rules

- Treat `.ai-rules/rules/` as the canonical general rule source.
- Apply project facts and approved exceptions using the precedence defined in
  `.ai-rules/docs/architecture.md`.
- Cite the IDs of normative rules that materially affected the change.
- Run the verification named by each applied rule when feasible.
- Report validation that was not run; do not present static inspection as runtime evidence.

Do not load the legacy `.ai-rules/CODING_RULES.md` unless the task explicitly involves
migrating it into canonical rule modules.
