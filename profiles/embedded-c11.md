# Embedded C11 Profile

Status: active

## Purpose

Language and change-policy baseline for embedded C11 projects. Runtime, architecture, and
toolchain choices are selected independently through project facts and task signals.

## Always active

- [Correctness](../rules/core/correctness.md)
- [Change policy](../rules/core/change-policy.md)
- [C11 style](../rules/c11/style.md)
- [Naming](../rules/c11/naming.md)

## Selectors

Use [rules/INDEX.md](../rules/INDEX.md) and `rules/catalog.json` to add the applicable
embedded, RTOS, architecture, and toolchain modules. Do not infer a platform or compiler
from the selected profile.
