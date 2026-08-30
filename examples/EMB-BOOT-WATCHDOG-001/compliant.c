/* EMB-BOOT-WATCHDOG-001 compliant example. */

#include <stdatomic.h>
#include <stdbool.h>
#include <stdint.h>

#define TASK_COUNT 3U

/*
 * Each monitored task publishes its check-in with an atomic store when it completes a unit
 * of work; the supervisor consumes with an atomic load and clear. The atomic access is the
 * synchronization protocol EMB-CONC-RACE-001 requires for this cross-context array.
 */
atomic_bool task_checked_in[TASK_COUNT];

extern void wdt_feed(void);

/*
 * The watchdog is fed only after every task has checked in. A stalled task withholds its
 * flag, the feed is skipped, and the watchdog trips: exactly the case it exists to catch.
 */
void supervisor_step(void)
{
    for (uint32_t i = 0U; i < TASK_COUNT; i++) {
        if (!atomic_load_explicit(&task_checked_in[i], memory_order_acquire)) {
            return;
        }
    }

    for (uint32_t i = 0U; i < TASK_COUNT; i++) {
        atomic_store_explicit(&task_checked_in[i], false, memory_order_relaxed);
    }
    wdt_feed();
}
