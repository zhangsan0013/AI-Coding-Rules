/*
 * EMB-CONC-CRITICAL-001 compliant example.
 *
 * Every exit path restores the saved state, so a caller that was already running masked
 * stays masked when this function returns.
 */

#include <stdint.h>

extern uint32_t irq_disable(void);
extern void irq_restore(uint32_t state);

static volatile uint32_t sequence_number;

uint32_t sequence_next(void)
{
    uint32_t state;
    uint32_t value;

    state = irq_disable();
    value = sequence_number + 1u;

    if (value == 0u) {
        irq_restore(state);   /* the early exit restores the caller's state too */
        return 0u;
    }

    sequence_number = value;
    irq_restore(state);
    return value;
}
