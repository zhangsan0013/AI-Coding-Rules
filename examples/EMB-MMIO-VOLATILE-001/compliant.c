/* EMB-MMIO-VOLATILE-001 compliant example. */

#include <stdint.h>

typedef struct {
    volatile uint32_t status;
} peripheral_regs_t;

static peripheral_regs_t *const peripheral =
    (peripheral_regs_t *)(uintptr_t)0x40000000U;

uint32_t peripheral_status_read(void)
{
    return peripheral->status;
}
