# RTOS C11 Profile

Status: provisional

## Environment

- Language: C11
- Runtime: RTOS, required and selected by project facts
- Architecture: project-defined
- Toolchain: project-defined

## Baseline

- [Core correctness](../rules/core/correctness.md)
- [Change policy](../rules/core/change-policy.md)
- [C11 style](../rules/c11/style.md)
- [C11 naming](../rules/c11/naming.md)
- [Embedded memory](../rules/embedded/memory.md)
- [RTOS common](../rules/rtos/common.md)

This repository supports RTOS-based firmware only. Hardware-facing modules remain
available for RTOS projects and are selected by task signals when a change touches
registers, interrupts, DMA, startup, representation, architecture, or toolchain behavior.

## Context budget

The baseline IDs remain the canonical selection. Use the `context` command's `summary` stage
for the first pass, then request only the matching rule sections and load evidence separately.
The default project-rule budget is 6,000 estimated tokens; 8,000 is the hard maximum. This
limits prompt growth without removing any rule from the installed library.

## Runtime adapters

Select one vendor adapter when applicable:

- [FreeRTOS](../rules/rtos/freertos.md)
- [RT-Thread](../rules/rtos/rt-thread.md)
- [ThreadX](../rules/rtos/threadx.md)

The adapter must be selected independently from the architecture and toolchain.
