# Project Rules

## Selected profile

`bare-metal-c11`

## Verified project facts

- MCU or SoC: host simulation; no MCU
- CPU core: x86_64 host
- Language standard: `C11`
- Toolchain and version: GCC 16.2.0 (MSYS2 UCRT64)
- Runtime or RTOS: none
- Cache configuration: host-managed; no target cache contract
- Allocation policy: no dynamic allocation
- Linker and startup ownership: host compiler and C runtime; no custom linker or startup

Remove fields that do not apply. Do not guess unknown facts; mark them `unknown` and identify
how they will be verified.

## Project conventions

The counter module owns its state privately. Public operations return explicit status
values and leave the counter unchanged when an operation fails.

## Approved exceptions

No exceptions have been approved yet.

Each exception must identify the affected rule ID, scope, reason, approver or decision
record, and any required compensating verification.
