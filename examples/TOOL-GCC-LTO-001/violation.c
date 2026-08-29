/* TOOL-GCC-LTO-001 violating example. */

typedef void (*driver_init_fn)(void);

extern void project_driver_init(void);

static const driver_init_fn driver_registration = project_driver_init;
