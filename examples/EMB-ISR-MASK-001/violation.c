/*
 * EMB-ISR-MASK-001 violating example.
 *
 * Two defects on two different paths:
 *   1. The early return leaves interrupts masked, so the caller's system is dead.
 *   2. The normal path enables unconditionally, so a caller that had already masked
 *      interrupts has them silently re-enabled and its own atomicity assumption breaks.
 */

#include <stdint.h>

extern uint32_t irq_disable(void);
extern void irq_enable(void);

static volatile uint32_t sequence_number;

uint32_t sequence_next(void)
{
    uint32_t value;

    irq_disable();   /* the saved state is discarded, which is the defect */
    value = sequence_number + 1u;

    if (value == 0u) {
        return 0u;   /* returns with interrupts still masked */
    }

    sequence_number = value;
    irq_enable();    /* re-enables even when the caller was masked */
    return value;
}
