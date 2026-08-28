# Bare-Metal C11 Profile

Status: active

## Inherits

- [Embedded C11](embedded-c11.md)

## Environment

- Language: C11
- Runtime: bare metal
- RTOS: none
- Architecture: project-defined
- Toolchain: project-defined

## Runtime selection

No RTOS module is selected by this profile. Load RTOS modules only when the project uses an
RTOS.

## Enabled routing areas

- [C11 interfaces and preprocessor](../rules/INDEX.md#c-source-or-header-changes)
- [Embedded concerns](../rules/INDEX.md#embedded-concerns), which are currently draft
  modules and are not included in the active coverage baseline.

Conditional modules are loaded on demand through `rules/catalog.json` and `rules/INDEX.md`.
