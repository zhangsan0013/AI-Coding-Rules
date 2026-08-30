/* EMB-BOOT-WATCHDOG-001 violating example. */

extern void wdt_feed(void);

/*
 * The watchdog is fed from a periodic timer that keeps firing regardless of whether the
 * main work is progressing. A deadlocked main loop is never detected, so the watchdog can
 * never reset the hung system.
 */
void systick_isr(void)
{
    wdt_feed();
}
