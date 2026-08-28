# RTOS Common Rules

Status: draft

## Scope

Scheduling, task lifecycle, blocking, priority inversion, resource ownership, and task
stack use independent of a specific RTOS, architecture, or compiler.

## Load when

Changing tasks, synchronization primitives, scheduling behavior, or cross-context data flow.

## Adapter boundary

This module defines runtime-independent behavior. Vendor modules such as FreeRTOS,
RT-Thread, and ThreadX add only API-specific or configuration-specific rules.

## Rules

No normative rules have been defined yet.
