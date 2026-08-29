/* EMB-CONC-PUBLISH-001 compliant example. */

#include <stdatomic.h>

static atomic_uint pending = 0U;

void publish_event(void)
{
    atomic_fetch_add_explicit(&pending, 1U, memory_order_release);
}
