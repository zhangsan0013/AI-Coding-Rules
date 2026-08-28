<!-- AI-CODING-RULES:BEGIN -->
## AI Coding Rules

Before changing code in this project:

1. Read `PROJECT_RULES.md` for verified project facts and approved exceptions.
2. Read `.ai-rules/profiles/bare-metal-c11.md` for the selected project baseline.
3. Read `.ai-rules/rules/INDEX.md` for the routing vocabulary.
4. Use `.ai-rules/rules/catalog.json` or the resolver to identify the module IDs
   selected by the profile and the current task signals.
5. Load the always-required modules and only the task-specific modules that apply.
6. If omitting a safety-related module is uncertain, load it and state the uncertainty.

Treat `.ai-rules/rules/` as the canonical general rule source. Apply project facts and
approved exceptions using the precedence defined in `.ai-rules/docs/architecture.md`.
Cite materially applied rule IDs, run the verification named by each applied rule when
feasible, and report validation that was not run.

Do not load the legacy `.ai-rules/CODING_RULES.md` unless the task explicitly involves
migrating it into canonical rule modules.

Selected profile: `.ai-rules/profiles/bare-metal-c11.md`
<!-- AI-CODING-RULES:END -->
