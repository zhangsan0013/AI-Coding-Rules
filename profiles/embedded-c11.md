# Embedded C11 Profile

Status: provisional

## Purpose

Language and change-policy baseline for embedded C11 projects. Runtime, architecture, and
toolchain choices are selected independently through project facts and task signals.

## Always active

- [Correctness](../rules/core/correctness.md)
- [Change policy](../rules/core/change-policy.md)
- [C11 style](../rules/c11/style.md)
- [Naming](../rules/c11/naming.md)
- [Memory](../rules/embedded/memory.md)

Memory is unconditional because its constraints follow from the target, not from the task: a
fixed RAM budget and no heap apply to every change, including ones that allocate nothing.

## Selectors

Use [rules/INDEX.md](../rules/INDEX.md) and `rules/catalog.json` to add the applicable
embedded, RTOS, architecture, and toolchain modules. Do not infer a platform or compiler
from the selected profile.

## Review status

This profile is `provisional` because its baseline includes an embedded module that has not
passed domain-owner review. Apply those rules, and report them as unreviewed rather than as
safety coverage.
