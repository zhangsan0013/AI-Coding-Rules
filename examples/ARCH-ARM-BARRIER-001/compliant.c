/* ARCH-ARM-BARRIER-001 compliant example. */

extern void arm_dmb_for_shared_memory(void);

void publish_descriptor(unsigned *ready, unsigned *descriptor)
{
    *descriptor = 1U;
    arm_dmb_for_shared_memory();
    *ready = 1U;
}
