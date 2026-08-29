/* TOOL-GCC-LTO-001 compliant example. */

typedef void (*driver_init_fn)(void);

extern void project_driver_init(void);

__attribute__((used, section(".driver_table")))
static const driver_init_fn driver_registration = project_driver_init;

void call_registered_driver(void)
{
    driver_registration();
}
