# Bare-Metal C11 Profile

Status: active

## Environment

- Language: C11
- Runtime: bare metal
- RTOS: none
- Toolchain: project-defined

## Always active

- [Correctness](../rules/core/correctness.md)
- [Change policy](../rules/core/change-policy.md)
- [C11 style](../rules/c11/style.md)
- [Naming](../rules/c11/naming.md)

## Enabled routing areas

- [C11 interfaces and preprocessor](../rules/INDEX.md#c-source-or-header-changes)
- [Embedded concerns](../rules/INDEX.md#embedded-concerns), which are currently draft
  modules and are not included in the active coverage baseline.

Conditional modules are loaded on demand through `rules/catalog.json` and `rules/INDEX.md`.
