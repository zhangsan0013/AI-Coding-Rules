# Project Rules

## Selected profile

`<select one profile under .ai-rules/profiles/>`

## Verified project facts

- MCU or SoC: `<value>`
- Architecture or ISA: `<value>`
- CPU core or variant: `<value>`
- Language standard: `C11`
- Compiler and version: `<value>`
- Toolchain or linker and version: `<value>`
- Runtime or RTOS and version: `<value>`
- Cache configuration: `<value>`
- Allocation policy: `<value>`
- Linker and startup ownership: `<value>`

Remove fields that do not apply. Do not guess unknown facts; mark them `unknown` and identify
how they will be verified.

## Project conventions

No project-specific conventions have been defined yet.

## Verification governance

Record the project-owned verification schema before selecting a risk tier for a change. Do not
invent a default tier or check set; replace each placeholder with the approved project policy.

- Risk tiers and definitions: `<link to the project risk matrix and tier definitions>`
- Mandatory check sets by tier: `<link to the required checks for each tier>`
- Approval policy for omitted checks: `<owner and decision record required>`
- Evidence register: `<path or system that stores command, result, scope, and artifacts>`
- Outstanding-check owner directory: `<team or role responsible for closing target-dependent checks>`
- Public API field parser: `<wrapper that checks parameter, return, ownership, and error fields>`

## Approved exceptions

No exceptions have been approved yet.

Each exception must identify the affected rule ID, scope, reason, approver or decision
record, and any required compensating verification.
