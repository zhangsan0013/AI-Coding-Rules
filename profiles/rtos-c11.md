# RTOS C11 Profile

Status: draft

## Inherits

- [Embedded C11](embedded-c11.md)

## Environment

- Language: C11
- Runtime: RTOS, selected by project facts
- Architecture: project-defined
- Toolchain: project-defined

## Baseline

- [RTOS common](../rules/rtos/common.md)

## Runtime adapters

Select one vendor adapter when applicable:

- [FreeRTOS](../rules/rtos/freertos.md)
- [RT-Thread](../rules/rtos/rt-thread.md)
- [ThreadX](../rules/rtos/threadx.md)

The adapter must be selected independently from the architecture and toolchain.
