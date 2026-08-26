# FreeRTOS C11 Profile

Status: draft

## Inherits

- [Bare-metal C11](bare-metal-c11.md)

## Environment

- Language: C11
- Runtime: FreeRTOS
- Toolchain: project-defined

## Additional routing

- Load [common RTOS rules](../rules/rtos/common.md) for scheduling, tasks, or synchronization.
- Load [FreeRTOS rules](../rules/rtos/freertos.md) for FreeRTOS interfaces or configuration.

Project configuration such as allocation support and interrupt priority limits belongs in
`PROJECT_RULES.md`.
