/* EMB-ERR-BOUNDS-001 violating example. */

extern int device_ready(void);

void wait_ready(void)
{
    while (!device_ready()) {
    }
}
