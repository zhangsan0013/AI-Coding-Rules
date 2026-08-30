# Bare-Metal C11 Profile

Status: provisional

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

## Always active

Inherited from [Embedded C11](embedded-c11.md), plus:

- [Register access](../rules/embedded/register-access.md)
- [Startup](../rules/embedded/startup.md)

Every change on a bare-metal target touches or is constrained by memory-mapped hardware, so
this module is not signal-gated here.

## Enabled routing areas

- [C11 interfaces and preprocessor](../rules/INDEX.md#c-source-or-header-changes)
- [Embedded concerns](../rules/INDEX.md#embedded-concerns)

Conditional modules are loaded on demand through `rules/catalog.json` and `rules/INDEX.md`.

## Review status

This profile and its embedded modules are `provisional`: the rules are complete and carry
compiled examples, but no domain owner has signed them. Apply them, and report them as
unreviewed rather than as safety coverage.
