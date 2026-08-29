/* EMB-ERR-BOUNDS-001 compliant example. */

#include <stdbool.h>
#include <stdint.h>

extern uint32_t platform_ticks_now(void);
extern bool device_ready(void);

static bool deadline_reached(uint32_t now, uint32_t deadline)
{
    return (int32_t)(now - deadline) >= 0;
}

bool wait_ready(uint32_t deadline)
{
    while (!deadline_reached(platform_ticks_now(), deadline)) {
        if (device_ready()) {
            return true;
        }
    }
    return false;
}
