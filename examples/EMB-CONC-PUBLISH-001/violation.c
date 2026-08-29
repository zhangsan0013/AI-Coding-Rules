/* EMB-CONC-PUBLISH-001 violating example. */

#include <stdbool.h>

static volatile bool event_ready = false;
static unsigned event_value;

void publish_event(unsigned value)
{
    event_value = value;
    event_ready = true;
}
