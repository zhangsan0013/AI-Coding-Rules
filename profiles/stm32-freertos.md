# STM32 FreeRTOS Profile

Status: draft

## Inherits

- [FreeRTOS C11](freertos-c11.md)

## Environment

- Platform family: STM32
- Runtime: FreeRTOS
- Architecture family: Arm
- Toolchain: project-defined

## Baseline

- [Arm architecture](../rules/architecture/arm.md)

## Conditional routing

- Load [register access](../rules/embedded/register-access.md) for peripheral access.
- Load [DMA and cache](../rules/embedded/dma-and-cache.md) only when DMA or cache applies.

The exact MCU, core, ISA/ABI facts, cache configuration, HAL or LL usage, toolchain, and
linker layout must be stated in `PROJECT_RULES.md`; this profile does not guess them.
