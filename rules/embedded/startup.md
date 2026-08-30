# Startup and Runtime-Health Rules

Status: provisional

## Scope

The assumptions code makes about the state it starts in, and the health mechanisms that run
for the life of the program: C runtime startup (`.data`/`.bss`), the watchdog, and the
brief window before either is established.

## Load when

Writing startup code, early initialization, a watchdog interaction, or any code that runs
before `main` or before the scheduler starts.

## Project facts this module depends on

- Which memory regions the startup code initializes, and which it does not.
- The watchdog timeout, who services it, and what a reset from it must leave recoverable.
- The order in which clocks, memory, the C runtime, and drivers become available at boot.

Record these in `PROJECT_RULES.md`; startup is where "it works on my board" and "it works"
diverge most.

## Rules

### EMB-BOOT-STARTUP-001 [MUST]

Code MUST NOT run before the C runtime has initialized the memory it uses. A variable read
before `.data`/`.bss` setup completes MUST be one the startup path itself sets.

- Applies when: Writing a reset handler, an early clock or memory init, a constructor-like hook, or anything reachable before the runtime startup finishes.
- Rationale: `.data` holds initialized statics that startup copies from flash; `.bss` holds zero-initialized statics that startup clears. Before that copy-and-clear runs, a static variable holds whatever was in RAM at reset. Early code that reads one — a "already initialized" flag, a cached handle — sees garbage on a cold boot and often the previous value on a warm one, which is why it passes in testing.
- Verification (agent): Trace every function reachable before runtime init and inventory its global/static reads. Pass when each read is either explicitly set on the reset path or in a startup-excluded section; artifact: early-call graph and section map.
- Verification (target): Using the `PROJECT_RULES.md` `boot-runtime-init` configuration, cold-boot with RAM deliberately non-zero, then inspect the target map's copy/zero loops. Pass when early behavior is identical to the initialized reference and no pre-init read depends on stale RAM in 100% of boots; artifact: boot log, map, startup trace, and configuration snapshot.
- Exceptions: A variable in a startup-excluded section or explicitly set by reset MAY be used only when section, initialization point, owner, and review condition are recorded.

Correct:

```c
#include <stdint.h>

/*
 * Placed in a no-init section the startup loops do not touch, so the value
 * captured before them survives the .data copy and .bss zero that follow.
 * PROJECT_RULES records the section and its exclusion from startup init; an
 * ordinary static would be cleared by startup_zero_bss() right after the write.
 */
extern uint32_t reset_reason __attribute__((section(".noinit")));

void Reset_Handler(void)
{
    reset_reason = read_reset_cause_register();   /* register read into no-init storage */
    startup_copy_data();
    startup_zero_bss();
    main();
}
```

Incorrect:

```c
#include <stdbool.h>

static bool clocks_ready = false;   /* lives in .bss, not yet zeroed here */

void Reset_Handler(void)
{
    if (!clocks_ready) {            /* reads .bss before it is cleared: value is garbage */
        configure_clocks();
        clocks_ready = true;
    }
    startup_zero_bss();            /* only now is clocks_ready defined */
    main();
}
```

### EMB-BOOT-WATCHDOG-001 [MUST]

A watchdog MUST be serviced only from a place that proves the system is making progress, not
from a timer or interrupt that runs regardless of whether the main work is advancing.

- Applies when: Enabling, configuring, or servicing a watchdog, or adding a long-running operation between two services.
- Rationale: The watchdog exists to reset a hung system. Servicing it from a periodic timer defeats it exactly when it is needed: the timer keeps firing while the main loop is deadlocked, so the watchdog never trips and the hang is permanent. The service has to be gated on evidence that the work it protects is still running.
- Verification (agent): Trace every watchdog service call to a progress witness (check-in, completed iteration, or equivalent) and reject unconditional timer/ISR paths. Pass when each feed is dominated by a fresh witness from every monitored unit; artifact: call graph and progress-gate table.
- Verification (target): Using the `PROJECT_RULES.md` `watchdog-progress` configuration, force a hang in each monitored path. Pass when the watchdog reset occurs within the configured timeout window and no feed occurs after the witness stops in 100% of injected hangs; artifact: reset-cause log, watchdog timing trace, and configuration snapshot.
- Exceptions: A windowed or multi-stage watchdog MAY be serviced by a supervisor only when it independently verifies each monitored unit and records owner, witness, timeout, and review condition.

Correct:

```c
#include <stdatomic.h>
#include <stdbool.h>
#include <stdint.h>

/*
 * Each monitored task publishes its check-in with an atomic store; the
 * supervisor consumes with an atomic exchange. The atomic access satisfies
 * EMB-CONC-RACE-001 for this shared array. A check-in landing during the clear
 * window is simply re-issued next cycle, which is the intended progress gate.
 */
extern atomic_bool task_checked_in[TASK_COUNT];
extern void wdt_feed(void);

void supervisor_step(void)
{
    for (uint32_t i = 0U; i < TASK_COUNT; i++) {
        if (!atomic_load_explicit(&task_checked_in[i], memory_order_acquire)) {
            return;   /* a stalled task withholds the feed, so the watchdog trips */
        }
    }

    for (uint32_t i = 0U; i < TASK_COUNT; i++) {
        atomic_store_explicit(&task_checked_in[i], false, memory_order_relaxed);
    }
    wdt_feed();
}
```

Incorrect:

```c
extern void wdt_feed(void);

void systick_isr(void)
{
    /* Fires on the timer regardless of whether any real work is progressing, */
    /* so a deadlocked main loop is never detected. */
    wdt_feed();
}
```

### EMB-BOOT-BRINGUP-001 [MUST]

A resource MUST NOT be used until its initialization path has observed the documented ready
or lock state for that resource.

- Applies when: Sequencing clock, power, memory-controller, or peripheral initialization at boot.
- Rationale: Boot order is a dependency graph, not a list. Using a peripheral before its clock is enabled reads back zeros or faults; proceeding past a PLL-enable before the lock bit sets runs the whole system at the wrong frequency. The missing readiness observation erases the evidence and makes the later failure look random.
- Verification (agent): Build the startup dependency graph and map each resource use to the ready/lock observation that dominates it. Pass when every dependent use is reachable only through the documented ready state and each readiness wait has a finite result; artifact: bring-up sequence and readiness table.
- Verification (target): Using the `PROJECT_RULES.md` `boot-bringup` configuration, cold-boot across the supported voltage and temperature corners. Pass when every dependent step executes only after its ready/lock state is observed and all waits terminate within the recorded bound in 100% of boots; artifact: boot trace, status samples, and configuration snapshot.
- Exceptions: A synchronously effective step MAY omit a readiness wait only when the reference-manual clause, owner, affected dependency, and review condition are recorded.

Correct:

```c
#include <stdbool.h>

extern bool pll_locked(void);

bool clock_init(void)
{
    pll_enable();

    for (uint32_t i = 0U; i < PLL_LOCK_TIMEOUT; i++) {
        if (pll_locked()) {
            clock_select_pll();   /* only switch after lock is confirmed */
            return true;
        }
    }

    return false;   /* bounded wait: report failure rather than run unlocked */
}
```

Incorrect:

```c
void clock_init(void)
{
    pll_enable();
    clock_select_pll();   /* switches before the PLL has locked: wrong frequency */
}
```

## Module examples

See the larger [compliant](../../examples/EMB-BOOT-WATCHDOG-001/compliant.c) and
[violating](../../examples/EMB-BOOT-WATCHDOG-001/violation.c) examples.
